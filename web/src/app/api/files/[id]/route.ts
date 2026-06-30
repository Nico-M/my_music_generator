// GET /api/files/[id] — serve audio files from /data/uploads
// Supports Range requests for reliable seeking in browser/Remotion Player

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { UPLOADS_DIR } from '@/lib/paths';

const EXT_CONTENT_TYPE: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'audio/mp4',
};

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
    const filePath = path.join(UPLOADS_DIR, safeId);

    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    const ext = path.extname(safeId).toLowerCase();
    const contentType = EXT_CONTENT_TYPE[ext] ?? 'audio/mpeg';

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
          'Content-Type': contentType,
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
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('File serve error:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
