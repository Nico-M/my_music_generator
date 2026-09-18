import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, Img, spring } from 'remotion';
import type { TemplateRenderProps } from '../types';
import type { LyricPosterConfig } from './config';
import { getPosterColors } from './config';
import { getActiveLineState } from '../shared/timing';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const LINE_HEIGHT = 80;
const VIEWPORT_LINES = 10;
const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Procedural Barcode SVG
function BarcodeGraphic({ color }: { color: string }) {
  const bars = [
    3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 2, 1, 3, 2, 1, 4, 1, 3, 2, 1,
    2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3,
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 42, gap: 2 }}>
      {bars.map((w, i) => (
        <div
          key={i}
          style={{
            width: w,
            backgroundColor: color,
            opacity: i % 2 === 0 ? 0.85 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

// Crisp Microphone SVG Icon
function MicrophoneIcon({
  color,
  size = 24,
  glow = false,
}: {
  color: string;
  size?: number;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        filter: glow ? `drop-shadow(0 0 8px ${color})` : undefined,
      }}
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" fill={glow ? color : 'none'} fillOpacity={glow ? 0.25 : 0} />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

export const LyricPosterTemplate: React.FC<TemplateRenderProps<LyricPosterConfig>> = ({
  data,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const state = getActiveLineState(data.lines, nowMs);
  const colors = getPosterColors(config.colorTheme ?? 'swiss-red');

  const totalDurationMs = Math.max(data.durationMs || 0, 1000);
  const progressRatio = Math.min(1, Math.max(0, nowMs / totalDurationMs));

  // Vinyl rotation: 33 1/3 RPM -> around 0.55 deg per frame @ 30fps
  const vinylRotation = frame * 0.45;

  // Active line index
  const activeIdx =
    state.currentIndex >= 0
      ? state.currentIndex
      : state.lastStartedIndex >= 0
        ? state.lastStartedIndex
        : 0;

  // Timed lines for smooth deterministic scrolling
  const timedLines = useMemo(() => {
    const list: { lineIdx: number; startMs: number }[] = [];
    for (let i = 0; i < data.lines.length; i++) {
      const s = data.lines[i].startMs;
      if (s != null) {
        list.push({ lineIdx: i, startMs: s });
      }
    }
    return list;
  }, [data.lines]);

  // Deterministic Remotion scroll position for the lyric feed
  const scrollOffsetY = useMemo(() => {
    if (timedLines.length === 0) {
      return activeIdx * LINE_HEIGHT;
    }

    if (nowMs <= timedLines[0].startMs) {
      return 0;
    }

    let segment = 0;
    for (let k = 0; k < timedLines.length; k++) {
      if (nowMs >= timedLines[k].startMs) {
        segment = k;
      } else {
        break;
      }
    }

    const current = timedLines[segment];
    const target = current.lineIdx * LINE_HEIGHT;

    if (segment === 0) {
      return target;
    }

    const prev = timedLines[segment - 1];
    const prevTarget = prev.lineIdx * LINE_HEIGHT;

    if (prevTarget === target) {
      return target;
    }

    const duration = Math.min(
      320,
      Math.max(160, (current.startMs - prev.startMs) * 0.5)
    );

    return interpolate(
      nowMs,
      [current.startMs, current.startMs + duration],
      [prevTarget, target],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );
  }, [timedLines, nowMs, activeIdx]);

  // Ken Burns subtle breathing scale for blurred cover background
  const bgScale = 1.15 + Math.sin(frame * 0.012) * 0.06;
  const bgTranslateY = Math.sin(frame * 0.009) * 14;
  const bgTranslateX = Math.cos(frame * 0.007) * 10;

  // Frame-smith: Spring slide-out for the vinyl record from the sleeve
  const vinylEntrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const vinylLeft = interpolate(vinylEntrance, [0, 1], [60, 210], clampOpts);
  const vinylBobY = Math.sin(frame * 0.04) * 4;
  const vinylTilt = Math.sin(frame * 0.03) * 1.8;

  // Frame-smith: Active lyric line spring overshoot
  const currentLineStart = state.currentIndex >= 0 ? data.lines[state.currentIndex]?.startMs ?? 0 : 0;
  const activeLocalFrame = Math.max(0, (nowMs - currentLineStart) / (1000 / fps));
  const activeSpring = spring({
    frame: activeLocalFrame,
    fps,
    config: { damping: 13, stiffness: 145 },
  });

  // Barcode animated scanning laser position
  const barcodeScan = (frame * 1.8) % 180;

  // Safely upgrade cover image URL to HTTPS if needed
  const safeCoverUrl = data.coverUrl
    ? data.coverUrl.startsWith('http://')
      ? data.coverUrl.replace('http://', 'https://')
      : data.coverUrl
    : null;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.bg,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
        color: colors.textPrimary,
      }}
    >
      {/* ===== LAYER 0: VIBRANT FROSTED GLASS COVER BACKGROUND ===== */}
      <div
        style={{
          position: 'absolute',
          inset: -80,
          overflow: 'hidden',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {safeCoverUrl ? (
          <Img
            src={safeCoverUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate(${bgTranslateX}px, ${bgTranslateY}px) scale(${bgScale})`,
              transformOrigin: 'center center',
              filter: 'blur(45px) saturate(1.35) brightness(0.92)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `radial-gradient(circle at 40% 35%, ${colors.accent}77 0%, ${colors.accentSecondary}44 40%, #151d2c 70%, #060912 100%)`,
              transform: `translate(${bgTranslateX}px, ${bgTranslateY}px) scale(${bgScale})`,
              filter: 'blur(45px)',
            }}
          />
        )}

        {/* Frosted Glass Scrim (Balanced at 38% opacity so colorful cover artwork is clearly visible!) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(8, 12, 18, 0.38)',
          }}
        />

        {/* Soft Vignette Depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0, 0, 0, 0.45) 100%)',
          }}
        />

        {/* Frosted Glass Specular Highlight */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 35%, rgba(0, 0, 0, 0.2) 100%)',
          }}
        />
      </div>

      {/* Background Matte Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 48,
          border: `1px solid ${colors.gridLine}`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 48,
          bottom: 48,
          left: 380,
          borderLeft: `1px dashed ${colors.gridLine}`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Subtle paper grain texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
          zIndex: 6,
        }}
      />

      {/* ===== HEADER: SWISS ARCHIVE BAR ===== */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 72,
          right: 72,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: 16,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              backgroundColor: colors.accent,
              color: '#FFFFFF',
              padding: '3px 8px',
              borderRadius: 3,
              letterSpacing: 1.5,
            }}
          >
            VINYL LP
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 3,
              color: colors.textSecondary,
              fontFamily: '"Fira Code", monospace',
            }}
          >
            ARCHIVE NO. 01 // 33⅓ RPM
          </span>
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 2,
            color: colors.textSecondary,
            fontFamily: '"Fira Code", monospace',
          }}
        >
          HI-RES AUDIO [44.1kHz]
        </div>
      </div>

      {/* ===== SECTION 2: VINYL POCKET & ROTATING RECORD ===== */}
      <div
        style={{
          position: 'absolute',
          top: 156,
          left: 72,
          right: 72,
          height: 380,
          zIndex: 20,
        }}
      >
        {/* Vinyl Sleeve Container (Left) */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: 340,
            height: 340,
            borderRadius: 16,
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 25,
          }}
        >
          {safeCoverUrl ? (
            <Img
              src={safeCoverUrl}
              alt={data.title}
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            /* Procedural Vinyl Sleeve Cover */
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${colors.cardBg} 0%, #08080A 100%)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 28,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: colors.accent,
                }}
              >
                SPECIAL EDITION
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 32,
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: '#FFFFFF',
                  }}
                >
                  {data.title}
                </h3>
                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: 18,
                    fontWeight: 500,
                    color: colors.accent,
                  }}
                >
                  {data.singer ?? 'ARTIST'}
                </p>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: '"Fira Code", monospace',
                }}
              >
                SIDE A · STEREO
              </div>
            </div>
          )}

          {/* Sleeve Paper Spine Highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 8,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Rotating Vinyl Record (Spring sliding out to the right + gentle float) */}
        <div
          style={{
            position: 'absolute',
            top: 20 + vinylBobY,
            left: vinylLeft,
            width: 340,
            height: 340,
            borderRadius: '50%',
            backgroundColor: '#09090B',
            boxShadow:
              '0 24px 60px rgba(0,0,0,0.85), inset 0 0 0 2px rgba(255,255,255,0.1), 0 0 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${vinylRotation}deg) rotateZ(${vinylTilt}deg)`,
            transformOrigin: 'center center',
            zIndex: 22,
          }}
        >
          {/* Vinyl Micro-Groove Rings */}
          {[150, 130, 110, 90, 70].map((radius, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: radius * 2,
                height: radius * 2,
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: 'inset 0 0 4px rgba(255,255,255,0.03)',
              }}
            />
          ))}

          {/* Dynamic Anisotropic Sweeping Sheen across the vinyl */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from ${vinylRotation * 1.5}deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.16) 40deg, transparent 80deg, transparent 180deg, rgba(255,255,255,0.12) 220deg, transparent 260deg, transparent 360deg)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />

          {/* Vinyl Center Paper Label */}
          <div
            style={{
              position: 'relative',
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: colors.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            }}
          >
            {safeCoverUrl ? (
              <Img
                src={safeCoverUrl}
                alt={data.title}
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.9,
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: 8,
                  lineHeight: 1.1,
                }}
              >
                {data.title.slice(0, 8)}
              </div>
            )}
            {/* Center Spindle Hole */}
            <div
              style={{
                position: 'absolute',
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: colors.bg,
                border: '2px solid rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </div>

        {/* Right Info Card: Metadata */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 10,
            width: 320,
            textAlign: 'right',
            zIndex: 30,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2,
              color: colors.accent,
              marginBottom: 8,
              fontFamily: '"Fira Code", monospace',
            }}
          >
            CATALOG // LP-2026
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: 1,
            }}
          >
            {data.creatorName ?? 'STEREO MASTER'}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: colors.textSecondary,
              marginTop: 6,
              fontFamily: '"Fira Code", monospace',
            }}
          >
            FORMAT: 1080×1920 30FPS
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: EDITORIAL TITLE BLOCK ===== */}
      <div
        style={{
          position: 'absolute',
          top: 570,
          left: 72,
          right: 72,
          borderBottom: `2px solid ${colors.textPrimary}`,
          paddingBottom: 24,
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: colors.accent,
            letterSpacing: 3,
            marginBottom: 10,
            fontFamily: '"Fira Code", monospace',
          }}
        >
          FEATURED TRACK 01 /
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 64,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: -1,
            lineHeight: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {data.title}
        </h1>
        {data.singer && (
          <p
            style={{
              margin: '12px 0 0 0',
              fontSize: 28,
              fontWeight: 600,
              color: colors.textSecondary,
              letterSpacing: 2,
            }}
          >
            {data.singer}
          </p>
        )}
      </div>

      {/* ===== SECTION 4: SWISS MULTI-LINE EDITORIAL LYRIC FEED ===== */}
      <div
        style={{
          position: 'absolute',
          top: 790,
          left: 72,
          right: 72,
          height: LINE_HEIGHT * VIEWPORT_LINES,
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        <div
          style={{
            transform: `translateY(${-scrollOffsetY + LINE_HEIGHT * 1.5}px) translateZ(0)`,
            willChange: 'transform',
          }}
        >
          {data.lines.map((line, i) => {
            const isCurrent = i === state.currentIndex;
            const isPast =
              state.currentIndex >= 0
                ? i < state.currentIndex
                : state.lastStartedIndex >= 0 && i <= state.lastStartedIndex;
            const distFromActive = Math.abs(i - activeIdx);
            const blurPx = isCurrent ? 0 : Math.min(3.5, distFromActive * 0.75);
            const scale = isCurrent ? 1 + activeSpring * 0.04 : Math.max(0.95, 1 - distFromActive * 0.015);
            const opacity = isCurrent ? 1 : isPast ? 0.42 : 0.65;

            return (
              <div
                key={i}
                style={{
                  height: LINE_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '0 16px',
                  borderRadius: 12,
                  backgroundColor: isCurrent ? colors.cardBg : 'transparent',
                  borderLeft: isCurrent ? `4px solid ${colors.accent}` : '4px solid transparent',
                  boxShadow: isCurrent ? `0 8px 30px rgba(0,0,0,0.5), 0 0 24px ${colors.accent}25` : 'none',
                  transform: `scale(${scale})`,
                  transformOrigin: 'left center',
                  opacity,
                  filter: blurPx > 0.3 ? `blur(${blurPx}px)` : 'none',
                  transition: 'background-color 0.2s ease',
                }}
              >
                {/* Microphone Icon indicator */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCurrent ? `${colors.accent}28` : 'transparent',
                    boxShadow: isCurrent ? `0 0 16px ${colors.accent}40` : 'none',
                    flexShrink: 0,
                  }}
                >
                  <MicrophoneIcon
                    color={isCurrent ? colors.accent : colors.textSecondary}
                    size={26}
                    glow={isCurrent}
                  />
                </div>

                {/* Lyric Text */}
                <span
                  style={{
                    fontSize: isCurrent ? 44 : 36,
                    fontWeight: isCurrent ? 800 : 500,
                    color: isCurrent
                      ? '#FFFFFF'
                      : isPast
                        ? colors.textSecondary
                        : 'rgba(255,255,255,0.65)',
                    letterSpacing: isCurrent ? 1 : 0.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: isCurrent
                      ? `0 0 24px rgba(255, 255, 255, 0.5), 0 0 45px ${colors.accent}35`
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

      {/* ===== SECTION 5: FOOTER (BARCODE & PROGRESS) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          left: 72,
          right: 72,
          zIndex: 20,
        }}
      >
        {/* Progress Line with Luminous Playhead */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 3,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: `${progressRatio * 100}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: colors.accent,
              boxShadow: `0 0 12px ${colors.accent}`,
            }}
          />
          {/* Glowing Playhead Bead */}
          <div
            style={{
              position: 'absolute',
              left: `${progressRatio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: `0 0 10px #FFFFFF, 0 0 16px ${colors.accent}`,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          {/* Barcode graphic with animated laser sweep */}
          <div>
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <BarcodeGraphic color={colors.textPrimary} />
              {/* Sweeping Laser Glint */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: barcodeScan,
                  width: 2,
                  backgroundColor: colors.accent,
                  boxShadow: `0 0 8px ${colors.accent}, 0 0 14px ${colors.accent}`,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: '"Fira Code", monospace',
                color: colors.textSecondary,
                letterSpacing: 3,
                marginTop: 6,
              }}
            >
              8 920194 019284
            </div>
          </div>

          {/* Center Title metadata stamp */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 2,
              color: colors.textSecondary,
              fontFamily: '"Fira Code", monospace',
              textAlign: 'center',
            }}
          >
            EDITORIAL POSTER ARCHIVE
          </div>

          {/* Timecode */}
          <div
            style={{
              fontFamily: '"Fira Code", monospace',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
              color: colors.textPrimary,
              textAlign: 'right',
            }}
          >
            {formatTime(nowMs)} / {formatTime(totalDurationMs)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export三件套 (frame-smith standard contract)
export const LYRIC_POSTER_FRAMES = 1800;
export const LyricPosterTemplateCover: React.FC<TemplateRenderProps<LyricPosterConfig>> = (props) => (
  <LyricPosterTemplate {...props} />
);
