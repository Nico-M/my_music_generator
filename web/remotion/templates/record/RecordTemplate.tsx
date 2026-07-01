import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { RecordTemplateConfig } from './config';
import { getActiveLineState } from '../shared/timing';

const Waveform: React.FC<{ style?: 'bars' | 'wave' }> = ({ style = 'bars' }) => {
  const bars = Array.from({ length: 20 }, (_, i) => {
    const height = 10 + Math.sin(i * 0.5) * 8;
    return (
      <div
        key={i}
        style={{
          width: 3,
          height: `${height}px`,
          backgroundColor: '#0A84FF',
          borderRadius: 2,
          margin: '0 2px',
        }}
      />
    );
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 4,
        height: 40,
      }}
    >
      {bars}
    </div>
  );
};

export const RecordTemplate: React.FC<TemplateRenderProps<RecordTemplateConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = getActiveLineState(data.lines, (frame / fps) * 1000);

  const currentLine = state.currentIndex >= 0 ? data.lines[state.currentIndex] : null;
  const previousLine = state.previousIndex >= 0 ? data.lines[state.previousIndex] : null;
  const nextLine = state.nextIndex >= 0 ? data.lines[state.nextIndex] : null;

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#000000',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '40px 20px 30px',
          textAlign: 'left',
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: '#2C2C2C',
        }}
      >
        <div style={{ fontSize: 14, color: '#999999', marginBottom: 4 }}>
          {data.singer && data.singer}
        </div>
        <div style={{ fontSize: 32, fontWeight: '600', marginBottom: 4 }}>
          {data.title || 'Recording'}
        </div>
        {data.creatorName && (
          <div style={{ fontSize: 14, color: '#999999' }}>
            by {data.creatorName}
          </div>
        )}
      </div>

      {/* Main Content Area - Lyrics Display */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 80,
          paddingBottom: 200,
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Previous Line - Dimmed */}
        {previousLine && (
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255, 255, 255, 0.3)',
              marginBottom: 40,
              maxWidth: 900,
              height: 30,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {previousLine.text}
          </div>
        )}

        {/* Current Line - Large and Prominent */}
        {currentLine ? (
          <div
            style={{
              fontSize: 56,
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: 40,
              maxWidth: 900,
              lineHeight: 1.3,
              letterSpacing: -0.5,
            }}
          >
            {currentLine.text}
          </div>
        ) : (
          <div
            style={{
              fontSize: 56,
              fontWeight: '700',
              color: 'rgba(255, 255, 255, 0.15)',
              marginBottom: 40,
            }}
          >
            ♪
          </div>
        )}

        {/* Next Line - Dimmed */}
        {nextLine && (
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255, 255, 255, 0.3)',
              marginTop: 40,
              maxWidth: 900,
              height: 30,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nextLine.text}
          </div>
        )}
      </div>

      {/* Bottom Waveform Visualization */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '40px 20px',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: '#2C2C2C',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Waveform style={config.waveformStyle} />
      </div>
    </div>
  );
};
