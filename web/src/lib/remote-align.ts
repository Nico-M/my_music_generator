/**
 * Remote alignment client.
 *
 * When REMOTE_ALIGN_URL is set, the align route uploads the audio to a remote
 * singing-aligner service (e.g. running on lan-mini) instead of relying on a
 * local Python worker.
 *
 * The remote service runs Demucs + faster-whisper on the server side, so the
 * web host does not need any ML / GPU dependencies installed.
 */

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { UPLOADS_DIR } from '@/lib/paths';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getRemoteAlignUrl(): string | null {
  return process.env.REMOTE_ALIGN_URL?.replace(/\/+$/, '') ?? null;
}

export function isRemoteAlignEnabled(): boolean {
  return !!getRemoteAlignUrl();
}

// ---------------------------------------------------------------------------
// Audio path helpers
// ---------------------------------------------------------------------------

/**
 * Convert a project's `audioPath` (URL path like `/data/uploads/abc.mp3`)
 * to an absolute filesystem path.
 */
export function audioPathToFsPath(audioPath: string): string {
  const filename = path.basename(audioPath);
  return path.join(UPLOADS_DIR, filename);
}

// ---------------------------------------------------------------------------
// Remote API calls
// ---------------------------------------------------------------------------

export interface RemoteAlignResult {
  job_id: string;
}

export interface RemoteJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string | null;
  logs?: string[];
  result?: {
    lines: AlignedLineDto[];
    asr_word_count?: number;
    used_vocals_separation?: boolean;
    model?: string;
    alignment_method?: 'fuzzy_global' | 'proportional_fallback';
  } | null;
}

export interface AlignedLineDto {
  index: number;
  startMs: number;
  endMs: number;
  confidence: number;
  matchedText: string;
}

function normalizeTimestamp(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
}

/**
 * Upload audio and lyrics to the remote align service.
 *
 * Reads the audio file from disk, constructs a multipart FormData, and
 * POSTs to `${remoteUrl}/align`.  Returns the remote job_id.
 */
export async function startRemoteAlign(
  audioPath: string,
  lyrics: string[],
  durationMs?: number,
): Promise<RemoteAlignResult> {
  const baseUrl = getRemoteAlignUrl();
  if (!baseUrl) throw new Error('REMOTE_ALIGN_URL is not configured');

  const filePath = audioPathToFsPath(audioPath);
  const audioBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  // Build multipart body manually — Node 18+ has global FormData + file
  const ext = path.extname(fileName).toLowerCase();
  const mimeType =
    ext === '.m4a' ? 'audio/mp4' :
    ext === '.mp3' ? 'audio/mpeg' :
    ext === '.wav' ? 'audio/wav' :
    ext === '.flac' ? 'audio/flac' :
    ext === '.ogg' ? 'audio/ogg' :
    ext === '.aac' ? 'audio/aac' :
    ext === '.mp4' ? 'audio/mp4' :
    ext === '.wma' ? 'audio/x-ms-wma' :
    'application/octet-stream';

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
  formData.append('lyrics_json', JSON.stringify(lyrics));
  formData.append('use_demucs', 'true');
  if (durationMs != null && durationMs > 0) {
    formData.append('audio_duration_ms', String(durationMs));
  }

  const res = await fetch(`${baseUrl}/align`, {
    method: 'POST',
    body: formData,
    // signal: AbortSignal.timeout(120_000), // 2 min upload window
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Remote align failed (${res.status}): ${body}`);
  }

  const data: RemoteAlignResult = await res.json();
  return data;
}

/**
 * Check the status of a remote job.
 */
export async function checkRemoteJob(
  remoteJobId: string,
): Promise<RemoteJobStatus> {
  const baseUrl = getRemoteAlignUrl();
  if (!baseUrl) throw new Error('REMOTE_ALIGN_URL is not configured');

  const res = await fetch(`${baseUrl}/jobs/${remoteJobId}`, {
    // signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Remote job status failed (${res.status}): ${body}`);
  }

  const data: RemoteJobStatus = await res.json();
  return data;
}

// ---------------------------------------------------------------------------
// Quality gate: validate remote results before writing to DB
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a set of aligned lines before writing them to the database.
 *
 * Rejects results that would corrupt the user's timeline, e.g. when the
 * remote returned garbage (tiny fragments with high confidence, zero-duration
 * lines, too few valid lines).
 *
 * @param lines        Aligned lines from the remote service.
 * @param expectedCount  Number of lyric lines in the project (without blanks).
 * @param alignmentMethod  Optional alignment method (relaxes checks for fallback).
 */
export function validateRemoteAlignResult(
  lines: AlignedLineDto[],
  expectedCount: number,
  alignmentMethod?: 'fuzzy_global' | 'proportional_fallback',
): ValidationResult {
  if (lines.length === 0) {
    return { ok: false, reason: 'Remote returned 0 lines' };
  }

  if (lines.length < Math.max(1, expectedCount * 0.5)) {
    return {
      ok: false,
      reason: `Too few lines returned: ${lines.length} vs ${expectedCount} expected`,
    };
  }

  // Relaxed validation for proportional fallback
  if (alignmentMethod === 'proportional_fallback') {
    // All lines must have endMs > startMs (monotonically increasing times)
    const zeroDurationLines = lines.filter((line) => line.endMs <= line.startMs);
    if (zeroDurationLines.length > expectedCount * 0.1) {
      return {
        ok: false,
        reason: `Proportional fallback has ${zeroDurationLines.length} zero-duration lines`,
      };
    }

    // Times must be monotonically increasing
    let prevEnd = 0;
    for (const line of lines) {
      if (line.startMs < prevEnd - 50) {
        return {
          ok: false,
          reason: `Proportional fallback has non-monotonic times at index ${line.index}`,
        };
      }
      prevEnd = line.endMs;
    }

    // Must cover >= 90% of expected lines
    if (lines.length < expectedCount * 0.9) {
      return {
        ok: false,
        reason: `Proportional fallback covers only ${lines.length}/${expectedCount} lines`,
      };
    }

    return { ok: true };
  }

  // Standard strict validation for fuzzy_global or unknown method
  const validLines = lines.filter(
    (line) =>
      line.endMs > line.startMs &&
      line.confidence >= 0.35 &&
      line.matchedText &&
      line.matchedText.trim().length > 0,
  );

  if (validLines.length < Math.max(2, expectedCount * 0.35)) {
    return {
      ok: false,
      reason: `Too few valid lines: ${validLines.length} / ${expectedCount} (need ≥${Math.max(2, Math.round(expectedCount * 0.35))})`,
    };
  }

  const zeroDurationLines = lines.filter((line) => line.endMs <= line.startMs);

  if (zeroDurationLines.length > expectedCount * 0.5) {
    return {
      ok: false,
      reason: `Too many zero-duration lines: ${zeroDurationLines.length} / ${expectedCount}`,
    };
  }

  // high-confidence matches on ≤2 characters are almost certainly wrong
  const highConfidenceTinyMatches = lines.filter(
    (line) => line.confidence >= 0.9 && line.matchedText.trim().length <= 2,
  );

  if (highConfidenceTinyMatches.length > 0) {
    return {
      ok: false,
      reason: `${highConfidenceTinyMatches.length} line(s) have high confidence on ≤2 char match (likely false positive)`,
    };
  }

  return { ok: true };
}

/**
 * Write aligned lines to the local database.
 *
 * Updates each LyricLine row with startMs / endMs / confidence / source='aligned'.
 * If an aligned line's index is out of range for the existing project lines it is
 * silently skipped.
 */
export async function writeAlignResults(
  projectId: string,
  lines: AlignedLineDto[],
): Promise<number> {
  let updatedCount = 0;

  // Load existing project lines (ordered by index)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { lines: { orderBy: { index: 'asc' } } },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);

  const linesByIndex = new Map(project.lines.map((line) => [line.index, line]));

  for (const al of lines) {
    const existing = linesByIndex.get(al.index);
    if (!existing) {
      console.warn(`[remote-align] skipping aligned line index ${al.index} — out of range`);
      continue;
    }

    await prisma.lyricLine.update({
      where: { id: existing.id },
      data: {
        startMs: normalizeTimestamp(al.startMs),
        endMs: normalizeTimestamp(al.endMs),
        confidence: al.confidence,
        source: 'aligned',
      },
    });
    updatedCount++;
  }

  return updatedCount;
}

// ---------------------------------------------------------------------------
// Sync helper: poll remote until done/failed, then write back
// ---------------------------------------------------------------------------

export interface SyncResult {
  status: RemoteJobStatus['status'];
  error?: string | null;
  updatedLines?: number;
}

/**
 * Poll the remote job once and sync the local state.
 *
 * - If remote status == "done": write aligned lines to DB, update local job.
 * - If remote status == "failed": update local job error.
 * - Otherwise: no-op (caller should poll again later).
 *
 * Returns the sync result summary.
 */
export async function syncRemoteJobToLocal(
  localJobId: string,
  remoteJobId: string,
  projectId: string,
): Promise<SyncResult> {
  const remote = await checkRemoteJob(remoteJobId);

  if (remote.status === 'done') {
    const lines = remote.result?.lines;
    if (!lines || lines.length === 0) {
      await prisma.job.update({
        where: { id: localJobId },
        data: { status: 'failed', error: 'Remote returned no aligned lines' },
      });
      return { status: 'failed', error: 'Remote returned no aligned lines' };
    }

    // ---- Quality gate: validate before writing to DB ----
    const expectedCount = await prisma.lyricLine.count({
      where: { projectId },
    });

    const validation = validateRemoteAlignResult(lines, expectedCount, remote.result?.alignment_method);
    if (!validation.ok) {
      const errorMsg = `Remote align quality check failed: ${validation.reason}`;
      console.error(`[remote-align] ${errorMsg}`);
      await prisma.job.update({
        where: { id: localJobId },
        data: { status: 'failed', error: errorMsg },
      });
      return { status: 'failed', error: errorMsg };
    }

    const updatedLines = await writeAlignResults(projectId, lines);

    await prisma.job.update({
      where: { id: localJobId },
      data: { status: 'done', resultPath: `remote:${remoteJobId}` },
    });

    return { status: 'done', updatedLines };
  }

  if (remote.status === 'failed') {
    await prisma.job.update({
      where: { id: localJobId },
      data: { status: 'failed', error: remote.error ?? 'Remote align failed' },
    });
    return { status: 'failed', error: remote.error ?? 'Remote align failed' };
  }

  // Still running — sync local status too
  await prisma.job.update({
    where: { id: localJobId },
    data: { status: 'running' },
  });

  return { status: remote.status };
}

// ---------------------------------------------------------------------------
// Background polling
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000; // 10 min timeout

/**
 * Poll the remote job in the background until done/failed, then write results.
 *
 * Intended to be fired without await from the POST handler (fire-and-forget).
 * The foreground GET /api/jobs/:id endpoint will also sync on each poll, so
 * this is an optimisation — not a single point of failure.
 */
export async function pollRemoteUntilDone(
  localJobId: string,
  remoteJobId: string,
  projectId: string,
): Promise<void> {
  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    try {
      const result = await syncRemoteJobToLocal(localJobId, remoteJobId, projectId);
      if (result.status === 'done' || result.status === 'failed') {
        console.log(
          `[remote-align] job ${localJobId} → ${result.status}` +
            (result.updatedLines != null ? ` (${result.updatedLines} lines)` : ''),
        );
        return;
      }
    } catch (err) {
      console.error(`[remote-align] poll error for job ${localJobId}:`, err);
      // Transient error — keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timed out
  console.error(`[remote-align] job ${localJobId} timed out after ${MAX_POLL_MS}ms`);
  await prisma.job.update({
    where: { id: localJobId },
    data: { status: 'failed', error: `Remote align timed out after ${MAX_POLL_MS / 1000}s` },
  });
}
