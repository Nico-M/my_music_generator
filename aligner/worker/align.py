"""Map an ordered list of lyrics lines onto ASR word timestamps.

Strategy
--------
1. Normalise both sides with pypinyin (Style.NORMAL, no tone marks).
   If pypinyin isn't installed we fall back to the raw characters — better
   than crashing; English / mixed text still aligns fine, Chinese will be
   noisier but the pipeline survives.

2. For each lyrics line, scan a window of *complete ASR words* (not
   arbitrary substrings) using rapidfuzz.fuzz.ratio and
   fuzz.partial_ratio blended with coverage and length penalties.

3. Only high-confidence matches (final_score >= 0.45) advance the
   word-level cursor. Failed matches emit a zero-confidence placeholder
   without moving the cursor forward, so remaining lines still have a
   chance to match.

4. If too many lines end up with zero-duration timestamps (greedy
   alignment consumed all ASR words too early), fall back to a
   proportional distribution: the audio interval [first_word.start_ms,
   last_word.end_ms] is divided among lyrics lines proportionally
   by their (normalised) character lengths.

Each returned line has::

    {
      "index": int,            # lyrics index (matches the input order)
      "startMs": int,          # window start in milliseconds
      "endMs":   int,          # window end in milliseconds
      "confidence": float,     # 0..1 blended score
      "matchedText": str       # complete ASR word(s) that matched
    }
"""
from __future__ import annotations

import difflib
import logging
from dataclasses import dataclass
from typing import Callable, Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_ACCEPT_SCORE = 0.45
"""Minimum final_score for a candidate to be accepted."""

FALLBACK_MAX_CONFIDENCE = 0.30
"""Confidence assigned to proportionally-fallback lines (low but non-zero)."""

FALLBACK_MIN_VALID_RATIO = 0.55
"""If fewer than this fraction of lines have a non-zero duration, fall back."""

# ---------------------------------------------------------------------------
# Lazy import helpers
# ---------------------------------------------------------------------------


def _load_pinyin_converter() -> Callable[[str], str]:
    """Return a function text -> space-separated pinyin.

    If pypinyin isn't installed we just return text unchanged.
    The fallback is intentionally dumb — better than crashing.
    """
    try:
        from pypinyin import Style, lazy_pinyin  # type: ignore

        def _convert(text: str) -> str:
            if not text:
                return ""
            return " ".join(lazy_pinyin(text, style=Style.NORMAL, errors=lambda x: x))

        return _convert
    except Exception:
        log.warning("pypinyin not available; using raw characters for matching (Chinese alignment will be noisy)")
        return lambda text: text or ""


def _load_rapidfuzz():
    """Import rapidfuzz.fuzz if available; return None otherwise.

    align_lyrics_to_words works without rapidfuzz — it falls back to
    difflib.SequenceMatcher so the pipeline still produces something
    useful when an operator hasn't installed optional deps yet.
    """
    try:
        from rapidfuzz import fuzz
        return fuzz
    except Exception as exc:
        log.warning("rapidfuzz not available (%s); falling back to difflib", exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@dataclass
class AlignedLine:
    index: int
    startMs: int
    endMs: int
    confidence: float
    matchedText: str = ""

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "startMs": self.startMs,
            "endMs": self.endMs,
            "confidence": self.confidence,
            "matchedText": self.matchedText,
        }


@dataclass
class MatchCandidate:
    """A candidate alignment window covering complete ASR words."""

    start_word: int
    end_word: int
    score: float
    coverage: float
    matched_text: str


def align_lyrics_to_words(
    *,
    words: list[dict],
    lyrics: list[str],
    audio_duration_ms: int | None = None,
    on_log: Optional[Callable[[str], None]] = None,
) -> list[AlignedLine]:
    """Run the alignment.

    Parameters
    ----------
    words : list of dicts as produced by worker.asr.transcribe_words
        with keys word, start_ms, end_ms (and optionally score).
    lyrics : ordered list of lyric line strings (Chinese / English / mixed).

    Returns
    -------
    list[AlignedLine] with one entry per non-empty lyrics line.
    """
    if not lyrics:
        return []

    fuzz = _load_rapidfuzz()
    convert = _load_pinyin_converter()

    # Build parallel arrays: raw words (for matchedText reconstruction)
    # and their normalised form (for similarity search).
    raw_words = [(w.get("word") or "").strip() for w in words]
    raw_times = [(int(w.get("start_ms", 0)), int(w.get("end_ms", 0))) for w in words]

    if not raw_words:
        if on_log:
            on_log("asr returned 0 words; emitting lyrics with zero-duration timestamps")
        return [
            AlignedLine(index=i, startMs=0, endMs=0, confidence=0.0, matchedText=ly)
            for i, ly in enumerate(lyrics)
            if ly.strip()
        ]

    norm_words = [convert(w) for w in raw_words]

    # ---- Greedy line-by-line alignment -----------------------------------
    aligned, cursor_word = _greedy_align(
        lyrics=lyrics,
        raw_words=raw_words,
        norm_words=norm_words,
        raw_times=raw_times,
        fuzz=fuzz,
        on_log=on_log,
    )

    # ---- Check coverage & fall back if too many zero-duration rows --------
    valid_count = sum(1 for a in aligned if a.startMs < a.endMs)
    total_count = len(aligned)
    valid_ratio = valid_count / max(total_count, 1)

    if valid_ratio < FALLBACK_MIN_VALID_RATIO and len(raw_words) > 0:
        if on_log:
            on_log(
                f"greedy alignment only covered {valid_count}/{total_count} lines "
                f"({valid_ratio:.0%}); applying proportional fallback"
            )
        # Use real audio duration for fallback end, NOT last ASR word time
        # This ensures lyrics are distributed across the full song, not just
        # the portion ASR managed to transcribe
        _fb_first_ms = raw_times[0][0] if raw_times else 0
        _fb_last_ms = audio_duration_ms if audio_duration_ms and audio_duration_ms > _fb_first_ms else (raw_times[-1][1] if len(raw_times) > 1 else raw_times[0][1])
        fallback = _proportional_fallback(
            lyrics=lyrics,
            words=words,
            first_ms=_fb_first_ms,
            last_ms=_fb_last_ms,
            on_log=on_log,
        )

        # The fallback is a whole-song estimate, so it must only fill the
        # lines greedy left empty — never overwrite a genuine acoustic match.
        # Without this, one unmatched line out of two drops coverage to 0.5,
        # trips the threshold, and silently discards the other line's exact
        # timestamps in favour of an even split.
        preserved = 0
        for i, prev in enumerate(aligned):
            if i < len(fallback) and prev.confidence > FALLBACK_MAX_CONFIDENCE and prev.startMs < prev.endMs:
                fallback[i] = prev
                preserved += 1
        if on_log and preserved:
            on_log(f"proportional fallback kept {preserved} matched line(s)")
        aligned = fallback

    return aligned


def aligned_to_dicts(aligned: list[AlignedLine]) -> list[dict]:
    return [a.to_dict() for a in aligned]


def detect_alignment_method(aligned: list[AlignedLine]) -> str:
    """Detect whether the alignment used greedy or proportional fallback.

    Useful for pipeline metadata: call after align_lyrics_to_words to determine
    the method.
    """
    if not aligned:
        return "no_lines"
    # If ALL non-empty lines have matchedText empty and low confidence,
    # it's proportional fallback
    non_empty = [a for a in aligned if a.matchedText or a.confidence > FALLBACK_MAX_CONFIDENCE]
    if not non_empty:
        return "proportional_fallback"
    valid_count = sum(1 for a in aligned if a.startMs < a.endMs)
    total_count = len(aligned)
    if valid_count / max(total_count, 1) >= FALLBACK_MIN_VALID_RATIO:
        return "fuzzy_greedy"
    return "proportional_fallback"


# ---------------------------------------------------------------------------
# Greedy word-window alignment
# ---------------------------------------------------------------------------


def _greedy_align(
    *,
    lyrics: list[str],
    raw_words: list[str],
    norm_words: list[str],
    raw_times: list[tuple[int, int]],
    fuzz,
    on_log: Optional[Callable[[str], None]] = None,
) -> tuple[list[AlignedLine], int]:
    """Original line-by-line greedy cursor alignment.

    Returns (aligned, cursor_word) where cursor_word is the first
    un-consumed ASR word index (for diagnostics).
    """
    n_words = len(norm_words)
    aligned: list[AlignedLine] = []
    cursor_word = 0

    for idx, line in enumerate(lyrics):
        if not line or not line.strip():
            last_ms = aligned[-1].endMs if aligned else 0
            aligned.append(AlignedLine(index=idx, startMs=last_ms, endMs=last_ms, confidence=0.0, matchedText=""))
            continue

        convert = _load_pinyin_converter()
        needle = convert(line).strip()
        if not needle:
            last_ms = aligned[-1].endMs if aligned else 0
            aligned.append(AlignedLine(index=idx, startMs=last_ms, endMs=last_ms, confidence=0.0, matchedText=""))
            continue

        # No more ASR words to scan
        if cursor_word >= n_words:
            aligned.append(_placeholder(idx, aligned))
            if on_log:
                on_log(f"line {idx}: no audio content remaining")
            continue

        candidate = _scan_best_word_window(
            needle=needle,
            raw_words=raw_words,
            norm_words=norm_words,
            cursor_word=cursor_word,
            fuzz=fuzz,
            n_words=n_words,
        )

        if candidate is None or candidate.score < MIN_ACCEPT_SCORE:
            best_score = candidate.score if candidate else 0.0
            aligned.append(_placeholder(idx, aligned))
            if on_log:
                on_log(f"line {idx}: no acceptable match (best={best_score:.2f})")
            continue

        # --- Accepted match -------------------------------------------------
        start_ms = raw_times[candidate.start_word][0]
        end_ms = raw_times[candidate.end_word][1]
        if end_ms <= start_ms:
            end_ms = start_ms + 1

        aligned.append(AlignedLine(
            index=idx,
            startMs=start_ms,
            endMs=end_ms,
            confidence=max(0.0, min(1.0, candidate.score)),
            matchedText=candidate.matched_text,
        ))
        cursor_word = candidate.end_word + 1

        if on_log:
            on_log(
                f"line {idx}: score={candidate.score:.2f} "
                f"cov={candidate.coverage:.2f} "
                f"span={start_ms}..{end_ms} "
                f"matched={candidate.matched_text!r}"
            )

    return aligned, cursor_word


def _scan_best_word_window(
    *,
    needle: str,
    raw_words: list[str],
    norm_words: list[str],
    cursor_word: int,
    fuzz,
    n_words: int | None = None,
) -> MatchCandidate | None:
    """Scan ASR words from cursor_word for the best window matching needle.

    Returns None when no window meets the minimum coverage requirements.
    """
    if n_words is None:
        n_words = len(norm_words)
    needle_tokens = max(1, len(needle.split()))
    max_words = min(n_words, max(needle_tokens * 3, 8))
    lookahead = min(n_words, max(max_words * 4, 40))

    best: MatchCandidate | None = None

    for start in range(cursor_word, min(n_words, cursor_word + lookahead)):
        for end in range(start, min(n_words, start + max_words)):
            candidate_norm = " ".join(norm_words[start:end + 1])
            if not candidate_norm.strip():
                continue

            if fuzz is not None:
                ratio_score = fuzz.ratio(needle, candidate_norm) / 100.0
                partial_score = fuzz.partial_ratio(needle, candidate_norm) / 100.0
            else:
                matcher = difflib.SequenceMatcher(None, needle, candidate_norm)
                ratio_score = matcher.ratio()
                partial_score = _fallback_partial_ratio(needle, candidate_norm)

            # Coverage: what fraction of the needle's length the candidate covers
            coverage = min(len(candidate_norm), len(needle)) / max(len(needle), 1)

            # Long-needle guardrails
            if len(needle) >= 12 and coverage < 0.45:
                continue
            if len(needle) >= 20 and coverage < 0.55:
                continue

            length_ratio = min(len(candidate_norm), len(needle)) / max(len(candidate_norm), len(needle), 1)

            final_score = (
                ratio_score * 0.55
                + partial_score * 0.25
                + coverage * 0.10
                + length_ratio * 0.10
            )

            if best is None or final_score > best.score:
                best = MatchCandidate(
                    start_word=start,
                    end_word=end,
                    score=final_score,
                    coverage=coverage,
                    matched_text="".join(raw_words[start:end + 1]).strip(),
                )

    return best


# ---------------------------------------------------------------------------
# Proportional fallback (when greedy alignment fails)
# ---------------------------------------------------------------------------


def _proportional_fallback(
    *,
    lyrics: list[str],
    words: list[dict],
    first_ms: int,
    last_ms: int,
    on_log: Optional[Callable[[str], None]] = None,
) -> list[AlignedLine]:
    """Distribute [first_ms, last_ms] across lyrics by character length.

    Each line's duration is proportional to its normalised character count
    (whitespace removed).  This is not "accurate" alignment but guarantees
    every line gets a non-zero, monotonically-increasing time interval.
    """
    total_duration = last_ms - first_ms
    if total_duration <= 0:
        if on_log:
            on_log("proportional fallback: zero-duration audio range, using 1 ms per line")
        result: list[AlignedLine] = []
        cursor = 0
        for idx, line in enumerate(lyrics):
            result.append(AlignedLine(
                index=idx, startMs=cursor, endMs=cursor + 1,
                confidence=FALLBACK_MAX_CONFIDENCE, matchedText="",
            ))
            cursor += 1
        return result

    # Compute weight per line: normalised character length (no spaces)
    weights: list[int] = []
    for line in lyrics:
        cleaned = "".join(line.split())
        weights.append(max(1, len(cleaned)))
    total_weight = sum(weights)

    result = []
    cursor_weight = 0
    for idx, line in enumerate(lyrics):
        if not line.strip():
            prev_end = result[-1].endMs if result else first_ms
            result.append(AlignedLine(
                index=idx, startMs=prev_end, endMs=prev_end,
                confidence=0.0, matchedText="",
            ))
            continue

        w = weights[idx]
        start_ratio = cursor_weight / max(total_weight, 1)
        end_ratio = (cursor_weight + w) / max(total_weight, 1)
        start_ms = first_ms + int(round(total_duration * start_ratio))
        end_ms = first_ms + int(round(total_duration * end_ratio))
        if end_ms <= start_ms:
            end_ms = start_ms + 1

        result.append(AlignedLine(
            index=idx,
            startMs=start_ms,
            endMs=end_ms,
            confidence=FALLBACK_MAX_CONFIDENCE,
            matchedText="",
        ))
        cursor_weight += w

    return result


# ---------------------------------------------------------------------------
# Fallback matching (when rapidfuzz is not available)
# ---------------------------------------------------------------------------


def _fallback_partial_ratio(needle: str, haystack: str) -> float:
    """Approximate fuzz.partial_ratio with difflib.SequenceMatcher."""
    nlen = len(needle)
    if nlen == 0 or len(haystack) <= nlen:
        return difflib.SequenceMatcher(None, needle, haystack).ratio()
    best = 0.0
    for i in range(len(haystack) - nlen + 1):
        r = difflib.SequenceMatcher(None, needle, haystack[i:i + nlen]).ratio()
        if r > best:
            best = r
    return best


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _placeholder(idx: int, so_far: list[AlignedLine]) -> AlignedLine:
    last_ms = so_far[-1].endMs if so_far else 0
    return AlignedLine(index=idx, startMs=last_ms, endMs=last_ms, confidence=0.0, matchedText="")


__all__ = ["AlignedLine", "align_lyrics_to_words", "aligned_to_dicts", "detect_alignment_method"]
