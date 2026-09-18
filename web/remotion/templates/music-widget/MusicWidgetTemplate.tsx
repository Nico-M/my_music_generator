import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';
import type { TemplateRenderProps, BaseLyricLine } from '../types';
import {
  type MusicWidgetConfig,
  getWidgetThemeStyles,
} from './config';
import { getActiveLineState } from '../shared/timing';

const FPS = 30;
const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const WIDTH = 1080;
const HEIGHT = 1920;
const LYRIC_LINE_HEIGHT = 80;

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

// Crisp AirPlay SVG Icon
function AirPlayIcon({ bg, color }: { bg: string; color: string }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 14px ${bg}88`,
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width={26} height={26} fill="none">
        {/* AirPlay Triangle */}
        <polygon points="12,5 6,13.5 18,13.5" fill={color} />
        {/* Concentric sound arc */}
        <path
          d="M7 17 C8.3 15.5 10 14.8 12 14.8 C14 14.8 15.7 15.5 17 17"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <path
          d="M4.5 20 C6.8 17.5 9.2 16.5 12 16.5 C14.8 16.5 17.2 17.5 19.5 20"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// Media Control Icons (Solid double triangles & Dual vertical rounded bars)
function RewindIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 52 36" width={52} height={36} fill={color} aria-hidden="true">
      <polygon points="26,18 52,0 52,36" />
      <polygon points="0,18 26,0 26,36" />
    </svg>
  );
}

function FastForwardIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 52 36" width={52} height={36} fill={color} aria-hidden="true">
      <polygon points="0,0 26,18 0,36" />
      <polygon points="26,0 52,18 26,36" />
    </svg>
  );
}

function PauseIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 44 56" width={44} height={56} fill={color} aria-hidden="true">
      <rect x="3" y="1" width="14" height="54" rx="7" />
      <rect x="27" y="1" width="14" height="54" rx="7" />
    </svg>
  );
}

// Speaker Min & Max Icons
function SpeakerMinIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} fill={color} aria-hidden="true">
      <polygon points="4,9 8.5,9 14,4 14,20 8.5,15 4,15" />
    </svg>
  );
}

function SpeakerMaxIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="3,9 7.5,9 13,4 13,20 7.5,15 3,15" fill={color} stroke="none" />
      <path d="M16 8.5 C17 9.8 17 14.2 16 15.5" />
      <path d="M19 6 C20.8 8.2 20.8 15.8 19 18" />
      <path d="M22 3.5 C24.5 6.5 24.5 17.5 22 20.5" />
    </svg>
  );
}

// Phone Status Bar (Dynamic Island, 5G, Wi-Fi, Battery)
function PhoneStatusBar() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: 56,
        right: 56,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
        color: 'rgba(255, 255, 255, 0.95)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      {/* Time */}
      <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.2 }}>9:41</span>

      {/* Dynamic Island Pill */}
      <div
        style={{
          width: 210,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#111827' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#052e16', border: '1.5px solid #22c55e' }} />
      </div>

      {/* Status Icons: Signal, 5G, Battery */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Cellular Signal bars */}
        <svg viewBox="0 0 20 16" width={20} height={16} fill="currentColor">
          <rect x="1" y="11" width="3" height="5" rx="1" />
          <rect x="5.5" y="8" width="3" height="8" rx="1" />
          <rect x="10" y="4" width="3" height="12" rx="1" />
          <rect x="14.5" y="0" width="3" height="16" rx="1" />
        </svg>

        {/* 5G Label */}
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>5G</span>

        {/* Battery with charge level */}
        <div
          style={{
            width: 32,
            height: 16,
            borderRadius: 5,
            border: '2px solid rgba(255, 255, 255, 0.9)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: '82%',
              height: '100%',
              borderRadius: 2,
              backgroundColor: '#ffffff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: -5,
              top: 4,
              width: 3,
              height: 6,
              borderRadius: '0 2px 2px 0',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Lock Screen Header (Lock Icon, Date, Big Clock)
function LockScreenHeader() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 130,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 15,
        color: 'rgba(255, 255, 255, 0.95)',
        textShadow: '0 4px 18px rgba(0, 0, 0, 0.4)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      }}
    >
      {/* Lock Icon */}
      <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" style={{ opacity: 0.85, marginBottom: 8 }}>
        <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3z" />
      </svg>

      {/* Date */}
      <div style={{ fontSize: 24, fontWeight: 500, opacity: 0.85, letterSpacing: 0.2 }}>
        Wednesday, September 17
      </div>

      {/* Big Apple Clock */}
      <div
        style={{
          fontSize: 126,
          fontWeight: 200,
          letterSpacing: -2,
          lineHeight: 1.05,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        9:41
      </div>
    </div>
  );
}

export const MusicWidgetTemplate: React.FC<TemplateRenderProps<MusicWidgetConfig>> = ({
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

  const themeStyles = getWidgetThemeStyles(config.theme);

  // Synchronized Timed Lyric Lines
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
      } else {
        break;
      }
    }
    return seg;
  }, [timedLines, nowMs]);

  // Smooth cubic scrolling translation for lyric lines
  const lyricScrollY = useMemo(() => {
    if (timedLines.length === 0 || activeSegment < 0) return 0;

    const current = timedLines[activeSegment];
    const targetY = activeSegment * LYRIC_LINE_HEIGHT;

    if (activeSegment === 0) {
      const firstDuration = Math.min(300, Math.max(150, current.startMs));
      return interpolate(
        nowMs,
        [Math.max(0, current.startMs - firstDuration), current.startMs],
        [Math.max(0, targetY - LYRIC_LINE_HEIGHT * 0.4), targetY],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        }
      );
    }

    const prev = timedLines[activeSegment - 1];
    const prevTargetY = (activeSegment - 1) * LYRIC_LINE_HEIGHT;
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

  // Gentle rhythmic pulse & specular sweep (frame-smith standard)
  const beatPulse = 1 + Math.sin(frame * 0.08) * 0.025;
  const slowAmbientDrift = Math.sin(frame * 0.02) * 20;
  const widgetGlassGlint = ((frame * 0.75) % 700) - 350;

  // Active lyric spring-overshoot pop
  const activeLineStart = activeSegment >= 0 ? timedLines[activeSegment]?.startMs ?? 0 : 0;
  const activeLocalFrame = Math.max(0, (nowMs - activeLineStart) / (1000 / fps));
  const activeSpring = spring({
    frame: activeLocalFrame,
    fps,
    config: { damping: 13, stiffness: 145 },
  });

  const displayTitle = data.title || 'Lorem ipsum dolor sit amet';
  const displaySinger = data.singer || data.creatorName || '';

  const isLockscreen = config.layout === 'lockscreen';

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#0c0e17',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* Background Atmosphere Layer (Blurred dusk sky / wallpaper)    */}
      {/* ------------------------------------------------------------- */}
      {data.coverUrl ? (
        // Real album cover with immersive blur
        <div
          style={{
            position: 'absolute',
            inset: -100,
            backgroundImage: `url(${data.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(75px) saturate(1.8) brightness(0.75)',
            transform: `scale(${1.08 + Math.sin(frame * 0.015) * 0.03}) translate(${slowAmbientDrift * 0.5}px, ${slowAmbientDrift * 0.3}px)`,
            transformOrigin: 'center center',
          }}
        />
      ) : (
        // Dusk sunset clouds aura matching the reference image!
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 30%, #3d2554 0%, #1e1b36 50%, #0d0f1a 100%)',
            }}
          />
          {/* Luminous atmospheric dusk clouds (pink, violet, peach, twilight blue) */}
          <div
            style={{
              position: 'absolute',
              top: '18%',
              left: '5%',
              width: 750,
              height: 750,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(215, 88, 148, 0.65) 0%, rgba(160, 60, 125, 0.35) 55%, transparent 78%)',
              filter: 'blur(90px)',
              transform: `translate(${Math.cos(frame * 0.02) * 45}px, ${Math.sin(frame * 0.025) * 40}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '32%',
              right: '2%',
              width: 700,
              height: 700,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(95, 125, 230, 0.6) 0%, rgba(65, 85, 180, 0.25) 55%, transparent 78%)',
              filter: 'blur(95px)',
              transform: `translate(${Math.sin(frame * 0.018) * 50}px, ${Math.cos(frame * 0.022) * 45}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '55%',
              left: '20%',
              width: 650,
              height: 650,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(235, 140, 160, 0.5) 0%, rgba(180, 90, 130, 0.2) 60%, transparent 80%)',
              filter: 'blur(90px)',
              transform: `translate(${Math.sin(frame * 0.015) * 35}px, ${Math.cos(frame * 0.02) * 30}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10%',
              right: '15%',
              width: 600,
              height: 600,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(130, 95, 205, 0.45) 0%, transparent 75%)',
              filter: 'blur(95px)',
              transform: `translate(${Math.cos(frame * 0.016) * 35}px, ${Math.sin(frame * 0.018) * 30}px)`,
            }}
          />
        </>
      )}

      {/* Subtle Atmospheric Vignette Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* Top Phone Status Bar & iOS Lock Screen Header                 */}
      {/* ------------------------------------------------------------- */}
      {config.showStatusBar && <PhoneStatusBar />}
      {isLockscreen && <LockScreenHeader />}

      {/* ------------------------------------------------------------- */}
      {/* Synchronized Fluid Lyrics Section                             */}
      {/* ------------------------------------------------------------- */}
      {config.showLyrics && timedLines.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: isLockscreen ? 410 : 220,
            left: 80,
            right: 80,
            height: isLockscreen ? 680 : 400,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 12,
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 78%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 78%, transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              transform: `translateY(${-lyricScrollY + (isLockscreen ? 300 : 160)}px)`,
              transition: 'transform 0.1s ease-out',
            }}
          >
            {timedLines.map((line, idx) => {
              const isActive = idx === activeSegment;
              const isPast = idx < activeSegment;
              const distance = Math.abs(idx - activeSegment);

              const opacity = isActive
                ? 1
                : distance === 1
                  ? 0.45
                  : distance === 2
                    ? 0.22
                    : 0.08;

              const blurPx = isActive ? 0 : Math.min(4, distance * 1.5);
              const scale = isActive ? 1.05 + activeSpring * 0.04 : distance === 1 ? 0.94 : 0.88;

              return (
                <div
                  key={line.index}
                  style={{
                    height: LYRIC_LINE_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0 24px',
                    width: '100%',
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    opacity,
                    filter: blurPx > 0.3 ? `blur(${blurPx}px)` : 'none',
                    transition: 'opacity 0.25s ease, transform 0.25s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: isActive ? 52 : 32,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? themeStyles.lyricsActiveColor : themeStyles.lyricsInactiveColor,
                      textShadow: isActive
                        ? `${themeStyles.lyricsGlow}, 0 0 25px rgba(255, 255, 255, 0.4)`
                        : '0 2px 8px rgba(0,0,0,0.5)',
                      letterSpacing: '-0.3px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* The Music Widget (Centered / Lower-third Lockscreen Card)    */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: isLockscreen ? 1140 : '50%',
          transform: isLockscreen
            ? 'translateX(-50%)'
            : 'translate(-50%, -50%)',
          width: 940,
          zIndex: 15,
        }}
      >
        {/* Ambient Under-Glow behind frosted card */}
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: 68,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.2) 0%, rgba(230, 160, 210, 0.25) 45%, transparent 75%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Frosted Glass Outer Container */}
        <div
          style={{
            width: '100%',
            borderRadius: 54,
            background: themeStyles.cardBg,
            backdropFilter: 'blur(50px) saturate(190%)',
            WebkitBackdropFilter: 'blur(50px) saturate(190%)',
            border: themeStyles.cardBorder,
            boxShadow: themeStyles.cardShadow,
            padding: '48px 52px',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            position: 'relative',
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          {/* Ambient Diagonal Specular Sweep on Glass */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 49%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.06) 51%, transparent 60%)',
              transform: `translateX(${widgetGlassGlint}px)`,
              pointerEvents: 'none',
            }}
          />

          {/* Top Row: Thumbnail + Title/Singer + AirPlay Route Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            {/* Left: Video / Album Cover Thumbnail */}
            <div
              style={{
                width: 192,
                height: 126,
                borderRadius: 22,
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backgroundColor: '#161924',
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
                // Default Procedural Thumbnail matching the reference image!
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #181d36 0%, #462552 50%, #171b2e 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      color: '#FFFFFF',
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                      textShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    music
                  </span>
                  {/* Mini Red YouTube Play Badge in bottom-right corner */}
                  <div
                    style={{
                      position: 'absolute',
                      right: 10,
                      bottom: 10,
                      width: 24,
                      height: 16,
                      borderRadius: 4,
                      backgroundColor: '#FF0000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: '4px solid transparent',
                        borderBottom: '4px solid transparent',
                        borderLeft: '6.5px solid #FFFFFF',
                        marginLeft: 1.5,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Middle: Song Title & Singer */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: themeStyles.titleColor,
                  letterSpacing: -0.4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}
              >
                {displayTitle}
              </div>
              {displaySinger && (
                <div
                  style={{
                    fontSize: 23,
                    fontWeight: 500,
                    color: themeStyles.subtitleColor,
                    marginTop: 6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displaySinger}
                </div>
              )}
            </div>

            {/* Right: Blue AirPlay Wireless Route Button */}
            <AirPlayIcon bg={themeStyles.airPlayBg} color={themeStyles.airPlayColor} />
          </div>

          {/* Progress Bar & Timestamps */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
            {/* Scrubber Track Bar */}
            <div
              style={{
                width: '100%',
                height: 9,
                borderRadius: 4.5,
                backgroundColor: themeStyles.trackBg,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Filled Track */}
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: '100%',
                  borderRadius: 4.5,
                  backgroundColor: themeStyles.progressFilled,
                }}
              />
              {/* White Round Scrubber Knob Handle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${progress * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: themeStyles.thumbColor,
                  boxShadow: themeStyles.thumbShadow,
                }}
              />
            </div>

            {/* Timestamps Row directly below the bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 14,
                fontSize: 22,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: themeStyles.timeColor,
              }}
            >
              <span>{formatTime(elapsedMs)}</span>
              <span>-{formatTime(remainingMs)}</span>
            </div>
          </div>

          {/* Playback Controls Row (<<  ❚❚  >>) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 104,
              margin: '6px 0 16px 0',
            }}
          >
            {/* Rewind << */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <RewindIcon color={themeStyles.controlColor} />
            </div>

            {/* Play/Pause ❚❚ with rhythm beat pulse */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${beatPulse})`,
                transformOrigin: 'center center',
                cursor: 'pointer',
              }}
            >
              <PauseIcon color={themeStyles.controlColor} />
            </div>

            {/* Fast Forward >> */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <FastForwardIcon color={themeStyles.controlColor} />
            </div>
          </div>

          {/* Volume Slider Row (Speaker Min - Bar - Speaker Max) */}
          {config.showVolumeBar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                marginTop: 2,
              }}
            >
              {/* Left: Speaker Min */}
              <SpeakerMinIcon color={themeStyles.speakerColor} />

              {/* Middle: Horizontal Volume Bar */}
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: themeStyles.volumeTrackBg,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* Fixed Volume Thumb Position at ~68% with subtle micro-oscillation */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${68 + Math.sin(frame * 0.04) * 1.5}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    backgroundColor: themeStyles.thumbColor,
                    boxShadow: themeStyles.thumbShadow,
                  }}
                />
              </div>

              {/* Right: Speaker Max */}
              <SpeakerMaxIcon color={themeStyles.speakerColor} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Home Indicator Bar (iOS Swipe bar) */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 380,
          height: 7,
          borderRadius: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          zIndex: 20,
        }}
      />
    </div>
  );
};

// Export三件套 (frame-smith standard contract)
export const MUSIC_WIDGET_FRAMES = 1800;
export const MusicWidgetTemplateCover: React.FC<TemplateRenderProps<MusicWidgetConfig>> = (props) => (
  <MusicWidgetTemplate {...props} />
);
