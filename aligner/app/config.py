"""Runtime configuration for the singing-aligner service.

All values are read from environment variables (with sensible defaults) so the
service can be deployed unchanged to different machines. Nothing here should
trigger heavy imports — configuration is pure stdlib.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _default_cache_root() -> Path:
    override = os.environ.get("ALIGN_CACHE_ROOT")
    if override:
        return Path(override).expanduser().resolve()
    # Default lives next to the project so a bare `python -m app.main` works
    # without any setup. Falls back to a tmp dir if the project tree is read-only.
    project_cache = Path(__file__).resolve().parent.parent / "cache"
    try:
        project_cache.mkdir(parents=True, exist_ok=True)
        return project_cache
    except OSError:
        return Path(tempfile.gettempdir()) / "singing-aligner"


@dataclass(frozen=True)
class Settings:
    # HTTP
    host: str = os.environ.get("ALIGN_HOST", "0.0.0.0")
    port: int = int(os.environ.get("ALIGN_PORT", "8088"))
    log_level: str = os.environ.get("ALIGN_LOG_LEVEL", "info")

    # Filesystem
    cache_root: Path = field(default_factory=_default_cache_root)
    jobs_dir_name: str = "jobs"
    demucs_cache_name: str = "demucs"

    # Demucs pluggable shell command. Supports {input} {output_dir} {cache_dir}
    # placeholders. Empty string disables Demucs entirely.
    demucs_cmd: str = os.environ.get("ALIGN_DEMUCS_CMD", "")

    # faster-whisper config (only consulted at job time, never imported here)
    whisper_model: str = os.environ.get("ALIGN_WHISPER_MODEL", "Systran/faster-whisper-small")
    whisper_device: str = os.environ.get("ALIGN_WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.environ.get("ALIGN_WHISPER_COMPUTE_TYPE", "int8")

    # Safety limits
    max_audio_bytes: int = int(os.environ.get("ALIGN_MAX_AUDIO_BYTES", str(50 * 1024 * 1024)))
    job_ttl_seconds: int = int(os.environ.get("ALIGN_JOB_TTL_SECONDS", str(6 * 3600)))

    # Misc
    enable_demucs: bool = field(default_factory=lambda: _env_bool("ALIGN_ENABLE_DEMUCS", True))

    # -- derived properties --------------------------------------------------

    @property
    def jobs_dir(self) -> Path:
        d = self.cache_root / self.jobs_dir_name
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def demucs_cache_dir(self) -> Path:
        d = self.cache_root / self.demucs_cache_name
        d.mkdir(parents=True, exist_ok=True)
        return d

    def demucs_is_runnable(self) -> bool:
        """Demucs is only attempted when there's a configured command."""
        return bool(self.demucs_cmd.strip())


def get_settings() -> Settings:
    """Construct a fresh Settings. Cheap; safe to call per-request if needed."""
    return Settings()


settings = get_settings()
