// LyricVideo — main Remotion composition
// iPhone Notes dark mode with checklist to-do list
// Shared component used by both Player (preview) and Renderer (export)

import React from 'react';
import { useCurrentFrame, Audio } from 'remotion';
import { Header } from './Header';
import { ScrollingList } from './ScrollingList';

interface LyricLineInput {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export interface LyricVideoProps extends Record<string, unknown> {
  lines: LyricLineInput[];
  template?: string;
  durationMs: number;
  audioSrc?: string;
  title?: string;
  username?: string;
  singer?: string;
}

export const LyricVideo: React.FC<LyricVideoProps> = ({
  lines,
  durationMs,
  audioSrc,
  title = 'Song Title',
  username,
  singer,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;

  // Current time in milliseconds
  const tMs = (frame / fps) * 1000;

  // Find current line index
  let currentIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startMs != null && line.endMs != null && tMs >= line.startMs && tMs < line.endMs) {
      currentIdx = i;
      break;
    }
  }

  // If past the last line, show last
  if (currentIdx === -1 && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine.endMs != null && tMs >= lastLine.endMs) {
      currentIdx = lines.length - 1;
    }
  }

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#030303',
      }}
    >
      {/* Audio — plays in background */}
      {audioSrc && <Audio src={audioSrc} />}

      {/* 顶部信息按参考图固定呈现为抖音 + 歌曲标题。 */}
      <Header title={title} username={username} singer={singer} />

      {/* Scrolling checklist */}
      <ScrollingList lines={lines} currentIdx={currentIdx} />
    </div>
  );
};
