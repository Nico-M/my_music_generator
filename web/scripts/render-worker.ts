/**
 * render-worker.ts — standalone script for rendering LyricVideo via Remotion
 * Run: npx tsx scripts/render-worker.ts <jobId>
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import path from 'path';
import { getTemplateUsername } from '../src/lib/template';

const adapter = new PrismaLibSql({
  url: 'file:/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/sqlite.db',
});
const prisma = new PrismaClient({ adapter });

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

    // Bundle the Remotion project
    console.log('Bundling Remotion project...');
    const bundlePath = await bundle({
      entryPoint: path.resolve(__dirname, '../remotion/Root.tsx'),
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
        audioSrc: project.audioPath.replace('/data/uploads/', '/api/files/'),
        durationMs: project.durationMs,
      },
    });

    // Render
    const outputPath = `/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/renders/${project.id}.mp4`;
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
        audioSrc: project.audioPath.replace('/data/uploads/', '/api/files/'),
        durationMs: project.durationMs,
      },
    });

    // Mark job as done
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'done', resultPath: outputPath },
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

main();
