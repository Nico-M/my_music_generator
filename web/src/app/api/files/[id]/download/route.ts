// GET /api/files/[id]/download — serve rendered MP4 files for download

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { RENDERS_DIR } from '@/lib/paths';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security: prevent path traversal
    const safeId = path.basename(id);
    const filePath = path.join(RENDERS_DIR, `${safeId}.mp4`);

    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `attachment; filename="${safeId}.mp4"`,
      },
    });
  } catch (err) {
    console.error('Download error:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
