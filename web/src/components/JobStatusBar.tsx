'use client';

import type { TrackedJob } from '@/lib/use-jobs';
import { useI18n } from './LanguageProvider';
import { LoaderCircle, CheckCircle, XCircle, X } from '@/components/icons/IonIcons';

interface JobStatusBarProps {
  activeJobs: TrackedJob[];
  finishedJobs: TrackedJob[];
  onDismiss: (jobId: string) => void;
}

export default function JobStatusBar({ activeJobs, finishedJobs, onDismiss }: JobStatusBarProps) {
  const { t, locale } = useI18n();

  const JOB_LABELS: Record<string, string> = {
    transcribe: t('jobs.transcribe'),
    render: t('jobs.render'),
    align: t('jobs.align'),
  };

  if (activeJobs.length === 0 && finishedJobs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {activeJobs.map(job => (
        <div key={job.jobId} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs bg-[#141418]/90 border border-white/10 text-white shadow-md backdrop-blur-md">
          <LoaderCircle className="animate-spin h-3.5 w-3.5 shrink-0 text-white/80" />
          <span className="font-semibold text-white">{JOB_LABELS[job.type]}</span>
          <span className="text-white/40">{job.status === 'queued' ? t('jobs.queued') : t('jobs.processing')}</span>
        </div>
      ))}

      {finishedJobs.map(job => (
        <div
          key={job.jobId}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border shadow-md backdrop-blur-md ${
            job.status === 'done'
              ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/30 text-rose-200'
          }`}
        >
          {job.status === 'done' ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          )}
          <span className="font-semibold">
            {JOB_LABELS[job.type]}
          </span>
          <span className="flex-1 text-slate-300">
            {job.status !== 'done'
              ? (job.error || t('jobs.failed', { error: '' }).replace(': ', ''))
              : t('jobs.complete')}
          </span>
          <button
            onClick={() => onDismiss(job.jobId)}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
