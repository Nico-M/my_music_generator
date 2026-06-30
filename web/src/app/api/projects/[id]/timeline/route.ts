// PUT /api/projects/[id]/timeline — batch update line timestamps

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { lines } = await req.json() as { lines: { index: number; startMs: number | null; endMs: number | null }[] };

    if (!Array.isArray(lines)) {
      return NextResponse.json({ error: 'lines must be an array' }, { status: 400 });
    }

    // Get existing lines to map index → id
    const existingLines = await prisma.lyricLine.findMany({
      where: { projectId: id },
    });
    const indexToId = new Map(existingLines.map(l => [l.index, l.id]));

    // Update each line's timestamps
    await prisma.$transaction(
      lines.map(line => {
        const lineId = indexToId.get(line.index);
        if (!lineId) return prisma.$queryRaw`SELECT 1`; // skip if not found

        return prisma.lyricLine.update({
          where: { id: lineId },
          data: {
            startMs: line.startMs,
            endMs: line.endMs,
          },
        });
      })
    );

    // Return updated project with lines
    const project = await prisma.project.findUnique({
      where: { id },
      include: { lines: { orderBy: { index: 'asc' } } },
    });

    return NextResponse.json(project);
  } catch (err) {
    console.error('Update timeline error:', err);
    return NextResponse.json({ error: 'Failed to update timeline' }, { status: 500 });
  }
}
