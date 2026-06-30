// POST /api/projects/[id]/timeline/align — start Python-based alignment job
// Creates a Job(type="align") for the Python worker to pick up
// Uses pinyin-aware matching (pypinyin + rapidfuzz) for much higher accuracy
// than the JS-based assisted endpoint

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists, has lines and transcript
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

    // Create align job
    const job = await prisma.job.create({
      data: {
        type: 'align',
        status: 'queued',
        projectId: id,
      },
    });

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error('Align start error:', err);
    return NextResponse.json({ error: 'Failed to start alignment' }, { status: 500 });
  }
}
