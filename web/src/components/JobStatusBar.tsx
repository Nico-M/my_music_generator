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
    <div className="space-y-1">
      {activeJobs.map(job => (
        <div key={job.jobId} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <LoaderCircle className="animate-spin h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>{JOB_LABELS[job.type]}</span>
          <span style={{ color: 'var(--color-text-subtle)' }}>{job.status === 'queued' ? t('jobs.queued') : t('jobs.processing')}</span>
        </div>
      ))}

      {finishedJobs.map(job => (
        <div
          key={job.jobId}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
          style={{
            background: 'var(--color-surface-2)',
            borderColor: job.status === 'done' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
          }}
        >
          {job.status === 'done' ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
          )}
          <span style={{ color: job.status === 'done' ? 'var(--color-primary-light)' : 'var(--color-danger)' }}>
            {JOB_LABELS[job.type]}
          </span>
          <span className="flex-1" style={{ color: job.status === 'done' ? 'var(--color-text-subtle)' : 'var(--color-danger)' }}>
            {job.status === 'done' ? t('jobs.complete') : (job.error || t('jobs.failed', { error: '' }).replace(': ', ''))}
          </span>
          <button
            onClick={() => onDismiss(job.jobId)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
