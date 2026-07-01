import type { BaseLyricLine } from '../types';

export interface ActiveLineState {
  currentIndex: number;
  previousIndex: number;
  nextIndex: number;
  progressInLine: number;
  currentTimeMs: number;
}

export function getActiveLineState(lines: BaseLyricLine[], currentTimeMs: number): ActiveLineState {
  let currentIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startMs == null || line.endMs == null) continue;
    if (currentTimeMs >= line.startMs && currentTimeMs < line.endMs) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1 && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine.endMs != null && currentTimeMs >= lastLine.endMs) {
      currentIndex = lines.length - 1;
    }
  }

  const previousIndex = currentIndex > 0 ? currentIndex - 1 : -1;
  const nextIndex = currentIndex >= 0 && currentIndex < lines.length - 1 ? currentIndex + 1 : -1;

  let progressInLine = 0;
  if (currentIndex >= 0) {
    const current = lines[currentIndex];
    if (current.startMs != null && current.endMs != null && current.endMs > current.startMs) {
      const elapsed = currentTimeMs - current.startMs;
      const duration = current.endMs - current.startMs;
      progressInLine = Math.max(0, Math.min(1, elapsed / duration));
    }
  }

  return {
    currentIndex,
    previousIndex,
    nextIndex,
    progressInLine,
    currentTimeMs,
  };
}
