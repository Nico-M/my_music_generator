'use client';

import { useEffect, useState, useRef } from 'react';
import { useEditorStore, type Project } from '@/lib/store';
import { useJobs } from '@/lib/use-jobs';
import LyricDraftEditor from '@/components/LyricDraftEditor';
import TimelineList from '@/components/TimelineList';
import AudioPlayer from '@/components/AudioPlayer';
import { PreviewPanel } from '@/components/PreviewPanel';
import JobStatusBar from '@/components/JobStatusBar';
import { getTemplateUsername } from '@/lib/template';
import { ArrowLeft, Clapperboard, FileText, Timer, LoaderCircle, CheckCircle2 } from 'lucide-react';

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'timeline'>('lyrics');

  const { project, setProject, lines } = useEditorStore();
  const { activeJobs, finishedJobs, track, dismiss } = useJobs();
  const reloadedJobIds = useRef<Set<string>>(new Set());

  const [syncing, setSyncing] = useState<'assisted' | 'weighted' | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Project not found');
        return res.json() as Promise<Project>;
      })
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id, setProject]);

  const reloadProject = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const doneJob = finishedJobs.find(
      j => j.status === 'done' && !reloadedJobIds.current.has(j.jobId)
    );
    if (doneJob) {
      reloadedJobIds.current.add(doneJob.jobId);
      reloadProject();
    }
  }, [finishedJobs]);

  const isRenderActive = activeJobs.some(j => j.type === 'render');
  const hasLines = lines.length > 0;

  if (loading) {
    return (
      <div className="editor-shell flex items-center justify-center min-h-screen">
        <LoaderCircle className="animate-spin h-8 w-8" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="editor-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div style={{ color: 'var(--color-danger)' }} className="mb-2">✕</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{error || 'Project not found'}</div>
        </div>
      </div>
    );
  }

  const audioUrl = project.audioPath
    ? project.audioPath.replace('/data/uploads/', '/api/files/')
    : undefined;

  return (
    <div className="editor-shell flex flex-col lg:flex-row h-screen">
      {/* ── Left: Workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Compressed Header (~64px) ── */}
        <header className="flex items-center justify-between px-4 py-3 shrink-0" style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          minHeight: 56,
        }}>
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="hover:opacity-80 transition-opacity shrink-0" style={{ color: 'var(--color-text-subtle)' }}>
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{project.title}</h1>
              <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                {Math.round(project.durationMs / 1000)}s · {project.lines.length} lines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Status badge */}
            {hasLines ? (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-primary)' }}>
                <CheckCircle2 className="w-3 h-3" />
                Ready
              </span>
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>No lyrics</span>
            )}

            {/* Render button — visually strongest, separate */}
            <button
              onClick={async () => {
                if (!id) return;
                await trackAsync(id, 'render', 'render', track);
              }}
              disabled={isRenderActive}
              className="btn-primary !py-1.5 !px-3 !text-xs"
              title="Render 1080x1920 MP4"
            >
              {isRenderActive ? (
                <span className="flex items-center gap-1">
                  <LoaderCircle className="animate-spin h-3 w-3" />
                  Rendering...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clapperboard className="w-3.5 h-3.5" />
                  Render MP4
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ── Scrollable Workspace Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4">

            {/* ── Job Status ── */}
            <JobStatusBar activeJobs={activeJobs} finishedJobs={finishedJobs} onDismiss={dismiss} />

            {/* Status message */}
            {statusMsg && (
              <div className="px-3 py-2 rounded-lg flex items-center gap-2 text-sm mb-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <span>{statusMsg}</span>
                <button onClick={() => setStatusMsg(null)} className="ml-auto shrink-0" style={{ color: 'var(--color-text-subtle)' }}>✕</button>
              </div>
            )}

            {/* ── Unified Workspace Panel ── */}
            <div className="workspace-panel overflow-hidden">

              {/* Audio row */}
              <div className="workspace-section">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="section-label">Audio</p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Space</span>
                </div>
                {audioUrl ? (
                  <AudioPlayer audioUrl={audioUrl} />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>No audio uploaded</p>
                )}
              </div>

              <div className="workspace-divider" />

              {/* Generate toolbar */}
              <div className="workspace-section">
                <div className="flex items-center gap-4">
                  <span className="section-label w-20 shrink-0">Generate</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        if (!id) return;
                        if (lines.length > 0 && !confirm('Transcribing will replace all lyrics and timeline. Continue?')) return;
                        await trackAsync(id, 'lyrics/transcribe', 'transcribe', track);
                      }}
                      disabled={activeJobs.some(j => j.type === 'transcribe')}
                      className="btn-ghost text-xs"
                      title="Speech-to-text: extract lyrics from audio using faster-whisper"
                    >
                      Transcribe
                    </button>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        setSyncing('assisted');
                        try {
                          const res = await fetch(`/api/projects/${id}/timeline/assisted`, { method: 'POST' });
                          if (!res.ok) { const err = await res.json(); alert(err.error || 'Assisted failed'); return; }
                          const data = await res.json();
                          await reloadProject();
                          if (data.summary) {
                            setStatusMsg(`Assisted: ${data.summary.matchedCount}/${data.summary.totalCount} matched, ${data.summary.fallbackCount} filled`);
                          }
                        } catch { alert('Assisted request failed'); }
                        finally { setSyncing(null); }
                      }}
                      disabled={syncing === 'assisted'}
                      className="btn-ghost text-xs"
                      title="JS assisted alignment: character-match ASR timestamps"
                    >
                      {syncing === 'assisted' ? '...' : 'Assisted'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        await trackAsync(id, 'timeline/align', 'align', track);
                      }}
                      disabled={activeJobs.some(j => j.type === 'align')}
                      className="btn-ghost text-xs"
                      title="Python alignment: pypinyin phonetic matching"
                    >
                      Align
                    </button>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        setSyncing('weighted');
                        try {
                          await fetch(`/api/projects/${id}/timeline/weighted`, { method: 'POST' });
                          await reloadProject();
                          setStatusMsg('Weighted layout applied (character-count distribution)');
                        } catch { alert('Weighted failed'); }
                        finally { setSyncing(null); }
                      }}
                      disabled={syncing === 'weighted'}
                      className="btn-ghost text-xs"
                      title="Weighted layout: distribute time by character count"
                    >
                      {syncing === 'weighted' ? '...' : 'Weighted'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="workspace-divider" />

              {/* Editor tabs + content */}
              <div className="workspace-section">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1 rounded-xl" style={{ background: 'var(--color-surface-2)', padding: 4 }}>
                    <button
                      onClick={() => setActiveTab('lyrics')}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      style={{
                        background: activeTab === 'lyrics' ? 'var(--color-surface)' : 'transparent',
                        color: activeTab === 'lyrics' ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                      }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Lyrics
                    </button>
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      style={{
                        background: activeTab === 'timeline' ? 'var(--color-surface)' : 'transparent',
                        color: activeTab === 'timeline' ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                      }}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      Timeline
                    </button>
                  </div>
                </div>

                <div>
                  {activeTab === 'lyrics' ? <LyricDraftEditor /> : <TimelineList />}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ── Right: Preview Stage ── */}
      <aside className="preview-stage w-full lg:w-[420px] h-[45vh] lg:h-auto shrink-0 border-t lg:border-t-0 lg:border-l" style={{ borderColor: 'var(--color-border)' }}>
        <div className="h-12 px-5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(183,192,212,0.1)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Preview</span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>1080 &times; 1920</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8 py-8">
          <div className="preview-frame w-full max-w-[340px]">
            <PreviewPanel
              lines={lines}
              durationMs={project.durationMs}
              title={project.title}
              username={getTemplateUsername(project.template)}
              audioUrl={audioUrl}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

async function trackAsync(
  projectId: string,
  endpoint: string,
  type: 'transcribe' | 'render' | 'align',
  track: (jobId: string, type: 'transcribe' | 'render' | 'align') => void,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/${endpoint}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(err.error || `${type} failed`);
      return null;
    }
    const { jobId } = await res.json();
    if (jobId) track(jobId, type);
    return jobId ?? null;
  } catch {
    alert(`${type} request failed`);
    return null;
  }
}
