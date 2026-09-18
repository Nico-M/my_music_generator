import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchCover } from '@/lib/lrc';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const coverUrl = await fetchCover(project.title, project.singer);
    if (!coverUrl) {
      return NextResponse.json({ error: '未找到匹配的封面' }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { coverUrl },
    });

    return NextResponse.json({ coverUrl: updated.coverUrl });
  } catch (err) {
    console.error('Fetch cover error:', err);
    return NextResponse.json({ error: '获取封面失败' }, { status: 500 });
  }
}
