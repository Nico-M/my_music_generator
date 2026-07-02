// GET /api/projects/[id]/timeline/align/[remoteJobId]
//
// Poll the remote align service for job status and, when complete, write
// the aligned lines into the local database.
//
// The frontend can call this to manually trigger sync; the background poll
// started by the POST handler does this automatically, so this route is
// mainly a fallback / diagnostic endpoint.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getRemoteAlignUrl,
  syncRemoteJobToLocal,
  checkRemoteJob,
} from '@/lib/remote-align';

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; remoteJobId: string }> },
) {
  try {
    const { id: projectId, remoteJobId } = await params;

    // Find the local Job that maps to this remoteJobId
    const localJob = await prisma.job.findFirst({
      where: {
        projectId,
        type: 'align',
        params: { contains: remoteJobId },
      },
    });

    if (!localJob) {
      // No local mapping — just proxy the remote status
      const remoteUrl = getRemoteAlignUrl();
      if (!remoteUrl) {
        return NextResponse.json(
          { error: 'REMOTE_ALIGN_URL not configured and no local job found' },
          { status: 400 },
        );
      }

      const remote = await checkRemoteJob(remoteJobId);
      return NextResponse.json({
        localJob: null,
        remote: {
          jobId: remote.job_id,
          status: remote.status,
          error: remote.error ?? null,
          result: remote.result ?? null,
        },
      });
    }

    // Sync remote → local
    const result = await syncRemoteJobToLocal(localJob.id, remoteJobId, projectId);

    // Re-read the updated local job
    const updatedJob = await prisma.job.findUnique({
      where: { id: localJob.id },
      select: {
        id: true,
        status: true,
        error: true,
        resultPath: true,
        params: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      localJob: updatedJob,
      syncResult: result,
      remote: null,
    });
  } catch (err) {
    console.error('Remote align poll error:', err);
    return NextResponse.json(
      { error: 'Failed to poll remote align job' },
      { status: 500 },
    );
  }
}
