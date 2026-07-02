import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { NeonSpectrumConfig } from './config';
import { getThemeColors } from './config';
import { getActiveLineState } from '../shared/timing';

const BAR_GAP = 6;

// Generate fake spectrum amplitudes based on frame + line energy
function getSpectrumData(frame: number, barCount: number, currentLineEnergy: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const freq = (i / barCount) * Math.PI * 5;
    const wave1 = Math.sin(frame * 0.045 + freq) * 0.42 + 0.48;
    const wave2 = Math.sin(frame * 0.032 - freq * 0.73) * 0.26 + 0.28;
    const wave3 = Math.sin(frame * 0.022 + i * 0.61) * 0.16 + 0.16;
    const energy = currentLineEnergy * 0.6 + 0.4;
    bars.push(Math.min(1, (wave1 + wave2 + wave3) * energy));
  }
  return bars;
}

function generateParticles(frame: number, count: number): Array<{ x: number; y: number; size: number; opacity: number }> {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 137.5;
    const x = ((Math.sin(frame * 0.002 + seed) + 1) / 2) * 100;
    const y = ((Math.cos(frame * 0.003 + seed * 1.3) + 1) / 2) * 100;
    const twinkle = Math.sin(frame * 0.05 + seed) * 0.5 + 0.5;
    particles.push({
      x: x * 10.8,
      y: y * 19.2,
      size: 2 + Math.sin(seed) * 3,
      opacity: 0.15 + twinkle * 0.5,
    });
  }
  return particles;
}

export const NeonSpectrumTemplate: React.FC<TemplateRenderProps<NeonSpectrumConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const colors = getThemeColors(config.colorTheme);
  const glowOpacity = config.glowIntensity === 'high' ? 0.8 : config.glowIntensity === 'medium' ? 0.5 : 0.3;
  const currentLineIndex =
    state.currentIndex >= 0 ? state.currentIndex : data.lines.length > 0 ? 0 : -1;
  const currentLine = currentLineIndex >= 0 ? data.lines[currentLineIndex] : null;
  const nextLine = currentLineIndex >= 0 && currentLineIndex < data.lines.length - 1
    ? data.lines[currentLineIndex + 1]
    : null;
  const lineEnergy = currentLine ? 0.7 + state.progressInLine * 0.3 : 0.3;

  const spectrum = getSpectrumData(frame, config.barCount, lineEnergy);
  const particles = config.showParticles ? generateParticles(frame, 40) : [];

  // Glow blur based on intensity
  const glowSize = config.glowIntensity === 'high' ? 40 : config.glowIntensity === 'medium' ? 25 : 12;

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Background glow layers */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 50% 20%, ${colors.primary}22 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 30% 80%, ${colors.secondary}18 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 70% 60%, ${colors.tertiary}15 0%, transparent 50%)
          `,
        }}
      />

      {/* Scan lines overlay */}
      {config.showScanLines && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 3px,
              rgba(0,0,0,0.15) 3px,
              rgba(0,0,0,0.15) 4px
            )`,
            pointerEvents: 'none',
            opacity: 0.5,
          }}
        />
      )}

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.secondary : colors.tertiary,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${colors.primary}${Math.round(glowOpacity * 80).toString(16)}`,
          }}
        />
      ))}

      {/* Spectrum bars at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: 60,
          right: 60,
          height: 360,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'stretch',
          gap: BAR_GAP,
        }}
      >
        {spectrum.map((amp, i) => {
          const barHeight = Math.max(4, amp * 340);
          const isCenter = Math.abs(i - spectrum.length / 2) / spectrum.length < 0.15;
          const barColor = isCenter ? colors.primary : i % 3 === 0 ? colors.secondary : colors.tertiary;
          return (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                height: barHeight,
                borderRadius: '7px 7px 3px 3px',
                background: `linear-gradient(0deg, ${barColor}44, ${barColor})`,
                boxShadow: `0 0 ${glowSize}px ${barColor}${Math.round(glowOpacity * 100).toString(16)}`,
              }}
            />
          );
        })}
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 60,
          right: 60,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: `0 0 ${glowSize * 2}px ${colors.primary}, 0 0 ${glowSize * 4}px ${colors.primary}66`,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {data.title}
        </h1>
        {data.singer && (
          <p
            style={{
              fontSize: 36,
              fontWeight: 400,
              color: colors.secondary,
              textShadow: `0 0 ${glowSize}px ${colors.secondary}66`,
              marginTop: 16,
              letterSpacing: 2,
              opacity: 0.8,
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* Two lyric lines - centered, glowing */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 60,
          right: 60,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          minHeight: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#FFFFFF',
            textShadow: `0 0 ${glowSize}px ${colors.primary}, 0 0 ${glowSize * 3}px ${colors.primary}44`,
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: 1,
            opacity: currentLine ? 1 : 0.2,
          }}
        >
          {currentLine?.text ?? ''}
        </span>
        <span
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: '#FFFFFF',
            textShadow: `0 0 ${Math.max(12, glowSize - 8)}px ${colors.secondary}, 0 0 ${glowSize * 2}px ${colors.secondary}33`,
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: 0.8,
            opacity: nextLine ? 0.68 : 0,
          }}
        >
          {nextLine?.text ?? ''}
        </span>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          left: 60,
          right: 60,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.tertiary}, transparent)`,
          boxShadow: `0 0 20px ${colors.primary}88`,
        }}
      />

      {/* Neon corner accents */}
      <div style={{ position: 'absolute', top: 40, left: 40, width: 60, height: 60, borderTop: `3px solid ${colors.primary}`, borderLeft: `3px solid ${colors.primary}`, boxShadow: `-2px -2px 15px ${colors.primary}44` }} />
      <div style={{ position: 'absolute', top: 40, right: 40, width: 60, height: 60, borderTop: `3px solid ${colors.secondary}`, borderRight: `3px solid ${colors.secondary}`, boxShadow: `2px -2px 15px ${colors.secondary}44` }} />
      <div style={{ position: 'absolute', bottom: 120, left: 40, width: 60, height: 60, borderBottom: `3px solid ${colors.tertiary}`, borderLeft: `3px solid ${colors.tertiary}`, boxShadow: `-2px 2px 15px ${colors.tertiary}44` }} />
      <div style={{ position: 'absolute', bottom: 120, right: 40, width: 60, height: 60, borderBottom: `3px solid ${colors.secondary}`, borderRight: `3px solid ${colors.secondary}`, boxShadow: `2px 2px 15px ${colors.secondary}44` }} />
    </div>
  );
};
