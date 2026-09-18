import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { NeonSpectrumConfig, WaveThemeDef } from './config';
import { getThemeColors } from './config';
import { getActiveLineState } from '../shared/timing';
import { SoftAurora } from '../../shared/fx/SoftAurora';

const BAR_GAP = 8;
const LYRIC_LINE_HEIGHT = 86;
const LYRIC_VIEWPORT_H = 340;
const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

// Symmetrical frequency bar heights (fallback when visualizerStyle === 'bars')
function getSpectrumAmplitudes(frame: number, barCount: number, energy: number): number[] {
  const bars: number[] = [];
  const half = Math.floor(barCount / 2);
  for (let i = 0; i < barCount; i++) {
    const distFromCenter = Math.abs(i - half) / half;
    const centerFactor = Math.cos(distFromCenter * Math.PI * 0.45);

    const wave1 = Math.sin(frame * 0.055 + i * 0.42) * 0.35 + 0.5;
    const wave2 = Math.cos(frame * 0.038 - i * 0.31) * 0.25 + 0.25;
    const pulse = (wave1 + wave2) * centerFactor;
    const clamped = Math.max(0.08, Math.min(1, pulse * (energy * 0.7 + 0.5)));
    bars.push(clamped);
  }
  return bars;
}

// Background cyber particles
function getParticles(frame: number, count: number) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 137.5;
    const x = ((Math.sin(frame * 0.0018 + seed) + 1) / 2) * 1080;
    const y = ((Math.cos(frame * 0.0024 + seed * 1.4) + 1) / 2) * 1920;
    const twinkle = Math.sin(frame * 0.06 + seed * 2) * 0.5 + 0.5;
    list.push({
      x,
      y,
      size: 3 + (i % 4) * 2,
      opacity: 0.12 + twinkle * 0.45,
    });
  }
  return list;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

// --------------------------------------------------------------------------
// NeonSpectrumTemplate Component
// --------------------------------------------------------------------------
export const NeonSpectrumTemplate: React.FC<TemplateRenderProps<NeonSpectrumConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const colors = getThemeColors(config.colorTheme);

  const glowMultiplier =
    config.glowIntensity === 'high' ? 1 : config.glowIntensity === 'medium' ? 0.65 : 0.4;
  const glowSize = Math.round(28 * glowMultiplier);

  const currentLineIndex = state.currentIndex;
  const currentLine = currentLineIndex >= 0 ? data.lines[currentLineIndex] : null;

  // Smooth sinusoidal vocal energy bell curve (starts at 0, peaks at mid-phrase, returns to 0 at end of line)
  // Ensures 100% seamless continuity without any height jumps or sawtooth breaks
  const vocalEnergy = currentLine
    ? Math.sin(Math.max(0, Math.min(1, state.progressInLine)) * Math.PI)
    : 0;
  const particles = config.showParticles ? getParticles(frame, 32) : [];

  const totalDurationMs = Math.max(data.durationMs || 0, 1000);
  const progressRatio = Math.min(1, Math.max(0, nowMs / totalDurationMs));

  // Audio-reactive bass thump and breathing pulse for the cover lightbox
  const coverPulse = 1 + Math.sin(frame * 0.035) * 0.012 + vocalEnergy * 0.036;

  // ------------------------------------------------------------------------
  // Smooth Kinetic Scrolling Lyrics Logic (Deterministic Math, 0 Jitter)
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
    if (timedLines.length === 0) {
      return 0;
    }

    if (activeSegment < 0) {
      return 0;
    }

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

  // Visualizer style configuration
  const isBarsMode = config.visualizerStyle === 'bars';
  const spectrumBars = isBarsMode ? getSpectrumAmplitudes(frame, config.barCount, vocalEnergy) : [];

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.bg,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
        color: '#FFFFFF',
      }}
    >
      {/* Layer 1: Ambient Cyber Atmosphere Gradients */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle 600px at 50% 30%, ${colors.primary}20 0%, transparent 70%),
            radial-gradient(circle 500px at 20% 75%, ${colors.secondary}1c 0%, transparent 65%),
            radial-gradient(circle 600px at 80% 85%, ${colors.tertiary}18 0%, transparent 70%),
            linear-gradient(180deg, #030206 0%, ${colors.bg} 50%, #030206 100%)
          `,
        }}
      />

      {/* Layer 2: Scanlines overlay */}
      {config.showScanLines && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 2px, transparent 2px, transparent 4px)',
            pointerEvents: 'none',
            opacity: 0.35,
          }}
        />
      )}

      {/* Layer 3: Neon Bokeh Particles */}
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
            backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${i % 2 === 0 ? colors.primary : colors.secondary}`,
          }}
        />
      ))}

      {/* ===== TOP STATUS BAR ===== */}
      <div
        style={{
          position: 'absolute',
          top: 64,
          left: 64,
          right: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 40,
        }}
      >
        {/* Left: Timecode Readout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: '"Fira Code", monospace, "SF Pro Display", sans-serif',
            fontSize: 22,
            fontWeight: 600,
            color: colors.primary,
            textShadow: `0 0 12px ${colors.primary}99`,
            letterSpacing: 2,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 10px #10B981',
              display: 'inline-block',
            }}
          />
          <span>TIMECODE [{formatTime(nowMs)}]</span>
        </div>

        {/* Right: Stereo Audio Level Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.45)',
              letterSpacing: 2,
              marginRight: 6,
            }}
          >
            CH-LR
          </span>
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const activeThreshold = (idx + 1) / 6;
            const meterLevel = 0.42 + Math.sin(frame * 0.14 + idx * 0.55) * 0.22 + vocalEnergy * 0.36;
            const isLit = meterLevel >= activeThreshold;
            const blockColor =
              idx >= 4 ? '#EF4444' : idx >= 2 ? colors.secondary : colors.primary;
            return (
              <div
                key={idx}
                style={{
                  width: 12,
                  height: 22,
                  borderRadius: 2,
                  backgroundColor: isLit ? blockColor : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isLit ? `0 0 10px ${blockColor}` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ===== CENTERPIECE: TACTICAL HUD FLOATING COVER ARTWORK ===== */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 30,
        }}
      >
        {/* Cover Art Box with Tactical HUD Corner Brackets */}
        <div
          style={{
            position: 'relative',
            width: 300,
            height: 300,
            transform: `scale(${coverPulse})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Tactical Cyber Reticles at 4 corners */}
          {[-1, 1].map((xDir) =>
            [-1, 1].map((yDir) => {
              const spread = vocalEnergy * 6;
              return (
                <div
                  key={`bracket-${xDir}-${yDir}`}
                  style={{
                    position: 'absolute',
                    top: yDir === -1 ? -12 - spread : undefined,
                    bottom: yDir === 1 ? -12 - spread : undefined,
                    left: xDir === -1 ? -12 - spread : undefined,
                    right: xDir === 1 ? -12 - spread : undefined,
                    width: 22,
                    height: 22,
                    borderTop: yDir === -1 ? `2.5px solid ${colors.primary}` : 'none',
                    borderBottom: yDir === 1 ? `2.5px solid ${colors.primary}` : 'none',
                    borderLeft: xDir === -1 ? `2.5px solid ${colors.primary}` : 'none',
                    borderRight: xDir === 1 ? `2.5px solid ${colors.primary}` : 'none',
                    boxShadow: `0 0 10px ${colors.primary}`,
                    pointerEvents: 'none',
                    zIndex: 32,
                    opacity: 0.85,
                  }}
                />
              );
            })
          )}

          {/* Border-Free Artwork */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: '#0A0713',
              boxShadow: `0 0 ${Math.round(glowSize * 0.75 + vocalEnergy * 16)}px ${colors.primary}77, 0 20px 48px rgba(0,0,0,0.85)`,
            }}
          >
            {data.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
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
              // Cyber Vinyl / Pulse Fallback Graphic
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `radial-gradient(circle at center, ${colors.primary}22 0%, #080512 80%)`,
                  position: 'relative',
                }}
              >
                {[110, 180, 240].map((size, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      width: size,
                      height: size,
                      borderRadius: '50%',
                      border: `1.5px dashed ${idx === 1 ? colors.secondary : colors.primary}44`,
                      transform: `rotate(${frame * (idx % 2 === 0 ? 0.3 : -0.2)}deg)`,
                    }}
                  />
                ))}
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 20px ${colors.primary}`,
                  }}
                >
                  <span style={{ fontSize: 30 }}>♫</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Song Title & Singer */}
        <div style={{ textAlign: 'center', marginTop: 18, padding: '0 60px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 50,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#FFFFFF',
              textShadow: `0 0 20px ${colors.primary}bb, 0 0 50px ${colors.primary}66`,
              lineHeight: 1.15,
            }}
          >
            {data.title}
          </h1>
          {data.singer && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: 24,
                fontWeight: 600,
                color: colors.secondary,
                letterSpacing: 3,
                textTransform: 'uppercase',
                textShadow: `0 0 16px ${colors.secondary}99`,
                opacity: 0.9,
              }}
            >
              {data.singer}
            </p>
          )}

          {/* Tactical Cyber Deck Status Line */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 16,
              padding: '6px 20px',
              borderRadius: 20,
              background: 'rgba(14, 9, 26, 0.75)',
              border: `1px solid ${colors.primary}38`,
              boxShadow: `0 0 18px ${colors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
              fontSize: 15,
              fontFamily: '"Fira Code", monospace, sans-serif',
              letterSpacing: 2,
              color: 'rgba(255, 255, 255, 0.75)',
            }}
          >
            <span style={{ color: colors.primary, fontWeight: 700, fontSize: 13 }}>FREQ-01</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3.5, height: 16 }}>
              {[0.4, 0.85, 0.55, 0.95, 0.65, 0.75, 0.35].map((barH, bIdx) => {
                const dynH = Math.max(
                  3,
                  Math.min(
                    16,
                    (barH + Math.sin(frame * 0.18 + bIdx * 0.9) * 0.35 + vocalEnergy * 0.4) * 16
                  )
                );
                const barCol = bIdx % 2 === 0 ? colors.primary : colors.secondary;
                return (
                  <div
                    key={bIdx}
                    style={{
                      width: 3.5,
                      height: dynH,
                      borderRadius: 1.5,
                      backgroundColor: barCol,
                      boxShadow: `0 0 6px ${barCol}`,
                    }}
                  />
                );
              })}
            </div>
            <span style={{ color: colors.secondary, fontWeight: 600, fontSize: 13 }}>
              {`${(124 + Math.sin(frame * 0.02) * 2).toFixed(0)} BPM`}
            </span>
          </div>
        </div>
      </div>

      {/* ===== MIDDLE: KINETIC SMOOTH SLIDING LYRICS STREAM (FRAME-SMITH UPGRADE) ===== */}
      <div
        style={{
          position: 'absolute',
          top: 600,
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

            // Mount-Gating: skip rendering lines outside active viewport
            if (normDist > 2.6) return null;

            const isCenter = normDist < 0.45;
            const heroPop = interpolate(normDist, [0, 0.45], [1, 0], clampOpts);
            const textRiseY = isCenter ? (1 - heroPop) * 12 : 0;
            const scale = isCenter
              ? interpolate(heroPop, [0, 1], [1.02, 1.08], clampOpts)
              : interpolate(normDist, [0.45, 1.5], [0.95, 0.88], clampOpts);
            const opacity = isCenter
              ? 1
              : interpolate(normDist, [0.45, 1.2, 2.2], [0.5, 0.28, 0.05], clampOpts);

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
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  opacity,
                }}
              >
                {/* Line Container with Flex Reticles */}
                <div
                  style={{
                    padding: '4px 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    position: 'relative',
                  }}
                >
                  {/* Left Cyber Reticle [ */}
                  {isCenter && (
                    <span
                      style={{
                        color: colors.primary,
                        fontFamily: '"Fira Code", monospace',
                        fontSize: 34,
                        fontWeight: 700,
                        opacity: heroPop * 0.92,
                        textShadow: `0 0 12px ${colors.primary}`,
                        transform: `translateX(${(1 - heroPop) * -12}px)`,
                        userSelect: 'none',
                      }}
                    >
                      [
                    </span>
                  )}

                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateY(${textRiseY}px)`,
                      fontSize: isCenter ? 48 : 34,
                      fontWeight: isCenter ? 800 : 500,
                      color: isCenter ? '#FFFFFF' : 'rgba(225, 220, 242, 0.7)',
                      letterSpacing: isCenter ? 2 : 1.2,
                      lineHeight: 1.2,
                      textShadow: isCenter
                        ? `0 0 16px rgba(255,255,255,0.95), 0 0 35px ${colors.primary}ee, 0 0 ${Math.round(55 + vocalEnergy * 25)}px ${colors.primary}77`
                        : `0 0 12px ${colors.secondary}22`,
                      padding: isCenter ? '0 12px' : '0 16px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 900,
                    }}
                  >
                    {line.text}
                  </span>

                  {/* Right Cyber Reticle ] */}
                  {isCenter && (
                    <span
                      style={{
                        color: colors.primary,
                        fontFamily: '"Fira Code", monospace',
                        fontSize: 34,
                        fontWeight: 700,
                        opacity: heroPop * 0.92,
                        textShadow: `0 0 12px ${colors.primary}`,
                        transform: `translateX(${(1 - heroPop) * 12}px)`,
                        userSelect: 'none',
                      }}
                    >
                      ]
                    </span>
                  )}
                </div>

                {/* Active Line Animated Neon Laser Underline */}
                {isCenter && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      width: '60%',
                      maxWidth: 440,
                      height: 2.5,
                      borderRadius: 2,
                      background: `linear-gradient(90deg, transparent 0%, ${colors.primary} 30%, ${colors.secondary} 70%, transparent 100%)`,
                      boxShadow: `0 0 14px ${colors.primary}, 0 0 28px ${colors.secondary}`,
                      transform: `scaleX(${heroPop})`,
                      opacity: heroPop,
                      transformOrigin: 'center center',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== ATMOSPHERIC BACKGROUND: SOFT AURORA (REACT BITS SHADER) ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <SoftAurora
          width={1080}
          height={1920}
          color1={colors.primary}
          color2={colors.secondary}
          speed={0.4}
          scale={1.45}
          brightness={1.35}
          bandHeight={0.34}
          vocalEnergy={vocalEnergy}
          opacity={0.92}
        />
      </div>

      {/* Optional: LED Equalizer Bars if bars mode explicitly selected */}
      {isBarsMode && (
        <div
          style={{
            position: 'absolute',
            top: 1100,
            left: 64,
            right: 64,
            height: 200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: BAR_GAP,
            zIndex: 30,
          }}
        >
          {spectrumBars.map((amp, i) => {
            const barHeight = Math.max(10, amp * 180);
            const isCenter = Math.abs(i - spectrumBars.length / 2) < 4;
            const barColor = isCenter
              ? colors.primary
              : i % 2 === 0
                ? colors.secondary
                : colors.tertiary;

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  maxWidth: 24,
                  height: barHeight,
                  borderRadius: 6,
                  background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}66 70%, transparent 100%)`,
                  boxShadow: `0 0 ${Math.round(14 * glowMultiplier)}px ${barColor}aa`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ===== BOTTOM SECTION: PROGRESS BAR & METADATA (SHORT SAFE ZONE) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          left: 64,
          right: 64,
          zIndex: 40,
        }}
      >
        {/* Neon Track Progress Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${progressRatio * 100}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                boxShadow: `0 0 16px ${colors.primary}`,
              }}
            />
          </div>

          {/* Audio-Reactive Glowing Progress Head Bead */}
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: `${progressRatio * 100}%`,
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: `0 0 10px ${colors.primary}, 0 0 20px ${colors.primary}`,
              transform: `translateX(-50%) scale(${1 + vocalEnergy * 0.3})`,
              pointerEvents: 'none',
            }}
          />

          {/* Time Labels with Monospace Cyber Aesthetic */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              fontSize: 22,
              fontWeight: 500,
              fontFamily: '"Fira Code", monospace',
              color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            <span style={{ color: colors.primary, textShadow: `0 0 8px ${colors.primary}66` }}>
              {formatTime(nowMs).slice(0, 5)}
            </span>
            <span
              style={{
                fontSize: 16,
                letterSpacing: 2,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
              }}
            >
              {data.creatorName ?? 'VocalBeat'}
            </span>
            <span>{formatTime(totalDurationMs).slice(0, 5)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
