"""Top-level job runner. Wires Demucs + ASR (dual) + alignment together.

This module is imported by ``app.main`` for ``run_job`` but never imports
faster-whisper / demucs at module load — those happen in ``worker.asr`` and
``worker.demucs_runner`` respectively, lazily.

Dual ASR strategy
-----------------
When Demucs vocal separation is used, the pipeline runs ASR on *both* the
separated vocals file AND the original audio, then picks whichever gives
better coverage (more words, higher confidence, longer time coverage).
This helps when Demucs accidentally attenuates vocal content.
"""
from __future__ import annotations

import logging
from typing import Callable, Optional

from app.config import settings
from app.jobs import registry
from worker import align as align_mod
from worker import asr as asr_mod
from worker import demucs_runner

log = logging.getLogger(__name__)

StateCallback = Callable[[str, str, Optional[str], Optional[dict]], None]
LogCallback = Callable[[str, str], None]

# ---------------------------------------------------------------------------
# ASR scoring — pick the transcription with the best coverage
# ---------------------------------------------------------------------------

ASR_SOURCE_VOCALS = "vocals"
ASR_SOURCE_ORIGINAL = "original"


def _score_asr_result(words: list[dict], audio_duration_ms: float) -> float:
    """Score an ASR result for ranking.

    Higher is better.  Considers:
    - word count
    - coverage ratio (last_word_end / audio_duration)
    - average word confidence
    """
    if not words:
        return 0.0
    word_count = len(words)
    last_end = max((w.get("end_ms", 0) or 0) for w in words)
    coverage_ratio = min(last_end / max(audio_duration_ms, 1), 1.0)
    avg_confidence = sum(w.get("score", 0.0) or 0.0 for w in words) / word_count
    return (
        word_count * 0.4
        + coverage_ratio * 100.0 * 0.5
        + avg_confidence * 10.0
    )


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def run_job(
    *,
    job_id: str,
    audio_path: str,
    lyrics: list[str],
    use_demucs: bool,
    audio_duration_ms: int | None = None,
    on_state: StateCallback,
    on_log: LogCallback,
) -> dict:
    """Execute the full pipeline. Returns the result dict (also stored on Job).

    State transitions emitted via ``on_state``:
        queued -> running -> done
                   :raw-lr:`failed` (on any error)
    """
    def _log(line: str) -> None:
        on_log(job_id, line)

    def _state(status: str, *, error: str | None = None, result: dict | None = None) -> None:
        on_state(job_id, status, error, result)

    _log("job started")
    _state("running")

    # ---- Step 1: vocal separation (optional) --------------------------------
    vocals_path: str | None = None
    if use_demucs and settings.demucs_is_runnable():
        try:
            job = registry.get(job_id)
            assert job is not None
            _log("step 1/3: vocal separation")
            separated = demucs_runner.maybe_separate_vocals(
                settings=settings,
                audio_path=audio_path,
                sha256=job.audio_sha256,
                on_log=_log,
            )
            if separated is not None:
                vocals_path = separated
        except Exception as exc:
            _log(f"demucs error (continuing with raw audio): {exc!s}")

    # ---- Step 2: ASR (dual if Demucs was used) ------------------------------
    _log("step 2/3: asr")

    # --- 2a: Transcribe the primary file (vocals or original) ----------------
    primary_path = vocals_path or audio_path
    try:
        primary_words = asr_mod.transcribe_words(
            audio_path=primary_path,
            model_name=settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            on_log=_log,
        )
    except RuntimeError as exc:
        _log(f"asr setup failed: {exc!s}")
        _state("failed", error=str(exc))
        return {"error": str(exc)}
    except Exception as exc:
        _log(f"asr crashed: {exc!r}")
        _state("failed", error=f"asr crashed: {exc!r}")
        return {"error": f"asr crashed: {exc!r}"}

    selected_words = primary_words
    selected_asr_source = ASR_SOURCE_VOCALS if vocals_path else ASR_SOURCE_ORIGINAL
    original_words: list[dict] | None = None
    vocals_words: list[dict] | None = primary_words if vocals_path else None

    # --- 2b: If Demucs was used, also transcribe original for comparison -----
    if vocals_path:
        _log("dual ASR: also transcribing original audio for comparison")
        try:
            original_words = asr_mod.transcribe_words(
                audio_path=audio_path,
                model_name=settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
                on_log=_log,
            )
        except Exception as exc:
            _log(f"dual ASR (original) failed, using vocals only: {exc!s}")
            original_words = None

        # --- 2c: Score both and pick the best ---------------------------------
        if original_words is not None:
            # Use real audio duration for coverage comparison (not estimated from words)
            # This makes coverage_ratio meaningful — without it, both sides always get ~100%
            real_duration = float(audio_duration_ms) if audio_duration_ms and audio_duration_ms > 0 else 0.0

            def _estimate_duration(words_list: list[dict]) -> float:
                if real_duration > 0:
                    return real_duration
                if not words_list:
                    return 0.0
                return max((w.get("end_ms", 0) or 0) for w in words_list)

            vocals_score = _score_asr_result(vocals_words or [], _estimate_duration(vocals_words or []))
            original_score = _score_asr_result(original_words, _estimate_duration(original_words))

            _log(f"ASR scores: vocals={vocals_score:.1f} original={original_score:.1f}")

            if original_score > vocals_score:
                _log(f"dual ASR: original audio scored higher ({original_score:.1f} > {vocals_score:.1f}), using original timestamps")
                selected_words = original_words
                selected_asr_source = ASR_SOURCE_ORIGINAL
            else:
                _log(f"dual ASR: vocals scored higher ({vocals_score:.1f} >= {original_score:.1f}), using vocals timestamps")
                # selected_words already = primary_words = vocals_words

    # ---- Step 3: alignment --------------------------------------------------
    _log("step 3/3: alignment")
    try:
        aligned = align_mod.align_lyrics_to_words(words=selected_words, lyrics=lyrics, audio_duration_ms=audio_duration_ms, on_log=_log)
    except RuntimeError as exc:
        _log(f"align setup failed: {exc!s}")
        _state("failed", error=str(exc))
        return {"error": str(exc)}
    except Exception as exc:
        _log(f"align crashed: {exc!r}")
        _state("failed", error=f"align crashed: {exc!r}")
        return {"error": f"align crashed: {exc!r}"}

    alignment_method = align_mod.detect_alignment_method(aligned)

    # ---- Estimate audio duration for metadata --------------------------------
    def _estimate_audio_duration() -> float:
        """Best-effort audio duration estimation from the selected words."""
        if selected_words:
            return max((w.get("end_ms", 0) or 0) for w in selected_words)
        return 0.0

    # ---- Compute coverage ratio -------------------------------------------
    _last_word_end = max((w.get("end_ms", 0) or 0) for w in selected_words) if selected_words else 0
    _real_duration = float(audio_duration_ms) if audio_duration_ms and audio_duration_ms > 0 else float(_last_word_end or 1)
    _coverage_ratio = round(min(_last_word_end / _real_duration, 1.0), 4)

    result: dict = {
        "lines": align_mod.aligned_to_dicts(aligned),
        "asr_word_count": len(selected_words),
        "used_vocals_separation": vocals_path is not None,
        "model": settings.whisper_model,
        "alignment_method": alignment_method,
        "selected_asr_source": selected_asr_source,
        "audio_duration_ms": audio_duration_ms,
        "asr_coverage_ratio": _coverage_ratio,
        "original_asr_word_count": len(original_words) if original_words is not None else None,
        "vocals_asr_word_count": len(vocals_words) if vocals_words is not None else None,
    }
    _log(f"alignment done: method={alignment_method} asr_source={selected_asr_source}")
    _state("done", result=result)
    return result


__all__ = ["run_job"]
