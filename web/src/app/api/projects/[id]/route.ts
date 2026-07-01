// GET /api/projects/[id] — get project with lines
// PATCH /api/projects/[id] — update project fields

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { index: 'asc' } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (err) {
    console.error('Get project error:', err);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'vocalStartMs',
      'vocalEndMs',
      'template',
      'singer',
      'creatorName',
      'templateId',
      'templateConfig',
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === 'templateConfig') {
          const value = body[key];
          if (value === null) {
            data[key] = null;
          } else if (typeof value === 'string') {
            data[key] = value;
          } else if (typeof value === 'object' && value && !Array.isArray(value)) {
            data[key] = JSON.stringify(value);
          }
          continue;
        }
        data[key] = body[key];
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data,
    });

    return NextResponse.json(project);
  } catch (err) {
    console.error('Update project error:', err);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
