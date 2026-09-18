import { MINIMAX_ASR_URL } from '@/lib/ai-settings';

/** One character (Chinese) or word (Latin) with its position in the audio. */
export interface AsrUnit {
  text: string;
  startMs: number;
  endMs: number;
}

export interface AsrResult {
  text: string;
  durationMs: number;
  units: AsrUnit[];
}

export type AsrFailure =
  | { kind: 'auth'; message: string }
  | { kind: 'tooLarge'; message: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'upstream'; message: string }
  | { kind: 'empty'; message: string };

export type AsrOutcome =
  | { ok: true; result: AsrResult }
  | { ok: false; error: AsrFailure };

interface MiniMaxWordUnit {
  start: number;
  end: number;
  text: string;
}

interface MiniMaxResponse {
  text?: string;
  duration?: number;
  segments?: MiniMaxWordUnit[];
  base_resp?: { status_code?: number; status_msg?: string };
  error?: { message?: string };
}

/**
 * Transcribe audio with MiniMax ASR at word level.
 *
 * Always requests `verbose_json` with `timestamp_level=word`: that is the only
 * response shape that yields per-character timings. The sentence-level
 * (`srt` / `vtt` / default `verbose_json`) view merges sung phrases into a
 * handful of multi-line blocks and cannot be split back into lyric lines.
 */
export async function transcribeWithMiniMax(
  audio: Blob,
  fileName: string,
  apiKey: string,
): Promise<AsrOutcome> {
  const form = new FormData();
  form.append('model', 'asr-1.0');
  form.append('file', audio, fileName);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_level', 'word');

  let res: Response;
  try {
    res = await fetch(MINIMAX_ASR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        language: 'zh',
      },
      body: form,
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'upstream',
        message: `无法连接识别服务：${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  const raw = (await res.json().catch(() => null)) as MiniMaxResponse | null;

  if (!res.ok) {
    if (res.status === 401 || raw?.base_resp?.status_code === 1004) {
      return { ok: false, error: { kind: 'auth', message: 'API Key 无效或已失效' } };
    }
    if (res.status === 413) {
      return { ok: false, error: { kind: 'tooLarge', message: '音频文件超过接口 50MB 上限' } };
    }
    if (res.status === 400) {
      return {
        ok: false,
        error: { kind: 'rejected', message: '音频不符合接口要求（时长需在 500 秒以内）' },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'upstream',
        message:
          raw?.error?.message ?? raw?.base_resp?.status_msg ?? `识别失败（HTTP ${res.status}）`,
      },
    };
  }

  const segments = Array.isArray(raw?.segments) ? raw.segments : [];
  if (segments.length === 0) {
    return { ok: false, error: { kind: 'empty', message: '识别结果为空，请确认音频中有清晰人声' } };
  }

  return {
    ok: true,
    result: {
      text: raw?.text ?? '',
      durationMs: Math.round((raw?.duration ?? 0) * 1000),
      units: segments.map((s) => ({
        text: s.text ?? '',
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
      })),
    },
  };
}
