'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TrackedJob {
  jobId: string;
  type: 'transcribe' | 'render' | 'align';
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  resultPath?: string;
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
