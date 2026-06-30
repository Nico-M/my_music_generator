'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface JobStatus {
  jobId: string;
  type: 'transcribe' | 'render' | 'align';
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  resultPath?: string;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Hook to track a single async job by polling GET /api/jobs/:id
 */
export function useJobPoll(jobId: string | null) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const js: JobStatus = {
          jobId: data.id,
          type: data.type,
          status: data.status,
          error: data.error ?? undefined,
          resultPath: data.resultPath ?? undefined,
        };
        setJob(js);

        // Stop polling on terminal state
        if (data.status === 'done' || data.status === 'failed') {
          clearPoll();
        }
      } catch {
        // Network error — keep polling
      }
    };

    // Initial fetch
    poll();

    // Start polling
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return clearPoll;
  }, [jobId, clearPoll]);

  return job;
}

/**
 * Manages multiple concurrent jobs with polling.
 * Returns a dispatcher to start jobs and the current job list.
 */
export function useJobManager() {
  const [jobIds, setJobIds] = useState<Record<string, string>>({});
  const [activeJobs, setActiveJobs] = useState<JobStatus[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobStatus[]>([]);
  const [history, setHistory] = useState<JobStatus[]>([]);

  // Start a job and begin tracking it
  const startJob = useCallback(async (projectId: string, endpoint: string, type: JobStatus['type']): Promise<string | null> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        // Add a fake failed job entry
        const fakeJob: JobStatus = {
          jobId: `failed-${Date.now()}`,
          type,
          status: 'failed',
          error: err.error || 'Request failed',
        };
        setHistory(prev => [...prev, fakeJob]);
        setCompletedJobs(prev => [...prev, fakeJob]);
        return null;
      }
      const { jobId } = await res.json();
      if (jobId) {
        setJobIds(prev => ({ ...prev, [jobId]: type }));
      }
      return jobId ?? null;
    } catch (err) {
      const fakeJob: JobStatus = {
        jobId: `failed-${Date.now()}`,
        type,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Network error',
      };
      setHistory(prev => [...prev, fakeJob]);
      setCompletedJobs(prev => [...prev, fakeJob]);
      return null;
    }
  }, []);

  // Dismiss (remove) a completed/failed job notification
  const dismissJob = useCallback((jobId: string) => {
    setJobIds(prev => {
      const { [jobId]: _, ...rest } = prev;
      return rest;
    });
    setCompletedJobs(prev => prev.filter(j => j.jobId !== jobId));
  }, []);

  const clearAll = useCallback(() => {
    setJobIds({});
    setCompletedJobs([]);
    setHistory([]);
  }, []);

  return { jobIds, activeJobs, completedJobs, history, startJob, dismissJob, clearAll };
}
