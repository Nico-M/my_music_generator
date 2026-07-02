'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DEFAULT_CREATOR_NAME, DEFAULT_TEMPLATE_ID } from '@/lib/template';
import HeroVisual from '@/components/HeroVisual';
import LanguageToggle from '@/components/LanguageToggle';
import { useI18n } from '@/components/LanguageProvider';
import { Plus, Music2, Upload, LoaderCircle } from '@/components/icons/IonIcons';

interface ProjectSummary {
  id: string;
  title: string;
  singer?: string | null;
  durationMs: number;
  createdAt: string;
  lines: { id: string }[];
}

export default function Home() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState(DEFAULT_CREATOR_NAME);
  const [singer, setSinger] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProjects();
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
    if (!file || !title.trim()) return;

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
          singer: singer.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          templateId: DEFAULT_TEMPLATE_ID,
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
    <div className="app-bg min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
              <Music2 className="w-5 h-5" />
              SingVid
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              {t('app.tagline')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
              <Plus className="w-4 h-4" />
              {t('app.newProject')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #22c55e 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, #06b6d4 0%, transparent 50%)'
        }} />

        <div className="max-w-5xl mx-auto px-5 py-16 md:py-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
            {/* Left: copy */}
            <div className="flex-1 text-center md:text-left">
              <h2
                className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] mb-4"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                <span style={{ color: 'var(--color-primary)' }}>{t('app.heroTitle1')}</span>
                <br />
                <span style={{ color: 'var(--color-text)' }}>{t('app.heroTitle2')}</span>
              </h2>
              <p className="text-sm md:text-base max-w-md mx-auto md:mx-0 mb-6" style={{ color: 'var(--color-text-muted)' }}>
                {t('app.heroDesc')}
              </p>
              <button
                onClick={() => {
                  const btn = document.querySelector<HTMLButtonElement>('.btn-primary');
                  if (btn) btn.click();
                }}
                className="btn-primary text-base px-7 py-3"
              >
                <Upload className="w-4 h-4" />
                {t('app.startCreating')}
              </button>
            </div>

            {/* Right: HeroVisual */}
            <div className="flex-1 w-full max-w-md md:max-w-none opacity-90 md:opacity-100">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Create Panel — visible when toggled */}
        {showCreate && (
          <div className="mb-8 rounded-xl border-0" style={{ background: 'var(--color-surface)', outline: '1px solid var(--color-border)' }}>
            {/* Accent top line */}
            <div className="h-0.5 rounded-t-xl" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-primary))' }} />
            <div className="p-6">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Upload className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
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
                    <input id="project-singer" type="text" value={singer} onChange={(e) => setSinger(e.target.value)} className="input-field w-full" placeholder={t('create.singerPlaceholder')} />
                  </div>
                  <div>
                    <label htmlFor="audio-file" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t('create.audioFile')}
                    </label>
                    <input id="audio-file" type="file" accept="audio/*" className="file-input w-full" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="manual-lyrics" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    {t('create.manualLyrics')}
                  </label>
                  <textarea
                    id="manual-lyrics"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="input-field w-full"
                    rows={4}
                    placeholder={t('create.manualLyricsPlaceholder')}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="flex gap-3 pt-1">
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
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('app.yourProjects')}
            </h2>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              {t('app.total', { count: projects.length })}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="card !p-4 animate-pulse">
                  <div className="h-4 rounded w-1/3 mb-2" style={{ background: 'var(--color-surface-2)' }} />
                  <div className="h-3 rounded w-1/4" style={{ background: 'var(--color-surface-2)' }} />
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
            <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex justify-center mb-3" style={{ color: 'var(--color-text-subtle)' }}>
                <Music2 className="w-8 h-8" />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>{t('app.noProjects')}</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-text-subtle)' }}>{t('app.createFirst')}</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" />
                {t('app.createProject')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="card !p-4 flex items-center justify-between group"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'var(--color-surface-2)', color: 'var(--color-primary)' }}>
                      <Music2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{p.title}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                        {p.singer ? `${p.singer} · ` : ''}{Math.round(p.durationMs / 1000)}s · {p.lines?.length ?? 0} {t('common.lines')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] hidden sm:block" style={{ color: 'var(--color-text-subtle)' }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <svg className="w-4 h-4" style={{ color: 'var(--color-text-subtle)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('app.templates')}
            </h2>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              2
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="relative aspect-video w-full">
                <Image
                  src="/assets/templates/output_example.png"
                  alt={t('app.notesTemplateAlt')}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('app.notesTemplate')}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                  output_example
                </p>
              </div>
            </article>

            <article className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="relative aspect-video w-full">
                <Image
                  src="/assets/templates/output_example_2.png"
                  alt={t('app.voiceMemoTemplateAlt')}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('app.voiceMemoTemplate')}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                  output_example_2
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
