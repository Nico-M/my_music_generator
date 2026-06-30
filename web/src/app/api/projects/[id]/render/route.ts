// POST /api/projects/[id]/render — start a render job
// Creates a Job record and spawns a detached child process for rendering
// Returns immediately with { jobId }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
      include: { lines: { orderBy: { index: 'asc' } } },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.lines.length === 0) {
      return NextResponse.json({ error: 'No lyrics to render' }, { status: 400 });
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        type: 'render',
        status: 'queued',
        projectId: id,
      },
    });

    // Fire-and-forget: spawn detached child process
    const workerScript = path.resolve(process.cwd(), 'scripts/render-worker.ts');
    spawn('npx', ['tsx', workerScript, job.id], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
    }).unref();

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error('Render start error:', err);
    return NextResponse.json({ error: 'Failed to start render' }, { status: 500 });
  }
}
