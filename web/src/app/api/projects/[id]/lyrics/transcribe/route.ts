// POST /api/projects/[id]/lyrics/transcribe — start ASR transcription job
// Creates a Job(type="transcribe") for the Python worker to pick up

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists and has audio
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.audioPath) {
      return NextResponse.json({ error: 'Project has no audio file' }, { status: 400 });
    }

    // Create transcribe job
    const job = await prisma.job.create({
      data: {
        type: 'transcribe',
        status: 'queued',
        projectId: id,
      },
    });

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error('Transcribe start error:', err);
    return NextResponse.json({ error: 'Failed to start transcription' }, { status: 500 });
  }
}
