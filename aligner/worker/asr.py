"""Lazy wrapper around faster-whisper for word-level ASR.

faster-whisper is imported *only* on first use, never at module load. If the
package isn't installed, we raise a clear ``RuntimeError`` so the job surfaces
a useful failure to the caller rather than a cryptic ``ImportError`` deeper
down.

Returns a list of word dicts::

    [{ "word": "你好", "start_ms": 0, "end_ms": 320, "score": 0.93 }, ...]
"""
from __future__ import annotations

import logging
from typing import Callable, Optional

log = logging.getLogger(__name__)


def transcribe_words(
    *,
    audio_path: str,
    model_name: str,
    device: str,
    compute_type: str,
    on_log: Optional[Callable[[str], None]] = None,
) -> list[dict]:
    """Run faster-whisper on ``audio_path`` and return word-level segments.

    Raises ``RuntimeError`` if faster-whisper is not installed, or
    ``Exception`` for genuine ASR failures (network, audio decode, etc.).
    """
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "faster-whisper is not installed. "
            "Install it with: pip install faster-whisper"
        ) from exc

    if on_log:
        on_log(f"loading faster-whisper model={model_name!r} device={device!r} compute={compute_type!r}")
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"failed to load WhisperModel({model_name}): {exc!s}") from exc

    if on_log:
        on_log("transcribing audio (this can take a while for long files)...")
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        vad_filter=True,
        language="zh",  # singing is Chinese in this project's domain; can be made configurable later
    )
    if on_log:
        on_log(f"whisper detected language={info.language} (prob={getattr(info, 'language_probability', '?')})")

    words: list[dict] = []
    for seg in segments:
        # If word_timestamps returns a list of Word objects, normalise them.
        seg_words = getattr(seg, "words", None) or []
        for w in seg_words:
            text = (getattr(w, "word", "") or "").strip()
            if not text:
                continue
            start = getattr(w, "start", None)
            end = getattr(w, "end", None)
            if start is None or end is None:
                continue
            words.append({
                "word": text,
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
                "score": float(getattr(w, "probability", 0.0) or 0.0),
            })
    if not words:
        # Fallback: maybe the model didn't emit word-level info; emit the segment
        # text as a single pseudo-word so downstream alignment still has *something*.
        for seg in segments:
            text = (seg.text or "").strip()
            if not text:
                continue
            start = seg.start or 0.0
            end = seg.end or (start + 0.01)
            words.append({
                "word": text,
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
                "score": 0.0,
            })
    if on_log:
        on_log(f"asr emitted {len(words)} word units")
    return words


__all__ = ["transcribe_words"]
