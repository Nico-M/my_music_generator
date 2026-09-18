// GET /api/files/[id]/preview — serve rendered MP4 for in-browser preview
// Supports Range requests for reliable seeking in browser <video> element

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { RENDERS_DIR } from '@/lib/paths';

function parseRange(range: string, fileSize: number): { start: number; end: number } | null {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  let start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (isNaN(start)) start = 0;
  if (isNaN(end)) return null;
  if (start > end || start >= fileSize) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security: prevent path traversal
    const safeId = path.basename(id);
    const filePath = path.join(RENDERS_DIR, `${safeId}.mp4`);

    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    const rangeHeader = req.headers.get('range');

    if (rangeHeader) {
      const parsed = parseRange(rangeHeader, fileSize);
      if (!parsed) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(chunkSize);
      await fd.read(buffer, 0, chunkSize, start);
      await fd.close();

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // No Range header — full file
    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        // No Content-Disposition: attachment — browser will show inline
      },
    });
  } catch (err) {
    console.error('Preview error:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
