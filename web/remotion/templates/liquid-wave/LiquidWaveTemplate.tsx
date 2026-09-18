import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Loop,
  OffthreadVideo,
  staticFile,
  spring,
} from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { LiquidWaveConfig } from './config';
import { getLiquidColors } from './config';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const LYRIC_LINE_HEIGHT = 88;
const LYRIC_VIEWPORT_H = 780;

// Universal Motion Craft Floor helpers (frame-smith standard)
const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const power3Out = Easing.out(Easing.cubic);

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface StarlightParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  twinkleFreq: number;
  phase: number;
}

// Procedural floating starlight motes that complement the dark liquid wave
const STARLIGHT_SEEDS: StarlightParticle[] = Array.from({ length: 32 }).map((_, i) => ({
  x: (i * 39 + 35) % WIDTH,
  y: (i * 67 + 50) % HEIGHT,
  size: i % 3 === 0 ? 2.5 : i % 2 === 0 ? 1.8 : 1.2,
  speed: 0.35 + (i % 5) * 0.15,
  opacity: 0.4 + (i % 4) * 0.15,
  twinkleFreq: 0.04 + (i % 3) * 0.02,
  phase: i * 0.7,
}));

export const LiquidWaveTemplate: React.FC<TemplateRenderProps<LiquidWaveConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const colors = getLiquidColors(config.colorScheme);

  const speedMul =
    config.waveSpeed === 'fast' ? 1.3 : config.waveSpeed === 'medium' ? 1 : 0.75;

  const totalDurationMs = Math.max(data.durationMs || 0, 1000);
  const progressRatio = Math.min(1, Math.max(0, nowMs / totalDurationMs));

  // --- 1. Fluid Dynamic 3D Vinyl Floating Physics (frame-smith motion craft) ---
  const wavePhase = frame * 0.032 * speedMul;
  const discBobY = Math.sin(wavePhase) * 12 + Math.cos(wavePhase * 0.45) * 4;
  const tiltX = Math.sin(wavePhase * 0.8) * 7 + Math.cos(wavePhase * 0.4) * 2;
  const tiltY = Math.cos(wavePhase * 0.7) * 8 + Math.sin(wavePhase * 0.35) * 2.5;
  const discRotation = frame * 0.42 * speedMul;
  const auraPulse = 0.85 + Math.sin(wavePhase * 1.2) * 0.15;

  // --- 2. Concentric Fluid Ripples with Organic Cubic Deceleration ---
  const rippleCount = config.rippleCount || 4;
  const ripples = Array.from({ length: rippleCount }).map((_, i) => {
    const period = 100 / speedMul;
    const rawT = ((frame + i * (period / rippleCount)) % period) / period;
    const easeT = power3Out(rawT);
    const radius = 170 + easeT * 260;
    const opacity = (1 - rawT) * 0.38;
    return { radius, opacity };
  });

  // --- 3. Timed Lyrics Logic with Optical Spring Physics ---
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

  // Active lyric spring-overshoot pop when new line begins
  const activeLineStartMs = activeSegment >= 0 ? timedLines[activeSegment]?.startMs : 0;
  const activeLocalFrame = Math.max(0, (nowMs - activeLineStartMs) / (1000 / fps));
  const activeSpring = spring({
    frame: activeLocalFrame,
    fps,
    config: { damping: 13, stiffness: 145 },
  });

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
          ...clampOpts,
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
    const scrollDuration = Math.min(360, Math.max(180, gap * 0.38));

    return interpolate(
      nowMs,
      [current.startMs, current.startMs + scrollDuration],
      [prevTargetY, targetY],
      {
        ...clampOpts,
        easing: Easing.out(Easing.cubic),
      }
    );
  }, [timedLines, activeSegment, nowMs]);

  const CENTER_Y = (LYRIC_VIEWPORT_H - LYRIC_LINE_HEIGHT) / 2;

  // --- 4. Floating Starlight Motes ---
  const particles = useMemo(() => {
    if (!config.showParticles) return [];
    return STARLIGHT_SEEDS.map((p, idx) => {
      const yOffset = (frame * p.speed * speedMul * 1.2 + idx * 80) % HEIGHT;
      const curY = (p.y - yOffset + HEIGHT) % HEIGHT;
      const curX = p.x + Math.sin(frame * 0.02 + p.phase) * 12;
      const twinkle = 0.5 + Math.sin(frame * p.twinkleFreq + p.phase) * 0.5;
      return {
        x: curX,
        y: curY,
        size: p.size,
        opacity: p.opacity * twinkle,
      };
    });
  }, [config.showParticles, frame, speedMul]);

  const discCenterY = 320;

  // Glass card diagonal light sweep progress (every ~18s)
  const glintOffset = ((frame * 0.65) % 550) - 275;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#000000',
        fontFamily:
          '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        color: '#FFFFFF',
      }}
    >
      {/* ===== GLOBAL TYPOGRAPHY IMPORT ===== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        .instrument-serif {
          font-family: 'Instrument Serif', 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif;
          font-style: italic;
        }
      `}</style>

      {/* ===== LAYER 1: PURE DARK BASE CANVAS ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
        }}
      />

      {/* ===== LAYER 2: DARK LIQUID WAVE VIDEO LOOP ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {/* 20s (600 frames at 30fps) seamless ping-pong reverse repeat */}
        <Loop durationInFrames={600}>
          <OffthreadVideo
            src={staticFile('assets/templates/liquid-wave/wave-bg.mp4')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 45%',
              opacity: 0.88,
              filter: 'contrast(1.15) brightness(0.95)',
            }}
            muted
          />
        </Loop>

        {/* Seamless Vignette overlay to melt into pure black */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, #000000 0%, rgba(0,0,0,0.4) 18%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 82%, #000000 100%)',
          }}
        />

        {/* Color Scheme Tint overlay (if non-mono) */}
        {config.colorScheme !== 'mono' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle 900px at 50% 45%, ${colors.accent1}30 0%, transparent 70%)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* ===== LAYER 3: DRIFTING STARLIGHT PARTICULATES ===== */}
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
            backgroundColor: '#FFFFFF',
            boxShadow: `0 0 ${p.size * 3}px rgba(255, 255, 255, 0.85)`,
            opacity: p.opacity,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ===== LAYER 4: CONCENTRIC LIQUID RIPPLES ===== */}
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}
      >
        {ripples.map((r, idx) => (
          <circle
            key={idx}
            cx={WIDTH / 2}
            cy={discCenterY + discBobY}
            r={r.radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth={1.3}
            strokeDasharray="5 7"
            opacity={r.opacity}
          />
        ))}
      </svg>

      {/* ===== LAYER 5: 3D FLOATING LIQUID-GLASS & METALLIC VINYL CENTERPIECE ===== */}
      <div
        style={{
          position: 'absolute',
          top: discCenterY - 145,
          left: WIDTH / 2 - 145,
          width: 290,
          height: 290,
          zIndex: 10,
          perspective: 1200,
        }}
      >
        {/* Ambient Breathing Aura Glow behind Vinyl */}
        <div
          style={{
            position: 'absolute',
            inset: -35,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.glassGlow} 0%, transparent 72%)`,
            transform: `translateY(${discBobY}px) scale(${auraPulse})`,
            filter: 'blur(22px)',
            opacity: 0.95,
            pointerEvents: 'none',
          }}
        />

        {/* 3D Floating Vinyl Disk Body */}
        <div
          style={{
            width: 290,
            height: 290,
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: '#050505',
            border: '1.5px solid rgba(255, 255, 255, 0.28)',
            boxShadow: `
              0 30px 70px rgba(0, 0, 0, 0.95),
              inset 0 1px 0 rgba(255, 255, 255, 0.45),
              0 0 45px ${colors.glassGlow}
            `,
            transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${discBobY}px)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
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
              /* Procedural Dark Liquid Mercury Vinyl Fallback */
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background:
                    'radial-gradient(circle, #242428 0%, #111114 45%, #050507 85%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {[110, 85, 60, 35].map((dim, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      width: dim * 2,
                      height: dim * 2,
                      borderRadius: '50%',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  />
                ))}
                {/* Spindle centerpiece */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, #FFFFFF 0%, #A0A0A0 50%, #404040 100%)',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                  }}
                />
              </div>
            )}

            {/* Sweeping Dual Specular Anisotropic Highlight across Vinyl Grooves */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `conic-gradient(from ${discRotation * 1.5}deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.22) 35deg, transparent 75deg, transparent 180deg, rgba(255,255,255,0.18) 215deg, transparent 255deg, transparent 360deg)`,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />

            {/* Liquid-Glass Shimmer Specular Sweep */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(125deg, rgba(255,255,255,0.3) 0%, transparent 45%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ===== LAYER 6: SONG HEADER (METALLIC BADGE + INSTRUMENT SERIF TITLE) ===== */}
      <div
        style={{
          position: 'absolute',
          top: 505,
          left: 64,
          right: 64,
          textAlign: 'center',
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Vesper-inspired Liquid-Metal Pill Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 24,
            border: '1px solid rgba(198, 198, 198, 0.35)',
            background:
              'linear-gradient(105deg, rgba(12, 12, 14, 0.85) 0%, rgba(42, 42, 48, 0.65) 50%, rgba(70, 70, 80, 0.45) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 8px 24px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(16px)',
            marginBottom: 16,
          }}
        >
          {/* Sparkle Icon */}
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: '#FFFFFF', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}
          >
            <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
          </svg>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 2,
              color: '#F2F2F2',
              textTransform: 'uppercase',
            }}
          >
            {data.creatorName || 'LIQUID WAVE AUDIO'}
          </span>
        </div>

        {/* Song Title in Instrument Serif Italic with Caustic Glow */}
        <h1
          className="instrument-serif"
          style={{
            margin: 0,
            fontSize: 66,
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            lineHeight: 1.15,
            textShadow:
              '0 4px 35px rgba(255, 255, 255, 0.4), 0 0 70px rgba(186, 208, 255, 0.3), 0 2px 10px rgba(0,0,0,0.85)',
            maxWidth: 900,
          }}
        >
          {data.title}
        </h1>

        {/* Singer Subtitle in clean Inter sans */}
        {data.singer && (
          <p
            style={{
              margin: '12px 0 0 0',
              fontSize: 24,
              fontWeight: 500,
              color: colors.muted,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* ===== LAYER 7: LIQUID-GLASS ENCASED LYRICS STREAM WITH OPTICAL FOCUS-PULL ===== */}
      <div
        style={{
          position: 'absolute',
          top: 730,
          left: 60,
          right: 60,
          height: LYRIC_VIEWPORT_H,
          borderRadius: 36,
          background: colors.glassBg,
          border: `1px solid ${colors.glassBorder}`,
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 30px 80px rgba(0, 0, 0, 0.75),
            0 0 40px ${colors.glassGlow}
          `,
          backdropFilter: 'blur(28px)',
          overflow: 'hidden',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Frosted Glass Diagonal Specular Glint Sweep */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.05) 49%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 51%, transparent 60%)`,
            transform: `translateX(${glintOffset}px)`,
            pointerEvents: 'none',
          }}
        />

        {/* Inner edge vertical gradient mask for ethereal lyric emergence/departure */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            maskImage:
              'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
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
              const isCenter = normDist < 0.45;

              // Cinematic Depth of Field Blur + Spring Pop
              const blurPx = interpolate(normDist, [0, 0.5, 1.5, 3], [0, 0.4, 2.2, 4.5], clampOpts);
              const opacity = interpolate(normDist, [0, 0.85, 2.2], [1, 0.48, 0.08], clampOpts);
              const baseScale = interpolate(normDist, [0, 1.2], [1.04, 0.94], clampOpts);
              const finalScale = isCenter ? 1 + activeSpring * 0.06 : baseScale;

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
                    transform: `scale(${finalScale})`,
                    transformOrigin: 'center center',
                    opacity,
                    filter: blurPx > 0.3 ? `blur(${blurPx}px)` : 'none',
                  }}
                >
                  {/* Subtle glowing pill dot indicator for active center lyric */}
                  {isCenter && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 48,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        boxShadow: `0 0 12px #FFFFFF, 0 0 20px ${colors.accent1}`,
                      }}
                    />
                  )}

                  <span
                    style={{
                      fontSize: isCenter ? 44 : 32,
                      fontWeight: isCenter ? 700 : 400,
                      color: isCenter ? '#FFFFFF' : colors.muted,
                      letterSpacing: isCenter ? 1.4 : 1.1,
                      lineHeight: 1.25,
                      padding: '0 64px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textShadow: isCenter
                        ? `0 0 28px rgba(255, 255, 255, 0.65), 0 0 50px ${colors.accent1}40, 0 2px 8px rgba(0,0,0,0.85)`
                        : 'none',
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== LAYER 8: BOTTOM PROGRESS DOCK WITH LUMINOUS PLAYHEAD ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 72,
          right: 72,
          zIndex: 30,
        }}
      >
        {/* Liquid-Metal Progress Track */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Filled gradient beam */}
          <div
            style={{
              width: `${progressRatio * 100}%`,
              height: '100%',
              borderRadius: 4,
              background:
                'linear-gradient(90deg, #606068 0%, #D0D0D8 50%, #FFFFFF 100%)',
              boxShadow: '0 0 14px rgba(255, 255, 255, 0.7)',
            }}
          />

          {/* Luminous glowing playhead pin */}
          <div
            style={{
              position: 'absolute',
              left: `${progressRatio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: `0 0 10px #FFFFFF, 0 0 20px ${colors.accent1}`,
            }}
          />
        </div>

        {/* Timestamps & Brand Watermark */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 18,
            fontSize: 20,
            fontWeight: 500,
            fontFamily: '"Inter", monospace',
            color: colors.muted,
            letterSpacing: 1.5,
          }}
        >
          <span>{formatTime(nowMs)}</span>
          <span style={{ letterSpacing: 3, fontSize: 16, opacity: 0.8, textTransform: 'uppercase' }}>
            {data.creatorName ?? 'SINGVID · FLUID WAVE'}
          </span>
          <span>{formatTime(totalDurationMs)}</span>
        </div>
      </div>
    </div>
  );
};

// Export三件套 (frame-smith standard contract)
export const LIQUID_WAVE_FRAMES = 1800; // 60s at 30fps default
export const LiquidWaveTemplateCover: React.FC<TemplateRenderProps<LiquidWaveConfig>> = (props) => (
  <LiquidWaveTemplate {...props} />
);
