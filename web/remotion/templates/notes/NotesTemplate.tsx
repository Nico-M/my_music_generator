import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Header } from '../../Header';
import { ScrollingList } from '../../ScrollingList';
import type { TemplateRenderProps } from '../types';
import type { NotesTemplateConfig } from './config';
import { getActiveLineState } from '../shared/timing';

export const NotesTemplate: React.FC<TemplateRenderProps<NotesTemplateConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = getActiveLineState(data.lines, (frame / fps) * 1000);

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
      <Header title={data.title} username={data.creatorName ?? undefined} singer={data.singer ?? undefined} />
      <ScrollingList lines={data.lines} currentIdx={state.currentIndex} showCheckbox={config.showCheckbox} />
    </div>
  );
};
