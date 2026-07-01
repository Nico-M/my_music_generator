'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { LyricVideo } from '../../remotion/LyricVideo';
import { useEditorStore } from '@/lib/store';

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
  singer?: string | null;
  audioUrl?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  lines,
  durationMs,
  title,
  username,
  singer,
  audioUrl,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const ref = playerRef.current;
    if (!ref) return;

    const onFrame = (e: { detail: { frame: number } }) => {
      const ms = Math.round((e.detail.frame / fps) * 1000);
      const now = Date.now();
      if (now - lastUpdateRef.current >= 100) {
        lastUpdateRef.current = now;
        useEditorStore.getState().setCurrentTimeMs(ms);
      }
    };

    const onPlay = () => useEditorStore.getState().setIsPlaying(true);
    const onPause = () => useEditorStore.getState().setIsPlaying(false);

    ref.addEventListener('frameupdate', onFrame);
    ref.addEventListener('play', onPlay);
    ref.addEventListener('pause', onPause);

    return () => {
      ref.removeEventListener('frameupdate', onFrame);
      ref.removeEventListener('play', onPlay);
      ref.removeEventListener('pause', onPause);
    };
  }, [fps]);

  if (durationMs <= 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--slate-600)] text-xs">
        No audio
      </div>
    );
  }

  const durationInFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));

  const inputProps = useMemo(() => ({
    lines, durationMs, audioSrc: audioUrl, title, username,
    singer: singer ?? undefined,
  }), [lines, durationMs, audioUrl, title, username, singer]);

  return (
    <Player
      ref={playerRef}
      component={LyricVideo}
      durationInFrames={durationInFrames}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={fps}
      controls
      inputProps={inputProps}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
