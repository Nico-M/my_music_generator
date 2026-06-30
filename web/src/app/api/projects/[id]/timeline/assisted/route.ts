// POST /api/projects/[id]/timeline/assisted — match user lines to ASR word timestamps
// Uses transcriptJson from the project to fuzzy-match each line

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assistedLayout } from '@/lib/assisted-layout';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Load project with lines
    const project = await prisma.project.findUnique({
      where: { id },
      include: { lines: { orderBy: { index: 'asc' } } },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.transcriptJson) {
      return NextResponse.json(
        { error: '请先运行识别歌词 (Run ASR transcription first)' },
        { status: 400 }
      );
    }

    if (project.lines.length === 0) {
      return NextResponse.json({ error: 'No lyrics to align' }, { status: 400 });
    }

    // Parse transcript data
    const transcriptData = JSON.parse(project.transcriptJson);

    // Run assisted layout on ALL lines (regardless of source)
    const allLines = project.lines.map((l) => ({
      index: l.index,
      text: l.text,
    }));
    const { results, summary } = assistedLayout(allLines, transcriptData, project.durationMs);

    // Write results back to DB: set source = 'transcribed-aligned'
    for (const line of results) {
      const existingLine = project.lines[line.index];
      if (existingLine) {
        await prisma.lyricLine.update({
          where: { id: existingLine.id },
          data: {
            startMs: line.startMs > 0 ? line.startMs : null,
            endMs: line.endMs > 0 ? line.endMs : null,
            source: 'transcribed-aligned',
            confidence: line.confidence,
          },
        });
      }
    }

    return NextResponse.json({ lines: results, summary });
  } catch (err) {
    console.error('Assisted layout error:', err);
    return NextResponse.json({ error: 'Failed to compute assisted layout' }, { status: 500 });
  }
}
