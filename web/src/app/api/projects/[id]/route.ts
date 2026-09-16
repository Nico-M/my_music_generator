// GET /api/projects/[id] — get project with lines
// PATCH /api/projects/[id] — update project fields
// DELETE /api/projects/[id] — delete project and related assets

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { UPLOADS_DIR } from '@/lib/paths';

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
      'coverUrl',
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Cascade delete project from database
    await prisma.project.delete({ where: { id } });

    // Clean up uploaded audio file if present
    if (project.audioPath) {
      try {
        const filePath = path.join(UPLOADS_DIR, path.basename(project.audioPath));
        await fs.unlink(filePath);
      } catch {
        // ignore if already removed
      }
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('Delete project error:', err);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
