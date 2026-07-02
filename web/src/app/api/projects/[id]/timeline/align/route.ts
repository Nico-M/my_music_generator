// POST /api/projects/[id]/timeline/align — start alignment job
//
// When REMOTE_ALIGN_URL is set, uploads audio to the remote singing-aligner
// service (Demucs + faster-whisper on the server).  Otherwise creates a local
// queued Job for the local Python worker to pick up.
//
// Remote flow:
//   1. POST  → upload audio, returns { jobId, remoteJobId }
//   2. Frontend polls GET /api/jobs/{jobId} every 2 s
//   3. Background sync writes aligned lines to DB when remote completes
//   4. GET /api/projects/[id]/timeline/align/[remoteJobId] also available
//      for manual / fallback sync

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getRemoteAlignUrl,
  isRemoteAlignEnabled,
  startRemoteAlign,
  pollRemoteUntilDone,
} from '@/lib/remote-align';

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
        { status: 400 },
      );
    }

    if (project.lines.length === 0) {
      return NextResponse.json({ error: 'No lyrics to align' }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Remote align (preferred)
    // -----------------------------------------------------------------------
    if (isRemoteAlignEnabled()) {
      const remoteUrl = getRemoteAlignUrl()!;
      const lyrics = project.lines.map((l) => l.text);

      console.log(`[align] uploading to remote align service: ${remoteUrl}`);

      // 1. Upload audio + lyrics + duration to remote service
      const { job_id: remoteJobId } = await startRemoteAlign(
        project.audioPath,
        lyrics,
        project.durationMs ?? undefined,
      );

      console.log(`[align] remote job started: ${remoteJobId}`);

      // 2. Create local Job record mapping to the remote job
      const job = await prisma.job.create({
        data: {
          type: 'align',
          status: 'running',
          projectId: id,
          params: JSON.stringify({ remoteJobId, remoteUrl }),
        },
      });

      // 3. Start background polling (fire-and-forget) — writes to DB on completion
      pollRemoteUntilDone(job.id, remoteJobId, id).catch((err) => {
        console.error(`[align] background poll failed for job ${job.id}:`, err);
      });

      return NextResponse.json(
        { jobId: job.id, remoteJobId },
        { status: 202 },
      );
    }

    // -----------------------------------------------------------------------
    // Fallback: local queued job (original behaviour)
    // -----------------------------------------------------------------------
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
    const message = err instanceof Error ? err.message : 'Failed to start alignment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
