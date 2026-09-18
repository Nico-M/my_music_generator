'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from '@/components/icons/IonIcons';
import { useI18n } from '@/components/LanguageProvider';

export interface TemplateItem {
  id: string;
  name: string;
  nameZh: string;
  tag: string;
  tagZh: string;
  description: string;
  descriptionZh: string;
  image: string;
}

export const TEMPLATES: TemplateItem[] = [
  {
    id: 'notes',
    name: 'Notes',
    nameZh: '便签备忘',
    tag: 'iOS Minimal',
    tagZh: '极简便签',
    description: 'iPhone Notes checklist style with animated strikethrough checkmarks',
    descriptionZh: '经典备忘录清单风格，逐行淡入与灵动画线勾选',
    image: '/assets/templates/notes.jpg',
  },
  {
    id: 'record',
    name: 'Record',
    nameZh: '语音备忘录',
    tag: 'Sound Wave',
    tagZh: '拟物声波',
    description: 'iPhone Voice Memo style with real-time waveform dynamics',
    descriptionZh: '拟物录音机动态波形，沉浸式黑白对比与时间刻度',
    image: '/assets/templates/record.jpg',
  },
  {
    id: 'neon-spectrum',
    name: 'Neon Spectrum',
    nameZh: '霓虹律动',
    tag: 'Cyber Aurora',
    tagZh: '赛博极光',
    description: 'Ethereal neon aurora fluid glow with pulsing cyber kinetic typography',
    descriptionZh: '赛博极光流体光晕与发光脉冲歌词，沉浸式音画共振',
    image: '/assets/templates/neon-spectrum.jpg',
  },
  {
    id: 'liquid-wave',
    name: 'Liquid Wave',
    nameZh: '流体水波',
    tag: 'Ethereal Flow',
    tagZh: '流体唯美',
    description: 'Dreamy liquid ripples and ambient light with ethereal floating lyrics',
    descriptionZh: '梦幻流动波纹微光，轻柔灵动的高质感浮动字幕',
    image: '/assets/templates/liquid-wave.jpg',
  },
  {
    id: 'lyric-poster',
    name: 'Lyric Poster',
    nameZh: '歌词海报',
    tag: 'Editorial',
    tagZh: '杂志大牌',
    description: 'Editorial kinetic typography with bold layout and dynamic motion',
    descriptionZh: '全屏大牌杂志海报排版，动感排版与艺术字体呈现',
    image: '/assets/templates/lyric-poster.jpg',
  },
  {
    id: 'ipod-classic',
    name: 'iPod Classic',
    nameZh: '经典 iPod',
    tag: 'Retro Classic',
    tagZh: '复古情怀',
    description: 'Classic Apple iPod with anodized aluminum body and Now Playing LCD',
    descriptionZh: '磨砂铝合金机身与实体转盘，复古 LCD 正在播放屏幕',
    image: '/assets/templates/ipod-classic.jpg',
  },
  {
    id: 'music-widget',
    name: 'Music Widget',
    nameZh: '音乐小组件',
    tag: 'Glassmorphism',
    tagZh: '毛玻璃微件',
    description: 'iOS frosted glass lock screen widget with scrubber controls & lyrics',
    descriptionZh: 'iOS 锁屏毛玻璃微件，进度条控制器与同屏歌词显示',
    image: '/assets/templates/music-widget.jpg',
  },
];

interface TemplateCarouselProps {
  onSelectTemplate?: (templateId: string) => void;
  theme?: 'light' | 'dark';
}

export default function TemplateCarousel({ onSelectTemplate, theme = 'dark' }: TemplateCarouselProps) {
  const { locale } = useI18n();
  const isDark = theme === 'dark';
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = TEMPLATES.length;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto carousel effect
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 3500);
    return () => clearInterval(timer);
  }, [isHovered, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        prevSlide();
      } else {
        nextSlide();
      }
    }
    touchStartX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  };

  return (
    <div
      className="relative w-full select-none outline-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={locale === 'zh' ? '模板轮播展示' : 'Templates carousel'}
    >
      {/* Carousel Track Stage with 3D perspective */}
      <div
        className="relative w-full h-[450px] sm:h-[490px] md:h-[530px] overflow-hidden flex items-center justify-center py-4"
        style={{ perspective: '1100px', perspectiveOrigin: 'center 60%' }}
      >
        {TEMPLATES.map((tpl, i) => {
          let offset = (i - activeIndex) % total;
          if (offset > Math.floor(total / 2)) offset -= total;
          if (offset < -Math.floor(total / 2)) offset += total;

          const isCenter = offset === 0;
          const isLeft = offset === -1;
          const isRight = offset === 1;

          // Compute poker card fan tilt, perspective deformation & 0.5, 1, 0.5 presentation
          let transform = 'translate(-50%, -50%) scale(0.7)';
          let opacity = 0;
          let zIndex = 10;
          let filter = 'none';
          let pointerEvents: 'auto' | 'none' = 'none';
          let cursor = 'default';
          let boxShadow = 'none';

          if (isCenter) {
            // Center card: flat, prominent, elevated
            transform = 'translate(-50%, -50%) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)';
            opacity = 1;
            zIndex = 30;
            pointerEvents = 'auto';
            cursor = 'default';
            boxShadow = '0 25px 50px -12px rgba(79, 70, 229, 0.22), 0 10px 20px -5px rgba(0, 0, 0, 0.08)';
          } else if (isLeft) {
            // Left card: poker fan tilt (-7.5deg), 3D perspective deformation (rotateY 16deg, rotateX 4deg), 0.5 opacity
            transform = 'translate(calc(-50% - 68%), -48%) rotateX(4deg) rotateY(16deg) rotateZ(-7.5deg) scale(0.88)';
            opacity = 0.5;
            zIndex = 20;
            filter = 'brightness(0.92)';
            pointerEvents = 'auto';
            cursor = 'pointer';
            boxShadow = '-12px 22px 35px -8px rgba(0, 0, 0, 0.28)';
          } else if (isRight) {
            // Right card: poker fan tilt (+7.5deg), 3D perspective deformation (rotateY -16deg, rotateX 4deg), 0.5 opacity
            transform = 'translate(calc(-50% + 68%), -48%) rotateX(4deg) rotateY(-16deg) rotateZ(7.5deg) scale(0.88)';
            opacity = 0.5;
            zIndex = 20;
            filter = 'brightness(0.92)';
            pointerEvents = 'auto';
            cursor = 'pointer';
            boxShadow = '12px 22px 35px -8px rgba(0, 0, 0, 0.28)';
          } else {
            const dir = offset < 0 ? -1 : 1;
            transform = `translate(calc(-50% + ${dir * 145}%), -44%) rotateX(8deg) rotateY(${dir * -28}deg) rotateZ(${dir * 14}deg) scale(0.7)`;
            opacity = 0;
            zIndex = 10;
            pointerEvents = 'none';
          }

          const displayName = locale === 'zh' ? tpl.nameZh : tpl.name;
          const displayTag = locale === 'zh' ? tpl.tagZh : tpl.tag;
          const displayDesc = locale === 'zh' ? tpl.descriptionZh : tpl.description;

          return (
            <div
              key={tpl.id}
              onClick={() => {
                if (isLeft) prevSlide();
                else if (isRight) nextSlide();
                else if (isCenter && onSelectTemplate) onSelectTemplate(tpl.id);
              }}
              style={{
                transform,
                transformOrigin: '50% 92%',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                boxShadow,
                opacity,
                zIndex,
                filter,
                pointerEvents,
                cursor,
                visibility: Math.abs(offset) <= 2 ? 'visible' : 'hidden',
                transition:
                  'transform 600ms cubic-bezier(0.25, 1, 0.5, 1), opacity 600ms ease, filter 600ms ease, box-shadow 600ms ease',
              }}
              className={`absolute top-1/2 left-1/2 w-[270px] sm:w-[320px] md:w-[350px] h-[390px] sm:h-[430px] md:h-[460px] rounded-2xl overflow-hidden border flex flex-col group ${
                isDark
                  ? isCenter
                    ? 'bg-slate-900/90 border-indigo-500/50 ring-2 ring-indigo-500/30'
                    : 'bg-slate-950/80 border-white/10 hover:opacity-85 hover:brightness-100'
                  : isCenter
                  ? 'bg-white border-indigo-200/80 ring-2 ring-indigo-500/15'
                  : 'bg-white border-slate-200/80 hover:opacity-75 hover:brightness-100'
              }`}
            >
              {/* Cover Image Container */}
              <div className="relative flex-1 w-full bg-slate-950 overflow-hidden">
                <Image
                  src={tpl.image}
                  alt={displayName}
                  fill
                  className={`object-cover object-top transition-transform duration-700 ${
                    isCenter ? 'group-hover:scale-105' : ''
                  }`}
                  sizes="(max-width: 640px) 270px, (max-width: 1024px) 320px, 350px"
                  priority={isCenter}
                />

                {/* Subtle dark vignette at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 via-black/20 to-transparent pointer-events-none" />

                {/* Tag pill */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/55 text-white/95 backdrop-blur-md border border-white/20 shadow-xs">
                  {displayTag}
                </div>

                {/* Template ID badge */}
                <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium backdrop-blur-md border shadow-xs ${
                  isDark ? 'bg-black/60 text-slate-200 border-white/20' : 'bg-white/80 text-slate-800 border-white/40'
                }`}>
                  {tpl.id}
                </div>
              </div>

              {/* Bottom Info Bar */}
              <div className={`p-3.5 sm:p-4 backdrop-blur-sm border-t flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-950/90 border-white/10' : 'bg-white/95 border-slate-100'
              }`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {displayName}
                    </h3>
                  </div>
                  <p className={`text-xs mt-0.5 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {displayDesc}
                  </p>
                </div>

                {/* Center active action button */}
                {isCenter && onSelectTemplate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(tpl.id);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-sm shadow-indigo-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{locale === 'zh' ? '使用此模板' : 'Use Template'}</span>
                    <ChevronRight className="w-3 h-3 stroke-[3]" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Floating Left Arrow Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          aria-label={locale === 'zh' ? '上一个模板' : 'Previous template'}
          className={`absolute left-1 sm:left-3 md:left-6 z-40 w-10 h-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-slate-900/80 hover:bg-slate-800 text-white hover:text-indigo-400 border-white/15'
              : 'bg-white/85 hover:bg-white text-slate-700 hover:text-indigo-600 border-slate-200/60'
          }`}
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Floating Right Arrow Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          aria-label={locale === 'zh' ? '下一个模板' : 'Next template'}
          className={`absolute right-1 sm:right-3 md:right-6 z-40 w-10 h-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-slate-900/80 hover:bg-slate-800 text-white hover:text-indigo-400 border-white/15'
              : 'bg-white/85 hover:bg-white text-slate-700 hover:text-indigo-600 border-slate-200/60'
          }`}
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Pagination Indicator Dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {TEMPLATES.map((tpl, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`${locale === 'zh' ? '切换到' : 'Go to'} ${
                locale === 'zh' ? tpl.nameZh : tpl.name
              }`}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'w-7 bg-indigo-500 shadow-sm shadow-indigo-500/50'
                  : isDark
                  ? 'w-2 bg-slate-700 hover:bg-slate-500'
                  : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
