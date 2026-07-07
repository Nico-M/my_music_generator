// GET /api/projects/[id] — get project with lines
// PATCH /api/projects/[id] — update project fields

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TEMPLATE_ID } from '@/lib/template';
import { getTemplateMetadata } from '../../../../../remotion/templates/metadata';

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
    const body = await req.json();
    const { id } = await params;

    if (Object.prototype.hasOwnProperty.call(body, 'templateId')) {
      return NextResponse.json({ error: 'templateId is fixed at project creation' }, { status: 400 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'vocalStartMs',
      'vocalEndMs',
      'template',
      'singer',
      'creatorName',
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
            // Parse string JSON, normalize through template metadata
            let parsed: unknown;
            try {
              parsed = JSON.parse(value);
            } catch {
              // Fall through to default normalization
            }
            const existingProject = await prisma.project.findUnique({
              where: { id },
              select: { templateId: true },
            });
            if (!existingProject) {
              return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }
            const templateMetadata = getTemplateMetadata(existingProject.templateId ?? DEFAULT_TEMPLATE_ID);
            const configObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            data[key] = JSON.stringify(templateMetadata.normalizeConfig(configObject));
          } else if (typeof value === 'object' && value && !Array.isArray(value)) {
            const existingProject = await prisma.project.findUnique({
              where: { id },
              select: { templateId: true },
            });
            if (!existingProject) {
              return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }
            const templateMetadata = getTemplateMetadata(existingProject.templateId ?? DEFAULT_TEMPLATE_ID);
            data[key] = JSON.stringify(templateMetadata.normalizeConfig(value));
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Delete project error:', err);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
