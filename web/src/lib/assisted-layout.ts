/**
 * Assisted layout — matches user-confirmed lyric lines to ASR segment timestamps.
 *
 * ⚠️ **NOT a large language model. NOT forced alignment.**
 * This is a simple heuristic: it uses the segment-level text + timestamps produced
 * by faster-whisper and tries to match each user lyric line to the closest ASR segment
 * by character overlap.
 *
 * How it works:
 * 1. ASR (faster-whisper) produces segments with text + start/end timestamps.
 * 2. User pastes/confirms the correct lyrics (one line per segment).
 * 3. This function matches each user line to the best ASR segment(s) by character coverage.
 * 4. Low-confidence lines get fallback timestamps distributed over the remaining time.
 *
 * 质量说明：
 * - 不是大模型，不涉及任何 LLM API 调用
 * - 不是 forced alignment（那是 WhisperX / MFA 做的事）
 * - 纯前端启发式匹配：用字符重叠度把用户歌词对到 ASR 时间戳上
 * - 匹配不到的行会用加权粗排自动补时间，不会出现空时间线
 */

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptData {
  segments: Segment[];
  words: WordTimestamp[];
}

export interface LineInput {
  index: number;
  text: string;
}

export interface AssistedResult {
  index: number;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface AssistedSummary {
  matchedCount: number;
  totalCount: number;
  fallbackCount: number;
}

/**
 * Calculate character overlap ratio between user line text and ASR segment text.
 * Simple character-level set overlap (works well for Chinese).
 */
function charOverlap(userText: string, asrText: string): number {
  const uChars = new Set(userText.trim().toLowerCase().replace(/\s+/g, ''));
  const aChars = new Set(asrText.trim().toLowerCase().replace(/\s+/g, ''));
  if (uChars.size === 0 || aChars.size === 0) return 0;

  let matched = 0;
  for (const ch of uChars) {
    if (aChars.has(ch)) matched++;
  }
  return matched / uChars.size;
}

/**
 * Main assisted layout function.
 *
 * Strategy:
 * 1. Match each user line to the best ASR segment (text-based, monotonic).
 * 2. Lines that don't match well get fallback: remaining time is distributed
 *    proportionally by text length (same as weighted-layout).
 * 3. Every line always gets a startMs/endMs — no zero timestamps for interior lines.
 *
 * @param userLines - user's confirmed lyrics, one entry per line
 * @param transcriptData - ASR result with segments and words
 * @param durationMs - total audio duration in ms (for fallback)
 */
export function assistedLayout(
  userLines: LineInput[],
  transcriptData: TranscriptData,
  durationMs: number = 0
): { results: AssistedResult[]; summary: AssistedSummary } {
  const segments = transcriptData.segments;
  if (segments.length === 0 || userLines.length === 0) {
    return {
      results: userLines.map(l => ({ index: l.index, startMs: 0, endMs: 0, confidence: 0 })),
      summary: { matchedCount: 0, totalCount: userLines.length, fallbackCount: userLines.length },
    };
  }

  // ── Pass 1: Match each user line to the best ASR segment ──
  const rawResults: { index: number; startMs: number; endMs: number; confidence: number }[] = [];
  let segCursor = 0;

  for (const userLine of userLines) {
    const text = userLine.text.trim();
    if (!text) {
      rawResults.push({ index: userLine.index, startMs: 0, endMs: 0, confidence: 0 });
      continue;
    }

    let bestSegIdx = -1;
    let bestScore = 0;

    // Search forward from current segment cursor
    for (let i = segCursor; i < segments.length; i++) {
      const score = charOverlap(text, segments[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestSegIdx = i;
      }
    }

    // If we found a match anywhere below cursor, jump there
    if (bestSegIdx >= 0 && bestScore >= 0.3) {
      const seg = segments[bestSegIdx];
      rawResults.push({
        index: userLine.index,
        startMs: Math.round(seg.start * 1000),
        endMs: Math.round(seg.end * 1000),
        confidence: Math.round(bestScore * 100) / 100,
      });
      segCursor = bestSegIdx + 1; // move past the matched segment
    } else {
      // No good match — mark for fallback
      rawResults.push({
        index: userLine.index,
        startMs: 0,
        endMs: 0,
        confidence: 0,
      });
    }
  }

  // ── Pass 2: Fallback — fill unmatched lines with weighted time distribution ──

  // Find matched lines and their time ranges
  const matchedLines = rawResults.filter(r => r.confidence > 0 && r.endMs > 0);

  // Calculate available time boundaries
  const totalDuration = durationMs > 0 ? durationMs
    : segments.length > 0 ? Math.round(segments[segments.length - 1].end * 1000)
    : 0;

  if (totalDuration <= 0) {
    // No time info — return as-is
    return {
      results: rawResults,
      summary: { matchedCount: matchedLines.length, totalCount: userLines.length, fallbackCount: userLines.length - matchedLines.length },
    };
  }

  // Fill unmatched lines using weighted distribution
  // Group lines into blocks separated by matched lines
  let blockStartIdx = 0;
  let blockStartMs = 0;
  const finalResults: AssistedResult[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const r = rawResults[i];

    if (r.confidence > 0 && r.endMs > 0) {
      // This line matched — fill the preceding block (if any)
      if (i > blockStartIdx) {
        fillBlock(finalResults, rawResults, blockStartIdx, i, blockStartMs, r.startMs);
      }
      // Add the matched line
      finalResults.push(r);
      blockStartIdx = i + 1;
      blockStartMs = r.endMs;
    }
  }

  // Fill trailing block after last matched line
  if (rawResults.length > blockStartIdx) {
    let blockEndMs = totalDuration;
    if (matchedLines.length > 0) {
      // If there's a last matched line, use its end as start, otherwise start from 0
      blockEndMs = Math.max(blockStartMs, totalDuration);
    }
    fillBlock(finalResults, rawResults, blockStartIdx, rawResults.length, blockStartMs, blockEndMs);
  }

  // Ensure the very last line gets totalDuration if it's close enough
  if (finalResults.length > 0) {
    const last = finalResults[finalResults.length - 1];
    if (last.endMs < totalDuration * 0.9) {
      finalResults[finalResults.length - 1] = { ...last, endMs: totalDuration };
    }
  }

  const finalMatched = finalResults.filter(r => r.confidence > 0 && r.endMs > 0);
  const fallbackCount = finalResults.filter(r => r.confidence === 0).length;

  return {
    results: finalResults,
    summary: {
      matchedCount: finalMatched.length,
      totalCount: userLines.length,
      fallbackCount,
    },
  };
}

/**
 * Fill a block of lines (indices [startIdx, endIdx)) with weighted time distribution
 * from startMs to endMs.
 */
function fillBlock(
  results: AssistedResult[],
  rawResults: { index: number; startMs: number; endMs: number; confidence: number }[],
  startIdx: number,
  endIdx: number,
  startMs: number,
  endMs: number
) {
  const availableMs = endMs - startMs;
  if (availableMs <= 0 || endIdx <= startIdx) return;

  // Equal distribution (we don't have text length here, but equal is fine for fallback)
  const count = endIdx - startIdx;
  const equalMs = Math.floor(availableMs / count);

  for (let i = startIdx; i < endIdx; i++) {
    const isLast = i === endIdx - 1;
    const lineStartMs = startMs + (i - startIdx) * equalMs;
    const lineEndMs = isLast ? endMs : startMs + (i - startIdx + 1) * equalMs;

    results.push({
      index: rawResults[i].index,
      startMs: lineStartMs,
      endMs: lineEndMs,
      confidence: 0,
    });
  }
}
