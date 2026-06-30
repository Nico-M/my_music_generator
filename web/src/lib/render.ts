/**
 * Render library — uses @remotion/renderer to export the LyricVideo composition to MP4
 */

import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { getTemplateUsername } from './template';
import { RENDERS_DIR } from './paths';

interface LyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export async function renderLyricVideo(
  projectId: string,
  lines: LyricLine[],
  title: string,
  audioPath: string,
  durationInFrames: number,
  template?: string | null
): Promise<string> {
  const username = getTemplateUsername(template);

  // Bundle the Remotion project
  const bundlePath = await bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/Root.tsx'),
  });

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'LyricVideo',
    inputProps: {
      lines,
      title,
      username,
      audioSrc: audioPath.replace('/data/uploads/', '/api/files/'),
      durationMs: Math.round((durationInFrames / 30) * 1000),
    },
  });

  // Render to MP4
  const outputPath = path.join(RENDERS_DIR, `${projectId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundlePath,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      lines,
      title,
      username,
      audioSrc: audioPath.replace('/data/uploads/', '/api/files/'),
      durationMs: Math.round((durationInFrames / 30) * 1000),
    },
  });

  return outputPath;
}
