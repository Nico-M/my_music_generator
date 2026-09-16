"""Regression tests for short-fragment / cursor-advancement fixes.

Run with::

    python -m pytest tests/test_align.py -q
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from worker.align import align_lyrics_to_words, aligned_to_dicts


def _make_words(pairs: Iterable[tuple[str, int, int]]) -> list[dict]:
    return [{"word": w, "start_ms": s, "end_ms": e, "score": 0.9} for w, s, e in pairs]


# ---------------------------------------------------------------------------
# Regression: short-fragment overconfidence
# ---------------------------------------------------------------------------


class ShortFragmentRegressionTests(unittest.TestCase):
    """Long lyrics must NOT match a 1-2 character ASR fragment with high confidence."""

    def test_long_chinese_line_does_not_match_tiny_fragment(self) -> None:
        """A 7-char lyric must not match a single 2-char ASR word at high confidence."""
        words = _make_words([
            ("种相", 40740, 41260),
            ("痛", 62370, 62750),
        ])
        lyrics = ["我會唾棄 自己的寬容"]
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=lyrics))
        self.assertEqual(len(result), 1)
        self.assertLess(result[0]["confidence"], 0.45)
        self.assertNotEqual(result[0]["matchedText"], "种相")

    def test_failed_match_does_not_advance_cursor_to_end(self) -> None:
        """A failed first line must not collapse all subsequent lines at the same time."""
        words = _make_words([
            ("种相", 1000, 1200),
            ("痛", 2000, 2200),
            ("hello", 3000, 3300),
            ("world", 3400, 3700),
        ])
        lyrics = [
            "我會唾棄 自己的寬容",
            "hello world",
        ]
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=lyrics))
        self.assertEqual(len(result), 2)
        self.assertLess(result[0]["confidence"], 0.45)
        self.assertGreater(result[1]["confidence"], 0.45)
        self.assertGreater(result[1]["endMs"], result[1]["startMs"])

    def test_normal_multiline_alignment_still_works(self) -> None:
        """Regular English alignment must still produce monotonically increasing timestamps."""
        words = _make_words([
            ("hello", 0, 400),
            ("world", 500, 900),
            ("good", 1200, 1500),
            ("night", 1600, 1900),
        ])
        lyrics = ["hello world", "good night"]
        result = aligned_to_dicts(align_lyrics_to_words(words=words, lyrics=lyrics))
        self.assertEqual(len(result), 2)
        self.assertGreater(result[0]["confidence"], 0.45)
        self.assertGreater(result[1]["confidence"], 0.45)
        self.assertLessEqual(result[0]["endMs"], result[1]["endMs"])

    def test_partial_coverage_keeps_matched_lines(self) -> None:
        """Falling below the coverage threshold must fill gaps, not discard matches.

        Two of five lines match (0.4 < FALLBACK_MIN_VALID_RATIO), which used to
        trigger a whole-song proportional rewrite that threw away the two exact
        timestamps along with everything else.
        """
        words = _make_words([
            ("a", 0, 100),
            ("b", 100, 200),
            ("hello", 300, 600),
            ("world", 600, 900),
            ("x", 1000, 1100),
        ])
        lyrics = ["zzz", "yyy", "hello world", "qqq", "www"]
        result = aligned_to_dicts(
            align_lyrics_to_words(words=words, lyrics=lyrics, audio_duration_ms=5000)
        )
        self.assertEqual(len(result), 5)

        # The one line that genuinely matched keeps its acoustic timestamps.
        self.assertEqual(result[2]["startMs"], 300)
        self.assertEqual(result[2]["endMs"], 900)
        self.assertEqual(result[2]["matchedText"], "helloworld")
        self.assertGreater(result[2]["confidence"], 0.45)

        # Everything else is filled so the timeline stays gap-free.
        for line in result:
            self.assertGreater(line["endMs"], line["startMs"])

    def test_all_lines_unmatched_still_falls_back(self) -> None:
        """When nothing matches, every line is still filled proportionally."""
        words = _make_words([("a", 0, 100), ("b", 100, 200)])
        lyrics = ["zzz", "yyy", "qqq"]
        result = aligned_to_dicts(
            align_lyrics_to_words(words=words, lyrics=lyrics, audio_duration_ms=5000)
        )
        self.assertEqual(len(result), 3)
        for line in result:
            self.assertGreater(line["endMs"], line["startMs"])
            self.assertEqual(line["matchedText"], "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
