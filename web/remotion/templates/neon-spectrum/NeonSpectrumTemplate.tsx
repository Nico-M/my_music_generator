import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { NeonSpectrumConfig, WaveThemeDef } from './config';
import { getThemeColors } from './config';
import { getActiveLineState } from '../shared/timing';

const BAR_GAP = 8;
const LYRIC_LINE_HEIGHT = 86;
const LYRIC_VIEWPORT_H = 340;

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
// Neon Oscilloscope Waveform Mathematical Model
// --------------------------------------------------------------------------
interface PeakDef {
  center: number;
  width: number;
  amp: number;
  speed: number;
  pulseSpeed: number;
  phase: number;
}

interface WaveConfig {
  name: string;
  color: string;
  glowColor: string;
  peaks: PeakDef[];
  rippleFreq: number;
  rippleSpeed: number;
  rippleAmp: number;
}

function getNeonWaveDefinitions(themeWaves: WaveThemeDef[]): WaveConfig[] {
  return [
    // Wave 0: Cyan (The Left Tall Bass Peak & Mid-Right Dome)
    {
      name: themeWaves[0]?.name ?? 'cyan',
      color: themeWaves[0]?.color ?? '#00F5FF',
      glowColor: themeWaves[0]?.glow ?? '#00D2FF',
      peaks: [
        { center: 0.19, width: 0.075, amp: 280, speed: 0.015, pulseSpeed: 0.045, phase: 0 },
        { center: 0.65, width: 0.13, amp: 145, speed: 0.012, pulseSpeed: 0.035, phase: 2.1 },
      ],
      rippleFreq: 1.8,
      rippleSpeed: 0.022,
      rippleAmp: 18,
    },
    // Wave 1: Magenta (Center-Left Peak, Right Mid, Edge Flares)
    {
      name: themeWaves[2]?.name ?? 'magenta',
      color: themeWaves[2]?.color ?? '#FF007A',
      glowColor: themeWaves[2]?.glow ?? '#FF1493',
      peaks: [
        { center: -0.01, width: 0.09, amp: 220, speed: 0, pulseSpeed: 0.03, phase: 1.0 },
        { center: 0.42, width: 0.07, amp: 200, speed: 0.018, pulseSpeed: 0.048, phase: 3.4 },
        { center: 0.72, width: 0.08, amp: 95, speed: 0.014, pulseSpeed: 0.038, phase: 4.8 },
        { center: 1.01, width: 0.09, amp: 240, speed: 0, pulseSpeed: 0.03, phase: 2.2 },
      ],
      rippleFreq: 2.6,
      rippleSpeed: 0.03,
      rippleAmp: 16,
    },
    // Wave 2: Purple / Violet (Harmonic Vibrations & Center Crests)
    {
      name: themeWaves[1]?.name ?? 'purple',
      color: themeWaves[1]?.color ?? '#BD00FF',
      glowColor: themeWaves[1]?.glow ?? '#9D00FF',
      peaks: [
        { center: 0.32, width: 0.065, amp: 115, speed: 0.02, pulseSpeed: 0.05, phase: 1.7 },
        { center: 0.54, width: 0.085, amp: 165, speed: 0.016, pulseSpeed: 0.042, phase: 0.8 },
        { center: 0.81, width: 0.07, amp: 110, speed: 0.022, pulseSpeed: 0.045, phase: 5.2 },
      ],
      rippleFreq: 3.4,
      rippleSpeed: 0.036,
      rippleAmp: 22,
    },
    // Wave 3: Warm Orange / Gold (Ground Surface Ripple & Right Peak)
    {
      name: themeWaves[3]?.name ?? 'orange',
      color: themeWaves[3]?.color ?? '#FF9900',
      glowColor: themeWaves[3]?.glow ?? '#FF6600',
      peaks: [
        { center: 0.88, width: 0.068, amp: 130, speed: 0.012, pulseSpeed: 0.038, phase: 4.1 },
        { center: 0.12, width: 0.14, amp: 35, speed: 0.01, pulseSpeed: 0.025, phase: 1.5 },
      ],
      rippleFreq: 1.5,
      rippleSpeed: 0.018,
      rippleAmp: 26,
    },
  ];
}

interface WaveRenderData {
  name: string;
  color: string;
  glowColor: string;
  pathD: string;
  reflectD: string;
  splashPools: Array<{ x: number; amp: number }>;
}

function computeWaveRenderData(
  waves: WaveConfig[],
  frame: number,
  vocalEnergy: number,
  width = 1080,
  samples = 120,
  baselineY = 360
): WaveRenderData[] {
  return waves.map((wave) => {
    const points: Array<{ x: number; y: number; reflectY: number }> = [];
    const splashPools: Array<{ x: number; amp: number }> = [];

    // Identify dynamic peak centers for floor splash light pools (100% continuous reverse-repeat breathing)
    for (const p of wave.peaks) {
      const dynamicCenter = p.center + Math.sin(frame * p.speed + p.phase) * 0.016;
      const pulseWave = Math.sin(frame * p.pulseSpeed + p.phase);
      const secondaryHarmonic = Math.cos(frame * (p.pulseSpeed * 0.55) + p.phase * 1.3) * 0.35;
      const baseFactor = 0.82 + (pulseWave + secondaryHarmonic) * 0.16;
      const dynamicAmp = p.amp * (baseFactor + vocalEnergy * 0.18);

      if (dynamicCenter >= 0.03 && dynamicCenter <= 0.97 && dynamicAmp > 65) {
        splashPools.push({
          x: dynamicCenter * width,
          amp: dynamicAmp,
        });
      }
    }

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const x = u * width;

      let elevation = 0;

      // 1. Gaussian pulses for sharp, continuous, organic audio peaks
      for (const p of wave.peaks) {
        const dynamicCenter = p.center + Math.sin(frame * p.speed + p.phase) * 0.016;
        const pulseWave = Math.sin(frame * p.pulseSpeed + p.phase);
        const secondaryHarmonic = Math.cos(frame * (p.pulseSpeed * 0.55) + p.phase * 1.3) * 0.35;
        const baseFactor = 0.82 + (pulseWave + secondaryHarmonic) * 0.16;
        const dynamicAmp = p.amp * (baseFactor + vocalEnergy * 0.18);
        const dist = (u - dynamicCenter) / p.width;
        elevation += dynamicAmp * Math.exp(-0.5 * dist * dist);
      }

      // 2. Continuous harmonic standing wave resonance along baseline (symmetric reverse repeat, 0 jumping breaks)
      const forwardArg = u * Math.PI * wave.rippleFreq - frame * wave.rippleSpeed;
      const backwardArg = u * Math.PI * wave.rippleFreq + frame * (wave.rippleSpeed * 0.75);
      const waveInterference = (Math.sin(forwardArg) + Math.cos(backwardArg)) * 0.5;
      const rectified = Math.max(0, waveInterference);
      const dynamicRippleAmp =
        wave.rippleAmp * (0.82 + Math.sin(frame * 0.028 + wave.rippleFreq) * 0.18 + vocalEnergy * 0.16);
      elevation += Math.pow(rectified, 2) * dynamicRippleAmp;

      const clampedElevation = Math.max(0, elevation);
      const y = baselineY - clampedElevation;
      // Mirror reflection with 0.56 vertical perspective compression
      const reflectY = baselineY + clampedElevation * 0.56;

      points.push({ x, y, reflectY });
    }

    let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    let reflectD = `M ${points[0].x.toFixed(1)},${points[0].reflectY.toFixed(1)}`;

    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
      reflectD += ` L ${points[i].x.toFixed(1)},${points[i].reflectY.toFixed(1)}`;
    }

    return {
      name: wave.name,
      color: wave.color,
      glowColor: wave.glowColor,
      pathD,
      reflectD,
      splashPools,
    };
  });
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

  // Subtle pulsing breathing scale for the cover lightbox
  const coverPulse = 1 + Math.sin(frame * 0.04) * 0.012;

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

  // Compute neon wave data
  const isWaveMode = config.visualizerStyle !== 'bars';
  const waveDefs = getNeonWaveDefinitions(colors.waves);
  const waveData = computeWaveRenderData(waveDefs, frame, vocalEnergy, 1080, 120, 360);
  const spectrumBars = !isWaveMode ? getSpectrumAmplitudes(frame, config.barCount, vocalEnergy) : [];

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

      {/* ===== CENTERPIECE: BORDERLESS COVER ARTWORK ===== */}
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
        {/* Cover Art Box (100% Border-Free Pure Floating Artwork) */}
        <div
          style={{
            position: 'relative',
            width: 300,
            height: 300,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: '#0A0713',
            boxShadow: `0 0 ${Math.round(glowSize * 0.75)}px ${colors.primary}66, 0 20px 48px rgba(0,0,0,0.85)`,
            transform: `scale(${coverPulse})`,
            transformOrigin: 'center center',
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
        </div>
      </div>

      {/* ===== MIDDLE: KINETIC SMOOTH SLIDING LYRICS STREAM ===== */}
      <div
        style={{
          position: 'absolute',
          top: 565,
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
                    color: isCenter ? '#FFFFFF' : 'rgba(235, 230, 250, 0.7)',
                    letterSpacing: isCenter ? 1.5 : 1.2,
                    lineHeight: 1.2,
                    textShadow: isCenter
                      ? `0 0 16px rgba(255,255,255,0.9), 0 0 40px ${colors.primary}ee, 0 0 70px ${colors.primary}77`
                      : `0 0 18px ${colors.secondary}44`,
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

      {/* ===== LOWER HALF: THE NEON OSCILLOSCOPE WAVE STAGE ===== */}
      {isWaveMode ? (
        <div
          style={{
            position: 'absolute',
            top: 920,
            left: 0,
            width: 1080,
            height: 520,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <svg
            viewBox="0 0 1080 520"
            style={{
              width: 1080,
              height: 520,
              display: 'block',
              overflow: 'visible',
            }}
          >
            <defs>
              {/* Floor Surface Depth Gradient */}
              <linearGradient id="neon-floor-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B0616" stopOpacity="0.75" />
                <stop offset="35%" stopColor="#07050E" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#030206" stopOpacity="1" />
              </linearGradient>

              {/* Floor Reflection Mask (downward perspective fade) */}
              <linearGradient id="floor-fade-mask" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.38" />
                <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <mask id="floor-reflection-mask">
                <rect x="0" y="360" width="1080" height="160" fill="url(#floor-fade-mask)" />
              </mask>

              {/* Blur filter for soft ground splash */}
              <filter id="splash-glow-blur" x="-50%" y="-100%" width="200%" height="300%">
                <feGaussianBlur stdDeviation="14 6" />
              </filter>
            </defs>

            {/* 1. Reflective Floor Plane */}
            <rect x="0" y="360" width="1080" height="160" fill="url(#neon-floor-gradient)" />

            {/* 2. Contact Splash Light Pools (Where waves touch or cast onto floor) */}
            {waveData.map((wave) =>
              wave.splashPools.map((pool, pIdx) => {
                const rx = Math.min(95, Math.max(45, pool.amp * 0.36));
                const ry = Math.min(22, Math.max(8, pool.amp * 0.08));
                return (
                  <ellipse
                    key={`${wave.name}-splash-${pIdx}`}
                    cx={pool.x}
                    cy={366}
                    rx={rx}
                    ry={ry}
                    fill={wave.color}
                    opacity={0.65 * glowMultiplier}
                    filter="url(#splash-glow-blur)"
                  />
                );
              })
            )}

            {/* 3. Inverted Floor Waves (Masked with downward perspective fade) */}
            <g mask="url(#floor-reflection-mask)">
              {waveData.map((wave) => (
                <g key={`reflect-${wave.name}`}>
                  {/* Soft reflection bloom */}
                  <path
                    d={wave.reflectD}
                    fill="none"
                    stroke={wave.color}
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.25 * glowMultiplier}
                    style={{ filter: 'blur(8px)' }}
                  />
                  {/* Reflected neon line */}
                  <path
                    d={wave.reflectD}
                    fill="none"
                    stroke={wave.color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.45 * glowMultiplier}
                    style={{ filter: 'blur(3px)' }}
                  />
                  {/* Reflected white core */}
                  <path
                    d={wave.reflectD}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.35}
                    style={{ filter: 'blur(1.5px)' }}
                  />
                </g>
              ))}
            </g>

            {/* 4. The Main Glowing Neon Waves (Rising above baseline) */}
            {waveData.map((wave) => (
              <g key={`wave-${wave.name}`}>
                {/* Layer A: Atmospheric Ambient Bloom */}
                <path
                  d={wave.pathD}
                  fill="none"
                  stroke={wave.color}
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.24 * glowMultiplier}
                  style={{ filter: 'blur(16px)' }}
                />
                {/* Layer B: Mid-Range Neon Glow */}
                <path
                  d={wave.pathD}
                  fill="none"
                  stroke={wave.color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.7 * glowMultiplier}
                  style={{ filter: 'blur(5px)' }}
                />
                {/* Layer C: Sharp Neon Tube Outer Wall */}
                <path
                  d={wave.pathD}
                  fill="none"
                  stroke={wave.color}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                  style={{ filter: `drop-shadow(0 0 6px ${wave.color})` }}
                />
                {/* Layer D: White-Hot Filament Core */}
                <path
                  d={wave.pathD}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.96}
                  style={{ filter: 'drop-shadow(0 0 2px #FFFFFF)' }}
                />
              </g>
            ))}
          </svg>
        </div>
      ) : (
        /* Fallback: LED Equalizer Bars */
        <div
          style={{
            position: 'absolute',
            top: 1060,
            left: 64,
            right: 64,
            height: 240,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: BAR_GAP,
            zIndex: 30,
          }}
        >
          {spectrumBars.map((amp, i) => {
            const barHeight = Math.max(12, amp * 220);
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
                  boxShadow: `0 0 ${Math.round(16 * glowMultiplier)}px ${barColor}cc`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ===== BOTTOM SECTION: PROGRESS BAR & METADATA ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
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

          {/* Time Labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 14,
              fontSize: 22,
              fontWeight: 500,
              fontFamily: '"Fira Code", monospace',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <span>{formatTime(nowMs).slice(0, 5)}</span>
            <span>{data.creatorName ?? 'VocalBeat'}</span>
            <span>{formatTime(totalDurationMs).slice(0, 5)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
