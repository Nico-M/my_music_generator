import type { BaseLyricLine } from '../types';

export interface ActiveLineState {
  currentIndex: number;
  previousIndex: number;
  nextIndex: number;
  progressInLine: number;
  currentTimeMs: number;
  lastStartedIndex: number;
  lastCompletedIndex: number;
}

export function getActiveLineState(lines: BaseLyricLine[], currentTimeMs: number): ActiveLineState {
  let currentIndex = -1;
  let lastStartedIndex = -1;
  let lastCompletedIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startMs == null) continue;
    const endMs = line.endMs ?? (lines[i + 1]?.startMs ?? line.startMs + 3000);

    if (currentTimeMs >= line.startMs) {
      lastStartedIndex = i;
    }
    if (currentTimeMs >= endMs) {
      lastCompletedIndex = i;
    }
    if (currentIndex === -1 && currentTimeMs >= line.startMs && currentTimeMs < endMs) {
      currentIndex = i;
    }
  }

  if (currentIndex === -1 && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    const lastEnd = lastLine.endMs ?? (lastLine.startMs != null ? lastLine.startMs + 3000 : null);
    if (lastEnd != null && currentTimeMs >= lastEnd) {
      currentIndex = lines.length - 1;
    }
  }

  const previousIndex = currentIndex > 0 ? currentIndex - 1 : lastCompletedIndex >= 0 ? lastCompletedIndex : -1;
  const nextIndex = currentIndex >= 0 && currentIndex < lines.length - 1
    ? currentIndex + 1
    : lastStartedIndex >= 0 && lastStartedIndex < lines.length - 1
      ? lastStartedIndex + 1
      : -1;

  let progressInLine = 0;
  if (currentIndex >= 0) {
    const current = lines[currentIndex];
    const endMs = current.endMs ?? (lines[currentIndex + 1]?.startMs ?? (current.startMs != null ? current.startMs + 3000 : null));
    if (current.startMs != null && endMs != null && endMs > current.startMs) {
      const elapsed = currentTimeMs - current.startMs;
      const duration = endMs - current.startMs;
      progressInLine = Math.max(0, Math.min(1, elapsed / duration));
    }
  }

  return {
    currentIndex,
    previousIndex,
    nextIndex,
    progressInLine,
    currentTimeMs,
    lastStartedIndex,
    lastCompletedIndex,
  };
}
