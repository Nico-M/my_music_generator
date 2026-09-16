"""In-process job registry with on-disk snapshots.

A job is represented as:

    {
      "job_id": str,
      "status": "queued" | "running" | "done" | "failed",
      "created_at": float,        # epoch seconds
      "updated_at": float,        # epoch seconds
      "audio_path": str,          # absolute
      "audio_sha256": str,
      "lyrics": list[str],
      "use_demucs": bool,
      "error": str | None,
      "result": dict | None,      # populated when status == "done"
      "logs": list[str],          # recent log lines (best-effort, bounded)
    }

The registry is a plain dict guarded by a lock so the FastAPI endpoint and
background worker thread can share it without races. Every state transition
is mirrored to ``cache/jobs/{job_id}.json`` so an operator can audit later.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

from .config import settings


@dataclass
class Job:
    job_id: str
    status: str = "queued"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    audio_path: str = ""
    audio_sha256: str = ""
    lyrics: list[str] = field(default_factory=list)
    use_demucs: bool = True
    error: str | None = None
    result: dict | None = None
    logs: list[str] = field(default_factory=list)

    MAX_LOGS = 200

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def log(self, line: str) -> None:
        # Bounded log buffer so the JSON file doesn't grow unbounded.
        self.logs.append(f"[{time.strftime('%H:%M:%S')}] {line}")
        if len(self.logs) > self.MAX_LOGS:
            del self.logs[: len(self.logs) - self.MAX_LOGS]

    def transition(self, status: str, *, error: str | None = None, result: dict | None = None) -> None:
        self.status = status
        self.updated_at = time.time()
        if error is not None:
            self.error = error
        if result is not None:
            self.result = result


class JobRegistry:
    """Thread-safe in-memory map of job_id -> Job, mirrored to disk."""

    def __init__(self, jobs_dir: Path | None = None) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._jobs_dir = jobs_dir or settings.jobs_dir

    # -- lifecycle -----------------------------------------------------------

    def create(self, *, audio_path: str, audio_sha256: str, lyrics: list[str], use_demucs: bool) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(
            job_id=job_id,
            audio_path=audio_path,
            audio_sha256=audio_sha256,
            lyrics=list(lyrics),
            use_demucs=use_demucs,
        )
        with self._lock:
            self._jobs[job_id] = job
            self._persist_locked(job)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, *, status: str | None = None,
               error: str | None = None, result: dict | None = None,
               log_line: str | None = None) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if log_line is not None:
                job.log(log_line)
            if status is not None:
                job.transition(status, error=error, result=result)
            elif error is not None or result is not None:
                job.updated_at = time.time()
                if error is not None:
                    job.error = error
                if result is not None:
                    job.result = result
            self._persist_locked(job)
            return job

    def all_jobs(self) -> Iterable[Job]:
        with self._lock:
            return list(self._jobs.values())

    # -- disk ----------------------------------------------------------------

    def _persist_locked(self, job: Job) -> None:
        path = self._jobs_dir / f"{job.job_id}.json"
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(job.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)

    def reload_from_disk(self) -> None:
        """Re-hydrate jobs from cache/jobs/*.json at startup. Best effort."""
        if not self._jobs_dir.exists():
            return
        for path in sorted(self._jobs_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                job = Job(**{k: v for k, v in data.items() if k in Job.__dataclass_fields__})
            except Exception:
                # Corrupt files are skipped; never block startup.
                continue
            with self._lock:
                self._jobs[job.job_id] = job


# Module-level singleton — FastAPI handlers and the background thread share this.
registry = JobRegistry()
