import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';
import type { TemplateRenderProps, BaseLyricLine } from '../types';
import {
  type IPodClassicConfig,
  getBodyThemeStyles,
  getWheelThemeStyles,
} from './config';
import { getActiveLineState } from '../shared/timing';

const FPS = 30;
const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

function formatTime(totalMs: number): string {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTotalDurationMs(dataDurationMs: number, lines: BaseLyricLine[]): number {
  if (Number.isFinite(dataDurationMs) && dataDurationMs > 0) {
    return dataDurationMs;
  }
  const lastEnd = lines.reduce((maxEnd, line) => {
    if (typeof line.endMs === 'number' && line.endMs > maxEnd) {
      return line.endMs;
    }
    return maxEnd;
  }, 0);
  return lastEnd > 0 ? lastEnd : 60000;
}

// Crisp click wheel icons
function RewindIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={18} fill={color} aria-hidden="true">
      <rect x="2" y="6" width="2" height="12" rx="0.5" />
      <polygon points="12,6 4,12 12,18" />
      <polygon points="20,6 12,12 20,18" />
    </svg>
  );
}

function FastForwardIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={18} fill={color} aria-hidden="true">
      <polygon points="4,6 12,12 4,18" />
      <polygon points="12,6 20,12 12,18" />
      <rect x="20" y="6" width="2" height="12" rx="0.5" />
    </svg>
  );
}

function PlayPauseIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={18} fill={color} aria-hidden="true">
      <polygon points="3,6 11,12 3,18" />
      <rect x="13" y="6.5" width="2.5" height="11" rx="0.5" />
      <rect x="17.5" y="6.5" width="2.5" height="11" rx="0.5" />
    </svg>
  );
}

const LYRIC_ITEM_HEIGHT = 36;

export const IPodClassicTemplate: React.FC<TemplateRenderProps<IPodClassicConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const totalDurationMs = getTotalDurationMs(data.durationMs, data.lines);
  const elapsedMs = Math.min(Math.max(0, Math.floor(nowMs)), totalDurationMs);
  const remainingMs = Math.max(totalDurationMs - elapsedMs, 0);
  const progress = totalDurationMs > 0 ? elapsedMs / totalDurationMs : 0;

  const bodyStyles = getBodyThemeStyles(config.bodyColor);
  const wheelStyles = getWheelThemeStyles(config.wheelColor);

  // Timed lines for synchronized kinetic scrolling lyrics inside the LCD
  const timedLines = useMemo(() => {
    return data.lines
      .filter((line) => line.text && line.text.trim().length > 0)
      .map((line, idx) => ({
        ...line,
        displayIndex: idx,
        startMs: line.startMs ?? 0,
        endMs: line.endMs ?? (data.lines[idx + 1]?.startMs ?? (line.startMs ?? 0) + 3000),
      }));
  }, [data.lines]);

  const activeSegment = useMemo(() => {
    if (timedLines.length === 0) return -1;
    let seg = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (nowMs >= timedLines[i].startMs) {
        seg = i;
      }
    }
    return seg;
  }, [timedLines, nowMs]);

  // Smooth scroll Y coordinate inside the lyrics box
  const lyricScrollY = useMemo(() => {
    if (timedLines.length === 0 || activeSegment < 0) return 0;

    const current = timedLines[activeSegment];
    const targetY = activeSegment * LYRIC_ITEM_HEIGHT;

    if (activeSegment === 0) {
      const firstDuration = Math.min(300, Math.max(150, current.startMs));
      return interpolate(
        nowMs,
        [Math.max(0, current.startMs - firstDuration), current.startMs],
        [Math.max(0, targetY - LYRIC_ITEM_HEIGHT * 0.5), targetY],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        }
      );
    }

    const prev = timedLines[activeSegment - 1];
    const prevTargetY = (activeSegment - 1) * LYRIC_ITEM_HEIGHT;
    const gap = current.startMs - prev.startMs;
    const scrollDuration = Math.min(350, Math.max(180, gap * 0.35));

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

  // Ambient breath oscillation & 3D acoustic micro-tilt physics (frame-smith standard)
  const ambientPulse = 1 + Math.sin(frame * 0.04) * 0.035;
  const ipodBobY = Math.sin(frame * 0.03) * 6;
  const ipodTiltX = Math.sin(frame * 0.024) * 2.5 + Math.cos(frame * 0.012) * 1;
  const ipodTiltY = Math.cos(frame * 0.02) * 3 + Math.sin(frame * 0.015) * 1;

  // Active lyric spring-overshoot pop
  const activeSegmentStart = activeSegment >= 0 ? timedLines[activeSegment]?.startMs ?? 0 : 0;
  const activeLocalFrame = Math.max(0, (nowMs - activeSegmentStart) / (1000 / fps));
  const activeSpring = spring({
    frame: activeLocalFrame,
    fps,
    config: { damping: 13, stiffness: 145 },
  });

  const displayTitle = data.title || 'Song Title';
  const displaySinger = data.singer || 'Various Artists';
  const displayAlbum = config.albumName || `${displayTitle} - Single`;
  const trackCounterText = timedLines.length > 0 && activeSegment >= 0
    ? `${activeSegment + 1} of ${timedLines.length}`
    : '1 of 1';

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#07090e',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Lucida Grande", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Studio Backdrop & Cinematic Atmosphere */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, #151d2d 0%, #0c111c 52%, #05070c 100%)',
        }}
      />

      {/* Subtle Studio Floor Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(5,7,12,0.65) 0%, transparent 20%, transparent 80%, rgba(5,7,12,0.85) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* --- iPod Classic Centered Scaled Assembly with 3D Acoustic Perspective --- */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 750,
          height: 1240,
          transform: `translate(-50%, -50%) translateY(${-110 + ipodBobY}px) perspective(1400px) rotateX(${ipodTiltX}deg) rotateY(${ipodTiltY}deg) scale(1.18)`,
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
          zIndex: 10,
        }}
      >
        {/* Screen Backlight Ambient Bloom (casts onto background and hand/surface) */}
        {config.screenBacklightGlow && (
          <div
            style={{
              position: 'absolute',
              left: -50,
              top: -30,
              width: 850,
              height: 750,
              background: 'radial-gradient(circle at 50% 38%, rgba(60, 130, 240, 0.24) 0%, rgba(30, 80, 190, 0.06) 55%, transparent 75%)',
              transform: `scale(${ambientPulse})`,
              transformOrigin: 'center center',
              filter: 'blur(35px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* --- Top 3.5mm Earphone Cable & Plug --- */}
        {config.showCables && (
          <>
            {/* Headphone Wire SVG */}
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: -350,
                width: 750,
                height: 350,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {/* Cable shadow */}
              <path
                d="M 657 300 C 657 190, 715 90, 750 0"
                fill="none"
                stroke="rgba(0, 0, 0, 0.55)"
                strokeWidth={14}
                strokeLinecap="round"
                filter="blur(5px)"
              />
              {/* White earphone wire */}
              <path
                d="M 657 300 C 657 190, 715 90, 750 0"
                fill="none"
                stroke="#F2F4F7"
                strokeWidth={7.5}
                strokeLinecap="round"
              />
              {/* Subtle wire specular highlight */}
              <path
                d="M 657 300 C 657 190, 715 90, 750 0"
                fill="none"
                stroke="rgba(255, 255, 255, 0.7)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>

            {/* Headphone Plug assembly */}
            <div
              style={{
                position: 'absolute',
                right: 83,
                top: -36,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              {/* Rubber strain relief boot */}
              <div
                style={{
                  width: 13,
                  height: 14,
                  background: 'linear-gradient(to right, #cfd4dc, #e8ecf1, #bcc1c9)',
                  borderRadius: '3px 3px 0 0',
                }}
              />
              {/* White plug barrel */}
              <div
                style={{
                  width: 20,
                  height: 36,
                  background: 'linear-gradient(to right, #e2e6eb 0%, #ffffff 40%, #d8dde3 100%)',
                  borderRadius: 3,
                  boxShadow: '0 3px 8px rgba(0, 0, 0, 0.45)',
                }}
              />
            </div>
          </>
        )}

        {/* --- Bottom 30-Pin Dock Cable & Connector --- */}
        {config.showCables && (
          <>
            {/* Dock Cable SVG */}
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 1294,
                width: 750,
                height: 400,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {/* Cable drop shadow */}
              <path
                d="M 375 22 C 375 130, 410 240, 420 400"
                fill="none"
                stroke="rgba(0, 0, 0, 0.6)"
                strokeWidth={22}
                strokeLinecap="round"
                filter="blur(7px)"
              />
              {/* Thick Apple white dock cable */}
              <path
                d="M 375 22 C 375 130, 410 240, 420 400"
                fill="none"
                stroke="#EDF0F4"
                strokeWidth={13}
                strokeLinecap="round"
              />
              {/* Specular core on cable */}
              <path
                d="M 375 22 C 375 130, 410 240, 420 400"
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>

            {/* Apple 30-pin connector plug */}
            <div
              style={{
                position: 'absolute',
                left: 283,
                top: 1238,
                width: 184,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              {/* Main white connector housing */}
              <div
                style={{
                  width: 184,
                  height: 56,
                  background: 'linear-gradient(to bottom, #ffffff 0%, #f2f4f7 65%, #d6dbe2 100%)',
                  borderRadius: '0 0 10px 10px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Left squeeze clip indicator */}
                <div
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: 14,
                    width: 3,
                    height: 28,
                    borderRadius: 1.5,
                    background: 'rgba(0, 0, 0, 0.12)',
                    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.2)',
                  }}
                />
                {/* Right squeeze clip indicator */}
                <div
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: 14,
                    width: 3,
                    height: 28,
                    borderRadius: 1.5,
                    background: 'rgba(0, 0, 0, 0.12)',
                    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.2)',
                  }}
                />
                {/* Iconic 30-pin embossed symbol: rounded rect outline */}
                <div
                  style={{
                    width: 38,
                    height: 14,
                    borderRadius: 3.5,
                    border: '1.5px solid #a4b0be',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 2,
                      backgroundColor: '#a4b0be',
                      borderRadius: 1,
                    }}
                  />
                </div>
              </div>

              {/* Molded strain relief collar */}
              <div
                style={{
                  width: 34,
                  height: 22,
                  background: 'linear-gradient(to bottom, #d6dbe2 0%, #c4cbd4 100%)',
                  borderRadius: '0 0 5px 5px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.35)',
                }}
              />
            </div>
          </>
        )}

        {/* --- iPod Classic Physical Body --- */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 750,
            height: 1240,
            borderRadius: 48,
            background: bodyStyles.bodyBg,
            boxShadow: `
              0 45px 110px rgba(0, 0, 0, 0.85),
              0 18px 45px rgba(0, 0, 0, 0.65),
              inset 0 1.5px 2px ${bodyStyles.outerBorder},
              inset 0 -2.5px 4px ${bodyStyles.bevelEdge},
              0 0 0 1px rgba(15, 18, 22, 0.95)
            `,
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
        {/* Anodized Aluminum Brushed Grain Simulation */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255, 255, 255, 0.012) 3px)',
            pointerEvents: 'none',
          }}
        />

        {/* Diagonal Specular Sheen across Front Face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(115deg, transparent 32%, rgba(255, 255, 255, 0.05) 48%, rgba(255, 255, 255, 0.02) 52%, transparent 66%)',
            pointerEvents: 'none',
          }}
        />

        {/* Edge Contouring Gradient for Curved Front Profile */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.28) 0%, transparent 6%, transparent 94%, rgba(0, 0, 0, 0.28) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top 3.5mm Jack Socket Rim */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            top: 0,
            width: 26,
            height: 4,
            background: 'linear-gradient(to right, #333, #888, #eee, #888, #222)',
            borderRadius: '0 0 3px 3px',
          }}
        />

        {/* ========================================================== */}
        {/* SCREEN RECESSED CUTOUT & LCD */}
        {/* ========================================================== */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 56,
            width: 630,
            height: 472,
            borderRadius: 10,
            backgroundColor: '#141619',
            boxShadow: `
              inset 0 4px 8px rgba(0, 0, 0, 0.85),
              inset 0 -1.5px 2px rgba(255, 255, 255, 0.12),
              0 1px 2px rgba(255, 255, 255, 0.06)
            `,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* LCD Screen Glass */}
          <div
            style={{
              width: 614,
              height: 456,
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(to bottom, #ebf1f7 0%, #dae4ee 55%, #cad7e5 100%)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'inset 0 0 4px rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* Fine LCD Scanline Texture */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1.5px, rgba(0, 20, 50, 0.015) 2.5px)',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            />

            {/* Diagonal Glass Sheen Reflection */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(125deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 35%, transparent 55%)',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />

            {/* --- 1. Metallic Aqua Header Bar --- */}
            <div
              style={{
                height: 42,
                background: 'linear-gradient(to bottom, #dce5ef 0%, #c4d3e3 49%, #a8bcd4 51%, #bed0e2 100%)',
                borderBottom: '1px solid #8ba3bf',
                boxShadow: '0 1px 2px rgba(0, 20, 50, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 14,
                paddingRight: 14,
                position: 'relative',
                zIndex: 2,
              }}
            >
              {/* "Now Playing" Title */}
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#10213d',
                  textShadow: '0 1px 0 rgba(255, 255, 255, 0.75)',
                  letterSpacing: -0.2,
                }}
              >
                Now Playing
              </div>

              {/* Status Icons: Play + Shuffle/Repeat + Battery */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Blue Play Triangle */}
                <svg viewBox="0 0 16 16" width={13} height={13} fill="#2069d8">
                  <polygon points="3,2 14,8 3,14" />
                </svg>

                {/* Shuffle indicator */}
                <svg viewBox="0 0 24 24" width={14} height={14} fill="#4b6282">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.42l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.12z" />
                </svg>

                {/* Repeat indicator */}
                <svg viewBox="0 0 24 24" width={14} height={14} fill="#4b6282">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                </svg>

                {/* Classic iPod Battery Gauge */}
                <div
                  style={{
                    width: 34,
                    height: 16,
                    border: '1.5px solid #233754',
                    borderRadius: 3,
                    padding: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    boxShadow: '0 1px 1px rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {/* Battery fill level */}
                  <div
                    style={{
                      width: '90%',
                      height: '100%',
                      background: 'linear-gradient(to bottom, #7be05a 0%, #43a820 100%)',
                      borderRadius: 1.5,
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Charging bolt symbol */}
                    <svg viewBox="0 0 16 16" width={9} height={9} fill="#FFFFFF">
                      <polygon points="9,1 4,9 8,9 7,15 12,7 8,7" />
                    </svg>
                  </div>
                  {/* Right battery terminal nipple */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -4,
                      top: 3,
                      width: 2.5,
                      height: 7,
                      backgroundColor: '#233754',
                      borderRadius: '0 1px 1px 0',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* --- 2. Main Middle Area: Album Cover & Track Info + Lyrics --- */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                padding: '16px 18px 8px 18px',
                position: 'relative',
                zIndex: 2,
                overflow: 'hidden',
              }}
            >
              {/* Left: Album Artwork with Iconic Mirror Floor Reflection */}
              <div
                style={{
                  width: 205,
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                }}
              >
                {/* Main Album Artwork */}
                <div
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 4,
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0, 15, 40, 0.3)',
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    backgroundColor: '#111520',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {data.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.coverUrl}
                      alt={displayTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    // Classic Procedural Retro CD Cover Fallback
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #0d1e38 0%, #153866 50%, #0a182c 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        padding: 12,
                        textAlign: 'center',
                      }}
                    >
                      {/* Vinyl Groove Rings */}
                      {[170, 130, 90].map((size, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        />
                      ))}
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3284e8, #184b90)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                          zIndex: 2,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFFFFF">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                      <div
                        style={{
                          color: '#FFFFFF',
                          fontSize: 14,
                          fontWeight: 700,
                          marginTop: 10,
                          maxWidth: '90%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          zIndex: 2,
                        }}
                      >
                        {displayTitle}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mirror Reflection Beneath Artwork */}
                <div
                  style={{
                    width: 200,
                    height: 72,
                    marginTop: 3,
                    borderRadius: '0 0 4px 4px',
                    overflow: 'hidden',
                    transform: 'scaleY(-1)',
                    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 75%)',
                    maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 75%)',
                    opacity: 0.8,
                    pointerEvents: 'none',
                    flexShrink: 0,
                  }}
                >
                  {data.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.coverUrl}
                      alt=""
                      style={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 200,
                        background: 'linear-gradient(135deg, #0d1e38 0%, #153866 50%, #0a182c 100%)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Right: Song Metadata + iPod OS Lyric Viewport */}
              <div
                style={{
                  flex: 1,
                  paddingLeft: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Track Metadata Header */}
                <div style={{ flexShrink: 0, marginBottom: 8 }}>
                  {/* Song Title */}
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: '#10213d',
                      lineHeight: 1.25,
                      textShadow: '0 1px 0 rgba(255, 255, 255, 0.8)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                    }}
                  >
                    {displayTitle}
                  </div>

                  {/* Artist / Singer */}
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: '#324a6e',
                      marginTop: 4,
                      textShadow: '0 1px 0 rgba(255, 255, 255, 0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displaySinger}
                  </div>

                  {/* Album Name */}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: '#556d8d',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayAlbum}
                  </div>

                  {/* Track Number: e.g. "1 of 1" */}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#556d8d',
                      marginTop: 6,
                    }}
                  >
                    {trackCounterText}
                  </div>
                </div>

                {/* iPod OS Synchronized Kinetic Lyrics Card */}
                {config.showLyrics && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 110,
                      maxHeight: 125,
                      backgroundColor: 'rgba(255, 255, 255, 0.42)',
                      borderRadius: 6,
                      border: '1px solid rgba(135, 160, 190, 0.45)',
                      boxShadow: 'inset 0 1px 3px rgba(0, 20, 50, 0.08), 0 1px 1px rgba(255, 255, 255, 0.6)',
                      overflow: 'hidden',
                      position: 'relative',
                      padding: '4px 10px',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                      maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    }}
                  >
                    {timedLines.length === 0 ? (
                      <div
                        style={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4e6788',
                          fontSize: 15,
                          fontWeight: 600,
                          fontStyle: 'italic',
                        }}
                      >
                        ♪ {displayTitle} ♪
                      </div>
                    ) : (
                      <div
                        style={{
                          transform: `translateY(${-lyricScrollY + (115 - LYRIC_ITEM_HEIGHT) / 2}px)`,
                        }}
                      >
                        {timedLines.map((line, idx) => {
                          const isActive = idx === activeSegment;
                          const dist = Math.abs(idx - (activeSegment >= 0 ? activeSegment : 0));
                          const opacity = isActive ? 1 : Math.max(0.25, 0.75 - dist * 0.3);

                          return (
                            <div
                              key={idx}
                              style={{
                                height: LYRIC_ITEM_HEIGHT,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '0 8px',
                                borderRadius: 4,
                                background: isActive
                                  ? 'linear-gradient(to bottom, #3b93f7 0%, #1a6edb 50%, #155cb8 100%)'
                                  : 'transparent',
                                boxShadow: isActive
                                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 6px rgba(10, 45, 100, 0.25)'
                                  : 'none',
                                opacity,
                                transform: isActive ? `scale(${1 + activeSpring * 0.03})` : 'scale(0.97)',
                                transformOrigin: 'left center',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              {isActive && (
                                <span
                                  style={{
                                    color: '#FFFFFF',
                                    fontSize: 11,
                                    lineHeight: 1,
                                    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))',
                                  }}
                                >
                                  ▶
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: isActive ? 15 : 14,
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? '#FFFFFF' : '#476282',
                                  textShadow: isActive ? '0 1px 1px rgba(0, 20, 60, 0.6)' : 'none',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  letterSpacing: -0.2,
                                }}
                              >
                                {line.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- 3. Bottom Progress Bar & Time Counters --- */}
            <div
              style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 18,
                paddingRight: 18,
                paddingBottom: 8,
                position: 'relative',
                zIndex: 2,
              }}
            >
              {/* Elapsed Time */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1a2f4a',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 46,
                  textShadow: '0 1px 0 rgba(255, 255, 255, 0.7)',
                }}
              >
                {formatTime(elapsedMs)}
              </div>

              {/* Recessed Progress Bar Groove */}
              <div
                style={{
                  flex: 1,
                  margin: '0 14px',
                  height: 15,
                  borderRadius: 7.5,
                  backgroundColor: '#a3b5c9',
                  boxShadow: 'inset 0 2px 3px rgba(0, 0, 0, 0.38), 0 1px 1px rgba(255, 255, 255, 0.7)',
                  overflow: 'hidden',
                  padding: 0.5,
                }}
              >
                {/* Glossy iPod Aqua Blue Progress Capsule */}
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                    height: '100%',
                    borderRadius: 7,
                    background: 'linear-gradient(to bottom, #5fa9ff 0%, #2b79e2 48%, #145db7 52%, #0e4fa9 100%)',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.7), 0 0 6px rgba(43, 121, 226, 0.4)',
                  }}
                />
              </div>

              {/* Remaining Time with negative sign */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1a2f4a',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 46,
                  textAlign: 'right',
                  textShadow: '0 1px 0 rgba(255, 255, 255, 0.7)',
                }}
              >
                -{formatTime(remainingMs)}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* PHYSICAL CLICK WHEEL */}
        {/* ========================================================== */}
        <div
          style={{
            position: 'absolute',
            left: 180,
            top: 610,
            width: 390,
            height: 390,
            borderRadius: '50%',
            background: wheelStyles.wheelBg,
            boxShadow: `
              inset 0 2.5px 5px rgba(255, 255, 255, 0.09),
              inset 0 -3.5px 7px rgba(0, 0, 0, 0.75),
              0 4px 15px rgba(0, 0, 0, 0.55)
            `,
          }}
        >
          {/* Top: MENU */}
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: wheelStyles.textColor,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 1.5,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
              userSelect: 'none',
            }}
          >
            MENU
          </div>

          {/* Left: Rewind |<< */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RewindIcon color={wheelStyles.textColor} />
          </div>

          {/* Right: Fast Forward >>| */}
          <div
            style={{
              position: 'absolute',
              right: 26,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FastForwardIcon color={wheelStyles.textColor} />
          </div>

          {/* Bottom: Play/Pause >|| */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlayPauseIcon color={wheelStyles.textColor} />
          </div>

          {/* Center Concave Select Button */}
          <div
            style={{
              position: 'absolute',
              left: 125,
              top: 125,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: wheelStyles.centerBg,
              boxShadow: `
                inset 0 3px 7px rgba(0, 0, 0, 0.9),
                inset 0 -1px 2px rgba(255, 255, 255, 0.08),
                0 1px 3px rgba(0, 0, 0, 0.5)
              `,
            }}
          />
        </div>
      </div>
    </div>
  </div>
  );
};

// Export三件套 (frame-smith standard contract)
export const IPOD_CLASSIC_FRAMES = 1800;
export const IPodClassicTemplateCover: React.FC<TemplateRenderProps<IPodClassicConfig>> = (props) => (
  <IPodClassicTemplate {...props} />
);
