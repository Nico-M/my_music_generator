'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DEFAULT_CREATOR_NAME, DEFAULT_TEMPLATE_ID } from '@/lib/template';
import HeroVisual from '@/components/HeroVisual';
import LanguageToggle from '@/components/LanguageToggle';
import { useI18n } from '@/components/LanguageProvider';
import { Plus, Music2, Upload, LoaderCircle } from '@/components/icons/IonIcons';
import TemplateCarousel, { TEMPLATES } from '@/components/TemplateCarousel';
import { SoftAurora, BlurText, ShinyText, SpotlightCard } from '@/components/react-bits';
import { WorkflowSection, BentoFeatures, BottomCta } from '@/components/landing';
import { Agentation } from "agentation";

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
    accentText: 'text-indigo-600',
    accentBg: 'bg-indigo-50 border-indigo-200/70',
    barColor: 'group-hover:bg-indigo-500',
  },
  {
    gradient: 'from-rose-500 via-pink-500 to-amber-500',
    accentText: 'text-rose-600',
    accentBg: 'bg-rose-50 border-rose-200/70',
    barColor: 'group-hover:bg-rose-500',
  },
  {
    gradient: 'from-cyan-500 via-blue-600 to-indigo-700',
    accentText: 'text-sky-600',
    accentBg: 'bg-sky-50 border-sky-200/70',
    barColor: 'group-hover:bg-sky-500',
  },
  {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    accentText: 'text-teal-600',
    accentBg: 'bg-teal-50 border-teal-200/70',
    barColor: 'group-hover:bg-teal-500',
  },
  {
    gradient: 'from-fuchsia-600 via-purple-600 to-cyan-500',
    accentText: 'text-fuchsia-600',
    accentBg: 'bg-fuchsia-50 border-fuchsia-200/70',
    barColor: 'group-hover:bg-fuchsia-500',
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

export default function Home() {
  const { t, locale } = useI18n();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState(DEFAULT_CREATOR_NAME);
  const [singer, setSinger] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProjects(data);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setLoadError('加载项目失败，请刷新页面重试。如果持续失败，请联系开发者。');
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
        <div className="app-bg min-h-screen">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/85 backdrop-blur-md border-b border-[var(--color-border)] shadow-xs'
            : 'bg-white/40 backdrop-blur-xs border-b border-transparent'
        }`}
      >
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25">
              <Music2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-none text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
                SingVid
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-slate-400 font-medium">v2.0 Aurora</span>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#templates" className="hover:text-indigo-600 transition-colors">
              {locale === 'zh' ? '视觉风格' : 'Templates'}
            </a>
            <a href="#workflow" className="hover:text-indigo-600 transition-colors">
              {locale === 'zh' ? '创作流程' : 'Workflow'}
            </a>
            <a href="#features" className="hover:text-indigo-600 transition-colors">
              {locale === 'zh' ? '核心架构' : 'Features'}
            </a>
            <a href="#projects" className="hover:text-indigo-600 transition-colors">
              {locale === 'zh' ? '我的项目' : 'Projects'}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              onClick={() => {
                setShowCreate(true);
                const el = document.getElementById('create-panel');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else window.scrollTo({ top: 320, behavior: 'smooth' });
              }}
              className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 shadow-sm shadow-indigo-500/25"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('app.newProject')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] pt-24 md:pt-28 pb-16 md:pb-24">
        {/* React Bits SoftAurora WebGL background */}
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <SoftAurora
            speed={0.45}
            scale={1.35}
            brightness={0.85}
            color1="#4648d4"
            color2="#0ea5e9"
            lightMode={true}
            enableMouseInteraction={true}
            className="w-full h-full"
          />
        </div>
        {/* Gradient backdrop for legibility */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(250, 248, 255, 0.25) 0%, rgba(250, 248, 255, 0.65) 50%, rgba(250, 248, 255, 0.98) 100%)',
          }}
        />

        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
            {/* Left: copy */}
            <div className="flex-1 text-center md:text-left">
              {/* React Bits ShinyText pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-indigo-100/90 shadow-xs mb-5">
                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <ShinyText
                  text={locale === 'zh' ? '✨ 专为社媒与音乐爱好者打造的动效引擎' : '✨ Kinetic Lyric Video Generator for Creators'}
                  color="#4648d4"
                  shineColor="#ec4899"
                  speed={2.8}
                  className="text-xs font-semibold"
                />
              </div>

              {/* React Bits BlurText animated title */}
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.18] mb-4 text-slate-900"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                <BlurText
                  text={t('app.heroTitle1')}
                  delay={70}
                  animateBy="words"
                  direction="top"
                  className="text-[var(--color-primary)] block font-extrabold"
                />
                <BlurText
                  text={t('app.heroTitle2')}
                  delay={70}
                  animateBy="words"
                  direction="bottom"
                  className="text-slate-900 block font-extrabold mt-1"
                />
              </h2>
              <p className="text-sm md:text-base max-w-md mx-auto md:mx-0 mb-6 text-slate-600 leading-relaxed">
                {t('app.heroDesc')}
              </p>

              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                <button
                  onClick={() => {
                    setShowCreate(true);
                    const el = document.getElementById('create-panel');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    else window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="btn-primary text-base px-7 py-3 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Upload className="w-4 h-4" />
                  {t('app.startCreating')}
                </button>
                <a
                  href="#templates"
                  className="inline-flex items-center justify-center text-sm font-semibold px-5 py-3 rounded-lg border border-slate-300/80 bg-white/85 hover:bg-white text-slate-700 shadow-xs hover:border-slate-400 transition-all"
                >
                  {locale === 'zh' ? '浏览视觉模板 ↓' : 'Explore Templates ↓'}
                </a>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap items-center gap-4 mt-7 text-xs text-slate-500 justify-center md:justify-start">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="font-medium">7 种视觉模板</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="font-medium">9:16 社媒竖屏高清</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="font-medium">音画毫秒级对齐</span>
                </div>
              </div>
            </div>

            {/* Right: HeroVisual inside SpotlightCard */}
            <div className="flex-1 w-full max-w-md md:max-w-none">
              <SpotlightCard
                className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-2xl shadow-indigo-500/10 p-5 md:p-6 transition-transform duration-500 hover:-translate-y-1"
                spotlightColor="rgba(70, 72, 212, 0.16)"
                spotlightSize={420}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-slate-400 font-semibold tracking-wider">
                      LIVE STUDIO PREVIEW
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono text-[10px] font-semibold">
                    1080×1920 60FPS
                  </span>
                </div>
                <HeroVisual />
              </SpotlightCard>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Templates Showcase Section ── */}
      <section id="templates" className="py-20 border-b border-[var(--color-border)] relative overflow-hidden bg-gradient-to-b from-transparent via-white/50 to-transparent">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold mb-3">
              <span>🎨 {locale === 'zh' ? '视觉风格展台' : 'Visual Gallery'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              {locale === 'zh' ? '7 款精心设计的电影级歌词动效风格' : '7 Designer-Crafted Kinetic Motion Styles'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {locale === 'zh'
                ? '融合赛博极光着色器、流体水波、极简便签与经典复古，满足多元音乐情绪'
                : 'From cyber aurora shaders to retro iPod LCD, crafted for every genre.'}
            </p>
          </div>

          <TemplateCarousel
            onSelectTemplate={(tplId) => {
              setSelectedTemplateId(tplId);
              setShowCreate(true);
              const el = document.getElementById('create-panel');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else window.scrollTo({ top: 400, behavior: 'smooth' });
            }}
          />
        </div>
      </section>

      {/* ── Rapid 3-Step Workflow Section ── */}
      <WorkflowSection />

      {/* ── Bento Grid Core Features ── */}
      <BentoFeatures />

      {/* ── Creator Workspace: Projects & Uploader ── */}
      <section id="projects" className="py-16 max-w-5xl mx-auto px-5">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold mb-2">
              <span>📁 {locale === 'zh' ? '创作者工作台' : 'Workspace'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
              {t('app.yourProjects')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-white text-slate-600 border border-slate-200 shadow-xs">
              {t('app.total', { count: projects.length })}
            </span>
            <button
              onClick={() => {
                setShowCreate(!showCreate);
                if (!showCreate) {
                  setTimeout(() => {
                    document.getElementById('create-panel')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }
              }}
              className="btn-primary text-xs sm:text-sm py-2 px-3.5"
            >
              <Plus className="w-4 h-4" />
              {t('app.newProject')}
            </button>
          </div>
        </div>

        {/* Create Panel — visible when toggled */}
        {showCreate && (
          <div
            id="create-panel"
            className="mb-8 rounded-2xl border-0 shadow-lg shadow-indigo-500/5 overflow-hidden transition-all duration-300"
            style={{ background: 'var(--color-surface)', outline: '1px solid var(--color-border)' }}
          >
            {/* Accent top line */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-primary))' }} />
            <div className="p-6 sm:p-8">
              <h2 className="text-base sm:text-lg font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Upload className="w-5 h-5 text-indigo-600" />
                {t('create.title')}
              </h2>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="project-title" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.projectTitle')}
                    </label>
                    <input id="project-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" placeholder={t('create.projectPlaceholder')} required />
                  </div>
                  <div>
                    <label htmlFor="template-brand" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.brand')}
                    </label>
                    <input id="template-brand" type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} className="input-field w-full" placeholder={t('create.brandPlaceholder')} />
                  </div>
                  <div>
                    <label htmlFor="project-singer" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.singer')}
                    </label>
                    <input id="project-singer" type="text" value={singer} onChange={(e) => setSinger(e.target.value)} className="input-field w-full" placeholder={t('create.singerPlaceholder')} required />
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                      {t('create.singerHint')}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="audio-file" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.audioFile')}
                    </label>
                    <input id="audio-file" type="file" accept="audio/*" className="file-input w-full" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="template-select" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.template')}
                    </label>
                    <select
                      id="template-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="input-field w-full"
                    >
                      {TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.nameZh} · {tpl.tagZh})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={uploading} className="btn-primary min-w-[140px]">
                    {uploading ? (
                      <span className="flex items-center gap-2">
                      <LoaderCircle className="animate-spin h-4 w-4" />
                        {t('create.uploading')}
                      </span>
                    ) : t('create.uploadCreate')}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">{t('create.cancel')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Project List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden animate-pulse shadow-sm">
                <div className="aspect-[16/10] w-full bg-slate-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-2 bg-slate-100 rounded w-full mt-2" />
                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--color-error, #ef4444)' }}>{loadError}</p>
            <button onClick={() => { setLoading(true); setLoadError(null); loadProjects(); }} className="btn-secondary text-sm">
              重试
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white shadow-xs">
            <div className="flex justify-center mb-3 text-indigo-500">
              <Music2 className="w-10 h-10" />
            </div>
            <p className="text-base font-semibold text-slate-800">{t('app.noProjects')}</p>
            <p className="text-xs mt-1 mb-5 text-slate-400">{t('app.createFirst')}</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm shadow-md shadow-indigo-500/20">
              <Plus className="w-4 h-4" />
              {t('app.createProject')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => {
              const palette = getCardPalette(p.id);
              return (
                <SpotlightCard
                  key={p.id}
                  className="group cursor-pointer rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-400/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden !p-0"
                  spotlightColor="rgba(70, 72, 212, 0.12)"
                  spotlightSize={340}
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  {/* 顶部流光封面与视听元素 */}
                  <div className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${palette.gradient} flex items-center justify-center p-3`}>
                    {p.coverUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.coverUrl}
                        alt={p.title}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                    )}
                    {/* 声波律动装饰线条 */}
                    <div className="absolute inset-0 opacity-25 mix-blend-overlay flex items-center justify-center gap-1 pointer-events-none px-5">
                      {[35, 60, 80, 45, 95, 60, 85, 100, 70, 90, 50, 95, 65, 40, 85, 55, 30].map((h, i) => (
                        <span
                          key={i}
                          className="flex-1 max-w-[4px] rounded-full bg-white transition-all duration-500 group-hover:scale-y-115"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>

                    {/* 黑胶同心圆质感装饰 */}
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full border-4 border-white/10 bg-black/10 backdrop-blur-[1px] flex items-center justify-center shadow-inner group-hover:rotate-45 transition-transform duration-700 ease-out pointer-events-none">
                      <div className="w-22 h-22 rounded-full border border-white/15 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-white/40" />
                        </div>
                      </div>
                    </div>

                    {/* 右上角：9:16 规格 */}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/25 backdrop-blur-md border border-white/25 text-[10px] font-semibold text-white tracking-wide shadow-sm">
                      9:16
                    </div>

                    {/* 右下角：时长微胶囊 */}
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md text-white text-[11px] font-mono tracking-wider flex items-center gap-1.5 shadow-sm">
                      <Music2 className="w-3 h-3 text-white/90" />
                      <span>{Math.round(p.durationMs / 1000)}s</span>
                    </div>

                    {/* Hover 悬停播放诱导遮罩 */}
                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-white/95 text-indigo-600 shadow-xl flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 卡片下半部：内容与交互元信息 */}
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {p.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span className="truncate">{p.singer || t('create.singerPlaceholder')}</span>
                      </p>

                      {/* 迷你声波可视化条 */}
                      <div className="flex items-center gap-1 h-3 px-0.5 my-2">
                        {[35, 65, 25, 80, 50, 90, 60, 45, 85, 55, 30, 75, 95, 50, 70, 40, 80, 55].map((val, idx) => (
                          <div
                            key={idx}
                            className={`flex-1 bg-slate-200/90 ${palette.barColor} rounded-full transition-all duration-300`}
                            style={{
                              height: `${Math.max(20, (val * ((idx % 3) + 1)) % 100)}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 底部元数据与操作指引 */}
                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${palette.accentBg} ${palette.accentText}`}>
                          {p.lines?.length ?? 0} 行歌词
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 font-semibold text-slate-500 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-xs">
                        制作
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bottom CTA ── */}
      <BottomCta
        onStartCreate={() => {
          setShowCreate(true);
          const el = document.getElementById('create-panel');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          else window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
      />
    </div>
    {process.env.NODE_ENV === "development" && (
      <Agentation
        endpoint={process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || "http://192.168.1.3:4747"}
        onSessionCreated={(sessionId) => {
          console.log("Session started:", sessionId);
        }}
      />
    )}
    </>

  );
}
