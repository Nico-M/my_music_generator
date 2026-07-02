import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { LiquidWaveConfig } from './config';
import { getLiquidColors } from './config';
import { getActiveLineState } from '../shared/timing';

type LiquidColors = ReturnType<typeof getLiquidColors>;

const WIDTH = 1080;
const HEIGHT = 1920;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Build a smooth horizontal wave path (like an ocean horizon / equalizer skyline).
// Samples sine-based points across the width and joins them with quadratic curves,
// then closes the shape down to `bottomY` so it renders as a filled silhouette.
// The path is drawn beyond the visible width (OVERSCAN) so the vertical closing
// edges land off-screen instead of creating a visible seam at the frame border.
const OVERSCAN = 160;

function buildWavePath(
  baseY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  bottomY: number,
  samples = 16
): string {
  const startX = -OVERSCAN;
  const endX = WIDTH + OVERSCAN;
  const step = (endX - startX) / samples;
  const pointAt = (x: number) => baseY + Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude;

  let path = `M ${startX} ${pointAt(startX).toFixed(1)}`;
  let prevX = startX;
  let prevY = pointAt(startX);
  for (let i = 1; i <= samples; i++) {
    const x = startX + i * step;
    const y = pointAt(x);
    const midX = (prevX + x) / 2;
    const midY = (prevY + y) / 2;
    path += ` Q ${prevX.toFixed(1)} ${prevY.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`;
    prevX = x;
    prevY = y;
  }
  path += ` L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  return path;
}

// A "wave band" is a cluster of 3 overlapping wave silhouettes (front/mid/back)
// that drift at slightly different speeds/phases to create parallax depth —
// this reads as an actual liquid wave instead of static rings.
function WaveBand({
  frame,
  centerY,
  spread,
  speedFactor,
  colors,
  colorOrder,
  towardTop,
  maxOpacity,
}: {
  frame: number;
  centerY: number;
  spread: number;
  speedFactor: number;
  colors: LiquidColors;
  colorOrder: [string, string, string];
  towardTop: boolean;
  maxOpacity: number;
}) {
  const bottomY = towardTop ? centerY - spread * 2.2 : centerY + spread * 2.2;
  const layers = [
    { amp: spread * 0.55, wavelength: 620, speed: 0.9, yOffset: -spread * 0.35, opacityMul: 0.5 },
    { amp: spread * 0.75, wavelength: 460, speed: 1.25, yOffset: 0, opacityMul: 0.72 },
    { amp: spread * 0.95, wavelength: 340, speed: 1.6, yOffset: spread * 0.4, opacityMul: 1 },
  ];

  // Feather the flat edge of the band into fog instead of a hard cut line.
  const flatEdgePct = clamp((bottomY / HEIGHT) * 100, 0, 100);
  const waveZonePct = clamp((centerY / HEIGHT) * 100, 0, 100);
  const maskImage = towardTop
    ? `linear-gradient(180deg, transparent 0%, transparent ${flatEdgePct}%, black ${waveZonePct}%, black 100%)`
    : `linear-gradient(180deg, black 0%, black ${waveZonePct}%, transparent ${flatEdgePct}%, transparent 100%)`;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        WebkitMaskImage: maskImage,
        maskImage,
      }}
    >
      <defs>
        <linearGradient id={`wave-grad-${centerY}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorOrder[0]} stopOpacity={0.85} />
          <stop offset="50%" stopColor={colorOrder[1]} stopOpacity={0.85} />
          <stop offset="100%" stopColor={colorOrder[2]} stopOpacity={0.85} />
        </linearGradient>
      </defs>
      {layers.map((l, i) => {
        const phase = (frame * 0.0055 * speedFactor * l.speed) % (Math.PI * 2);
        const path = buildWavePath(centerY + l.yOffset, l.amp, l.wavelength, phase, bottomY);
        return (
          <path
            key={i}
            d={path}
            fill={`url(#wave-grad-${centerY})`}
            opacity={clamp(maxOpacity * l.opacityMul, 0, 1)}
            style={{ filter: `blur(${2 + i * 2}px)` }}
          />
        );
      })}
    </svg>
  );
}

const PEARL_SEEDS = [
  { x: 45.1, y: 87.3 }, { x: 124.8, y: 162.4 }, { x: 198.2, y: 234.5 },
  { x: 272.9, y: 309.1 }, { x: 348.3, y: 383.5 }, { x: 423.1, y: 457.8 },
  { x: 497.2, y: 531.8 }, { x: 571.4, y: 607.9 }, { x: 646.6, y: 681.7 },
];

function getPearlData(frame: number) {
  return PEARL_SEEDS.map((seed, i) => {
    const baseX = ((Math.sin(seed.x * 2.17) + 1) / 2) * WIDTH;
    // Keep pearls out of the center lyric band (roughly 35%-65% of height)
    const rawY = ((Math.cos(seed.y * 1.89) + 1) / 2) * HEIGHT;
    const baseY = rawY < HEIGHT * 0.65 && rawY > HEIGHT * 0.35 ? rawY - HEIGHT * 0.3 : rawY;
    const driftX = Math.sin(frame * 0.00035 + seed.x) * 60;
    const driftY = Math.cos(frame * 0.00028 + seed.y * 1.2) * 40;
    const twinkle = Math.sin(frame * 0.007 + seed.x * 0.6) * 0.5 + 0.5;
    return {
      x: baseX + driftX,
      y: baseY + driftY,
      size: 2 + Math.sin(seed.y) * 2.6,
      opacity: clamp(0.1 + twinkle * 0.16, 0.08, 0.28),
      colorIndex: i % 3,
    };
  });
}

export const LiquidWaveTemplate: React.FC<TemplateRenderProps<LiquidWaveConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const colors = getLiquidColors(config.colorScheme);

  const currentLineIndex =
    state.currentIndex >= 0 ? state.currentIndex : data.lines.length > 0 ? 0 : -1;
  const currentLine = currentLineIndex >= 0 ? data.lines[currentLineIndex] : null;
  const nextLine = currentLineIndex >= 0 && currentLineIndex < data.lines.length - 1
    ? data.lines[currentLineIndex + 1]
    : null;

  const speedFactor = config.waveSpeed === 'fast' ? 1.25 : config.waveSpeed === 'medium' ? 1 : 0.78;
  const pearls = config.showParticles ? getPearlData(frame) : [];
  const palette = [colors.accent1, colors.accent2, colors.accent3] as [string, string, string];

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.base,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* ===== Deep cinematic base gradient ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, #050b16 0%, ${colors.base} 40%, #030710 100%)`,
        }}
      />

      {/* ===== Ambient ocean-glow blobs (soft, off-center for asymmetry) ===== */}
      <div
        style={{
          position: 'absolute',
          left: -160,
          top: 120 + Math.sin(frame * 0.0012) * 40,
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent2}30 0%, ${colors.accent1}18 45%, transparent 72%)`,
          filter: 'blur(90px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -200,
          bottom: 60 + Math.cos(frame * 0.0011) * 50,
          width: 680,
          height: 680,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent3}28 0%, ${colors.accent2}16 45%, transparent 72%)`,
          filter: 'blur(100px)',
        }}
      />

      {/* ===== Upper wave band — behind title, above lyrics ===== */}
      <WaveBand
        frame={frame}
        centerY={430}
        spread={70}
        speedFactor={speedFactor}
        colors={colors}
        colorOrder={palette}
        towardTop
        maxOpacity={0.34}
      />

      {/* ===== Lower wave band — below lyrics, above credit ===== */}
      <WaveBand
        frame={frame + 400}
        centerY={1560}
        spread={85}
        speedFactor={speedFactor}
        colors={colors}
        colorOrder={[palette[2], palette[1], palette[0]]}
        towardTop={false}
        maxOpacity={0.36}
      />

      {/* ===== Pearl particles, kept out of the lyric band ===== */}
      {pearls.map((p, i) => (
        <div
          key={`pearl-${i}`}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: palette[p.colorIndex],
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${palette[p.colorIndex]}aa`,
          }}
        />
      ))}

      {/* ===== Edge vignette for cinematic depth ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 22%, transparent 68%, rgba(0,0,0,0.46) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ===== Title ===== */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 60,
          right: 60,
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 58,
            fontWeight: 320,
            color: '#FFFFFF',
            letterSpacing: 5.5,
            lineHeight: 1.2,
            textShadow: `0 0 30px rgba(0,0,0,0.6), 0 0 64px ${colors.accent2}55`,
          }}
        >
          {data.title}
        </h1>
        {data.singer && (
          <p
            style={{
              marginTop: 18,
              marginBottom: 0,
              fontSize: 26,
              fontWeight: 220,
              color: colors.accent2,
              letterSpacing: 3.8,
              opacity: 0.7,
              textShadow: '0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* ===== Lyrics — no boxy card, just clean text with strong contrast shadow ===== */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 70,
          right: 70,
          transform: 'translateY(-50%)',
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 54,
            fontWeight: 380,
            textAlign: 'center',
            lineHeight: 1.36,
            letterSpacing: 1.6,
            opacity: currentLine ? 0.98 : 0.16,
            textShadow: `0 2px 4px rgba(0,0,0,0.5), 0 0 26px rgba(0,0,0,0.7), 0 0 50px ${colors.accent2}40`,
          }}
        >
          {currentLine?.text ?? ''}
        </span>
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 37,
            fontWeight: 280,
            textAlign: 'center',
            lineHeight: 1.34,
            letterSpacing: 1.1,
            opacity: nextLine ? 0.56 : 0,
            textShadow: `0 1px 3px rgba(0,0,0,0.45), 0 0 18px rgba(0,0,0,0.55), 0 0 36px ${colors.accent1}30`,
          }}
        >
          {nextLine?.text ?? ''}
        </span>
      </div>

      {/* ===== Bottom artist credit ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 98,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 200,
          color: colors.accent3,
          letterSpacing: 3,
          opacity: 0.4,
          textShadow: '0 0 16px rgba(0,0,0,0.6)',
          zIndex: 30,
        }}
      >
        {data.creatorName ?? ''}
      </div>
    </div>
  );
};
