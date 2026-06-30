// PUT /api/projects/[id]/lyrics — replace lyrics text only
// Does NOT touch existing startMs/endMs values (keeps good timestamps intact)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { texts } = await req.json() as { texts: string[] };

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts must be a non-empty array' }, { status: 400 });
    }

    // Get existing lines for this project
    const existingLines = await prisma.lyricLine.findMany({
      where: { projectId: id },
      orderBy: { index: 'asc' },
    });

    // If lines exist, update texts in-place (preserve startMs/endMs/source)
    // If count changed, add/remove lines accordingly
    const newLines: {
      index: number;
      text: string;
      id?: string;
      startMs: number | null;
      endMs: number | null;
      source: string;
      confidence: number | null;
    }[] = texts.map((text, index) => {
      const existing = existingLines[index];
      let source = existing?.source ?? 'manual';

      // If user edits a transcribed line, change to manual
      if (existing && existing.source === 'transcribed' && existing.text !== text) {
        source = 'manual';
      }

      return {
        index,
        text,
        id: existing?.id,
        startMs: existing?.startMs ?? null,
        endMs: existing?.endMs ?? null,
        source,
        confidence: existing?.confidence ?? null,
      };
    });

    // Delete removed lines
    const idsToKeep = newLines.filter(l => l.id).map(l => l.id!);
    await prisma.lyricLine.deleteMany({
      where: {
        projectId: id,
        id: { notIn: idsToKeep.length > 0 ? idsToKeep : ['__none__'] },
      },
    });

    // Upsert each line
    for (const line of newLines) {
      if (line.id) {
        await prisma.lyricLine.update({
          where: { id: line.id },
          data: {
            index: line.index,
            text: line.text,
            source: line.source,
          },
        });
      } else {
        await prisma.lyricLine.create({
          data: {
            projectId: id,
            index: line.index,
            text: line.text,
            source: line.source,
          },
        });
      }
    }

    // Return updated project with lines
    const project = await prisma.project.findUnique({
      where: { id },
      include: { lines: { orderBy: { index: 'asc' } } },
    });

    return NextResponse.json(project);
  } catch (err) {
    console.error('Update lyrics error:', err);
    return NextResponse.json({ error: 'Failed to update lyrics' }, { status: 500 });
  }
}
