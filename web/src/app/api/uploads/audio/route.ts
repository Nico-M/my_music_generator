// POST /api/uploads/audio
// Accepts form-data with 'audio' file, saves to /data/uploads/{cuid}.{ext},
// returns { audioPath, durationMs }
// Supports: MP3, WAV, M4A (AAC), OGG, FLAC, and other common audio formats

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createId } from '@paralleldrive/cuid2';
import fs from 'fs/promises';

const UPLOADS_DIR = '/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/uploads';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = createId();
    const ext = guessExtension(file.name);
    const audioPath = `/data/uploads/${id}.${ext}`;
    const fullPath = `${UPLOADS_DIR}/${id}.${ext}`;

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    // ffprobe to get duration
    let durationMs = 0;
    try {
      const output = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullPath}"`,
        { timeout: 10000 }
      );
      const durationSec = parseFloat(output.toString().trim());
      durationMs = Math.round(durationSec * 1000);
    } catch {
      // ffprobe might not be available — use a fallback
      durationMs = 0;
    }

    return NextResponse.json({ audioPath, durationMs });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/** Guess file extension from original filename */
function guessExtension(filename: string | null): string {
  const match = filename?.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    // Accept common audio extensions; default to mp3 for unknown
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'mp4'].includes(ext)) {
      return ext;
    }
  }
  return 'mp3';
}
