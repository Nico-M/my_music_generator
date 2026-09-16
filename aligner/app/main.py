"""FastAPI entrypoint.

Endpoints:
    GET  /health          — liveness probe, no heavy imports.
    POST /align           — multipart: file=audio, lyrics_json=<string>, use_demucs=bool.
                            Returns {"job_id": "..."}, runs pipeline in a background thread.
    GET  /jobs/{job_id}   — returns the current job snapshot (status, error, result, logs).

Heavy dependencies (faster-whisper, demucs, torch) are NEVER imported here. They
are imported lazily inside ``worker.pipeline.run_job`` so the HTTP server can
start on a machine without them.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import settings
from .jobs import registry  # noqa: F401  (re-exported for tests)
from .jobs import Job
from worker.pipeline import run_job

log = logging.getLogger("singing-aligner")

app = FastAPI(title="singing-aligner", version="0.1.0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_lyrics_json(raw: str) -> list[str]:
    """Accept either a JSON array of strings, or a single string fallback."""
    if raw is None or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"lyrics_json is not valid JSON: {exc}") from exc
    if isinstance(data, str):
        return [data]
    if isinstance(data, list):
        out: list[str] = []
        for item in data:
            if not isinstance(item, str):
                raise HTTPException(status_code=400, detail="lyrics_json must be a list of strings")
            out.append(item)
        return out
    raise HTTPException(status_code=400, detail="lyrics_json must be a JSON array of strings")


def _safe_filename(name: str, fallback: str = "audio") -> str:
    """Sanitize an uploaded filename and keep its extension (Demucs/ffmpeg need it).

    - Strips any directory components (``/``, ``\\``) and parent traversal (``..``).
    - Falls back to ``fallback`` when the resulting stem is empty.
    - Ensures the result has a suffix; if the sanitized stem has none, we append ``.bin``
      so downstream tools at least see *some* extension. We do NOT silently substitute
      a known audio suffix — the caller's content-type / actual bytes are the source
      of truth.
    """
    raw = Path(name or "").name  # strip directory components
    # Drop any remaining path separators that Path(name).name wouldn't strip
    # (e.g. Windows-style backslashes on POSIX, or odd unicode).
    raw = raw.replace("/", "_").replace("\\", "_")

    # Parent-traversal collapse: neuter any ``..`` segment so callers can't
    # escape jobs_dir. We replace the bare ``..`` token with ``_`` *before*
    # stripping, so callers like ``".."`` or ``"....m4a"`` land on something
    # we can reason about below.
    raw = raw.replace("..", "_").strip()

    if not raw:
        return fallback

    # "Nothing but punctuation" — e.g. ``...``, ``.`` after the ``..`` collapse
    # became ``_._`` (or similar). If stripping ``.`` and ``_`` leaves nothing,
    # there is no usable stem or extension here.
    if not raw.strip("._"):
        return fallback

    # Extension-only inputs (``".m4a"``): the caller gave us a suffix but no stem.
    # Use the fallback as the stem so the result is actually addressable.
    if raw.startswith(".") and raw.count(".") == 1 and len(raw) > 1:
        return f"{fallback}{raw.lower()}"

    # Normal path: split stem / suffix, then sanity-check the stem.
    suffix = Path(raw).suffix.lower()
    stem = Path(raw).stem
    if not stem or stem.strip("._") == "":
        # Stem collapsed to nothing after sanitization — fall back, but keep
        # any suffix the caller provided (already lower-cased).
        return f"{fallback}{suffix}" if suffix else fallback
    if not suffix:
        suffix = ".bin"
    return f"{stem}{suffix}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": app.version,
        "demucs_configured": settings.demucs_is_runnable(),
        "whisper_model": settings.whisper_model,
        "cache_root": str(settings.cache_root),
    }


@app.post("/align")
async def align(
    file: UploadFile = File(..., description="Audio upload (wav / mp3 / m4a / flac / …)"),
    lyrics_json: str = Form(..., description='JSON string, e.g. ["第一句","第二句"]'),
    filename: str | None = Form(default=None, description="Optional override for the saved filename"),
    use_demucs: bool = Form(default=True),
    audio_duration_ms: int | None = Form(default=None),
) -> JSONResponse:
    # Pick the filename we actually want on disk:
    #   1. explicit ``filename`` form field (if caller knows better than the browser did)
    #   2. ``upload.filename`` from the multipart part
    #   3. fallback ``audio`` (no extension will then be added by _safe_filename)
    requested_name = (
        (filename or "").strip()
        or (file.filename or "").strip()
        or "audio"
    )
    safe_name = _safe_filename(requested_name, fallback="audio")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="audio file is required")
    if len(data) > settings.max_audio_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"audio too large: {len(data)} > {settings.max_audio_bytes}",
        )

    lyrics = _parse_lyrics_json(lyrics_json)
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics_json is empty")

    # Persist upload to a stable per-job temp dir so the worker can re-open it.
    # We MUST keep the extension (Demucs / ffmpeg sniff by suffix), hence the
    # work done in ``_safe_filename`` above.
    job_dir = settings.jobs_dir / f"upload-{int(time.time() * 1000)}-{os.urandom(4).hex()}"
    job_dir.mkdir(parents=True, exist_ok=True)
    audio_path = job_dir / safe_name
    audio_path.write_bytes(data)

    audio_sha256 = _sha256_file(audio_path)

    job = registry.create(
        audio_path=str(audio_path),
        audio_sha256=audio_sha256,
        lyrics=lyrics,
        use_demucs=bool(use_demucs) and settings.demucs_is_runnable(),
    )
    job.log(
        f"received upload ({len(data)} bytes), saved_as={safe_name!r}, "
        f"upload_filename={file.filename!r}, override_filename={filename!r}, "
        f"sha256={audio_sha256[:12]}..., lyrics={len(lyrics)}, duration_ms={audio_duration_ms}"
    )

    # Background thread — keeps the HTTP request cheap and unblocks the client.
    t = threading.Thread(
        target=_run_job_thread,
        args=(job.job_id, str(audio_path), lyrics, job.use_demucs, audio_duration_ms),
        daemon=True,
        name=f"align-{job.job_id}",
    )
    t.start()

    return JSONResponse({"job_id": job.job_id, "status": job.status}, status_code=202)


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = registry.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.to_dict()


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _run_job_thread(job_id: str, audio_path: str, lyrics: list[str], use_demucs: bool, audio_duration_ms: int | None = None) -> None:
    """Wrapper so a worker crash surfaces as a failed job, not a 500 mid-request."""
    try:
        run_job(
            job_id=job_id,
            audio_path=audio_path,
            lyrics=lyrics,
            use_demucs=use_demucs,
            audio_duration_ms=audio_duration_ms,
            on_log=lambda jid, line: registry.update(jid, log_line=line),
            on_state=lambda jid, status, error=None, result=None:
                registry.update(jid, status=status, error=error, result=result),
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("job %s crashed", job_id)
        registry.update(job_id, status="failed", error=f"internal: {exc!r}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    import uvicorn
    registry.reload_from_disk()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    main()
