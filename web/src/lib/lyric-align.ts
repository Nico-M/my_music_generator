import { pinyin } from 'pinyin-pro';
import type { AsrUnit } from '@/lib/minimax-asr';
import type { LrcLine } from '@/lib/lrc';

export interface LyricRow {
  text: string;
  startMs: number;
  endMs: number;
}

/** One CJK character with the timing of the ASR unit that produced it. */
export interface TimedChar {
  char: string;
  startMs: number;
  endMs: number;
}

const CJK = /[\u4e00-\u9fff]/;

/** Keep only CJK characters, so punctuation and latin never disturb indices. */
export function cjkOnly(text: string): string {
  return Array.from(text)
    .filter((ch) => CJK.test(ch))
    .join('');
}

/**
 * Convert a CJK string to one pinyin syllable per character.
 *
 * Pinyin is the alignment currency: simplified and traditional spellings of the
 * same character (`听` / `聽`) collapse to one syllable, so a traditional LRC
 * matches a simplified transcript without any conversion table.
 */
export function toPinyin(text: string): string[] {
  return pinyin(cjkOnly(text), { toneType: 'none', type: 'array' }).map((s) =>
    (s ?? '').toLowerCase(),
  );
}

/** Flatten ASR units into one entry per CJK character, preserving timing. */
export function toTimedChars(units: AsrUnit[]): TimedChar[] {
  const out: TimedChar[] = [];
  for (const unit of units) {
    for (const ch of unit.text) {
      if (CJK.test(ch)) {
        out.push({ char: ch, startMs: unit.startMs, endMs: unit.endMs });
      }
    }
  }
  return out;
}

export interface AlignResult {
  rows: LyricRow[];
  /** Fraction of ASR syllables that matched the LRC, 0..1. */
  matchRate: number;
  reason?: string;
}

/** Below this share of matched syllables the two texts are not the same passage. */
const MIN_MATCH_RATE = 0.5;

/**
 * Map correct LRC lyrics onto the timings of the user's own recording.
 *
 * The LRC supplies the words and the ASR supplies the timing, because the two
 * are different performances: LRC timings belong to the studio release, while
 * the audio here is whatever the user recorded.
 *
 * Alignment runs on pinyin, then gaps between matched runs are interpolated
 * linearly. That keeps the mapping monotonic — an index can never move
 * backwards — which rules out a repeated chorus being matched to the wrong
 * occurrence.
 */
export function alignLrcToAsr(
  units: AsrUnit[],
  lrcLines: LrcLine[],
): AlignResult {
  const timed = toTimedChars(units);
  if (timed.length === 0) {
    return { rows: [], matchRate: 0, reason: '识别结果中没有可对齐的汉字' };
  }

  // Flatten the LRC, remembering which line each character came from so the
  // LRC's own line breaks become the rows.
  const lrcChars: string[] = [];
  const lrcLineOf: number[] = [];
  const lineTexts: string[] = [];
  const lineHasText: boolean[] = [];

  lrcLines.forEach((line, lineIndex) => {
    const text = cjkOnly(line.text);
    if (text.length === 0) return;
    lineTexts.push(line.text.trim());
    lineHasText.push(true);
    for (const ch of text) {
      lrcChars.push(ch);
      lrcLineOf.push(lineTexts.length - 1);
    }
  });

  if (lrcChars.length === 0) {
    return { rows: [], matchRate: 0, reason: '歌词没有可用文字' };
  }

  const asrPy = toPinyin(timed.map((t) => t.char).join(''));
  const lrcPy = toPinyin(lrcChars.join(''));

  const { aToB, matchRate } = alignByPinyin(asrPy, lrcPy);

  if (matchRate < MIN_MATCH_RATE) {
    return {
      rows: [],
      matchRate,
      reason: `歌词与录音内容匹配度过低（${Math.round(matchRate * 100)}%）`,
    };
  }

  // Group ASR characters by the LRC line they mapped to. A line only becomes a
  // row when at least half its characters were actually sung here — that
  // drops LRC lines falling outside this recording.
  const buckets = new Map<number, number[]>();
  aToB.forEach((b, a) => {
    const lineIndex = lrcLineOf[b];
    if (lineIndex === undefined) return;
    const bucket = buckets.get(lineIndex);
    if (bucket) bucket.push(a);
    else buckets.set(lineIndex, [a]);
  });

  const rows: LyricRow[] = [];
  for (const lineIndex of [...buckets.keys()].sort((x, y) => x - y)) {
    const asrIndices = buckets.get(lineIndex)!;
    const lineCharCount = lineTexts.length > 0
      ? cjkOnly(lineTexts[lineIndex]).length
      : 0;
    if (lineCharCount > 0 && asrIndices.length < lineCharCount * 0.5) continue;

    const first = timed[Math.min(...asrIndices)];
    const last = timed[Math.max(...asrIndices)];
    rows.push({
      text: lineTexts[lineIndex],
      startMs: first.startMs,
      endMs: last.endMs,
    });
  }

  if (rows.length === 0) {
    return { rows: [], matchRate, reason: '未能从歌词中切分出与录音对应的行' };
  }
  return { rows, matchRate };
}

/**
 * Align two pinyin sequences and return a monotonic ASR-index → LRC-index map.
 *
 * Positions inside an unmatched gap are interpolated between the surrounding
 * anchors. The result is monotonic by construction, which is what makes a
 * mis-matched repeated section impossible.
 */
function alignByPinyin(
  asrPy: string[],
  lrcPy: string[],
): { aToB: number[]; matchRate: number } {
  const n = asrPy.length;
  const m = lrcPy.length;

  // Longest-common-subsequence table. Sequences are a few hundred syllables, so
  // the quadratic table stays small; it gives exact anchors rather than the
  // greedy blocks difflib would return.
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        asrPy[i] === lrcPy[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const aToB = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  let matched = 0;
  const anchors: Array<[number, number]> = [];

  while (i < n && j < m) {
    if (asrPy[i] === lrcPy[j]) {
      aToB[i] = j;
      anchors.push([i, j]);
      matched++;
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      i++;
    } else {
      j++;
    }
  }

  // Interpolate the gaps between anchors.
  for (let k = 0; k < anchors.length - 1; k++) {
    const [a0, b0] = anchors[k];
    const [a1, b1] = anchors[k + 1];
    const spanA = a1 - a0;
    const spanB = b1 - b0;
    for (let a = a0 + 1; a < a1; a++) {
      aToB[a] = b0 + Math.round(((a - a0) * spanB) / spanA);
    }
  }

  // Positions before the first or after the last anchor extrapolate linearly.
  if (anchors.length > 0) {
    const [a0, b0] = anchors[0];
    for (let a = 0; a < a0; a++) aToB[a] = Math.max(0, b0 - (a0 - a));
    const [aL, bL] = anchors[anchors.length - 1];
    for (let a = aL + 1; a < n; a++) aToB[a] = Math.min(m - 1, bL + (a - aL));
  } else {
    for (let a = 0; a < n; a++) {
      aToB[a] = Math.min(m - 1, Math.round((a * m) / n));
    }
  }

  return { aToB, matchRate: matched / n };
}
