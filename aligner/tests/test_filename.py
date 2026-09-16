"""Tests for filename sanitization and the multipart /align contract.

These are pure-stdlib tests so they run anywhere without pytest / TestClient.
For the FastAPI layer we use ``fastapi.testclient.TestClient`` — it ships with
fastapi itself, so no extra dependency is required.
"""
from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import _safe_filename  # noqa: E402


class SafeFilenameTests(unittest.TestCase):
    """Pure unit tests — no FastAPI, no network."""

    def test_keeps_extension(self) -> None:
        self.assertEqual(_safe_filename("song.m4a"), "song.m4a")
        self.assertEqual(_safe_filename("song.MP3"), "song.mp3")
        self.assertEqual(_safe_filename("my song (final).wav"), "my song (final).wav")

    def test_strips_directory_traversal(self) -> None:
        # ``..`` must NOT collapse into a parent — that would let callers escape jobs_dir.
        self.assertNotIn("..", _safe_filename("../../etc/passwd"))
        self.assertNotIn("/", _safe_filename("a/b/c.wav"))
        self.assertNotIn("\\", _safe_filename(r"a\b\c.wav"))

    def test_strips_windows_separators(self) -> None:
        # Path(name).name doesn't strip backslashes on POSIX.
        self.assertEqual(_safe_filename(r"evil\name.m4a"), "evil_name.m4a")

    def test_empty_falls_back(self) -> None:
        self.assertEqual(_safe_filename(""), "audio")
        self.assertEqual(_safe_filename(None), "audio")  # type: ignore[arg-type]
        self.assertEqual(_safe_filename("..."), "audio")
        self.assertEqual(_safe_filename("////"), "audio")

    def test_extension_only_keeps_stem_with_fallback(self) -> None:
        self.assertEqual(_safe_filename(".m4a", fallback="audio"), "audio.m4a")

    def test_no_extension_gets_bin_suffix(self) -> None:
        # We refuse to silently *guess* an audio suffix; .bin makes it obvious
        # something's off and still gives Demucs something to look at.
        result = _safe_filename("audioblob")
        self.assertTrue(result.endswith(".bin"))
        self.assertTrue(result.startswith("audioblob"))

    def test_custom_fallback(self) -> None:
        self.assertEqual(_safe_filename("", fallback="clip"), "clip")
        self.assertEqual(_safe_filename("..", fallback="clip"), "clip")

    def test_unicode_stem_kept(self) -> None:
        self.assertEqual(_safe_filename("测试.wav"), "测试.wav")


class AlignEndpointTests(unittest.TestCase):
    """End-to-end tests for POST /align using FastAPI's in-process TestClient.

    We don't actually run the worker pipeline — we monkeypatch
    ``worker.pipeline.run_job`` to a no-op so the test stays fast and hermetic.
    """

    @classmethod
    def setUpClass(cls) -> None:
        # Import here so the path is already set up above.
        from fastapi.testclient import TestClient  # noqa: WPS433

        import worker.pipeline as pipeline_mod
        from app.main import app
        from app.jobs import registry

        cls._pipeline_mod = pipeline_mod
        cls.registry = registry

        # Replace run_job with a stub that flips the job to succeeded.
        def _stub_run_job(job_id, audio_path, lyrics, use_demucs, on_log, on_state):
            on_log(job_id, f"stub: audio={audio_path} lyrics={len(lyrics)}")
            on_state(job_id, "succeeded", error=None, result={"audio": audio_path, "lyrics": lyrics})

        cls._original_run_job = pipeline_mod.run_job
        pipeline_mod.run_job = _stub_run_job  # type: ignore[assignment]

        # Use a temp cache root so tests don't pollute the real cache.
        import tempfile
        from app.config import Settings
        cls._tmp_cache = Path(tempfile.mkdtemp(prefix="aligner-test-"))

        # Important: app.main imported ``settings`` at module load. To swap
        # the limit/cache for tests we patch the *same* binding on app.main.
        from app import main as main_mod
        cls._main_mod = main_mod
        cls._original_main_settings = main_mod.settings
        main_mod.settings = Settings(cache_root=cls._tmp_cache)  # type: ignore[attr-defined]

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._pipeline_mod.run_job = cls._original_run_job
        cls._main_mod.settings = cls._original_main_settings
        # Best-effort cleanup of temp cache.
        import shutil
        if cls._tmp_cache.exists():
            shutil.rmtree(cls._tmp_cache, ignore_errors=True)

    def _post_audio(self, *, filename: str, override: str | None = None, body: bytes = b"FAKE"):
        files = {"file": (filename, io.BytesIO(body), "audio/mpeg")}
        form = {"lyrics_json": '["hi"]'}
        if override is not None:
            form["filename"] = override
        return self.client.post("/align", files=files, data=form)

    def test_upload_filename_used_when_no_override(self) -> None:
        r = self._post_audio(filename="real_song.m4a")
        self.assertEqual(r.status_code, 202, r.text)
        job_id = r.json()["job_id"]
        job = self.registry.get(job_id)
        self.assertIsNotNone(job)
        self.assertTrue(job.audio_path.endswith(".m4a"),
                        f"expected .m4a extension, got {job.audio_path!r}")
        self.assertNotIn("..", Path(job.audio_path).name)

    def test_override_form_filename_takes_precedence(self) -> None:
        r = self._post_audio(filename="real_song.m4a", override="renamed.wav")
        self.assertEqual(r.status_code, 202, r.text)
        job = self.registry.get(r.json()["job_id"])
        self.assertTrue(job.audio_path.endswith(".wav"))
        self.assertIn("renamed.wav", job.audio_path)

    def test_no_filename_falls_back_to_audio(self) -> None:
        # Multipart ``filename=""`` would be rejected by Starlette, so we send a
        # name with no extension — the sanitizer should still produce a usable
        # filename (with .bin) so Demucs/ffmpeg see something.
        r = self._post_audio(filename="audioblob")
        self.assertEqual(r.status_code, 202, r.text)
        job = self.registry.get(r.json()["job_id"])
        name = Path(job.audio_path).name
        self.assertTrue(name.endswith(".bin"))
        self.assertTrue(name.startswith("audioblob"))

    def test_path_traversal_neutralized(self) -> None:
        r = self._post_audio(filename="../../etc/passwd.wav")
        self.assertEqual(r.status_code, 202, r.text)
        job = self.registry.get(r.json()["job_id"])
        name = Path(job.audio_path).name
        self.assertNotIn("..", name)
        self.assertNotIn("/", name)
        self.assertTrue(name.endswith(".wav"))

    def test_oversize_rejected_with_413(self) -> None:
        # Build a payload just over the configured limit.
        from app.config import Settings
        limit = 1024
        big = b"\x00" * (limit + 1)
        # Temporarily swap in a tiny-limit settings on the SAME binding main.py uses.
        original = self._main_mod.settings
        self._main_mod.settings = Settings(cache_root=self._tmp_cache, max_audio_bytes=limit)
        try:
            r = self._post_audio(filename="big.wav", body=big)
        finally:
            self._main_mod.settings = original
        self.assertEqual(r.status_code, 413, r.text)
        self.assertIn("audio too large", r.text)

    def test_empty_file_rejected_with_400(self) -> None:
        r = self._post_audio(filename="empty.wav", body=b"")
        self.assertEqual(r.status_code, 400, r.text)

    def test_health_endpoint(self) -> None:
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")


if __name__ == "__main__":  # pragma: no cover
    unittest.main(verbosity=2)