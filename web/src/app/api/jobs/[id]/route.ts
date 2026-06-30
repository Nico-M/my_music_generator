// GET /api/jobs/[id] — get job status (for polling from frontend)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
        createdAt: true,
        updatedAt: true,
        projectId: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error('Job status error:', err);
    return NextResponse.json({ error: 'Failed to get job status' }, { status: 500 });
  }
}
