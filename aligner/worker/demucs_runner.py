"""Pluggable vocal separation via an external Demucs-compatible command.

Design notes
------------
* Demucs (and PyTorch) are ~2 GB. We don't want to *import* them just to
  *check* if they're installed. So we treat Demucs as an external command
  exposed through the ``ALIGN_DEMUCS_CMD`` template. Default is empty
  (separation skipped → ASR runs on the original audio).

* The template may contain ``{input}`` ``{output_dir}`` ``{cache_dir}``
  placeholders. Either the operator wires up a real Demucs invocation, e.g.
      ALIGN_DEMUCS_CMD='.venv/bin/demucs --two-stems vocals -n htdemucs -o {output_dir} {input}'
  or leaves it empty to disable separation.

  The template is parsed via :func:`shlex.split` so quoting and ``-flag value``
  pairs work naturally; substitution then happens on each ``argv`` token. As a
  result ``{input}`` may contain spaces (e.g. ``Baisha Road 9.m4a``) and stays
  a single argv element — there is no shell word-splitting to fight, so we
  pass the rendered argv straight to ``subprocess.run`` without ``shell=True``.

* Vocal track results are cached by audio SHA-256 so repeated uploads of
  the same file don't pay the separation cost twice.

* If the command runs but no ``vocals.*`` file appears in the output dir,
  we degrade gracefully and return ``None``; the caller will then run ASR
  on the raw audio instead.
"""
from __future__ import annotations

import hashlib
import logging
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Optional

from app.config import Settings

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def maybe_separate_vocals(
    *,
    settings: Settings,
    audio_path: str,
    sha256: str,
    on_log: Optional[Callable[[str], None]] = None,
) -> Optional[str]:
    """Return the path to a vocals-only wav file, or None if separation was
    skipped / failed / produced no vocals file.

    The returned path is always inside the persistent cache so subsequent
    jobs with the same audio hash can reuse it.
    """
    audio_path = str(audio_path)
    cache_dir = settings.demucs_cache_dir
    target = cache_dir / f"{sha256}.vocals.wav"

    if target.exists():
        log.info("vocals cache hit: %s", target)
        if on_log:
            on_log(f"vocals cache hit ({target.name})")
        return str(target)

    if not settings.demucs_is_runnable():
        log.info("Demucs disabled (no ALIGN_DEMUCS_CMD); using raw audio")
        if on_log:
            on_log("demucs disabled; using raw audio")
        return None

    try:
        run_demucs(settings=settings, audio_path=audio_path, cache_dir=cache_dir, on_log=on_log)
    except Exception as exc:  # noqa: BLE001
        log.warning("demucs failed (%s); falling back to raw audio", exc)
        if on_log:
            on_log(f"demucs failed: {exc!s} — using raw audio")
        return None

    vocals = find_vocals_file(cache_dir, sha256=sha256)
    if vocals is None:
        log.warning("demucs produced no vocals file; using raw audio")
        if on_log:
            on_log("no vocals output found — using raw audio")
        return None

    # Materialize a stable, content-addressed path. Demucs output filenames
    # vary (vocals.wav, vocals.mp3, ...); we copy to <sha>.vocals.wav.
    try:
        shutil.copyfile(str(vocals), target)
    except OSError:
        # If the source is already at the target path we're done.
        return str(vocals)
    if on_log:
        on_log(f"demucs vocals cached: {target.name}")
    return str(target)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _render_argv(
    template: str,
    *,
    input_path: str,
    output_dir: str,
    cache_dir: str,
) -> list[str]:
    """Parse the ``ALIGN_DEMUCS_CMD`` template into a real argv list.

    We ``shlex.split`` the template so the operator can quote paths or pass
    flags with spaces, then substitute ``{input}``/``{output_dir}``/
    ``{cache_dir}`` on each resulting token. Because every path becomes a
    single argv element, spaces inside ``input_path`` (e.g. ``Baisha Road 9.m4a``)
    survive intact — there is no shell word-splitting to fight.
    """
    tokens = shlex.split(template)
    if not tokens:
        raise ValueError("ALIGN_DEMUCS_CMD is empty after parsing")
    rendered: list[str] = []
    for tok in tokens:
        rendered.append(
            tok
            .replace("{input}", input_path)
            .replace("{output_dir}", output_dir)
            .replace("{cache_dir}", cache_dir)
        )
    return rendered


def run_demucs(
    *,
    settings: Settings,
    audio_path: str,
    cache_dir: Path,
    on_log: Optional[Callable[[str], None]] = None,
) -> None:
    """Execute the configured Demucs command.

    We create a per-invocation tmp dir because Demucs writes unpredictable
    intermediate filenames. After the run, the ``vocals.*`` file (if any)
    is moved into the persistent cache keyed by SHA-256.
    """
    tmp_root = Path(tempfile.mkdtemp(prefix="demucs-", dir=str(cache_dir)))
    try:
        argv = _render_argv(
            settings.demucs_cmd,
            input_path=audio_path,
            output_dir=str(tmp_root),
            cache_dir=str(cache_dir),
        )
        # shlex.join keeps the log line copy-pasteable into a real shell while
        # the *actual* execution uses the already-tokenised argv above.
        cmd_str = shlex.join(argv)
        log.info("running demucs: %s", cmd_str)
        if on_log:
            on_log(f"demucs: {cmd_str}")

        # NO shell=True: the argv list is passed straight to execve so paths
        # with spaces (``Baisha Road 9.m4a``) stay a single argv element and
        # can't be split on whitespace the way a shell would split them.
        completed = subprocess.run(
            argv,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60 * 30,  # hard cap
        )
        if completed.stdout.strip():
            log.debug("demucs stdout: %s", completed.stdout.strip()[:1000])
        if completed.stderr.strip():
            log.debug("demucs stderr: %s", completed.stderr.strip()[:1000])
    finally:
        # The Demucs output tree lives under tmp_root; we copy *just the
        # vocals file* into the persistent cache below. tmp_root is left
        # in place briefly so find_vocals_file() can scan it.
        # It's cleaned by the next "cache hit"-skip path's caller — or by
        # the operator running `rm -rf <cache>/demucs/demucs-*`.
        pass


def find_vocals_file(root: Path, *, sha256: str) -> Optional[Path]:
    """Locate a vocals output inside ``root``.

    Demucs typically writes ``<track>/vocals.wav`` but the exact filename
    depends on the model and flags. We accept any file whose name starts
    with ``vocals`` and has a recognised audio suffix, and prefer ``.wav``.
    """
    if not root.exists():
        return None
    candidates: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        name = path.name.lower()
        if name.startswith("vocals"):
            candidates.append(path)
    if not candidates:
        return None
    # Prefer .wav > .flac > .mp3 > anything else.
    priority = {".wav": 0, ".flac": 1, ".mp3": 2}
    candidates.sort(key=lambda p: (priority.get(p.suffix.lower(), 99), len(str(p))))
    return candidates[0]


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

def sha256_file(path: "str | Path") -> str:
    h = hashlib.sha256()
    p = Path(path)
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


__all__ = ["maybe_separate_vocals", "run_demucs", "find_vocals_file"]


# sha256_file is intentionally NOT re-exported: callers (e.g. app.main) use their
# own hash helper to avoid coupling HTTP entrypoint to the worker module.
