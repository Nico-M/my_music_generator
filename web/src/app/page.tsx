'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_TEMPLATE_USERNAME } from '@/lib/template';
import HeroVisual from '@/components/HeroVisual';
import { Plus, Music2, Clock, FileText, Upload, LoaderCircle } from 'lucide-react';

interface ProjectSummary {
  id: string;
  title: string;
  durationMs: number;
  createdAt: string;
  lines: { id: string }[];
}

export default function Home() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState(DEFAULT_TEMPLATE_USERNAME);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        body: JSON.stringify({ title: title.trim(), username: username.trim(), audioPath, durationMs }),
      });
      if (!projectRes.ok) throw new Error('Create failed');
      const project = await projectRes.json();

      router.push(`/projects/${project.id}`);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('上传失败，请重试');
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
              Create synced lyric videos
            </p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Project
          </button>
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
                <span style={{ color: 'var(--color-primary)' }}>Lyric videos</span>
                <br />
                <span style={{ color: 'var(--color-text)' }}>in minutes</span>
              </h2>
              <p className="text-sm md:text-base max-w-md mx-auto md:mx-0 mb-6" style={{ color: 'var(--color-text-muted)' }}>
                Upload your audio, auto-sync lyrics, tweak the timeline, and render
                stunning lyric videos — no video editing experience needed.
              </p>
              <button
                onClick={() => {
                  const btn = document.querySelector<HTMLButtonElement>('.btn-primary');
                  if (btn) btn.click();
                }}
                className="btn-primary text-base px-7 py-3"
              >
                <Upload className="w-4 h-4" />
                Start Creating
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
                Upload audio to create a project
              </h2>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="project-title" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      Song title
                    </label>
                    <input id="project-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" placeholder="My Song" required />
                  </div>
                  <div>
                    <label htmlFor="template-username" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      Your name
                    </label>
                    <input id="template-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field w-full" placeholder={DEFAULT_TEMPLATE_USERNAME} />
                  </div>
                </div>
                <div>
                  <label htmlFor="audio-file" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Audio file (MP3, WAV, M4A)
                  </label>
                  <input id="audio-file" type="file" accept="audio/*" className="file-input w-full" required />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={uploading} className="btn-primary min-w-[140px]">
                    {uploading ? (
                      <span className="flex items-center gap-2">
                      <LoaderCircle className="animate-spin h-4 w-4" />
                        Uploading...
                      </span>
                    ) : 'Upload & Create'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Project List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Your Projects
            </h2>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              {projects.length} total
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
          ) : projects.length === 0 ? (
            <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex justify-center mb-3" style={{ color: 'var(--color-text-subtle)' }}>
                <Music2 className="w-8 h-8" />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>No projects yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-text-subtle)' }}>Upload audio to create your first lyric video</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" />
                Create Project
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
                        {Math.round(p.durationMs / 1000)}s · {p.lines?.length ?? 0} lines
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
      </main>
    </div>
  );
}
