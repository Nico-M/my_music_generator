"""Tests for ``worker.demucs_runner``.

These are pure-stdlib tests: no Demucs, no PyTorch, no audio I/O. We mock
``subprocess.run`` so we can assert exactly what argv the worker hands to the
OS — that's what callers get hung up on when audio filenames contain spaces
(e.g. ``Baisha Road 9.m4a``) and the shell would otherwise word-split them.
"""
from __future__ import annotations

import shlex
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings  # noqa: E402
from worker import demucs_runner  # noqa: E402


# The default template as the operator currently runs it in the launchctl job.
DEFAULT_TEMPLATE = ".venv/bin/demucs --two-stems vocals -n htdemucs -o {output_dir} {input}"


def _completed_proc(*, stdout: str = "", stderr: str = "") -> mock.Mock:
    """Build a mock that quacks like ``subprocess.CompletedProcess``."""
    cp = mock.Mock()
    cp.stdout = stdout
    cp.stderr = stderr
    cp.returncode = 0
    return cp


class RenderArgvTests(unittest.TestCase):
    """Unit tests for the tokeniser; no subprocess involved."""

    def test_default_template_renders_expected_argv(self) -> None:
        argv = demucs_runner._render_argv(  # noqa: SLF001 — intentional
            DEFAULT_TEMPLATE,
            input_path="/cache/jobs/song.m4a",
            output_dir="/cache/demucs/demucs-abc",
            cache_dir="/cache/demucs",
        )
        self.assertEqual(
            argv,
            [
                ".venv/bin/demucs",
                "--two-stems", "vocals",
                "-n", "htdemucs",
                "-o", "/cache/demucs/demucs-abc",
                "/cache/jobs/song.m4a",
            ],
        )

    def test_input_path_with_spaces_stays_single_token(self) -> None:
        """The regression: 'Baisha Road 9.m4a' must be ONE argv element."""
        argv = demucs_runner._render_argv(  # noqa: SLF001
            DEFAULT_TEMPLATE,
            input_path="/cache/jobs/Baisha Road 9.m4a",
            output_dir="/cache/demucs/demucs-abc",
            cache_dir="/cache/demucs",
        )
        self.assertEqual(argv[-1], "/cache/jobs/Baisha Road 9.m4a")
        # Critically: the rendered argv must NOT contain the three split
        # words as separate elements. If it did, demucs would see the file
        # /cache/jobs/Baisha as "the input" and complain.
        self.assertNotIn("/cache/jobs/Baisha", argv[:-1])
        self.assertNotIn("Road", argv[:-1])
        self.assertNotIn("9.m4a", argv[:-1])
        # Default template has 7 tokens before substitution; {input} adds 1.
        self.assertEqual(len(argv), 8)

    def test_quoted_paths_in_template_are_parsed(self) -> None:
        """If an operator quotes a path inside ALIGN_DEMUCS_CMD, we honour it.

        POSIX shell rules apply: a path with embedded whitespace must be
        quoted in the template so ``shlex.split`` keeps it together.
        """
        argv = demucs_runner._render_argv(  # noqa: SLF001
            "'/usr/local/bin/with space/demucs' -n htdemucs {input}",
            input_path="/cache/jobs/song.m4a",
            output_dir="/tmp/out",
            cache_dir="/cache/demucs",
        )
        self.assertEqual(argv[0], "/usr/local/bin/with space/demucs")
        self.assertEqual(argv[-1], "/cache/jobs/song.m4a")

    def test_cache_dir_placeholder_supported(self) -> None:
        argv = demucs_runner._render_argv(  # noqa: SLF001
            "demucs --out {cache_dir}/out -n htdemucs {input}",
            input_path="song.m4a",
            output_dir="/tmp/x",
            cache_dir="/var/cache/demucs",
        )
        # The {cache_dir} substitution happens inside one argv token.
        self.assertIn("/var/cache/demucs/out", argv)
        self.assertEqual(argv[-1], "song.m4a")

    def test_empty_template_raises(self) -> None:
        with self.assertRaises(ValueError):
            demucs_runner._render_argv(  # noqa: SLF001
                "   ",  # all whitespace → no tokens
                input_path="song.m4a",
                output_dir="/tmp/x",
                cache_dir="/cache",
            )

    def test_round_trip_through_shlex_join(self) -> None:
        """The log line (shlex.join) should be pasteable into a real shell
        and yield the same argv we hand to subprocess."""
        argv = demucs_runner._render_argv(  # noqa: SLF001
            DEFAULT_TEMPLATE,
            input_path="/cache/jobs/Baisha Road 9.m4a",
            output_dir="/cache/demucs/demucs-abc",
            cache_dir="/cache/demucs",
        )
        rendered = shlex.join(argv)
        self.assertEqual(shlex.split(rendered), argv)


class RunDemucsInvocationTests(unittest.TestCase):
    """Confirm ``run_demucs`` calls subprocess.run with the right argv
    and crucially *without* ``shell=True``."""

    def setUp(self) -> None:
        import tempfile

        self._tmp = Path(tempfile.mkdtemp(prefix="aligner-demucs-test-"))

    def tearDown(self) -> None:
        import shutil as _sh
        _sh.rmtree(self._tmp, ignore_errors=True)

    def _make_settings(self, **overrides) -> Settings:
        kwargs = dict(cache_root=self._tmp)
        kwargs.update(overrides)
        return Settings(**kwargs)

    def test_subprocess_run_called_with_argv_no_shell(self) -> None:
        settings = self._make_settings(demucs_cmd=DEFAULT_TEMPLATE)
        cache_dir = self._tmp / "demucs"
        cache_dir.mkdir(parents=True, exist_ok=True)

        with mock.patch.object(
            demucs_runner.subprocess, "run", return_value=_completed_proc()
        ) as run_mock, mock.patch.object(
            demucs_runner, "find_vocals_file", return_value=None
        ):
            # is_runnable gates on whether to attempt subprocess at all.
            self.assertTrue(settings.demucs_is_runnable())
            demucs_runner.run_demucs(
                settings=settings,
                audio_path=str(self._tmp / "jobs" / "Baisha Road 9.m4a"),
                cache_dir=cache_dir,
            )

        self.assertEqual(run_mock.call_count, 1)
        kwargs = run_mock.call_args.kwargs

        # The first positional arg is the argv list, NOT a string.
        argv = run_mock.call_args[0][0]
        self.assertIsInstance(argv, list)
        # shell=True must NOT be present.
        self.assertNotIn("shell", kwargs)
        # We want to confirm the last argv element is the full space-bearing path.
        self.assertEqual(argv[-1], str(self._tmp / "jobs" / "Baisha Road 9.m4a"))
        # And the demucs binary is element 0, not a shell wrapper.
        self.assertEqual(argv[0], ".venv/bin/demucs")

    def test_subprocess_uses_known_safe_kwargs(self) -> None:
        """We pass check / capture / text / timeout — but never shell=True."""
        settings = self._make_settings(demucs_cmd="demucs {input}")
        cache_dir = self._tmp / "demucs"
        cache_dir.mkdir(parents=True, exist_ok=True)
        with mock.patch.object(
            demucs_runner.subprocess, "run", return_value=_completed_proc()
        ) as run_mock, mock.patch.object(
            demucs_runner, "find_vocals_file", return_value=None
        ):
            demucs_runner.run_demucs(
                settings=settings,
                audio_path=str(self._tmp / "song.m4a"),
                cache_dir=cache_dir,
            )
        kwargs = run_mock.call_args.kwargs
        self.assertTrue(kwargs.get("check"))
        self.assertIs(kwargs.get("stdout"), demucs_runner.subprocess.PIPE)
        self.assertIs(kwargs.get("stderr"), demucs_runner.subprocess.PIPE)
        self.assertTrue(kwargs.get("text"))
        self.assertEqual(kwargs.get("timeout"), 60 * 30)


if __name__ == "__main__":  # pragma: no cover
    unittest.main(verbosity=2)
