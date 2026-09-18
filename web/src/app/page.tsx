'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_CREATOR_NAME, DEFAULT_TEMPLATE_ID } from '@/lib/template';
import HeroVisual from '@/components/HeroVisual';
import LanguageToggle from '@/components/LanguageToggle';
import { useI18n } from '@/components/LanguageProvider';
import {
  Plus,
  Music2,
  Upload,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from '@/components/icons/IonIcons';
import { TEMPLATES } from '@/components/TemplateCarousel';
import {
  GhostFibers,
  BlurText,
  ShinyText,
  SpotlightCard,
  DepthCarousel,
  type DepthCarouselItemObject,
  Shuffle,
  GooeyNav,
} from '@/components/react-bits';
import { BentoFeatures } from '@/components/landing';
import { Agentation } from 'agentation';

interface ProjectSummary {
  id: string;
  title: string;
  singer?: string | null;
  coverUrl?: string | null;
  durationMs: number;
  createdAt: string;
  lines: { id: string }[];
}

const CARD_PALETTES = [
  {
    gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    accentText: 'text-indigo-400',
    accentBg: 'bg-indigo-950/70 border-indigo-500/30',
    barColor: 'group-hover:bg-indigo-400',
  },
  {
    gradient: 'from-rose-500 via-pink-600 to-amber-500',
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-950/70 border-rose-500/30',
    barColor: 'group-hover:bg-rose-400',
  },
  {
    gradient: 'from-cyan-500 via-blue-600 to-indigo-700',
    accentText: 'text-sky-400',
    accentBg: 'bg-sky-950/70 border-sky-500/30',
    barColor: 'group-hover:bg-sky-400',
  },
  {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-950/70 border-emerald-500/30',
    barColor: 'group-hover:bg-emerald-400',
  },
  {
    gradient: 'from-fuchsia-600 via-purple-600 to-cyan-500',
    accentText: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-950/70 border-fuchsia-500/30',
    barColor: 'group-hover:bg-fuchsia-400',
  },
];

function getCardPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return CARD_PALETTES[Math.abs(hash) % CARD_PALETTES.length];
}

const SCREENS = [
  { id: 'hero', nameZh: '演播室', nameEn: 'Studio', number: '01' },
  { id: 'templates', nameZh: '视觉风格', nameEn: 'Gallery', number: '02' },
  { id: 'features', nameZh: '核心架构', nameEn: 'Engine', number: '03' },
  { id: 'workspace', nameZh: '工作台', nameEn: 'Workspace', number: '04' },
];

export default function Home() {
  const { t, locale } = useI18n();
  const isZh = locale === 'zh';
  const router = useRouter();

  // Full page deck state (0..3) initialized directly from URL
  const [activeSlide, setActiveSlide] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const slideParam = urlParams.get('slide');
      if (slideParam !== null) {
        const idx = parseInt(slideParam, 10);
        if (!isNaN(idx) && idx >= 0 && idx <= 3) return idx;
      }
      const hash = window.location.hash.replace('#', '');
      const foundIdx = SCREENS.findIndex((s) => s.id === hash);
      if (foundIdx !== -1) return foundIdx;
    }
    return 0;
  });
  const isTransitioningRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  // Sync hash and query param on mount and hashchange
  useEffect(() => {
    const handleHash = () => {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const slideParam = urlParams.get('slide');
      const createParam = urlParams.get('create');
      if (createParam === '1' || createParam === 'true') {
        setShowCreate(true);
      }
      if (slideParam !== null) {
        const idx = parseInt(slideParam, 10);
        if (!isNaN(idx) && idx >= 0 && idx <= 3) {
          setActiveSlide(idx);
          return;
        }
      }

      const hash = window.location.hash.replace('#', '');
      const foundIdx = SCREENS.findIndex((s) => s.id === hash);
      if (foundIdx !== -1) {
        setActiveSlide(foundIdx);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update hash when activeSlide changes without loop
  useEffect(() => {
    const screen = SCREENS[activeSlide];
    if (screen && typeof window !== 'undefined') {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash !== screen.id) {
        window.history.replaceState(null, '', `#${screen.id}`);
      }
    }
  }, [activeSlide]);

  // Projects & Create states
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState(DEFAULT_CREATOR_NAME);
  const [singer, setSinger] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);

  const depthCarouselItems: DepthCarouselItemObject[] = useMemo(
    () =>
      TEMPLATES.map((tpl) => ({
        id: tpl.id,
        image: tpl.image,
        label: isZh ? tpl.nameZh : tpl.name,
        tag: isZh ? tpl.tagZh : tpl.tag,
        description: isZh ? tpl.descriptionZh : tpl.description,
        alt: isZh ? tpl.nameZh : tpl.name,
      })),
    [isZh]
  );

  useEffect(() => {
    loadProjects();
  }, []);

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index > 3) return;
    setActiveSlide(index);
    isTransitioningRef.current = true;
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 700);
  }, []);

  const nextSlide = useCallback(() => {
    if (isTransitioningRef.current) return;
    setActiveSlide((curr) => {
      if (curr < 3) {
        isTransitioningRef.current = true;
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 700);
        return curr + 1;
      }
      return curr;
    });
  }, []);

  const prevSlide = useCallback(() => {
    if (isTransitioningRef.current) return;
    setActiveSlide((curr) => {
      if (curr > 0) {
        isTransitioningRef.current = true;
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 700);
        return curr - 1;
      }
      return curr;
    });
  }, []);

  // Wheel, keyboard, and touch listeners
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      const scrollable = target?.closest('[data-allow-scroll="true"]') as HTMLElement | null;

      if (scrollable) {
        const isAtTop = scrollable.scrollTop <= 2;
        const isAtBottom =
          scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 2;

        if (e.deltaY > 0 && !isAtBottom) return;
        if (e.deltaY < 0 && !isAtTop) return;
      }

      e.preventDefault();

      if (isTransitioningRef.current) return;
      if (Math.abs(e.deltaY) < 22) return;

      if (e.deltaY > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSlide(3);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const diff = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      if (Math.abs(diff) > 45) {
        if (diff < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [nextSlide, prevSlide, goToSlide]);

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProjects(data);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setLoadError(
        isZh ? '加载项目失败，请刷新页面重试。' : 'Failed to load projects. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = document.querySelector<HTMLInputElement>('#audio-file');
    const file = fileInput?.files?.[0];
    if (!file || !title.trim() || !singer.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const uploadRes = await fetch('/api/uploads/audio', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { audioPath, durationMs } = await uploadRes.json();

      const projectRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          creatorName: creatorName.trim(),
          singer: singer.trim(),
          templateId: selectedTemplateId || DEFAULT_TEMPLATE_ID,
          templateConfig: {},
          audioPath,
          durationMs,
        }),
      });
      if (!projectRes.ok) throw new Error('Create failed');
      const project = await projectRes.json();

      router.push(`/projects/${project.id}`);
    } catch (err) {
      console.error('Upload failed:', err);
      alert(t('create.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* ── Persistent WebGL Ghost Fibers Canvas ── */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#08070d]">
        <GhostFibers
          lineColor="#16122d"
          glowColor="#6366f1"
          twist={1.25}
          layers={4}
          speed={0.4}
          brightness={0.85}
          className="w-full h-full"
        />
        {/* Dark Studio radial ambient vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(14, 12, 32, 0.25) 0%, rgba(8, 7, 13, 0.7) 65%, #08070d 100%)',
          }}
        />
      </div>

      {/* ── Fixed Studio Glass Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#08070d]/60 backdrop-blur-xl border-b border-white/10 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => goToSlide(0)}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Music2 className="w-4 h-4" />
            </div>
            <div>
              <h1
                className="text-base sm:text-lg font-bold tracking-tight leading-none text-white flex items-center gap-2"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                SingVid
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  STUDIO
                </span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-slate-400 font-medium">v2.0 Ghost</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs with ReactBits GooeyNav */}
          <div className="hidden md:block">
            <GooeyNav
              items={SCREENS.map((s) => ({
                id: s.id,
                number: s.number,
                label: isZh ? s.nameZh : s.nameEn,
              }))}
              activeIndex={activeSlide}
              onSelect={(idx) => goToSlide(idx)}
              colors={['#6366f1', '#818cf8', '#a855f7', '#c084fc', '#38bdf8']}
              particleCount={14}
            />
          </div>

          {/* Right Action: Language + Launch Button */}
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              onClick={() => {
                goToSlide(3);
                setShowCreate(true);
              }}
              className="btn-primary text-xs sm:text-sm py-1.5 px-3 sm:px-4 shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t('app.newProject')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Right-Side Magnetic Vertical Deck Pagination ── */}
      <aside
        className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col items-center gap-3 select-none"
        aria-label="Deck Pagination"
      >
        {/* Up arrow */}
        <button
          onClick={prevSlide}
          disabled={activeSlide === 0}
          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
            activeSlide === 0
              ? 'border-white/5 text-white/20 cursor-not-allowed'
              : 'border-white/15 bg-white/5 text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 cursor-pointer'
          }`}
          aria-label="Previous screen"
        >
          <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        {/* Vertical Screen Dots */}
        <div className="flex flex-col items-center gap-2 py-2">
          {SCREENS.map((s, idx) => {
            const isActive = activeSlide === idx;
            return (
              <button
                key={s.id}
                onClick={() => goToSlide(idx)}
                className="group relative flex items-center justify-center p-1.5 cursor-pointer"
                aria-label={`Jump to ${s.nameEn}`}
              >
                <div
                  className={`rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-2 h-6 bg-indigo-500 shadow-md shadow-indigo-500/70'
                      : 'w-2 h-2 bg-white/25 hover:bg-white/60'
                  }`}
                />
                {/* Floating tooltip on hover */}
                <div className="absolute right-7 px-2 py-1 rounded bg-slate-900 border border-white/15 text-[10px] font-mono text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                  {s.number} · {isZh ? s.nameZh : s.nameEn}
                </div>
              </button>
            );
          })}
        </div>

        {/* Down arrow */}
        <button
          onClick={nextSlide}
          disabled={activeSlide === 3}
          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
            activeSlide === 3
              ? 'border-white/5 text-white/20 cursor-not-allowed'
              : 'border-white/15 bg-white/5 text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 cursor-pointer'
          }`}
          aria-label="Next screen"
        >
          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        {/* Slide Counter */}
        <span className="text-[10px] font-mono text-slate-500 mt-1">
          0{activeSlide + 1}
        </span>
      </aside>

      {/* ── 4-Screen Single-Viewport Deck Container ── */}
      <div className="h-screen w-screen overflow-hidden relative">
        <main
          className="w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translate3d(0, -${activeSlide * 100}%, 0)`,
          }}
        >
          {/* ════════ SCREEN 0: THE STUDIO HERO ════════ */}
          <section
            id="hero"
            className="h-screen w-full flex items-center justify-center px-6 pt-16 pb-8 relative"
          >
            <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Headline & Action */}
              <div className="lg:col-span-7 text-center lg:text-left">
                {/* ShinyText pill badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-indigo-500/30 shadow-lg shadow-indigo-950/40 mb-5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <ShinyText
                    text={
                      isZh
                        ? '✨ 专为社媒与音乐爱好者打造的动效引擎'
                        : '✨ Kinetic Lyric Video Engine for Creators'
                    }
                    color="#818cf8"
                    shineColor="#f472b6"
                    speed={2.6}
                    className="text-xs font-semibold"
                  />
                </div>

                {/* Hero Headline */}
                <h2
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.2] mb-4"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  <div className="block">
                    <Shuffle
                      text={t('app.heroTitle1')}
                      tag="span"
                      className="text-indigo-400 block font-extrabold drop-shadow-[0_0_24px_rgba(129,140,248,0.4)]"
                      colorFrom="#f472b6"
                      colorTo="#818cf8"
                      shuffleDirection="right"
                      duration={0.35}
                      stagger={0.03}
                      triggerOnHover={true}
                    />
                  </div>
                  <div className="block mt-1">
                    <Shuffle
                      text={t('app.heroTitle2')}
                      tag="span"
                      className="text-white block font-extrabold drop-shadow-[0_0_16px_rgba(255,255,255,0.2)]"
                      colorFrom="#94a3b8"
                      colorTo="#ffffff"
                      shuffleDirection="right"
                      duration={0.35}
                      stagger={0.03}
                      triggerOnHover={true}
                    />
                  </div>
                </h2>

                <p className="text-sm sm:text-base max-w-lg mx-auto lg:mx-0 mb-6 text-slate-300 leading-relaxed">
                  {t('app.heroDesc')}
                </p>

                {/* CTA buttons */}
                <div className="flex flex-wrap items-center gap-3.5 justify-center lg:justify-start">
                  <button
                    onClick={() => {
                      goToSlide(3);
                      setShowCreate(true);
                    }}
                    className="btn-primary text-sm sm:text-base px-6 py-2.5 sm:py-3 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('app.startCreating')}</span>
                  </button>

                  <button
                    onClick={() => goToSlide(1)}
                    className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold px-5 py-2.5 sm:py-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md shadow-xs hover:border-white/30 transition-all cursor-pointer"
                  >
                    <span>{isZh ? '探索 7 种风格' : 'Explore Templates'}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tech chips */}
                <div className="flex flex-wrap items-center gap-4 mt-7 text-xs text-slate-400 justify-center lg:justify-start">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="font-medium text-slate-300">7 款着色器风格</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-medium text-slate-300">9:16 社媒竖屏高清</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    <span className="font-medium text-slate-300">确定性 60FPS 逐帧渲染</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dark Studio Console Hero Visual */}
              <div className="lg:col-span-5 w-full max-w-md mx-auto lg:max-w-none">
                <SpotlightCard
                  className="rounded-3xl bg-slate-950/70 backdrop-blur-xl border border-white/15 shadow-2xl shadow-indigo-950/60 p-5 sm:p-6 transition-transform duration-500 hover:-translate-y-1"
                  spotlightColor="rgba(99, 102, 241, 0.22)"
                  spotlightSize={420}
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      <span className="ml-2 font-mono text-[11px] text-slate-400 font-semibold tracking-wider">
                        LIVE STUDIO PREVIEW
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-semibold">
                      1080×1920 60FPS
                    </span>
                  </div>
                  <div className="text-white/40">
                    <HeroVisual />
                  </div>
                </SpotlightCard>
              </div>
            </div>

            {/* Bottom scroll down hint */}
            <div
              onClick={() => goToSlide(1)}
              className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer select-none transition-colors"
            >
              <span>{isZh ? '向下翻页探索' : 'SCROLL TO EXPLORE'}</span>
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </div>
          </section>

          {/* ════════ SCREEN 1: 3D VISUAL GALLERY ════════ */}
          <section
            id="templates"
            className="h-screen w-full flex flex-col items-center justify-center px-6 pt-16 pb-6 relative"
          >
            <div className="max-w-6xl w-full mx-auto">
              <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
                  <span>🎨 {isZh ? '视觉风格展台 · VISUAL GALLERY' : 'Visual Gallery'}</span>
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1.5"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {isZh
                    ? '7 款精心设计的电影级歌词动效风格'
                    : '7 Designer-Crafted Kinetic Motion Styles'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  {isZh
                    ? '融合赛博极光着色器、流体水波、极简便签与经典复古，满足多元音乐情绪'
                    : 'From cyber aurora shaders to retro iPod LCD, crafted for every genre.'}
                </p>
              </div>

              {/* React Bits Depth Carousel 3D Showcase */}
              <div className="w-full h-[460px] relative">
                <DepthCarousel
                  items={depthCarouselItems}
                  cardWidth={300}
                  cardHeight={410}
                  radius={22}
                  depth={220}
                  spread={100}
                  tilt={22}
                  visibleCards={3}
                  falloff={0.22}
                  blur={6}
                  tint="#08070d"
                  showControls={true}
                  showIndicators={true}
                  enableWheel={false}
                  selectButtonText={isZh ? '使用此风格' : 'Use Style'}
                  onSelectTemplate={(tplId) => {
                    setSelectedTemplateId(tplId);
                    setShowCreate(true);
                    goToSlide(3);
                  }}
                />
              </div>
            </div>
          </section>

          {/* ════════ SCREEN 2: STUDIO ENGINE MATRIX ════════ */}
          <section
            id="features"
            className="h-screen w-full flex flex-col items-center justify-center px-6 pt-16 pb-6 relative"
          >
            <BentoFeatures theme="dark" />
          </section>

          {/* ════════ SCREEN 3: CREATOR WORKSPACE & LAUNCH ════════ */}
          <section
            id="workspace"
            className="h-screen w-full flex flex-col justify-between px-6 pt-20 pb-4 max-w-6xl mx-auto relative"
          >
            {/* Workspace Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold mb-1">
                  <span>📁 {isZh ? '创作者工作台 · WORKSPACE' : 'Workspace'}</span>
                </div>
                <h2
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {t('app.yourProjects')}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-900/80 text-slate-300 border border-white/10 shadow-xs">
                  {t('app.total', { count: projects.length })}
                </span>
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary text-xs sm:text-sm py-1.5 px-3.5 shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('app.newProject')}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Project Cards Viewport */}
            <div
              data-allow-scroll="true"
              className="flex-1 overflow-y-auto max-h-[calc(100vh-175px)] pr-2 pb-4 select-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 overflow-hidden animate-pulse shadow-sm"
                    >
                      <div className="aspect-[16/10] w-full bg-slate-900" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-slate-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                        <div className="h-2 bg-slate-800/40 rounded w-full mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-rose-500/30 bg-slate-950/40 p-6">
                  <p className="text-sm mb-3 text-rose-400">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      setLoadError(null);
                      loadProjects();
                    }}
                    className="btn-secondary text-sm"
                  >
                    {isZh ? '重试' : 'Retry'}
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-14 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 shadow-xl flex flex-col items-center justify-center p-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
                    <Music2 className="w-7 h-7" />
                  </div>
                  <p className="text-base font-semibold text-white">{t('app.noProjects')}</p>
                  <p className="text-xs mt-1 mb-5 text-slate-400">{t('app.createFirst')}</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary text-sm shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('app.createProject')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((p) => {
                    const palette = getCardPalette(p.id);
                    return (
                      <SpotlightCard
                        key={p.id}
                        className="group cursor-pointer rounded-2xl bg-slate-950/70 border border-white/10 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-400/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden !p-0"
                        spotlightColor="rgba(99, 102, 241, 0.18)"
                        spotlightSize={340}
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        {/* Stream cover & audio visualization */}
                        <div
                          className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${palette.gradient} flex items-center justify-center p-3`}
                        >
                          {p.coverUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.coverUrl}
                              alt={p.title}
                              className="absolute inset-0 w-full h-full object-cover object-center"
                            />
                          )}
                          {/* Equalizer lines */}
                          <div className="absolute inset-0 opacity-25 mix-blend-overlay flex items-center justify-center gap-1 pointer-events-none px-5">
                            {[
                              35, 60, 80, 45, 95, 60, 85, 100, 70, 90, 50, 95, 65, 40, 85, 55, 30,
                            ].map((h, i) => (
                              <span
                                key={i}
                                className="flex-1 max-w-[4px] rounded-full bg-white transition-all duration-500 group-hover:scale-y-115"
                                style={{ height: `${h}%` }}
                              />
                            ))}
                          </div>

                          {/* Vinyl concentric groove circle */}
                          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full border-4 border-white/10 bg-black/20 backdrop-blur-[1px] flex items-center justify-center shadow-inner group-hover:rotate-45 transition-transform duration-700 ease-out pointer-events-none">
                            <div className="w-22 h-22 rounded-full border border-white/15 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-white/40" />
                              </div>
                            </div>
                          </div>

                          {/* Top right: 9:16 badge */}
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/25 text-[10px] font-semibold text-white tracking-wide shadow-sm">
                            9:16
                          </div>

                          {/* Bottom right: duration pill */}
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-mono tracking-wider flex items-center gap-1.5 shadow-sm">
                            <Music2 className="w-3 h-3 text-white/90" />
                            <span>{Math.round(p.durationMs / 1000)}s</span>
                          </div>

                          {/* Hover Play Preview mask */}
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                            <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-2xl flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300">
                              <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Card bottom: metadata */}
                        <div className="p-4 flex flex-col flex-1 justify-between bg-slate-950/80">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                                {p.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              <span className="truncate">
                                {p.singer || t('create.singerPlaceholder')}
                              </span>
                            </p>

                            {/* Soundwave bars */}
                            <div className="flex items-center gap-1 h-2.5 px-0.5 my-1.5">
                              {[
                                35, 65, 25, 80, 50, 90, 60, 45, 85, 55, 30, 75, 95, 50, 70, 40,
                                80, 55,
                              ].map((val, idx) => (
                                <div
                                  key={idx}
                                  className={`flex-1 bg-white/15 ${palette.barColor} rounded-full transition-all duration-300`}
                                  style={{
                                    height: `${Math.max(20, (val * ((idx % 3) + 1)) % 100)}%`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${palette.accentBg} ${palette.accentText}`}
                              >
                                {p.lines?.length ?? 0} {isZh ? '行歌词' : 'lines'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {new Date(p.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 font-semibold text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all text-xs">
                              {isZh ? '制作' : 'Edit'}
                              <ChevronRight className="w-3 h-3 stroke-[3]" />
                            </span>
                          </div>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Micro Studio Footer */}
            <footer className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>SingVid Studio · WebGL Ghost Fibers Canvas</span>
              </div>
              <span className="hidden sm:inline">60FPS Deterministic Remotion Engine</span>
            </footer>

          </section>
        </main>
      </div>

      {/* ── Studio Glass Creation Drawer / Modal (Fixed at root viewport) ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-xl rounded-2xl border border-white/20 bg-[#0c0a17]/95 backdrop-blur-2xl shadow-2xl shadow-indigo-950 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-cyan-400" />
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-400" />
                  <span>{t('create.title')}</span>
                </h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="project-title"
                      className="block text-xs font-medium text-white mb-1.5"
                    >
                      {t('create.projectTitle')}
                    </label>
                    <input
                      id="project-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                      placeholder={t('create.projectPlaceholder')}
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="template-brand"
                      className="block text-xs font-medium text-white mb-1.5"
                    >
                      {t('create.brand')}
                    </label>
                    <input
                      id="template-brand"
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                      placeholder={t('create.brandPlaceholder')}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="project-singer"
                      className="block text-xs font-medium text-white mb-1.5"
                    >
                      {t('create.singer')}
                    </label>
                    <input
                      id="project-singer"
                      type="text"
                      value={singer}
                      onChange={(e) => setSinger(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                      placeholder={t('create.singerPlaceholder')}
                      required
                    />
                    <p className="mt-1 text-[11px] text-white/40">
                      {t('create.singerHint')}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="audio-file"
                      className="block text-xs font-medium text-white mb-1.5"
                    >
                      {t('create.audioFile')}
                    </label>
                    <input
                      id="audio-file"
                      type="file"
                      accept="audio/*"
                      className="w-full px-3 py-2 rounded-xl bg-[#1A1A1A] border border-white/10 text-white/80 text-xs file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-white/90 active:file:scale-[0.98] cursor-pointer"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="template-select"
                      className="block text-xs font-medium text-white mb-1.5"
                    >
                      {t('create.template')}
                    </label>
                    <select
                      id="template-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-[#1A1A1A] border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer transition-all"
                    >
                      {TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id} className="bg-[#1A1A1A] text-white">
                          {tpl.name} ({isZh ? tpl.nameZh : tpl.name} ·{' '}
                          {isZh ? tpl.tagZh : tpl.tag})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="h-11 px-5 rounded-xl border border-white/10 bg-black/60 text-white hover:bg-white/5 active:scale-[0.98] text-sm transition-all cursor-pointer"
                  >
                    {t('create.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="h-11 min-w-[140px] px-6 rounded-xl bg-white text-black font-semibold hover:bg-white/90 active:scale-[0.98] text-sm shadow-md shadow-white/5 transition-all cursor-pointer"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoaderCircle className="animate-spin h-4 w-4 text-black" />
                        <span>{t('create.uploading')}</span>
                      </span>
                    ) : (
                      t('create.uploadCreate')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && (
        <Agentation
          endpoint={process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || 'http://192.168.1.3:4747'}
          onSessionCreated={(sessionId) => {
            console.log('Session started:', sessionId);
          }}
        />
      )}
    </>
  );
}
