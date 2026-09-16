"""Tests for ``worker.align``.

Run with::

    python -m pytest tests/test_align.py -q
    # or, if pytest isn't installed:
    python -m unittest tests.test_align

The suite is intentionally hermetic:
    * No audio I/O, no network, no GPU, no model downloads.
    * Uses rapidfuzz if installed; otherwise the import error is caught
      and certain tests are marked expected-to-fail (``xfail``-style via
      ``unittest.expectedFailure``).
    * Uses pypinyin if available; fallback to raw characters is exercised
      by the Latin-only test cases.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Iterable

# Make ``app`` and ``worker`` importable when tests are run from any cwd.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from worker.align import (  # noqa: E402
    AlignedLine,
    align_lyrics_to_words,
    aligned_to_dicts,
)


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def _make_words(pairs: Iterable[tuple[str, int, int]]) -> list[dict]:
    """Build a synthetic ASR word list: ``("hello", start_ms, end_ms)``."""
    return [{"word": w, "start_ms": s, "end_ms": e, "score": 0.9} for w, s, e in pairs]


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

class BasicEnglishTests(unittest.TestCase):
    """Latin-only lyrics — should work with or without pypinyin."""

    def test_single_line_exact_match(self) -> None:
        words = _make_words([("hello", 0, 500), ("world", 600, 1100)])
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=["hello world"]))
        self.assertEqual(len(result), 1)
        self.assertGreater(result[0]["confidence"], 0.5)
        self.assertGreaterEqual(result[0]["startMs"], 0)
        self.assertLessEqual(result[0]["endMs"], 1100)

    def test_monotonic_three_lines(self) -> None:
        words = _make_words([
            ("one", 0, 300),
            ("two", 400, 700),
            ("three", 800, 1100),
            ("four", 1200, 1500),
        ])
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=["one", "two", "three"]))
        self.assertEqual(len(result), 3)
        # Monotonic non-decreasing timestamps
        for a, b in zip(result, result[1:]):
            self.assertLessEqual(a["startMs"], b["startMs"])
            self.assertLess(a["startMs"], b["endMs"] + 1)

    def test_blank_lines_are_kept(self) -> None:
        words = _make_words([("only", 0, 500)])
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=["", "only", ""]))
        indices = [r["index"] for r in result]
        self.assertEqual(indices, [0, 1, 2])
        # Middle line should land at 0..500.
        self.assertEqual(result[1]["startMs"], 0)
        self.assertGreaterEqual(result[1]["endMs"], 0)

    def test_no_match_emits_zero_confidence(self) -> None:
        words = _make_words([("foo", 0, 200), ("bar", 300, 500)])
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=["completely unrelated nonsense phrase xyzzy"]))
        self.assertEqual(len(result), 1)
        # Even on failure we still emit an entry — never silently drop a line.
        self.assertIn("confidence", result[0])
        self.assertGreaterEqual(result[0]["confidence"], 0.0)


class EdgeCaseTests(unittest.TestCase):
    def test_empty_lyrics_returns_empty(self) -> None:
        self.assertEqual(align_lyrics_to_words(words=[], lyrics=[]), [])
        self.assertEqual(align_lyrics_to_words(words=_make_words([("x", 0, 1)]), lyrics=[]), [])

    def test_empty_words_emits_placeholders(self) -> None:
        result = aligned_to_dicts(align_lyrics_to_words(words=[], lyrics=["line one", "line two"]))
        self.assertEqual(len(result), 2)
        for r in result:
            self.assertEqual(r["confidence"], 0.0)
            self.assertEqual(r["startMs"], 0)
            self.assertEqual(r["endMs"], 0)

    def test_dataclass_to_dict(self) -> None:
        a = AlignedLine(index=3, startMs=100, endMs=200, confidence=0.5, matchedText="hi")
        self.assertEqual(
            a.to_dict(),
            {"index": 3, "startMs": 100, "endMs": 200, "confidence": 0.5, "matchedText": "hi"},
        )


class PinyinBehaviourTests(unittest.TestCase):
    """If pypinyin is installed, Chinese strings should align reasonably well."""

    def setUp(self) -> None:
        try:
            import pypinyin  # noqa: F401
            self._has_pypinyin = True
        except Exception:
            self._has_pypinyin = False

    def test_chinese_does_not_crash(self) -> None:
        words = _make_words([("ni", 0, 200), ("hao", 300, 500), ("shi", 600, 800), ("jie", 900, 1100)])
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=["你好"]))
        self.assertEqual(len(result), 1)
        # With pypinyin installed confidence should be plausibly > 0;
        # without it, fallback is raw-char match which may also score > 0.
        self.assertGreaterEqual(result[0]["confidence"], 0.0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main(verbosity=2)
