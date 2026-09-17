"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEditorStore, type Project } from "@/lib/store";
import { useAiSettings } from "@/components/AiSettingsProvider";
import { useJobs } from "@/lib/use-jobs";
import TimelineList from "@/components/TimelineList";
import { PreviewPanel } from "@/components/PreviewPanel";
import JobStatusBar from "@/components/JobStatusBar";
import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/components/LanguageProvider";
import { DEFAULT_TEMPLATE_ID, resolveCreatorName } from "@/lib/template";
import {
  ArrowLeft,
  Clapperboard,
  FileText,
  Timer,
  LoaderCircle,
  CheckCircle2,
  Check,
  Music2,
  Trash2,
} from "@/components/icons/IonIcons";
import { Agentation } from "agentation";

interface TemplateOption {
  id: string;
  name: string;
  image: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: "notes", name: "Notes", image: "/assets/templates/notes.jpg" },
  { id: "record", name: "Record", image: "/assets/templates/record.jpg" },
  { id: "neon-spectrum", name: "Neon Spectrum", image: "/assets/templates/neon-spectrum.jpg" },
  { id: "liquid-wave", name: "Liquid Wave", image: "/assets/templates/liquid-wave.jpg" },
  { id: "lyric-poster", name: "Lyric Poster", image: "/assets/templates/lyric-poster.jpg" },
  { id: "ipod-classic", name: "iPod Classic", image: "/assets/templates/ipod-classic.jpg" },
  { id: "music-widget", name: "Music Widget", image: "/assets/templates/music-widget.jpg" },
];

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useI18n();
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"lyrics" | "timeline">("lyrics");

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
        `确定要删除项目「${project.title}」吗？此操作将彻底删除该项目、歌词与关联文件，无法撤销。`
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
        alert(err.error || "删除失败");
        setDeleting(false);
      }
    } catch {
      alert("删除失败，请重试");
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
      <div className="editor-shell flex items-center justify-center min-h-screen">
        <LoaderCircle
          className="animate-spin h-8 w-8"
          style={{ color: "var(--color-accent)" }}
        />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="editor-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div style={{ color: "var(--color-danger)" }} className="mb-2">
            ✕
          </div>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {error || t("editor.projectNotFound")}
          </div>
        </div>
      </div>
    );
  }

  const creatorName = resolveCreatorName(project.creatorName, project.template);

  return (
    <>
      <div className="editor-shell flex flex-col lg:flex-row h-screen">
        {/* ── Left: Workspace ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── Compressed Header (~64px) ── */}
          <header
            className="relative overflow-hidden flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-200/90"
            style={{
              minHeight: 58,
            }}
          >
            {/* Background image & aesthetic glassmorphic overlay */}
            <div className="absolute inset-0 pointer-events-none select-none">
              <Image
                src="/images/editor-header-bg.jpg"
                alt="Editor header background"
                fill
                priority
                className="object-cover object-[center_40%] opacity-40"
              />
              <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px]" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
            </div>

            <div className="relative z-10 flex items-center gap-3 min-w-0">
              <a
                href="/"
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/80 hover:bg-white border border-slate-200/80 shadow-xs hover:shadow transition-all shrink-0 text-slate-600 hover:text-slate-900"
                title="返回首页"
              >
                <ArrowLeft className="w-4 h-4" />
              </a>
              <div className="min-w-0">
                <h1
                  className="text-sm font-bold truncate text-slate-900"
                >
                  {project.title}
                </h1>
                <p
                  className="text-[11px] text-slate-500 flex items-center gap-1.5"
                >
                  <span>{Math.round(project.durationMs / 1000)}s</span>
                  <span>·</span>
                  <span>{project.lines.length} {t("common.lines")}</span>
                  {project.singer && (
                    <>
                      <span>·</span>
                      <span className="truncate">{project.singer}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2 shrink-0">
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="btn-ghost !py-1.5 !px-2.5 !text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 bg-white/70 border border-rose-200/80 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="删除此项目"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>{deleting ? "删除中..." : "删除"}</span>
              </button>

              <button
                onClick={openSettings}
                className="btn-ghost !py-1.5 !px-2.5 !text-xs bg-white/70 hover:bg-white border border-slate-200/70 shadow-xs"
                title={t("ai.settingsTitle")}
              >
                {t("ai.settings")}
              </button>
              <LanguageToggle />

              {/* Status badge */}
              {hasLines ? (
                <span
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-100/90 text-indigo-600 font-medium shadow-xs"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {t("editor.ready")}
                </span>
              ) : (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/90 text-slate-500 font-medium"
                >
                  {t("editor.noLyrics")}
                </span>
              )}

              {/* Render button — visually strongest, separate */}
              <button
                onClick={async () => {
                  if (!id) return;
                  await trackAsync(id, "render", "render", track);
                }}
                disabled={isRenderActive}
                className="btn-primary !py-1.5 !px-3 !text-xs shadow-sm hover:shadow-md transition-shadow"
                title="Render 1080x1920 MP4"
              >
                {isRenderActive ? (
                  <span className="flex items-center gap-1">
                    <LoaderCircle className="animate-spin h-3 w-3" />
                    {t("editor.rendering")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clapperboard className="w-3.5 h-3.5" />
                    {t("editor.renderMP4")}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* ── Scrollable Workspace Content ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4">
              {/* ── Job Status ── */}
              <JobStatusBar
                activeJobs={activeJobs}
                finishedJobs={finishedJobs}
                onDismiss={dismiss}
              />

              {/* ── Render result buttons ── */}
              {showRenderButtons && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xs"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--color-primary-light)" }}
                  >
                    {t("editor.renderReady")}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <a
                      href={downloadUrl}
                      className="btn-primary !py-1.5 !px-3 !text-xs !no-underline inline-flex items-center gap-1 shadow-xs"
                      download
                    >
                      {t("editor.downloadRendered")}
                    </a>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost !py-1.5 !px-3 !text-xs !no-underline inline-flex items-center gap-1"
                    >
                      {t("editor.previewRendered")}
                    </a>
                  </div>
                </div>
              )}

              {/* Status message */}
              {statusMsg && (
                <div
                  className="px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm shadow-xs"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {transcribing && (
                    <LoaderCircle
                      className="animate-spin h-3.5 w-3.5 shrink-0 text-indigo-600"
                    />
                  )}
                  <span className="text-xs">{statusMsg}</span>
                  <button
                    onClick={() => setStatusMsg(null)}
                    className="ml-auto shrink-0 text-xs hover:text-slate-700"
                    style={{ color: "var(--color-text-subtle)" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* ── Left-Right Split Studio Layout ── */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* ── Left Column: Project Config & Album Cover ── */}
                <div className="xl:col-span-5">
                  <div className="workspace-panel p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Music2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            歌曲设置与封面
                          </h2>
                          <p className="text-[10px] text-slate-400">
                            配置歌曲基础信息与专辑封面图
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {project.coverUrl ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            已获取封面
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            待识别
                          </span>
                        )}
                        <button
                          onClick={handleDeleteProject}
                          disabled={deleting}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="删除此项目"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Two-Column Form & Cover Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                      {/* Left: Fields (7 cols) */}
                      <div className="sm:col-span-7 space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            歌曲标题
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
                            className="input-field !py-1.5 !px-2.5 !text-xs w-full"
                            placeholder="歌曲名称"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                            className="input-field !py-1.5 !px-2.5 !text-xs w-full"
                            placeholder={t("create.singerPlaceholder")}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {t("create.brand")}
                          </label>
                          <input
                            type="text"
                            defaultValue={creatorName}
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (!val || !id) return;
                              try {
                                await fetch(`/api/projects/${id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ creatorName: val }),
                                });
                                reloadProject();
                              } catch {}
                            }}
                            className="input-field !py-1.5 !px-2.5 !text-xs w-full"
                            placeholder={t("create.brandPlaceholder")}
                          />
                        </div>
                      </div>

                      {/* Right: Cover Preview / Placeholder (5 cols) */}
                      <div className="sm:col-span-5 flex flex-col items-center">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1 self-start">
                          专辑封面
                        </label>
                        {project.coverUrl ? (
                          <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md group/cover bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={project.coverUrl}
                              alt="Album cover"
                              className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                              <button
                                onClick={async () => {
                                  if (!id) return;
                                  setFetchingCover(true);
                                  try {
                                    const res = await fetch(`/api/projects/${id}/cover`, { method: "POST" });
                                    if (res.ok) {
                                      await reloadProject();
                                    } else {
                                      alert("未找到匹配封面，请检查歌曲名与歌手");
                                    }
                                  } catch {
                                    alert("拉取封面失败");
                                  }
                                  setFetchingCover(false);
                                }}
                                disabled={fetchingCover}
                                className="btn-ghost !py-1 !px-2.5 !text-[11px] text-white bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg backdrop-blur-sm"
                              >
                                {fetchingCover ? "获取中..." : "重新拉取"}
                              </button>
                            </div>
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white font-medium">
                              已匹配
                            </span>
                          </div>
                        ) : (
                          <div className="relative aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 flex flex-col items-center justify-center p-3 text-center group/placeholder hover:border-indigo-300 hover:bg-indigo-50/20 transition-all">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-400 mb-2 group-hover/placeholder:scale-105 group-hover/placeholder:text-indigo-600 group-hover/placeholder:border-indigo-200 transition-all">
                              <Music2 className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 mb-0.5">
                              Cover 占位图
                            </span>
                            <span className="text-[10px] text-slate-400 leading-tight">
                              点击下方识别将自动拉取
                            </span>
                            <button
                              onClick={async () => {
                                if (!id) return;
                                setFetchingCover(true);
                                try {
                                  const res = await fetch(`/api/projects/${id}/cover`, { method: "POST" });
                                  if (res.ok) {
                                    await reloadProject();
                                  } else {
                                    alert("未找到匹配封面，请检查歌曲名与歌手");
                                  }
                                } catch {
                                  alert("拉取封面失败");
                                }
                                setFetchingCover(false);
                              }}
                              disabled={fetchingCover}
                              className="mt-2 text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold underline cursor-pointer"
                            >
                              {fetchingCover ? "正在获取..." : "单独拉取封面"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Template Card Selection (Full Width) */}
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <span>{t("create.template")}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            （已选：{TEMPLATE_OPTIONS.find((tpl) => tpl.id === (project.templateId ?? DEFAULT_TEMPLATE_ID))?.name ?? "Notes"}）
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">7 款风格可选</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3.5">
                        {TEMPLATE_OPTIONS.map((tpl) => {
                          const isSelected = (project.templateId ?? DEFAULT_TEMPLATE_ID) === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectTemplate(tpl.id)}
                              className={`group relative flex flex-col rounded-xl overflow-hidden border-2 text-left transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? "border-indigo-600 ring-2 ring-indigo-500/20 shadow-md"
                                  : "border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white"
                              }`}
                              title={tpl.name}
                            >
                              <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={tpl.image}
                                  alt={tpl.name}
                                  className={`w-full h-full object-cover transition-transform duration-300 ${
                                    isSelected ? "scale-102" : "group-hover:scale-105"
                                  }`}
                                />
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                              <div className="py-2 px-1.5 bg-white text-center">
                                <span
                                  className={`block text-xs truncate leading-tight ${
                                    isSelected
                                      ? "font-bold text-indigo-600"
                                      : "font-medium text-slate-700 group-hover:text-slate-900"
                                  }`}
                                >
                                  {tpl.name}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Action: 歌词识别 */}
                    <div className="pt-4 mt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        点击识别将基于 MiniMax 引擎对齐歌词，并同步联网拉取官方专辑封面
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
                        className="btn-primary !py-2.5 !px-5 !text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all shrink-0 font-semibold cursor-pointer"
                        title={t("editor.transcribeHint")}
                      >
                        {transcribing ? (
                          <LoaderCircle className="animate-spin w-4 h-4" />
                        ) : (
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                        <span>{transcribing ? t("editor.transcribing") : "歌词识别"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Right Column: Timeline Alignment Studio ── */}
                <div className="xl:col-span-7">
                  <div className="workspace-panel p-4">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Timer className="w-3.5 h-3.5" />
                        </div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {t("editor.timeline")}
                        </h2>
                      </div>
                    </div>

                    <TimelineList />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Preview Stage ── */}
        <aside
          className="preview-stage w-full lg:w-[420px] h-[45vh] lg:h-auto shrink-0 border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div
            className="h-12 px-5 flex items-center justify-between border-b"
            style={{ borderColor: "rgba(183,192,212,0.1)" }}
          >
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("editor.preview")}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--color-text-subtle)" }}
            >
              1080 &times; 1920
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="preview-frame w-full max-w-[340px]">
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
