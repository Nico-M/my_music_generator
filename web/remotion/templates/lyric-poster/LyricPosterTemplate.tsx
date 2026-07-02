import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { LyricPosterConfig } from './config';
import { getActiveLineState } from '../shared/timing';

function WaveformAccent({ frame, color }: { frame: number; color: string }) {
  const bars = 36;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: 60,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const freq = (i / bars) * Math.PI * 8;
        const amp = Math.sin(frame * 0.06 + freq) * 0.4 + 0.6;
        const barH = Math.max(2, amp * 50);
        return (
          <div
            key={i}
            style={{
              width: 4,
              height: barH,
              borderRadius: 2,
              background: color,
              opacity: 0.3 + amp * 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

function getScaleFactor(size: LyricPosterConfig['typographyScale']) {
  switch (size) {
    case 'xlarge': return 1.4;
    case 'large': return 1.15;
    default: return 1;
  }
}

function getBackgroundGradient(frame: number, config: LyricPosterConfig): React.CSSProperties {
  if (config.backgroundStyle === 'dark-solid') {
    return { backgroundColor: '#0A0A0A' };
  }
  // Animated gradient
  const shift = Math.sin(frame * 0.002) * 10;
  const shift2 = Math.cos(frame * 0.003) * 10;
  return {
    background: `linear-gradient(135deg, #0F0A1E ${30 + shift}%, #1A0A2E ${50 + shift2}%, #2D1B69)`,
  };
}

export const LyricPosterTemplate: React.FC<TemplateRenderProps<LyricPosterConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const scale = getScaleFactor(config.typographyScale);

  // Get current + next line for multi-line poster feel
  const currentLine = state.currentIndex >= 0 ? data.lines[state.currentIndex] : null;
  const nextLine = state.nextIndex >= 0 ? data.lines[state.nextIndex] : null;
  const maxLines = data.lines.length;

  // Show 4 visible lines: current, future lines, and past lines
  const visibleStart = Math.max(0, state.currentIndex - 2);
  const visibleEnd = Math.min(maxLines, state.currentIndex + 3);
  const visibleLines = data.lines.slice(visibleStart, visibleEnd);

  const bg = getBackgroundGradient(frame, config);
  const accentColor = config.accentColor;

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
        ...bg,
        color: '#FFFFFF',
      }}
    >
      {/* Subtle grain/noise overlay using CSS */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Top section: title & artist */}
      <div
        style={{
          position: 'relative',
          paddingTop: config.layout === 'bottom-wave' ? 80 : 140,
          paddingLeft: 60,
          paddingRight: 60,
          textAlign: config.layout === 'center-emphasis' ? 'center' : 'left',
        }}
      >
        <p
          style={{
            fontSize: Math.round(42 * scale),
            fontWeight: 700,
            color: accentColor,
            letterSpacing: 4,
            textTransform: 'uppercase',
            margin: 0,
            opacity: 0.5 + Math.sin(frame * 0.01) * 0.1,
          }}
        >
          {data.title}
        </p>
        {data.singer && (
          <p
            style={{
              fontSize: Math.round(24 * scale),
              fontWeight: 300,
              color: '#999',
              letterSpacing: 2,
              marginTop: 14,
              opacity: 0.6,
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* Lyric lines - cinematic poster style */}
      <div
        style={{
          position: 'absolute',
          top: config.layout === 'center-emphasis' ? '40%' : config.layout === 'top-title' ? '55%' : '35%',
          left: 60,
          right: 60,
          transform: config.layout === 'center-emphasis' ? 'translateY(-50%)' : 'none',
        }}
      >
        {visibleLines.map((line, i) => {
          const actualIndex = visibleStart + i;
          const isCurrent = actualIndex === state.currentIndex;
          const isPast = actualIndex < state.currentIndex;
          const isFuture = actualIndex > state.currentIndex;

          // Animate entrance: slide up + fade
          const futureOffset = isFuture ? Math.min(3, actualIndex - state.currentIndex) : 0;
          const offsetSlide = isFuture ? Math.max(0, 30 - futureOffset * 8) : 0;
          const opacity = isCurrent ? 1 : isPast ? 0.3 : Math.max(0.05, 0.4 - futureOffset * 0.12);

          const fontSize = isCurrent
            ? Math.round(64 * scale)
            : Math.round(38 * scale);

          return (
            <div
              key={i}
              style={{
                marginBottom: isCurrent ? 24 : 16,
                transform: `translateY(${offsetSlide}px)`,
                transition: 'transform 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize,
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? '#FFFFFF' : '#666',
                  lineHeight: 1.2,
                  letterSpacing: isCurrent ? 1 : 0.5,
                  textShadow: isCurrent ? `0 0 40px ${accentColor}33` : 'none',
                  opacity,
                  display: 'block',
                }}
              >
                {line.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Waveform at bottom */}
      {config.showWaveform && (
        <div
          style={{
            position: 'absolute',
            bottom: 180,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <WaveformAccent frame={frame} color={accentColor} />
        </div>
      )}

      {/* Bottom credit */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 300,
          color: accentColor,
          letterSpacing: 3,
          opacity: 0.25,
        }}
      >
        {data.creatorName ?? 'SingVid'}
      </div>
    </div>
  );
};
