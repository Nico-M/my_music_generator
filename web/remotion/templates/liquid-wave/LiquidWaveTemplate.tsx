import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { LiquidWaveConfig } from './config';
import { getLiquidColors } from './config';
import { getActiveLineState } from '../shared/timing';

const WIDTH = 1080;
const HEIGHT = 1920;
const LYRIC_LINE_HEIGHT = 86;
const LYRIC_VIEWPORT_H = 340;

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Generate organic tidal wave path for bottom (1/3 screen height ~650px)
function buildTidalPath(
  baseY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  bottomY: number,
  samples = 22
): string {
  const startX = -60;
  const endX = WIDTH + 60;
  const step = (endX - startX) / samples;
  const pointY = (x: number) =>
    baseY +
    Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude +
    Math.cos((x / (wavelength * 0.58)) * Math.PI * 2 - phase * 0.68) * (amplitude * 0.32);

  let d = `M ${startX} ${pointY(startX).toFixed(1)}`;
  let prevX = startX;
  let prevY = pointY(startX);

  for (let i = 1; i <= samples; i++) {
    const x = startX + i * step;
    const y = pointY(x);
    const cx = (prevX + x) / 2;
    const cy = (prevY + y) / 2;
    d += ` Q ${prevX.toFixed(1)} ${prevY.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    prevX = x;
    prevY = y;
  }
  d += ` L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  return d;
}

function buildTidalCrestPath(
  baseY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  samples = 22
): string {
  const startX = -60;
  const endX = WIDTH + 60;
  const step = (endX - startX) / samples;
  const pointY = (x: number) =>
    baseY +
    Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude +
    Math.cos((x / (wavelength * 0.58)) * Math.PI * 2 - phase * 0.68) * (amplitude * 0.32);

  let d = `M ${startX} ${pointY(startX).toFixed(1)}`;
  let prevX = startX;
  let prevY = pointY(startX);

  for (let i = 1; i <= samples; i++) {
    const x = startX + i * step;
    const y = pointY(x);
    const cx = (prevX + x) / 2;
    const cy = (prevY + y) / 2;
    d += ` Q ${prevX.toFixed(1)} ${prevY.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    prevX = x;
    prevY = y;
  }
  return d;
}

interface UnderwaterBubble {
  x: number;
  y: number;
  size: number;
  opacity: number;
  scale: number;
}

const WATER_WAVE_HEIGHT = 650; // ~1/3 of 1920 (640px)
const WATER_SURFACE_Y = HEIGHT - WATER_WAVE_HEIGHT + 70; // ~1340px
const WATER_BOTTOM_Y = HEIGHT; // 1920px

const BUBBLE_SEEDS = [
  { x: 90,  speed: 2.1, size: 16, wobbleSpeed: 0.04, wobbleAmp: 14, phase: 0.2, delay: 0 },
  { x: 170, speed: 2.7, size: 9,  wobbleSpeed: 0.06, wobbleAmp: 10, phase: 1.1, delay: 180 },
  { x: 230, speed: 1.8, size: 22, wobbleSpeed: 0.035, wobbleAmp: 16, phase: 2.4, delay: 360 },
  { x: 300, speed: 3.0, size: 7,  wobbleSpeed: 0.07, wobbleAmp: 8,  phase: 3.1, delay: 90 },
  { x: 360, speed: 2.3, size: 18, wobbleSpeed: 0.045, wobbleAmp: 12, phase: 0.8, delay: 480 },
  { x: 420, speed: 2.5, size: 11, wobbleSpeed: 0.05, wobbleAmp: 9,  phase: 4.2, delay: 240 },
  { x: 480, speed: 1.9, size: 26, wobbleSpeed: 0.03, wobbleAmp: 18, phase: 1.7, delay: 600 },
  { x: 540, speed: 2.8, size: 8,  wobbleSpeed: 0.065, wobbleAmp: 11, phase: 5.0, delay: 150 },
  { x: 600, speed: 2.2, size: 15, wobbleSpeed: 0.04, wobbleAmp: 13, phase: 2.9, delay: 420 },
  { x: 670, speed: 3.1, size: 7,  wobbleSpeed: 0.075, wobbleAmp: 7, phase: 0.5, delay: 30 },
  { x: 730, speed: 2.0, size: 24, wobbleSpeed: 0.032, wobbleAmp: 15, phase: 3.7, delay: 520 },
  { x: 800, speed: 2.6, size: 12, wobbleSpeed: 0.055, wobbleAmp: 10, phase: 1.4, delay: 270 },
  { x: 870, speed: 2.4, size: 17, wobbleSpeed: 0.042, wobbleAmp: 12, phase: 4.8, delay: 390 },
  { x: 940, speed: 2.9, size: 8,  wobbleSpeed: 0.06, wobbleAmp: 8,  phase: 2.1, delay: 120 },
  { x: 130, speed: 2.4, size: 13, wobbleSpeed: 0.048, wobbleAmp: 11, phase: 5.6, delay: 310 },
  { x: 270, speed: 3.2, size: 6,  wobbleSpeed: 0.08, wobbleAmp: 7,  phase: 0.9, delay: 70 },
  { x: 390, speed: 1.7, size: 25, wobbleSpeed: 0.03, wobbleAmp: 19, phase: 3.3, delay: 580 },
  { x: 510, speed: 2.7, size: 10, wobbleSpeed: 0.058, wobbleAmp: 9, phase: 2.0, delay: 210 },
  { x: 640, speed: 2.3, size: 19, wobbleSpeed: 0.041, wobbleAmp: 14, phase: 4.5, delay: 450 },
  { x: 770, speed: 3.0, size: 7,  wobbleSpeed: 0.072, wobbleAmp: 8, phase: 1.2, delay: 140 },
  { x: 840, speed: 2.1, size: 21, wobbleSpeed: 0.038, wobbleAmp: 16, phase: 3.9, delay: 340 },
  { x: 910, speed: 2.8, size: 9,  wobbleSpeed: 0.062, wobbleAmp: 9, phase: 0.4, delay: 500 },
  { x: 200, speed: 2.5, size: 14, wobbleSpeed: 0.052, wobbleAmp: 12, phase: 2.7, delay: 170 },
  { x: 340, speed: 2.0, size: 20, wobbleSpeed: 0.036, wobbleAmp: 15, phase: 4.1, delay: 630 },
  { x: 460, speed: 3.1, size: 8,  wobbleSpeed: 0.076, wobbleAmp: 8, phase: 1.8, delay: 290 },
  { x: 580, speed: 2.2, size: 16, wobbleSpeed: 0.043, wobbleAmp: 13, phase: 5.3, delay: 80 },
  { x: 700, speed: 2.9, size: 10, wobbleSpeed: 0.064, wobbleAmp: 10, phase: 3.0, delay: 400 },
  { x: 820, speed: 1.8, size: 23, wobbleSpeed: 0.033, wobbleAmp: 17, phase: 0.7, delay: 560 },
  { x: 150, speed: 3.3, size: 6,  wobbleSpeed: 0.082, wobbleAmp: 6, phase: 4.4, delay: 20 },
  { x: 630, speed: 2.6, size: 12, wobbleSpeed: 0.054, wobbleAmp: 11, phase: 2.3, delay: 260 },
  { x: 760, speed: 2.4, size: 15, wobbleSpeed: 0.046, wobbleAmp: 13, phase: 1.5, delay: 470 },
  { x: 890, speed: 3.0, size: 8,  wobbleSpeed: 0.07, wobbleAmp: 7,  phase: 3.6, delay: 190 },
];

function getUnderwaterBubbles(frame: number, speedMul: number): UnderwaterBubble[] {
  const travelDist = WATER_BOTTOM_Y - WATER_SURFACE_Y + 90; // ~670px

  return BUBBLE_SEEDS.map((s) => {
    const cycle = (frame * s.speed * speedMul * 1.5 + s.delay) % travelDist;
    const y = WATER_BOTTOM_Y + 30 - cycle;
    const driftX =
      Math.sin(frame * s.wobbleSpeed * speedMul + s.phase) * s.wobbleAmp +
      Math.cos(frame * 0.02 * speedMul + s.phase * 1.6) * (s.wobbleAmp * 0.35);
    const x = s.x + driftX;

    let opacity = 0.85;
    let scale = 1.0;

    // Fade in as it emerges from deep bottom
    if (y > WATER_BOTTOM_Y - 50) {
      opacity = Math.max(0, (WATER_BOTTOM_Y + 30 - y) / 80) * 0.85;
    } else if (y < WATER_SURFACE_Y + 70) {
      // Near surface: bubble expands slightly and pops
      const popDist = Math.min(1, Math.max(0, (WATER_SURFACE_Y + 70 - y) / 70));
      scale = 1 + popDist * 0.45;
      opacity = (1 - popDist) * 0.85;
    }

    return {
      x,
      y,
      size: s.size,
      opacity,
      scale,
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
  const colors = getLiquidColors(config.colorScheme);

  const speedMul =
    config.waveSpeed === 'fast' ? 1.4 : config.waveSpeed === 'medium' ? 1 : 0.7;

  const totalDurationMs = Math.max(data.durationMs || 0, 1000);
  const progressRatio = Math.min(1, Math.max(0, nowMs / totalDurationMs));

  // Floating disc motion: slight vertical bob and gentle rotation
  const discBobY = Math.sin(frame * 0.032 * speedMul) * 12;
  const discRotation = frame * 0.22 * speedMul;

  // Concentric ripples expanding outwards from disc center (cy = 390)
  const discCenterY = 390;
  const rippleCount = config.rippleCount || 4;
  const ripples = Array.from({ length: rippleCount }).map((_, i) => {
    const period = 90 / speedMul;
    const t = ((frame + i * (period / rippleCount)) % period) / period;
    const radius = 160 + t * 200;
    const opacity = (1 - t) * 0.45;
    return { radius, opacity };
  });

  const bubbles = config.showParticles ? getUnderwaterBubbles(frame, speedMul) : [];

  // ------------------------------------------------------------------------
  // Smooth Kinetic Scrolling Lyrics Stream (Deterministic Math, 0 Jitter)
  // ------------------------------------------------------------------------
  const timedLines = useMemo(() => {
    const list: { lineIdx: number; startMs: number; text: string }[] = [];
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      if (line.startMs != null) {
        list.push({ lineIdx: i, startMs: line.startMs, text: line.text });
      }
    }
    return list;
  }, [data.lines]);

  const activeSegment = useMemo(() => {
    if (timedLines.length === 0) return -1;
    let seg = -1;
    for (let k = 0; k < timedLines.length; k++) {
      if (nowMs >= timedLines[k].startMs) {
        seg = k;
      } else {
        break;
      }
    }
    return seg;
  }, [timedLines, nowMs]);

  const lyricScrollY = useMemo(() => {
    if (timedLines.length === 0) return 0;
    if (activeSegment < 0) return 0;

    const current = timedLines[activeSegment];
    const targetY = current.lineIdx * LYRIC_LINE_HEIGHT;

    if (activeSegment === 0) {
      const firstLineDuration = Math.min(320, Math.max(160, current.startMs));
      return interpolate(
        nowMs,
        [Math.max(0, current.startMs - firstLineDuration), current.startMs],
        [Math.max(0, targetY - LYRIC_LINE_HEIGHT * 0.4), targetY],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        }
      );
    }

    const prev = timedLines[activeSegment - 1];
    const prevTargetY = prev.lineIdx * LYRIC_LINE_HEIGHT;

    if (prevTargetY === targetY) {
      return targetY;
    }

    const gap = current.startMs - prev.startMs;
    const scrollDuration = Math.min(340, Math.max(180, gap * 0.35));

    return interpolate(
      nowMs,
      [current.startMs, current.startMs + scrollDuration],
      [prevTargetY, targetY],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );
  }, [timedLines, activeSegment, nowMs]);

  const CENTER_Y = (LYRIC_VIEWPORT_H - LYRIC_LINE_HEIGHT) / 2;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.base,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
        color: '#FFFFFF',
      }}
    >
      {/* ===== LAYER 1: DEEP FLUID GRADIENT BACKGROUND ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle 800px at 50% 20%, ${colors.accent1}24 0%, transparent 70%),
            radial-gradient(circle 900px at 80% 60%, ${colors.accent2}20 0%, transparent 65%),
            radial-gradient(circle 700px at 20% 80%, ${colors.accent3}1e 0%, transparent 60%),
            linear-gradient(180deg, ${colors.base} 0%, #030810 100%)
          `,
        }}
      />

      {/* ===== LAYER 2: ORGANIC CAUSTIC LIGHT BLOBS ===== */}
      {true && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 240 + Math.sin(frame * 0.02 * speedMul) * 35,
              left: 140 + Math.cos(frame * 0.015 * speedMul) * 50,
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors.accent1}33 0%, transparent 70%)`,
              filter: 'blur(60px)',
              pointerEvents: 'none',
              opacity: 0.65,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 760 + Math.cos(frame * 0.025 * speedMul) * 40,
              right: 120 + Math.sin(frame * 0.018 * speedMul) * 60,
              width: 460,
              height: 460,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors.accent2}26 0%, transparent 70%)`,
              filter: 'blur(70px)',
              pointerEvents: 'none',
              opacity: 0.6,
            }}
          />
        </>
      )}

      {/* ===== LAYER 3: CONCENTRIC WATER RIPPLES ===== */}
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
      >
        {ripples.map((r, idx) => (
          <circle
            key={idx}
            cx={WIDTH / 2}
            cy={discCenterY + discBobY}
            r={r.radius}
            fill="none"
            stroke={colors.accent1}
            strokeWidth={1.8}
            strokeDasharray="8 6"
            opacity={r.opacity}
          />
        ))}
      </svg>

      {/* ===== LAYER 4: FLOATING DISK CENTERPIECE (BORDERLESS) ===== */}
      <div
        style={{
          position: 'absolute',
          top: discCenterY - 140 + discBobY,
          left: WIDTH / 2 - 140,
          width: 280,
          height: 280,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#050D18',
          boxShadow: `0 20px 60px rgba(0,0,0,0.75), 0 0 35px ${colors.accent1}55`,
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${discRotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {data.coverUrl ? (
            <img
              src={data.coverUrl}
              alt={data.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            /* Procedural Ripple Vinyl Fallback */
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `radial-gradient(circle, ${colors.accent2}33 0%, #060e1a 75%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {[100, 70, 40].map((dim, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    width: dim * 2,
                    height: dim * 2,
                    borderRadius: '50%',
                    border: `1px solid ${colors.accent1}25`,
                  }}
                />
              ))}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: colors.accent1,
                  boxShadow: `0 0 16px ${colors.accent1}`,
                }}
              />
            </div>
          )}

          {/* Liquid Glass Shimmer reflection */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 45%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* ===== LAYER 5: SONG TITLE & SINGER ===== */}
      <div
        style={{
          position: 'absolute',
          top: 560,
          left: 72,
          right: 72,
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: 2,
            color: '#FFFFFF',
            textShadow: `0 2px 14px rgba(0,0,0,0.6), 0 0 40px ${colors.accent1}55`,
            lineHeight: 1.15,
          }}
        >
          {data.title}
        </h1>
        {data.singer && (
          <p
            style={{
              margin: '10px 0 0 0',
              fontSize: 40,
              fontWeight: 500,
              color: colors.accent2,
              letterSpacing: 4,
              textTransform: 'uppercase',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              opacity: 0.9,
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* ===== LAYER 6: BORDERLESS KINETIC SLIDING LYRICS STREAM ===== */}
      <div
        style={{
          position: 'absolute',
          top: 670,
          left: 64,
          right: 64,
          height: LYRIC_VIEWPORT_H,
          overflow: 'hidden',
          zIndex: 35,
          maskImage:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 18%, black 35%, black 65%, rgba(0,0,0,0.85) 82%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 18%, black 35%, black 65%, rgba(0,0,0,0.85) 82%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            transform: `translateY(${-lyricScrollY + CENTER_Y}px) translateZ(0)`,
            willChange: 'transform',
          }}
        >
          {data.lines.map((line, idx) => {
            const lineCenterY = idx * LYRIC_LINE_HEIGHT;
            const distPx = Math.abs(lineCenterY - lyricScrollY);
            const normDist = distPx / LYRIC_LINE_HEIGHT;

            const opacity = interpolate(normDist, [0, 0.85, 1.8], [1, 0.52, 0.1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const scale = interpolate(normDist, [0, 1.2], [1.06, 0.93], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const isCenter = normDist < 0.45;

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  top: idx * LYRIC_LINE_HEIGHT,
                  left: 0,
                  right: 0,
                  height: LYRIC_LINE_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  opacity,
                }}
              >
                <span
                  style={{
                    fontSize: isCenter ? 48 : 34,
                    fontWeight: isCenter ? 800 : 500,
                    color: isCenter ? '#FFFFFF' : colors.accent3,
                    letterSpacing: isCenter ? 1.5 : 1.2,
                    lineHeight: 1.25,
                    padding: '0 32px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== LAYER 7: TIDAL WATER WAVES AT BOTTOM (~1/3 SCREEN HEIGHT) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: WATER_WAVE_HEIGHT,
          pointerEvents: 'none',
          zIndex: 18,
          overflow: 'hidden',
        }}
      >
        <svg
          width={WIDTH}
          height={WATER_WAVE_HEIGHT}
          viewBox={`0 0 ${WIDTH} ${WATER_WAVE_HEIGHT}`}
          style={{ position: 'absolute', bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="tidal-grad-back" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.accent1} stopOpacity={0.22} />
              <stop offset="100%" stopColor={colors.accent2} stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="tidal-grad-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.accent2} stopOpacity={0.38} />
              <stop offset="100%" stopColor={colors.accent3} stopOpacity={0.65} />
            </linearGradient>
            <linearGradient id="tidal-grad-front" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.accent1} stopOpacity={0.32} />
              <stop offset="50%" stopColor={colors.accent2} stopOpacity={0.55} />
              <stop offset="100%" stopColor={colors.accent3} stopOpacity={0.82} />
            </linearGradient>
            <filter id="crest-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Underwater Depth Ambient Base */}
          <rect
            x={0}
            y={120}
            width={WIDTH}
            height={WATER_WAVE_HEIGHT - 120}
            fill={colors.base}
            opacity={0.65}
          />

          {/* Layer 1: Back Wave */}
          <path
            d={buildTidalPath(
              50,
              38,
              540,
              frame * 0.018 * speedMul + 1.4,
              WATER_WAVE_HEIGHT
            )}
            fill="url(#tidal-grad-back)"
          />

          {/* Layer 2: Mid Wave */}
          <path
            d={buildTidalPath(
              72,
              30,
              430,
              frame * 0.024 * speedMul + 0.5,
              WATER_WAVE_HEIGHT
            )}
            fill="url(#tidal-grad-mid)"
          />

          {/* Layer 3: Front Wave */}
          <path
            d={buildTidalPath(
              92,
              25,
              350,
              frame * 0.03 * speedMul,
              WATER_WAVE_HEIGHT
            )}
            fill="url(#tidal-grad-front)"
          />

          {/* Layer 4: Front Wave Glistening Crest Line */}
          <path
            d={buildTidalCrestPath(
              92,
              25,
              350,
              frame * 0.03 * speedMul
            )}
            fill="none"
            stroke={colors.accent1}
            strokeWidth={2.4}
            strokeOpacity={0.85}
            filter="url(#crest-glow)"
          />
        </svg>
      </div>

      {/* ===== LAYER 8: REALISTIC UNDERWATER RISING BUBBLES ===== */}
      {bubbles.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x - b.size / 2,
            top: b.y - b.size / 2,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.88) 0%, rgba(130, 235, 255, 0.32) 28%, rgba(8, 70, 150, 0.12) 68%, rgba(130, 235, 255, 0.42) 100%)',
            border: '1.2px solid rgba(220, 245, 255, 0.7)',
            boxShadow: `inset -1.5px -1.5px 4px rgba(0, 180, 255, 0.35), 0 0 ${Math.max(4, b.size * 0.75)}px ${colors.accent1}77`,
            opacity: b.opacity,
            transform: `scale(${b.scale})`,
            pointerEvents: 'none',
            zIndex: 22,
          }}
        >
          {/* Internal Specular Reflection Dot for realistic 3D bubble refraction */}
          {b.size >= 9 && (
            <div
              style={{
                position: 'absolute',
                top: '16%',
                left: '20%',
                width: Math.max(2, Math.round(b.size * 0.25)),
                height: Math.max(2, Math.round(b.size * 0.25)),
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                opacity: 0.95,
              }}
            />
          )}
        </div>
      ))}

      {/* ===== LAYER 9: BOTTOM PROGRESS DOCK ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          left: 72,
          right: 72,
          zIndex: 40,
        }}
      >
        {/* Sleek Oceanic Progress Track */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.16)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressRatio * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${colors.accent1}, ${colors.accent2}, ${colors.accent3})`,
              boxShadow: `0 0 12px ${colors.accent1}`,
            }}
          />
        </div>

        {/* Time and Creator Subtitle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            fontSize: 22,
            fontWeight: 500,
            fontFamily: '"Fira Code", monospace',
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          <span>{formatTime(nowMs)}</span>
          <span style={{ fontFamily: 'inherit', letterSpacing: 2, opacity: 0.7 }}>
            {data.creatorName ?? 'OCEAN ECHO'}
          </span>
          <span>{formatTime(totalDurationMs)}</span>
        </div>
      </div>
    </div>
  );
};
