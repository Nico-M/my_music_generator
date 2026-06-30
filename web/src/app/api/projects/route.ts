// POST /api/projects — create a new project
// GET /api/projects — list all projects

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildProjectTemplate, DEFAULT_TEMPLATE_USERNAME } from '@/lib/template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, audioPath, durationMs, username } = body;

    if (!title || !audioPath) {
      return NextResponse.json({ error: 'title and audioPath are required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title,
        audioPath,
        durationMs: durationMs ?? 0,
        template: buildProjectTemplate(username ?? DEFAULT_TEMPLATE_USERNAME),
      },
    });

    return NextResponse.json(project, { status: 201 });
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
