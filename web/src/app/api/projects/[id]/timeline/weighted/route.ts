// POST /api/projects/[id]/timeline/weighted — assign weighted fallback timestamps

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { weightedLayout } from '@/lib/weighted-layout';

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

    if (project.lines.length === 0) {
      return NextResponse.json({ error: 'No lyrics to assign timestamps to' }, { status: 400 });
    }

    // Compute weighted layout
    const results = weightedLayout(
      project.lines,
      project.durationMs,
      project.vocalStartMs ?? undefined,
      project.vocalEndMs ?? undefined
    );

    // Update lines in DB
    for (const result of results) {
      const line = project.lines[result.index];
      await prisma.lyricLine.update({
        where: { id: line.id },
        data: {
          startMs: result.startMs,
          endMs: result.endMs,
          source: 'weighted',
        },
      });
    }

    return NextResponse.json({ lines: results });
  } catch (err) {
    console.error('Weighted layout error:', err);
    return NextResponse.json({ error: 'Failed to compute weighted layout' }, { status: 500 });
  }
}
