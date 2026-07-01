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
  template?: string | null,
  renderBaseUrl?: string
): Promise<string> {
  const username = getTemplateUsername(template);
  const audioSrc = toAbsoluteFileUrl(audioPath, renderBaseUrl);

  // Bundle the Remotion project
  const bundlePath = await bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/index.ts'),
  });

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'LyricVideo',
    inputProps: {
      lines,
      title,
      username,
      audioSrc,
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
      audioSrc,
      durationMs: Math.round((durationInFrames / 30) * 1000),
    },
  });

  return outputPath;
}

function toAbsoluteFileUrl(audioPath: string, renderBaseUrl?: string): string {
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const apiPath = audioPath.replace('/data/uploads/', '/api/files/');
  const baseUrl = renderBaseUrl ?? process.env.RENDER_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing renderBaseUrl for local audio asset rendering');
  }

  // 离线渲染不能使用相对 API 路径，否则会被解析到 Remotion 临时服务。
  return new URL(apiPath, baseUrl).toString();
}
