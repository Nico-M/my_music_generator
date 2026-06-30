'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { LyricVideo } from '../../remotion/LyricVideo';

interface LyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

interface PreviewPanelProps {
  lines: LyricLine[];
  durationMs: number;
  title: string;
  username: string;
  audioUrl?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  lines,
  durationMs,
  title,
  username,
  audioUrl,
}) => {
  if (durationMs <= 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--slate-600)] text-xs">
        No audio
      </div>
    );
  }

  const fps = 30;
  const durationInFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));

  return (
    <Player
      component={LyricVideo}
      durationInFrames={durationInFrames}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={fps}
      controls
      inputProps={{ lines, durationMs, audioSrc: audioUrl, title, username }}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
