'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { useEditorStore } from '@/lib/store';
import { TemplateVideo } from '../../remotion/TemplateVideo';
import { buildRenderInput, FPS, getDurationInFrames } from '@/lib/template';

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
  creatorName?: string | null;
  singer?: string | null;
  audioPath: string;
  templateId?: string | null;
  templateConfig?: string | null;
  legacyTemplate?: string | null;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  lines,
  durationMs,
  title,
  creatorName,
  singer,
  audioPath,
  templateId,
  templateConfig,
  legacyTemplate,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const fps = FPS;
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

  const durationInFrames = getDurationInFrames(durationMs);

  const inputProps = useMemo(
    () =>
      buildRenderInput({
        mode: 'preview',
        title,
        singer,
        creatorName,
        audioPath,
        durationMs,
        lines,
        templateId,
        templateConfig,
        legacyTemplate,
      }),
    [title, singer, creatorName, audioPath, durationMs, lines, templateId, templateConfig, legacyTemplate]
  );

  return (
    <Player
      ref={playerRef}
      component={TemplateVideo}
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
