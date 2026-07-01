/**
 * render-worker.ts — standalone script for rendering LyricVideo via Remotion
 * Run: npx tsx scripts/render-worker.ts <jobId>
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import fs from 'fs/promises';
import path from 'path';
import { getTemplateUsername } from '../src/lib/template';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(__dirname, '../../data');
const DATABASE_URL = process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, 'sqlite.db')}`;
const RENDERS_DIR = process.env.RENDERS_DIR ?? path.join(DATA_DIR, 'renders');

const adapter = new PrismaLibSql({
  url: DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

interface RenderJobParams {
  renderBaseUrl?: string;
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: npx tsx scripts/render-worker.ts <jobId>');
    process.exit(1);
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      project: {
        include: { lines: { orderBy: { index: 'asc' } } },
      },
    },
  });

  if (!job || !job.project) {
    console.error('Job not found:', jobId);
    process.exit(1);
  }

  const project = job.project;

  try {
    // Mark job as running
    await prisma.job.update({ where: { id: jobId }, data: { status: 'running' } });

    const durationInFrames = Math.max(1, Math.ceil(((project.durationMs || 0) / 1000) * 30));
    const username = getTemplateUsername(project.template);
    const renderParams = parseRenderJobParams(job.params);
    const audioSrc = toAbsoluteFileUrl(project.audioPath, renderParams.renderBaseUrl);

    // Bundle the Remotion project
    console.log('Bundling Remotion project...');
    const bundlePath = await bundle({
      entryPoint: path.resolve(__dirname, '../remotion/index.ts'),
    });

    // Select composition
    console.log('Selecting composition...');
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: 'LyricVideo',
      inputProps: {
        lines: project.lines,
        title: project.title,
        username,
        audioSrc,
        durationMs: project.durationMs,
      },
    });

    // Override with the actual project duration (Root.tsx defaults to 300 frames)
    composition.durationInFrames = durationInFrames;

    // Render
    const outputPath = path.join(RENDERS_DIR, `${project.id}.mp4`);
    await fs.mkdir(RENDERS_DIR, { recursive: true });
    console.log(`Rendering to ${outputPath}...`);
    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        lines: project.lines,
        title: project.title,
        username,
        audioSrc,
        durationMs: project.durationMs,
      },
    });

    // Mark job as done — store logical path
    const resultPath = `/data/renders/${project.id}.mp4`;
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'done', resultPath },
    });

    console.log('Render complete:', outputPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Render failed:', message);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'failed', error: message },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function parseRenderJobParams(params: string | null): RenderJobParams {
  if (!params) return {};

  try {
    return JSON.parse(params) as RenderJobParams;
  } catch {
    return {};
  }
}

function toAbsoluteFileUrl(audioPath: string, renderBaseUrl?: string): string {
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const apiPath = audioPath.replace('/data/uploads/', '/api/files/');
  const baseUrl = renderBaseUrl ?? process.env.RENDER_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing renderBaseUrl for local audio asset rendering');
  }

  // Remotion renderer 会启动自己的临时服务器；音频必须指向真实 Web 服务。
  return new URL(apiPath, baseUrl).toString();
}

main();
