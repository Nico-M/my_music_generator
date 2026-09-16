'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TrackedJob {
  jobId: string;
  type: 'transcribe' | 'render' | 'align';
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  resultPath?: string;
  /** How the remote aligner actually matched, for `align` jobs only. */
  alignDetail?: AlignDetail;
}

/** Outcome metadata reported by the aligner for a finished alignment. */
export interface AlignDetail {
  alignmentMethod?: 'fuzzy_greedy' | 'proportional_fallback';
  matchedLines?: number;
  totalLines?: number;
}

function parseAlignDetail(params: unknown): AlignDetail | undefined {
  if (typeof params !== 'string') return undefined;
  try {
    const parsed = JSON.parse(params) as Record<string, unknown>;
    const detail: AlignDetail = {};
    if (
      parsed.alignmentMethod === 'fuzzy_greedy' ||
      parsed.alignmentMethod === 'proportional_fallback'
    ) {
      detail.alignmentMethod = parsed.alignmentMethod;
    }
    if (typeof parsed.matchedLines === 'number') detail.matchedLines = parsed.matchedLines;
    if (typeof parsed.totalLines === 'number') detail.totalLines = parsed.totalLines;
    return Object.keys(detail).length > 0 ? detail : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Manages a list of async jobs with polling.
 * Call `track(jobId, type)` after POSTing to start tracking.
 * Returns the live list of jobs.
 */
export function useJobs() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const pollingRef = useRef<Set<string>>(new Set());

  const pollOne = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJobs(prev =>
        prev.map(j =>
          j.jobId === jobId
            ? {
                jobId: data.id,
                type: data.type,
                status: data.status,
                error: data.error ?? undefined,
                resultPath: data.resultPath ?? undefined,
                alignDetail: parseAlignDetail(data.params),
              }
            : j
        )
      );
      return data.status;
    } catch {
      return undefined;
    }
  }, []);

  const track = useCallback(
    (jobId: string, type: TrackedJob['type']) => {
      if (pollingRef.current.has(jobId)) return;
      pollingRef.current.add(jobId);

      setJobs(prev => [
        ...prev,
        { jobId, type, status: 'queued' },
      ]);

      // Poll immediately
      pollOne(jobId);

      // Poll every 2s until done/failed
      const interval = setInterval(async () => {
        const status = await pollOne(jobId);
        if (status === 'done' || status === 'failed') {
          clearInterval(interval);
          pollingRef.current.delete(jobId);
        }
      }, 2000);
    },
    [pollOne]
  );

  const dismiss = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.jobId !== jobId));
    pollingRef.current.delete(jobId);
  }, []);

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running');
  const finishedJobs = jobs.filter(j => j.status === 'done' || j.status === 'failed');

  return { jobs, activeJobs, finishedJobs, track, dismiss };
}
