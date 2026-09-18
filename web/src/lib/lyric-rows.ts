import type { AsrUnit } from '@/lib/minimax-asr';

export interface LyricRow {
  text: string;
  startMs: number;
  endMs: number;
}

/** Punctuation the LLM is allowed to insert. */
const PUNCTUATION = /[，。！？、,.!?]/;

/**
 * Strip everything that is not a CJK character.
 *
 * ASR attaches no punctuation on its own and the LLM only inserts it, so the
 * CJK sequences on both sides must match exactly for index-based mapping.
 */
export function cjkOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fff]/g, '');
}

export interface BuildRowsResult {
  rows: LyricRow[];
  /** Set when the punctuated text could not be trusted for mapping. */
  mismatch?: string;
}

/**
 * Build lyric rows by mapping LLM-inserted punctuation back onto ASR timings.
 *
 * Both inputs must describe the same character sequence: `punctuated` is the
 * LLM's version of the ASR transcript with punctuation added. Walking them in
 * lockstep means row N's start comes from the first unit of that row and its
 * end from the last, keeping the ASR's exact word-level timings.
 *
 * Returns `mismatch` instead of rows when the character sequences diverge —
 * the caller then falls back, because a shifted index would misplace every
 * subsequent timestamp.
 */
export function buildRowsFromPunctuation(
  units: AsrUnit[],
  punctuated: string,
): BuildRowsResult {
  const asrChars = units.map((u) => u.text).join('');
  const asrCjk = cjkOnly(asrChars);
  const llmCjk = cjkOnly(punctuated);

  if (asrCjk.length === 0) {
    return { rows: [], mismatch: '识别结果为空' };
  }
  if (asrCjk !== llmCjk) {
    return {
      rows: [],
      mismatch: `断句结果与识别文字不一致（${llmCjk.length} vs ${asrCjk.length} 字）`,
    };
  }

  const rows: LyricRow[] = [];
  let cjkSeen = 0;
  let rowStart: number | null = null;

  const flush = (endIndex: number) => {
    if (rowStart === null) return;
    const text = units
      .slice(rowStart, endIndex + 1)
      .map((u) => u.text)
      .join('')
      .trim();
    if (text.length > 0) {
      rows.push({
        text,
        startMs: units[rowStart].startMs,
        endMs: units[endIndex].endMs,
      });
    }
    rowStart = null;
  };

  for (const ch of punctuated) {
    if (PUNCTUATION.test(ch)) {
      // A punctuation mark closes the row that precedes it.
      if (rowStart !== null) flush(cjkSeen - 1);
      continue;
    }
    if (cjkOnly(ch).length === 0) continue;

    if (rowStart === null) rowStart = cjkSeen;
    cjkSeen++;
    if (cjkSeen >= units.length) flush(units.length - 1);
  }

  // Trailing characters with no closing punctuation.
  if (rowStart !== null) flush(units.length - 1);

  if (rows.length === 0) {
    return { rows: [], mismatch: '断句结果未产生任何歌词行' };
  }
  return { rows };
}

/**
 * The whole transcript as one row.
 *
 * Used when punctuation could not be obtained: the recognizer emits none of
 * its own, and guessing breaks the user would have to undo is worse than
 * letting them split the single row themselves.
 */
export function singleRowFromUnits(units: AsrUnit[]): LyricRow[] {
  const cjk = units.map((u) => u.text).join('');
  const text = cjkOnly(cjk);
  if (text.length === 0 || units.length === 0) return [];
  return [
    {
      text,
      startMs: units[0].startMs,
      endMs: units[units.length - 1].endMs,
    },
  ];
}
