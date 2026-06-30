/**
 * Weighted layout — fallback timeline generation based on character count.
 * Distributes available duration proportionally by text length.
 * Pure JS, no external dependencies, synchronous, never fails.
 */

export interface WeightedLine {
  text: string;
}

export interface WeightedResult {
  index: number;
  startMs: number;
  endMs: number;
}

export function weightedLayout(
  lines: WeightedLine[],
  durationMs: number,
  vocalStartMs?: number,
  vocalEndMs?: number
): WeightedResult[] {
  if (lines.length === 0) return [];

  const start = vocalStartMs ?? 0;
  const end = vocalEndMs ?? durationMs;
  const availableMs = Math.max(0, end - start);

  // Calculate weights by text length (minimum weight of 1)
  const weights = lines.map((l) => Math.max(1, l.text.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Distribute time proportionally
  const results: WeightedResult[] = [];
  let currentMs = start;

  for (let i = 0; i < lines.length; i++) {
    const lineMs = Math.round((weights[i] / totalWeight) * availableMs);
    const lineStart = currentMs;
    const lineEnd = currentMs + lineMs;

    results.push({
      index: i,
      startMs: lineStart,
      endMs: lineEnd,
    });

    currentMs = lineEnd;
  }

  // If there's any remaining time due to rounding, add it to the last line
  if (results.length > 0 && currentMs < end) {
    results[results.length - 1].endMs = end;
  }

  return results;
}
