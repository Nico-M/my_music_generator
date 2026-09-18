import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { RecordTemplateConfig } from './config';
import { getActiveLineState } from '../shared/timing';

const ionChevronBackPoints = '328 112 184 256 328 400';
const ionSearchPath = 'M456.69,421.39,362.6,327.3a173.81,173.81,0,0,0,34.84-104.58C397.44,126.38,319.06,48,222.72,48S48,126.38,48,222.72s78.38,174.72,174.72,174.72A173.81,173.81,0,0,0,327.3,362.6l94.09,94.09a25,25,0,0,0,35.3-35.3ZM97.92,222.72a124.8,124.8,0,1,1,124.8,124.8A124.95,124.95,0,0,1,97.92,222.72Z';
const ionPauseLeftPath = 'M208,432H160a16,16,0,0,1-16-16V96a16,16,0,0,1,16-16h48a16,16,0,0,1,16,16V416A16,16,0,0,1,208,432Z';
const ionPauseRightPath = 'M352,432H304a16,16,0,0,1-16-16V96a16,16,0,0,1,16-16h48a16,16,0,0,1,16,16V416A16,16,0,0,1,352,432Z';
const ionTrashTopPath = 'M296,64H216a7.91,7.91,0,0,0-8,8V96h96V72A7.91,7.91,0,0,0,296,64Z';
const ionTrashBodyPath = 'M432,96H336V72a40,40,0,0,0-40-40H216a40,40,0,0,0-40,40V96H80a16,16,0,0,0,0,32H97L116,432.92c1.42,26.85,22,47.08,48,47.08H348c26.13,0,46.3-19.78,48-47L415,128h17a16,16,0,0,0,0-32ZM192.57,416H192a16,16,0,0,1-16-15.43l-8-224a16,16,0,1,1,32-1.14l8,224A16,16,0,0,1,192.57,416ZM272,400a16,16,0,0,1-32,0V176a16,16,0,0,1,32,0ZM304,96H208V72a7.91,7.91,0,0,1,8-8h80a7.91,7.91,0,0,1,8,8Zm32,304.57A16,16,0,0,1,320,416h-.58A16,16,0,0,1,304,399.43l8-224a16,16,0,1,1,32,1.14Z';

function SeekStepIcon({ direction }: { direction: 'backward' | 'forward' }) {
  return (
    <svg viewBox="0 0 512 512" width={66} height={66} fill="none" aria-hidden="true">
      <g transform={direction === 'forward' ? 'translate(512 0) scale(-1 1)' : undefined}>
        <polyline
          points="176 96 96 96 96 176"
          stroke="#FFFFFF"
          strokeWidth={32}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M96 176C130 110 204 64 288 64C394 64 480 150 480 256C480 362 394 448 288 448C230 448 176 422 140 378"
          stroke="#FFFFFF"
          strokeWidth={32}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="252"
        y="326"
        textAnchor="middle"
        fill="#FFFFFF"
        style={{ fontSize: 150, fontWeight: 700, letterSpacing: -2, fontFamily: 'SF Pro Display, Arial, sans-serif' }}
      >
        15
      </text>
    </svg>
  );
}

function VoiceMemoWaveformIcon() {
  return (
    <svg viewBox="0 0 512 512" width={72} height={72} fill="#0A84FF" aria-hidden="true">
      <rect x="0" y="216" width="48" height="80" rx="24" />
      <rect x="77" y="130" width="48" height="252" rx="24" />
      <rect x="154" y="0" width="48" height="512" rx="24" />
      <rect x="232" y="86" width="48" height="340" rx="24" />
      <rect x="309" y="173" width="48" height="166" rx="24" />
      <rect x="387" y="86" width="48" height="340" rx="24" />
      <rect x="464" y="216" width="48" height="80" rx="24" />
    </svg>
  );
}

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
        <svg viewBox="0 0 512 512" width={58} height={58} fill="none" stroke="#FFFFFF" strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}>
          <polyline points={ionChevronBackPoints} />
        </svg>
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
          <svg viewBox="0 0 512 512" width={62} height={62} fill="#FFFFFF">
            <path d={ionSearchPath} />
          </svg>
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
          <div style={{ fontSize: 64, fontWeight: 400 }}>{data.singer ?? data.creatorName ?? ''}</div>
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
            width: 104,
            height: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ opacity: currentLine ? 1 : 0.55 }}>
            <VoiceMemoWaveformIcon />
          </div>
        </div>
        <div
          style={{
            width: 104,
            height: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SeekStepIcon direction="backward" />
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
          <svg viewBox="0 0 512 512" width={82} height={82} fill="#F2F2F3">
            <path d={ionPauseLeftPath} />
            <path d={ionPauseRightPath} />
          </svg>
        </div>
        <div
          style={{
            width: 104,
            height: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SeekStepIcon direction="forward" />
        </div>
        <div
          style={{
            width: 104,
            height: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 512 512" width={68} height={68} fill="#0A84FF">
            <path d={ionTrashTopPath} style={{ fill: 'none' }} />
            <path d={ionTrashBodyPath} />
          </svg>
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
        {currentLine?.text ?? ''}
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
