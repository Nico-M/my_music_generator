// GET /api/files/[id] — serve audio files from /data/uploads
// Converts server file paths to HTTP URLs for browser <audio> and Remotion Player

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = '/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/uploads';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security: prevent path traversal
    const safeId = path.basename(id);
    const filePath = path.join(UPLOADS_DIR, safeId);

    const buffer = await fs.readFile(filePath);

    // Determine content type from extension
    const ext = path.extname(safeId).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.wma': 'audio/x-ms-wma',
      '.mp4': 'audio/mp4',
    };
    const contentType = contentTypeMap[ext] ?? 'audio/mpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('File serve error:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
