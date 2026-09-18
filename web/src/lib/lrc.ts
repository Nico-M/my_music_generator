import { LRC_API_URL, COVER_API_URL } from '@/lib/ai-settings';

export interface LrcLine {
  /** Text with the timestamp and any structure tags removed. */
  text: string;
  /** Milliseconds parsed from the LRC tag, or null for unsynced lines. */
  startMs: number | null;
}

export interface LrcResult {
  lines: LrcLine[];
  /** The raw LRC text, useful for debugging mismatches. */
  raw: string;
}

export type LrcOutcome =
  | { ok: true; result: LrcResult }
  | { ok: false; reason: string };

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
/** Structure tags such as [Verse] / [Chorus] — not timestamps. */
const STRUCTURE_TAG = /^\[[A-Za-z][^\]]*\]$/;

/**
 * Fetch lyrics from the lrc.cx library.
 *
 * Only the text is used downstream: LRC timings belong to the original studio
 * recording, while this app aligns to the user's own performance, whose tempo
 * and arrangement differ. A miss is not an error — the caller falls back to the
 * raw ASR transcript and tells the user the lyrics may be inaccurate.
 */
export async function fetchLrc(
  title: string,
  artist: string | null | undefined,
): Promise<LrcOutcome> {
  if (!title.trim()) {
    return { ok: false, reason: '缺少歌曲名' };
  }

  const url = `${LRC_API_URL}?title=${encodeURIComponent(title.trim())}${
    artist?.trim() ? `&artist=${encodeURIComponent(artist.trim())}` : ''
  }`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    return {
      ok: false,
      reason: `歌词服务连接失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    return { ok: false, reason: `歌词服务返回 ${res.status}` };
  }

  const raw = await res.text().catch(() => '');
  const lines: LrcLine[] = [];

  for (const sourceLine of raw.split('\n')) {
    const trimmed = sourceLine.trim();
    if (!trimmed || STRUCTURE_TAG.test(trimmed)) continue;

    const matches = [...trimmed.matchAll(TIME_TAG)];
    const text = trimmed.replace(TIME_TAG, '').trim();
    if (!text) continue;

    if (matches.length === 0) {
      // Unsynced line (e.g. a header) — keep the text, no timing.
      lines.push({ text, startMs: null });
      continue;
    }

    for (const m of matches) {
      const minutes = Number(m[1]);
      const seconds = Number(m[2]);
      const fraction = m[3] ?? '0';
      // [mm:ss.xx] is centiseconds, [mm:ss.xxx] is milliseconds.
      const ms = fraction.length === 1
        ? Number(fraction) * 100
        : fraction.length === 2
          ? Number(fraction) * 10
          : Number(fraction);
      lines.push({ text, startMs: minutes * 60_000 + seconds * 1000 + ms });
    }
  }

  if (lines.length === 0) {
    return { ok: false, reason: '歌词服务未返回内容' };
  }

  return { ok: true, result: { lines, raw } };
}

/**
 * Fetch album cover artwork from api.lrc.cx.
 * The endpoint returns 301/302 redirecting to the image CDN URL.
 */
export async function fetchCover(
  title: string,
  artist?: string | null,
): Promise<string | null> {
  if (!title.trim()) return null;

  const url = `${COVER_API_URL}?title=${encodeURIComponent(title.trim())}${
    artist?.trim() ? `&artist=${encodeURIComponent(artist.trim())}` : ''
  }`;

  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 301 || res.status === 302) {
      const loc = res.headers.get('location');
      if (loc) return loc;
    }

    if (res.ok && res.url && res.url !== url) {
      return res.url;
    }
  } catch (err) {
    console.warn('[fetchCover] error:', err);
  }

  return null;
}
