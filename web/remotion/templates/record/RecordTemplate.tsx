import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { RecordTemplateConfig } from './config';
import { getActiveLineState } from '../shared/timing';

function formatSeconds(totalMs: number): string {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTotalDurationMs(dataDurationMs: number, lines: TemplateRenderProps<RecordTemplateConfig>['data']['lines']): number {
  if (Number.isFinite(dataDurationMs) && dataDurationMs > 0) {
    return dataDurationMs;
  }

  const lastEnd = lines.reduce((maxEnd, line) => {
    if (typeof line.endMs === 'number' && line.endMs > maxEnd) {
      return line.endMs;
    }
    return maxEnd;
  }, 0);

  return lastEnd > 0 ? lastEnd : 66000;
}

const iconButtonStyle: React.CSSProperties = {
  width: 134,
  height: 134,
  borderRadius: 67,
  backgroundColor: '#1A1A1C',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const RecordTemplate: React.FC<TemplateRenderProps<RecordTemplateConfig>> = ({
  data,
  config: _config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const totalDurationMs = getTotalDurationMs(data.durationMs, data.lines);
  const elapsedMs = Math.min(Math.max(0, Math.floor(nowMs)), totalDurationMs);
  const remainingMs = Math.max(totalDurationMs - elapsedMs, 0);
  const progress = totalDurationMs > 0 ? elapsedMs / totalDurationMs : 0;

  const currentLine = state.currentIndex >= 0 ? data.lines[state.currentIndex] : null;

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
      <div
        style={{
        marginTop: 44,
        paddingLeft: 44,
        paddingRight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      >
      <div style={iconButtonStyle}>
        <div
          style={{
            width: 30,
            height: 30,
            borderLeft: '7px solid #FFFFFF',
            borderBottom: '7px solid #FFFFFF',
            transform: 'rotate(45deg)',
            marginLeft: 16,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div
          style={{
            height: 134,
            minWidth: 280,
            borderRadius: 67,
            paddingLeft: 48,
            paddingRight: 48,
            backgroundColor: '#1A1A1C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 68,
            fontWeight: 500,
            letterSpacing: -0.8,
          }}
        >
          Select
        </div>
        <div style={iconButtonStyle}>
          <div
            style={{
              width: 52,
              height: 52,
              border: '7px solid #FFFFFF',
              borderRadius: '50%',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 22,
                height: 7,
                borderRadius: 99,
                backgroundColor: '#FFFFFF',
                right: -14,
                bottom: -8,
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        </div>
      </div>
      </div>

      <div
      style={{
        marginTop: 56,
        paddingLeft: 46,
        color: '#FFFFFF',
        fontSize: 98,
        fontWeight: 700,
        letterSpacing: -2.6,
        lineHeight: 1,
      }}
      >
      All Recordings
      </div>

      <div
      style={{
        marginTop: 46,
        marginLeft: 44,
        marginRight: 44,
        height: 2,
        backgroundColor: '#232327',
      }}
      />

      <div
      style={{
        marginTop: 40,
        paddingLeft: 46,
        paddingRight: 46,
      }}
      >
      <div style={{ color: '#FFFFFF', fontSize: 72, fontWeight: 700, letterSpacing: -1.4 }}>
        {data.title || 'New Recording'}
      </div>
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#8D8D93',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 400 }}>Yesterday</div>
          <div
            style={{
              width: 58,
              height: 48,
              borderRadius: 14,
              border: '5px solid #6F6F77',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 13,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#6F6F77',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 30,
                top: 13,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#6F6F77',
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 64, color: '#0A84FF', lineHeight: 1 }}>•••</div>
      </div>
      <div
        style={{
          marginTop: 28,
          height: 28,
          borderRadius: 99,
          backgroundColor: '#1C1D1F',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
            height: 28,
            borderRadius: 99,
            backgroundColor: '#F2F2F3',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 56,
          color: '#8D8D93',
          display: 'flex',
          justifyContent: 'space-between',
          letterSpacing: -0.2,
        }}
      >
        <div>{formatSeconds(elapsedMs)}</div>
        <div>-{formatSeconds(remainingMs)}</div>
      </div>
      <div
        style={{
          marginTop: 86,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 98,
            height: 98,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {[22, 48, 74, 96, 74, 48, 22].map((height, index) => (
            <div
              key={`${height}-${index}`}
              style={{
                width: 7,
                height,
                borderRadius: 8,
                backgroundColor: '#0A84FF',
                opacity: currentLine ? 1 : 0.55,
              }}
            />
          ))}
        </div>
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: '50%',
            border: '7px solid #FFFFFF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 68,
            fontWeight: 500,
          }}
        >
          15
        </div>
        <div
          style={{
            width: 130,
            height: 130,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '52px solid transparent',
              borderBottom: '52px solid transparent',
              borderLeft: '84px solid #F2F2F3',
              marginLeft: 18,
            }}
          />
        </div>
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: '50%',
            border: '7px solid #FFFFFF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 68,
            fontWeight: 500,
          }}
        >
          15
        </div>
        <div
          style={{
            width: 92,
            height: 104,
            border: '7px solid #0A84FF',
            borderTopWidth: 12,
            borderRadius: '14px 14px 20px 20px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -34,
              left: 22,
              width: 36,
              height: 20,
              border: '7px solid #0A84FF',
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
            }}
          />
        </div>
      </div>
      <div
        style={{
          marginTop: 66,
          minHeight: 72,
          color: 'rgba(255, 255, 255, 0.46)',
          fontSize: 42,
          lineHeight: 1.1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {currentLine?.text ?? data.singer ?? data.creatorName ?? ''}
      </div>
      </div>

      <div
      style={{
        position: 'absolute',
        bottom: 130,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#232327',
      }}
      />
    </div>
  );
};
