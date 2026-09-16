// POST /api/projects/[id]/lyrics/transcribe — recognize lyrics and align them
//
// Two sources, each doing what it is good at:
//   MiniMax ASR      → per-character timings for *this* recording
//   lrc.cx library   → the correct lyric text
//
// The library's own timings are deliberately discarded: they belong to the
// studio release, whereas the audio here is the user's own performance. Text
// from the library is mapped onto the ASR timings by pinyin alignment (which
// also bridges simplified/traditional differences).
//
// When the library has no match — or matches too loosely to trust — the raw
// ASR transcript is used and the response says so, because those lyrics are
// recognizer output and may contain wrong characters.

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { UPLOADS_DIR } from '@/lib/paths';
import { transcribeWithMiniMax } from '@/lib/minimax-asr';
import { punctuateLyrics } from '@/lib/minimax-llm';
import { buildRowsFromPunctuation, singleRowFromUnits } from '@/lib/lyric-rows';
import { fetchLrc } from '@/lib/lrc';
import { alignLrcToAsr } from '@/lib/lyric-align';
import { MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_MS } from '@/lib/ai-settings';

export interface TranscribeNotice {
  kind: 'lrc-miss' | 'lrc-mismatch';
  message: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const settings = body.settings as Record<string, unknown> | undefined;
  const apiKey = typeof settings?.apiKey === 'string' ? settings.apiKey.trim() : '';
  if (!apiKey) {
    return NextResponse.json({ error: 'API Key 未配置' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.audioPath) {
    return NextResponse.json({ error: 'Project has no audio file' }, { status: 400 });
  }
  if (project.durationMs > MAX_AUDIO_DURATION_MS) {
    return NextResponse.json(
      { error: `音频时长 ${Math.round(project.durationMs / 1000)} 秒超过接口 500 秒上限` },
      { status: 400 },
    );
  }

  const filePath = path.join(UPLOADS_DIR, path.basename(project.audioPath));
  let audio: Buffer;
  try {
    audio = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: '音频文件不存在' }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `音频文件 ${(audio.byteLength / 1024 / 1024).toFixed(1)}MB 超过接口 50MB 上限` },
      { status: 400 },
    );
  }

  const job = await prisma.job.create({
    data: { type: 'transcribe', status: 'running', projectId: id },
  });

  const fail = async (message: string) => {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'failed', error: message },
    });
    return NextResponse.json({ jobId: job.id, error: message }, { status: 502 });
  };

  try {
    const asr = await transcribeWithMiniMax(
      new Blob([new Uint8Array(audio)]),
      path.basename(filePath),
      apiKey,
    );
    if (!asr.ok) return fail(asr.error.message);
    const units = asr.result.units;
    if (units.length === 0) return fail('识别结果为空，请确认音频中有清晰人声');

    const last = units[units.length - 1];
    console.log(
      `[transcribe] ASR: ${units.length} units, ` +
        `coverage ${units[0].startMs}-${last.endMs}ms, duration ${asr.result.durationMs}ms`,
    );

    let rows: Array<{ text: string; startMs: number; endMs: number }> | null = null;
    let notice: TranscribeNotice | undefined;

    const lrc = await fetchLrc(project.title, project.singer);

    if (lrc.ok) {
      const result = alignLrcToAsr(units, lrc.result.lines);
      console.log(
        `[transcribe] LRC "${project.title}": ${lrc.result.lines.length} lines, ` +
          `match ${(result.matchRate * 100).toFixed(1)}%` +
          (result.reason ? `, rejected: ${result.reason}` : ''),
      );
      if (result.rows.length > 0) {
        rows = result.rows;
      } else {
        notice = {
          kind: 'lrc-mismatch',
          message: `找到歌词库内容但与本录音对不上（匹配度 ${Math.round(result.matchRate * 100)}%），已改用语音识别结果`,
        };
      }
    } else {
      console.log(`[transcribe] LRC lookup failed: ${lrc.reason}`);
      notice = {
        kind: 'lrc-miss',
        message: `歌词库未找到「${project.title}」，当前歌词来自语音识别，可能有错字，请手动校正`,
      };
    }

    // Fallback: lyrics library had nothing trustworthy, so the recognizer's own
    // text is the best available. It carries no punctuation, so the LLM is
    // asked to insert breaks; if that fails or returns a different character
    // count, the transcript stays as one row rather than being guessed at.
    const aligned = rows !== null;
    if (!rows) {
      const rawText = units.map((u) => u.text).join('');
      const punctuated = await punctuateLyrics(rawText, apiKey);
      if (punctuated.ok) {
        const built = buildRowsFromPunctuation(units, punctuated.result.text);
        if (built.mismatch) {
          console.warn(`[transcribe] punctuation rejected: ${built.mismatch}`);
        } else {
          rows = built.rows;
        }
      } else {
        console.warn(`[transcribe] punctuation unavailable: ${punctuated.reason}`);
      }
    }
    if (!rows) {
      const single = singleRowFromUnits(units);
      if (single.length === 0) return fail('识别结果中没有可用的歌词文字');
      rows = single;
    }

    console.log(
      `[transcribe] ${aligned ? 'aligned' : 'fallback'}: ${rows.length} rows\n` +
        rows.map((r, i) => `  ${i}: ${r.startMs}-${r.endMs}  ${r.text}`).join('\n'),
    );

    await prisma.$transaction([
      prisma.lyricLine.deleteMany({ where: { projectId: id } }),
      prisma.lyricLine.createMany({
        data: rows.map((row, index) => ({
          projectId: id,
          index,
          text: row.text,
          startMs: row.startMs,
          endMs: row.endMs,
          source: aligned ? 'lrc-aligned' : 'transcribed',
        })),
      }),
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'done', params: notice ? JSON.stringify({ notice }) : null },
      }),
    ]);

    return NextResponse.json({ jobId: job.id, rows: rows.length, aligned, notice });
  } catch (err) {
    console.error('Transcribe error:', err);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'failed', error: '识别过程出错' },
    });
    return NextResponse.json({ error: 'Failed to transcribe' }, { status: 500 });
  }
}
