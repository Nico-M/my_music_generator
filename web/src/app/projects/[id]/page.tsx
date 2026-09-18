"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore, type Project } from "@/lib/store";
import { useAiSettings } from "@/components/AiSettingsProvider";
import { useJobs } from "@/lib/use-jobs";
import TimelineList from "@/components/TimelineList";
import { PreviewPanel } from "@/components/PreviewPanel";
import JobStatusBar from "@/components/JobStatusBar";
import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/components/LanguageProvider";
import { DEFAULT_TEMPLATE_ID, resolveCreatorName } from "@/lib/template";
import { TEMPLATES } from "@/components/TemplateCarousel";
import { GhostFibers, ElectricBorder } from "@/components/react-bits";
import {
  ArrowLeft,
  Clapperboard,
  Timer,
  LoaderCircle,
  CheckCircle2,
  Check,
  Music2,
  Trash2,
  Settings,
  Download,
  ExternalLink,
} from "@/components/icons/IonIcons";
import { Agentation } from "agentation";

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, locale } = useI18n();
  const isZh = locale === "zh";
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const project = useEditorStore((s) => s.project);
  const lines = useEditorStore((s) => s.lines);
  const setProject = useEditorStore((s) => s.setProject);
  const { activeJobs, finishedJobs, track, dismiss } = useJobs();
  const reloadedJobIds = useRef<Set<string>>(new Set());

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [fetchingCover, setFetchingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Selected template ref to guarantee it starts within the visible scroll view
  const selectedTemplateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && selectedTemplateRef.current) {
      // Small timeout to allow DOM and layout calculation to settle
      const timer = setTimeout(() => {
        selectedTemplateRef.current?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, project?.templateId]);

  const handleSelectTemplate = async (templateId: string) => {
    if (!id || (project?.templateId ?? DEFAULT_TEMPLATE_ID) === templateId) return;
    if (project) {
      setProject({ ...project, templateId });
    }
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      await reloadProject();
    } catch {
      await reloadProject();
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !project) return;
    if (
      !confirm(
        isZh
          ? `确定要删除项目「${project.title}」吗？此操作将彻底删除该项目、歌词与关联文件，无法撤销。`
          : `Delete project "${project.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || (isZh ? "删除失败" : "Delete failed"));
        setDeleting(false);
      }
    } catch {
      alert(isZh ? "删除失败，请重试" : "Failed to delete");
      setDeleting(false);
    }
  };

  const {
    settings: aiSettings,
    openSettings,
    isConfigured: isAiConfigured,
  } = useAiSettings();

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Project not found");
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

  const reloadProject = async (): Promise<Project | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = (await res.json()) as Project;
        setProject(data);
        return data;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  useEffect(() => {
    const doneJob = finishedJobs.find(
      (j) => j.status === "done" && !reloadedJobIds.current.has(j.jobId),
    );
    if (!doneJob) return;

    reloadedJobIds.current.add(doneJob.jobId);
    reloadProject();
  }, [finishedJobs]);

  const transcribeWithApiKey = async (projectId: string) => {
    setTranscribing(true);
    setStatusMsg(t("editor.transcribing"));
    try {
      const res = await fetch(`/api/projects/${projectId}/lyrics/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: aiSettings }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
        aligned?: boolean;
        notice?: { message?: string };
      };
      if (!res.ok) {
        setStatusMsg(data.error || t("ai.correctFailed"));
        return;
      }
      if (data.jobId) track(data.jobId, "transcribe");
      await reloadProject();
      setStatusMsg(data.notice?.message || t("editor.transcribeDone"));
    } catch {
      setStatusMsg(t("ai.correctFailed"));
    } finally {
      setTranscribing(false);
    }
  };

  const isRenderActive = activeJobs.some((j) => j.type === "render");
  const hasLines = lines.length > 0;

  // Find the most recent completed render job
  const doneRenderJob = finishedJobs.find(
    (j) => j.type === "render" && j.status === "done",
  );
  // Show buttons only when a render has completed and no new render is active
  const showRenderButtons = !!doneRenderJob && !isRenderActive;
  const downloadUrl = id ? `/api/files/${id}/download` : "#";
  const previewUrl = id ? `/api/files/${id}/preview` : "#";

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#05060a] flex items-center justify-center z-50">
        <GhostFibers lineColor="#16122d" glowColor="#6366f1" className="opacity-25 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
          <span className="text-xs text-slate-400 font-mono">
            {isZh ? "正在载入工程演播室..." : "Loading Studio Workspace..."}
          </span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="fixed inset-0 bg-[#05060a] flex items-center justify-center z-50 text-white">
        <GhostFibers lineColor="#16122d" glowColor="#6366f1" className="opacity-20 pointer-events-none" />
        <div className="relative z-10 text-center p-8 rounded-2xl bg-slate-950/80 border border-white/10 shadow-2xl max-w-sm">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
            ✕
          </div>
          <div className="text-sm text-slate-300 mb-4">
            {error || t("editor.projectNotFound")}
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isZh ? "返回首页" : "Back to Home"}</span>
          </a>
        </div>
      </div>
    );
  }

  const creatorName = resolveCreatorName(project.creatorName, project.template);
  const selectedTemplate =
    TEMPLATES.find((tpl) => tpl.id === (project.templateId ?? DEFAULT_TEMPLATE_ID)) ??
    TEMPLATES[0];

  return (
    <>
      {/* ── Root Viewport Container: Strictly 100dvh, Zero Page-Level Scrolling ── */}
      <div className="relative w-screen h-screen h-[100dvh] overflow-hidden flex flex-col bg-[#08070d] text-white select-none">
        {/* ── WebGL GhostFibers Background & Ambient Flares ── */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#08070d]">
          <GhostFibers
            lineColor="#16122d"
            glowColor="#6366f1"
            twist={1.25}
            layers={4}
            speed={0.4}
            brightness={0.85}
            className="w-full h-full opacity-40 pointer-events-none"
          />
          {/* Dark Studio radial ambient vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(14, 12, 32, 0.25) 0%, rgba(8, 7, 13, 0.7) 65%, #08070d 100%)',
            }}
          />
          <div className="absolute -top-32 left-1/4 w-[480px] h-[480px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/2 right-12 w-[440px] h-[440px] bg-pink-600/10 rounded-full blur-[150px] pointer-events-none" />
        </div>

        {/* ── Studio Top Header (Height: ~56px, Fixed, Zero Stretch) ── */}
        <header className="relative z-20 h-14 shrink-0 flex items-center justify-between px-4 lg:px-6 bg-[#0d0d11]/90 backdrop-blur-2xl border-b border-white/10 shadow-sm">
          {/* Left: Navigation & Project Meta */}
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer shadow-xs"
              title={isZh ? "返回首页" : "Back to Home"}
            >
              <ArrowLeft className="w-4 h-4" />
            </a>

            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-sm font-bold truncate text-white tracking-tight shrink-0 max-w-[200px] sm:max-w-[280px]">
                {project.title}
              </h1>
              {project.singer && (
                <>
                  <span className="text-white/20 shrink-0 text-xs">/</span>
                  <span className="text-xs text-white/70 truncate shrink-0 max-w-[120px] sm:max-w-[180px]">
                    {project.singer}
                  </span>
                </>
              )}
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white/10 text-white/80 border border-white/15 shrink-0">
                {selectedTemplate.id}
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-white/40 font-mono shrink-0">
                <span>{Math.round(project.durationMs / 1000)}s</span>
                <span>·</span>
                <span>
                  {project.lines.length} {t("common.lines")}
                </span>
              </span>
            </div>
          </div>

          {/* Right: Actions & Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDeleteProject}
              disabled={deleting}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 bg-black/60 border border-rose-500/20 active:scale-[0.98] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title={isZh ? "删除此项目" : "Delete Project"}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">{deleting ? (isZh ? "删除中..." : "Deleting...") : (isZh ? "删除" : "Delete")}</span>
            </button>

            <button
              onClick={openSettings}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 bg-black/60 border border-white/10 active:scale-[0.98] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title={t("ai.settingsTitle")}
            >
              <Settings className="w-3.5 h-3.5 text-white/60" />
              <span className="hidden sm:inline">{t("ai.settings")}</span>
            </button>

            <LanguageToggle />

            {/* Status badge */}
            {hasLines ? (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white font-medium shadow-xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{t("editor.ready")}</span>
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-[#1A1A1A] border border-white/10 text-white/40 font-medium">
                {t("editor.noLyrics")}
              </span>
            )}

            {/* Render MP4 Button - Aurora high-contrast submit button */}
            <button
              onClick={async () => {
                if (!id) return;
                await trackAsync(id, "render", "render", track);
              }}
              disabled={isRenderActive}
              className="h-8.5 px-4 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all shadow-md shadow-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Render 1080x1920 MP4"
            >
              {isRenderActive ? (
                <>
                  <LoaderCircle className="animate-spin h-3.5 w-3.5 text-black" />
                  <span>{t("editor.rendering")}</span>
                </>
              ) : (
                <>
                  <Clapperboard className="w-3.5 h-3.5 text-black" />
                  <span>{t("editor.renderMP4")}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* ── Main Viewport Split: strictly flex-1 min-h-0, overflow-hidden ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative z-10">
          {/* ════════ LEFT: WORKSPACE PANELS ════════ */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col p-3 lg:p-4 gap-3 overflow-hidden">
            {/* ── Active Job Alerts & Render Results (shrink-0, only visible when active) ── */}
            <JobStatusBar
              activeJobs={activeJobs}
              finishedJobs={finishedJobs}
              onDismiss={dismiss}
            />

            {showRenderButtons && (
              <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-200 shadow-md backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium">
                  {t("editor.renderReady")}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <a
                    href={downloadUrl}
                    download
                    className="btn-primary !py-1 !px-2.5 !text-xs !no-underline inline-flex items-center gap-1 shadow-sm"
                  >
                    <Download className="w-3 h-3" />
                    <span>{t("editor.downloadRendered")}</span>
                  </a>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 inline-flex items-center gap-1 transition-colors !no-underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{t("editor.previewRendered")}</span>
                  </a>
                </div>
              </div>
            )}

            {statusMsg && (
              <div className="shrink-0 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs bg-slate-900/80 border border-white/10 text-slate-300 shadow-sm">
                {transcribing && (
                  <LoaderCircle className="animate-spin h-3.5 w-3.5 shrink-0 text-indigo-400" />
                )}
                <span className="flex-1">{statusMsg}</span>
                <button
                  onClick={() => setStatusMsg(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ── Two-Column Studio Layout (Config & Templates + Timeline) ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3 lg:gap-4 overflow-hidden">
              {/* ─────────────────────────────────────────────────────────────
                  COL 1: Song Settings, Cover & Template Selector (5 cols)
                  No global scroll; Template selection scrolls in its own div.
                  ───────────────────────────────────────────────────────────── */}
              <div className="xl:col-span-5 h-full flex flex-col rounded-2xl border border-white/10 bg-[#0d0d11]/90 backdrop-blur-2xl p-4 shadow-2xl overflow-hidden min-h-0">
                {/* 1. Panel Header (shrink-0) */}
                <div className="shrink-0 flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#1A1A1A] text-white flex items-center justify-center shrink-0 border border-white/10">
                      <Music2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold tracking-tight text-white uppercase">
                        {isZh ? "歌曲设置与封面" : "Song & Album Cover"}
                      </h2>
                    </div>
                  </div>
                  {project.coverUrl ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#1A1A1A] text-white/90 border border-white/15 flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {isZh ? "已获取封面" : "Cover Active"}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#1A1A1A] text-white/40 border border-white/10 font-mono">
                      {isZh ? "待识别" : "Pending"}
                    </span>
                  )}
                </div>

                {/* 2. Metadata Inputs & Cover Thumbnail (shrink-0) */}
                <div className="shrink-0 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start pb-3 border-b border-white/10">
                  {/* Left: Input fields (7 cols) */}
                  <div className="sm:col-span-7 space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">
                        {isZh ? "歌曲标题" : "Song Title"}
                      </label>
                      <input
                        type="text"
                        defaultValue={project.title}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (!val || !id) return;
                          try {
                            await fetch(`/api/projects/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: val }),
                            });
                            reloadProject();
                          } catch {}
                        }}
                        className="w-full h-10 px-3.5 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-xs focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        placeholder={isZh ? "歌曲名称" : "Title"}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">
                        {t("create.singer")}
                      </label>
                      <input
                        type="text"
                        defaultValue={project.singer ?? ""}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (!id) return;
                          try {
                            await fetch(`/api/projects/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ singer: val || null }),
                            });
                            reloadProject();
                          } catch {}
                        }}
                        className="w-full h-10 px-3.5 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-xs focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        placeholder={t("create.singerPlaceholder")}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">
                        {t("create.brand")}
                      </label>
                      <input
                        type="text"
                        defaultValue={creatorName}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (!id) return;
                          try {
                            await fetch(`/api/projects/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ creatorName: val }),
                            });
                            reloadProject();
                          } catch {}
                        }}
                        className="w-full h-10 px-3.5 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-xs focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        placeholder={t("create.brandPlaceholder")}
                      />
                    </div>
                  </div>

                  {/* Right: Album Cover thumbnail (5 cols) */}
                  <div className="sm:col-span-5 flex flex-col items-center">
                    <label className="block text-xs font-medium text-white mb-1.5 self-start">
                      {isZh ? "专辑封面" : "Cover Art"}
                    </label>
                    {project.coverUrl ? (
                      <div className="relative aspect-square w-full max-w-[130px] rounded-xl overflow-hidden border border-white/10 shadow-md group/cover bg-[#1A1A1A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={project.coverUrl}
                          alt="Album cover"
                          className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                          <button
                            onClick={async () => {
                              if (!id) return;
                              setFetchingCover(true);
                              try {
                                const res = await fetch(`/api/projects/${id}/cover`, {
                                  method: "POST",
                                });
                                if (res.ok) {
                                  await reloadProject();
                                } else {
                                  alert(isZh ? "未找到匹配封面，请检查歌曲名与歌手" : "Cover not found");
                                }
                              } catch {
                                alert(isZh ? "拉取封面失败" : "Failed to fetch cover");
                              }
                              setFetchingCover(false);
                            }}
                            disabled={fetchingCover}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-md transition-all cursor-pointer"
                          >
                            {fetchingCover ? (isZh ? "获取中..." : "Fetching...") : (isZh ? "重新拉取" : "Refetch")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative aspect-square w-full max-w-[130px] rounded-xl border border-dashed border-white/15 bg-[#1A1A1A] flex flex-col items-center justify-center p-2 text-center group/placeholder hover:border-white/30 transition-all">
                        <Music2 className="w-5 h-5 text-white/40 mb-1" />
                        <span className="text-[10px] text-white/40">
                          {isZh ? "点击识别自动拉取" : "Auto-fetches on align"}
                        </span>
                        <button
                          onClick={async () => {
                            if (!id) return;
                            setFetchingCover(true);
                            try {
                              const res = await fetch(`/api/projects/${id}/cover`, {
                                method: "POST",
                              });
                              if (res.ok) {
                                await reloadProject();
                              } else {
                                alert(isZh ? "未找到匹配封面，请检查歌曲名与歌手" : "Cover not found");
                              }
                            } catch {
                              alert(isZh ? "拉取封面失败" : "Failed to fetch cover");
                            }
                            setFetchingCover(false);
                          }}
                          disabled={fetchingCover}
                          className="mt-1.5 text-[10px] text-white/80 hover:text-white font-medium underline cursor-pointer"
                        >
                          {fetchingCover ? (isZh ? "获取中..." : "Fetching...") : (isZh ? "单独拉取" : "Fetch")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 模板选择 (Template Selector) ── 在自己div内滚动，采用 Aurora StepItem 质感 ── */}
                <div className="flex-1 min-h-0 flex flex-col pt-3 overflow-hidden">
                  <div className="shrink-0 flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white flex items-center gap-1.5">
                      <span>{t("create.template")}</span>
                      <span className="text-[10px] font-normal text-white/60 font-mono">
                        ({isZh ? selectedTemplate.nameZh : selectedTemplate.name})
                      </span>
                    </label>
                    <span className="text-[10px] text-white/40 font-mono">
                      {TEMPLATES.length} {isZh ? "款风格可选" : "Styles"}
                    </span>
                  </div>

                  {/* ── Scrollable Template Cards Div ── */}
                  <div
                    data-allow-scroll="true"
                    className="flex-1 min-h-[140px] overflow-y-auto pr-1 select-auto [scrollbar-width:thin] scrollbar-thumb-white/15 scrollbar-track-transparent"
                  >
                    <div className="grid grid-cols-3 gap-2.5 pb-1">
                      {TEMPLATES.map((tpl) => {
                        const isSelected =
                          (project.templateId ?? DEFAULT_TEMPLATE_ID) === tpl.id;
                        const cardButton = (
                          <button
                            type="button"
                            onClick={() => handleSelectTemplate(tpl.id)}
                            className={`group relative w-full flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                              isSelected
                                ? "border-transparent bg-white/10"
                                : "border-white/10 hover:border-white/25 bg-[#1A1A1A] hover:bg-[#222222]"
                            }`}
                            title={isZh ? tpl.nameZh : tpl.name}
                          >
                            <div className="relative aspect-[2/3] w-full overflow-hidden bg-black">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={tpl.image}
                                alt={isZh ? tpl.nameZh : tpl.name}
                                className={`w-full h-full object-cover transition-transform duration-300 ${
                                  isSelected ? "scale-102" : "group-hover:scale-105"
                                }`}
                              />
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow-md z-10">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                          </button>
                        );

                        return (
                          <div
                            key={tpl.id}
                            ref={isSelected ? selectedTemplateRef : undefined}
                            className="relative rounded-xl"
                          >
                            {isSelected ? (
                              <ElectricBorder
                                color="#818cf8"
                                speed={1.2}
                                chaos={0.14}
                                borderRadius={12}
                                className="w-full h-full"
                              >
                                {cardButton}
                              </ElectricBorder>
                            ) : (
                              cardButton
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4. Bottom Action: 歌词识别 (Aurora Submit Button 风格) ── */}
                <div className="shrink-0 pt-3 mt-2 border-t border-white/10 flex items-center justify-between gap-3">
                  <p className="text-[10px] text-white/40 leading-tight">
                    {isZh
                      ? "基于 MiniMax 引擎智能拆词对齐，并联网匹配专辑封面"
                      : "Auto-sync with MiniMax & fetch cover"}
                  </p>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      if (!isAiConfigured) {
                        setStatusMsg(t("ai.needKey"));
                        openSettings();
                        return;
                      }
                      if (
                        lines.length > 0 &&
                        !confirm(t("editor.transcribeConfirm"))
                      )
                        return;
                      await transcribeWithApiKey(id);
                    }}
                    disabled={
                      transcribing ||
                      activeJobs.some((j) => j.type === "transcribe")
                    }
                    className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    title={t("editor.transcribeHint")}
                  >
                    {transcribing ? (
                      <LoaderCircle className="animate-spin w-3.5 h-3.5 text-black" />
                    ) : (
                      <svg className="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                    <span>{transcribing ? t("editor.transcribing") : (isZh ? "歌词识别" : "Align Lyrics")}</span>
                  </button>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  COL 2: Timeline Alignment Studio (7 cols)
                  No global scroll; Timeline list scrolls inside its own div.
                  ───────────────────────────────────────────────────────────── */}
              <div className="xl:col-span-7 h-full flex flex-col rounded-2xl border border-white/10 bg-[#0d0d11]/90 backdrop-blur-2xl p-4 shadow-2xl overflow-hidden min-h-0">
                <TimelineList />
              </div>
            </div>
          </div>

          {/* ════════ RIGHT: REALTIME PREVIEW STAGE ════════ */}
          <aside className="w-full lg:w-[360px] xl:w-[400px] 2xl:w-[440px] h-full shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0d0d11]/90 backdrop-blur-2xl overflow-hidden">
            {/* Stage Title Bar (shrink-0) */}
            <div className="h-11 px-4 flex items-center justify-between border-b border-white/10 shrink-0 font-mono text-xs">
              <span className="font-semibold text-white/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t("editor.preview")}</span>
              </span>
              <span className="text-[10px] text-white/40">
                1080 &times; 1920 · 60FPS
              </span>
            </div>

            {/* Stage Phone Viewport (flex-1 min-h-0, fits phone naturally without scroll) */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-3 lg:p-4 overflow-hidden">
              <div className="relative w-full max-w-[280px] xl:max-w-[310px] max-h-[calc(100vh-120px)] aspect-[9/16] rounded-[24px] overflow-hidden border border-white/15 shadow-2xl shadow-indigo-950/80 bg-black flex items-center justify-center">
                <PreviewPanel
                  lines={lines}
                  durationMs={project.durationMs}
                  title={project.title}
                  creatorName={project.creatorName}
                  singer={project.singer ?? undefined}
                  audioPath={project.audioPath}
                  templateId={project.templateId}
                  templateConfig={project.templateConfig}
                  legacyTemplate={project.template}
                  coverUrl={project.coverUrl}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <Agentation
          endpoint={
            process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ||
            "http://192.168.1.3:4747"
          }
          onSessionCreated={(sessionId) => {
            console.log("Session started:", sessionId);
          }}
        />
      )}
    </>
  );
}

async function trackAsync(
  projectId: string,
  endpoint: string,
  type: "render",
  track: (jobId: string, type: "render") => void,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/${endpoint}`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
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
