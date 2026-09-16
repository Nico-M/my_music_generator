// POST /api/projects — create a new project
// GET /api/projects — list all projects

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CREATOR_NAME, DEFAULT_TEMPLATE_ID } from '@/lib/template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      audioPath,
      durationMs,
      creatorName,
      username,
      templateId,
      templateConfig,
      singer,
    } = body;

    if (!title || !audioPath) {
      return NextResponse.json({ error: 'title and audioPath are required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title,
        audioPath,
        durationMs: durationMs ?? 0,
        creatorName:
          typeof creatorName === 'string' && creatorName.trim()
            ? creatorName.trim()
            : typeof username === 'string' && username.trim()
              ? username.trim()
              : DEFAULT_CREATOR_NAME,
        templateId: typeof templateId === 'string' && templateId.trim() ? templateId.trim() : DEFAULT_TEMPLATE_ID,
        templateConfig:
          templateConfig && typeof templateConfig === 'object' && !Array.isArray(templateConfig)
            ? JSON.stringify(templateConfig)
            : null,
        singer: typeof singer === 'string' && singer.trim() ? singer.trim() : null,
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
