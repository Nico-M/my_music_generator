// GET /api/jobs/[id] — get job status (for polling from frontend)
//
// For align jobs backed by a remote singing-aligner service, this endpoint
// proxies the remote status and writes aligned lines to the local database
// when the remote job completes.  This makes the existing frontend polling
// (every 2 s via useJobs) work transparently with remote jobs.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRemoteAlignUrl, syncRemoteJobToLocal } from '@/lib/remote-align';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        error: true,
        resultPath: true,
        params: true,
        createdAt: true,
        updatedAt: true,
        projectId: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If this is a remote-backed align job that hasn't finished yet, sync
    // the remote status to the local database on each poll.
    if (
      job.type === 'align' &&
      (job.status === 'queued' || job.status === 'running') &&
      job.params &&
      getRemoteAlignUrl()
    ) {
      try {
        const parsed = JSON.parse(job.params);
        if (parsed.remoteJobId) {
          await syncRemoteJobToLocal(job.id, parsed.remoteJobId, job.projectId);

          // Re-read after sync (status may have changed)
          const updated = await prisma.job.findUnique({
            where: { id: job.id },
            select: {
              id: true,
              type: true,
              status: true,
              error: true,
              resultPath: true,
              params: true,
              createdAt: true,
              updatedAt: true,
              projectId: true,
            },
          });
          if (updated) {
            return NextResponse.json(updated);
          }
        }
      } catch {
        // If parsing fails or sync errors, just return the current state
        // so the frontend doesn't break.
      }
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error('Job status error:', err);
    return NextResponse.json({ error: 'Failed to get job status' }, { status: 500 });
  }
}
