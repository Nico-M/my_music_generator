'use client';

import { useRef, useEffect, useState, useCallback, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { gsap } from 'gsap';

export interface AccordionGalleryItem {
  id?: string;
  image: string;
  label?: string;
  sublabel?: string;
  tag?: string;
  description?: string;
  link?: string;
  alt?: string;
}

export interface AccordionGalleryProps {
  items?: AccordionGalleryItem[];
  defaultIndex?: number;
  accentColor?: string;
  overlayColor?: string;
  textColor?: string;
  height?: number;
  gap?: number;
  radius?: number;
  expandRatio?: number;
  orientation?: 'horizontal' | 'vertical';
  duration?: number;
  ease?: string;
  parallax?: number;
  tilt?: number;
  stagger?: number;
  trigger?: 'hover' | 'click';
  showLabels?: boolean;
  grayscale?: boolean;
  className?: string;
  onSelectTemplate?: (id: string) => void;
  selectButtonText?: string;
}

const DEFAULT_ITEMS: AccordionGalleryItem[] = [
  { image: 'https://picsum.photos/id/1015/900/1200', label: 'Canyon', link: '#' },
  { image: 'https://picsum.photos/id/1018/900/1200', label: 'Ridgeline', link: '#' },
  { image: 'https://picsum.photos/id/1039/900/1200', label: 'Falls', link: '#' },
  { image: 'https://picsum.photos/id/1043/900/1200', label: 'Harbour', link: '#' },
  { image: 'https://picsum.photos/id/1044/900/1200', label: 'Skyline', link: '#' },
];

export default function AccordionGallery({
  items = DEFAULT_ITEMS,
  defaultIndex = 2,
  accentColor = '#6366f1',
  overlayColor = '#060010',
  textColor = '#ffffff',
  height = 460,
  gap = 12,
  radius = 20,
  expandRatio = 0.46,
  orientation = 'horizontal',
  duration = 0.6,
  ease = 'power3.out',
  parallax = 0.5,
  tilt = 6,
  stagger = 0.05,
  trigger = 'hover',
  showLabels = true,
  grayscale = true,
  className = '',
  onSelectTemplate,
  selectButtonText = '使用此模板',
}: AccordionGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLElement | null)[]>([]);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const mediaSizeRef = useRef<number>(360);
  const firstRunRef = useRef<boolean>(true);

  const vertical = orientation === 'vertical';
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const overlayBg = `linear-gradient(180deg, transparent 35%, color-mix(in srgb, ${overlayColor} 82%, transparent) 100%), color-mix(in srgb, ${overlayColor} calc(var(--ag-dim, 0.4) * 100%), transparent)`;

  const applyLayout = useCallback(
    (animate: boolean) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      const mediaSize = mediaSizeRef.current;

      tlRef.current?.kill();
      const dur = animate && !prefersReduced ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === active;
        const media = mediaRefs.current[i];
        const bar = barRefs.current[i];
        const text = textRefs.current[i];
        const content = contentRefs.current[i];

        const rot = isActive ? 0 : i < active ? tilt : -tilt;
        const rotProp = vertical ? { rotateX: -rot } : { rotateY: rot };

        tl.to(
          panel,
          {
            flexGrow: isActive ? grow : 1,
            ...rotProp,
            duration: dur,
            ease,
          },
          0
        );

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - i));
          const shift = drift * parallax * mediaSize * 0.06;
          const gray = grayscale ? (isActive ? 0 : 0.85) : 0;
          tl.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: vertical ? 0 : isActive ? 0 : shift,
              y: vertical ? (isActive ? 0 : shift) : 0,
              '--ag-gray': gray,
              '--ag-dim': isActive ? 0.05 : 0.45,
              duration: dur,
              ease,
            },
            0
          );
        }

        if (showLabels && bar && text) {
          if (isActive) {
            tl.to([bar, text], { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger }, 0);
          } else {
            tl.to([bar, text], { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0);
          }
        }

        if (content) {
          if (isActive) {
            tl.to(content, { opacity: 1, y: 0, duration: dur, ease }, prefersReduced ? 0 : 0.08);
          } else {
            tl.to(content, { opacity: 0, y: 12, duration: dur * 0.4, ease }, 0);
          }
        }
      });

      tlRef.current = tl;
    },
    [
      active,
      count,
      expandRatio,
      duration,
      ease,
      vertical,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const total = vertical ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(160, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.25);
      mediaSizeRef.current = size;
      el.style.setProperty('--ag-media-size', `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout, gap, count, expandRatio, vertical]);

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    []
  );

  const handleEnter = (i: number) => {
    if (trigger === 'hover') setActive(i);
  };

  const handleClick = (i: number, e: MouseEvent) => {
    if (i !== active) {
      e.preventDefault();
      setActive(i);
    }
  };

  const handleKeyDown = (i: number, e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i + 1) % count);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i - 1 + count) % count);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`flex ${vertical ? 'flex-col' : 'flex-row'} w-full max-w-full [perspective:1400px] max-[640px]:!flex-col max-[640px]:[perspective:none] select-none ${className}`}
      style={{
        gap: `${gap}px`,
        height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px`,
      }}
      role="list"
      aria-label="Image accordion gallery"
    >
      {items.map((item, i) => {
        const isActive = i === active;
        const Tag = (item.link ? 'a' : 'div') as 'div';
        return (
          <Tag
            key={item.id || i}
            ref={(el: HTMLElement | null) => {
              panelRefs.current[i] = el;
            }}
            className={`group relative block min-w-0 min-h-0 flex-[1_1_0] cursor-pointer overflow-hidden bg-[#0a0713] no-underline outline-none [transform-style:preserve-3d] [transform-origin:center] transition-shadow duration-500 max-[640px]:min-h-[84px] max-[640px]:!transform-none ${
              isActive
                ? 'ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-950/70'
                : 'border border-white/10 hover:border-white/25 shadow-lg'
            }`}
            style={
              {
                borderRadius: `${radius}px`,
                '--ag-accent': accentColor,
                willChange: 'flex-grow, transform',
              } as CSSProperties
            }
            onClick={(e: MouseEvent<HTMLDivElement>) => handleClick(i, e)}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => setActive(i)}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => handleKeyDown(i, e)}
            role="listitem"
            tabIndex={0}
            aria-current={isActive ? 'true' : undefined}
            aria-label={item.label}
          >
            {/* Background Media Container */}
            <span className="absolute inset-0 overflow-hidden [border-radius:inherit]">
              <span
                ref={(el: HTMLElement | null) => {
                  mediaRefs.current[i] = el;
                }}
                className="absolute top-1/2 left-1/2 [filter:grayscale(var(--ag-gray,1))]"
                style={{
                  width: vertical ? '100%' : 'var(--ag-media-size, 380px)',
                  height: vertical ? 'var(--ag-media-size, 380px)' : '100%',
                  willChange: 'transform, filter',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.alt || item.label || ''}
                  draggable={false}
                  className="block h-full w-full select-none object-cover object-top [-webkit-user-drag:none] transition-transform duration-700 group-hover:scale-105"
                />
              </span>
              <span
                className="pointer-events-none absolute inset-0"
                style={{ background: overlayBg }}
                aria-hidden="true"
              />
            </span>

            {/* Top Badges (Visible on both collapsed and active) */}
            <div className="absolute top-3 inset-x-3 z-[3] flex items-center justify-between pointer-events-none">
              {item.id && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium backdrop-blur-md border transition-all ${
                  isActive
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40 shadow-xs'
                    : 'bg-black/60 text-slate-300 border-white/15'
                }`}>
                  {item.id}
                </span>
              )}
              {item.tag && isActive && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white backdrop-blur-md border border-white/20 shadow-xs">
                  {item.tag}
                </span>
              )}
            </div>

            {/* Bottom Content Area */}
            {showLabels && (
              <div
                className="pointer-events-none absolute bottom-4 left-4 right-4 z-[3] flex flex-col justify-end"
                aria-hidden="true"
              >
                {/* Title Line with Accent Bar */}
                <div className="flex items-center gap-2.5 mb-1">
                  <span
                    ref={(el: HTMLElement | null) => {
                      barRefs.current[i] = el;
                    }}
                    className="h-[22px] w-[3.5px] flex-none rounded-full opacity-0"
                    style={{
                      background: accentColor,
                      boxShadow: `0 0 12px color-mix(in srgb, ${accentColor} 80%, transparent)`,
                    }}
                  />
                  <span
                    ref={(el: HTMLElement | null) => {
                      textRefs.current[i] = el;
                    }}
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-base sm:text-lg font-bold tracking-tight opacity-0 [text-shadow:0_2px_14px_rgba(0,0,0,0.7)]"
                    style={{ color: textColor }}
                  >
                    {item.label}
                  </span>
                </div>

                {/* Expanded Details Panel with Description and CTA */}
                <div
                  ref={(el: HTMLElement | null) => {
                    contentRefs.current[i] = el;
                  }}
                  className="opacity-0 translate-y-3 space-y-2.5 pt-1"
                >
                  {item.description && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed max-w-md [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
                      {item.description}
                    </p>
                  )}

                  {onSelectTemplate && item.id && (
                    <div className="pt-1 pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.id) onSelectTemplate(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-md shadow-indigo-600/40 cursor-pointer"
                      >
                        <span>{selectButtonText}</span>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
