// POST /api/projects — create a new project
// GET /api/projects — list all projects

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildProjectTemplate, DEFAULT_TEMPLATE_USERNAME } from '@/lib/template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, audioPath, durationMs, username, singer, lyrics } = body;

    if (!title || !audioPath) {
      return NextResponse.json({ error: 'title and audioPath are required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title,
        audioPath,
        durationMs: durationMs ?? 0,
        template: buildProjectTemplate(username ?? DEFAULT_TEMPLATE_USERNAME),
        singer: typeof singer === 'string' && singer.trim() ? singer.trim() : null,
        manualLyrics: typeof lyrics === 'string' && lyrics.trim() ? lyrics.trim() : null,
      },
    });

    // If manual lyrics provided, create LyricLine records
    if (typeof lyrics === 'string' && lyrics.trim()) {
      const lines = lyrics
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      if (lines.length > 0) {
        await prisma.lyricLine.createMany({
          data: lines.map((text: string, idx: number) => ({
            index: idx,
            text,
            source: 'manual',
            projectId: project.id,
          })),
        });
      }
    }

    // Return project with lines if any were created
    const created = await prisma.project.findUnique({
      where: { id: project.id },
      include: { lines: { orderBy: { index: 'asc' } } },
    });

    return NextResponse.json(created ?? project, { status: 201 });
  } catch (err) {
    console.error('Create project error:', err);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lines: { select: { id: true } } },
    });
    return NextResponse.json(projects);
  } catch (err) {
    console.error('List projects error:', err);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}
