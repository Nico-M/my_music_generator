# singing-aligner

A small FastAPI service that aligns a list of lyrics lines to an audio
file and returns per-line start/end timestamps. Built as a companion to
a local Web project that just wants to POST an audio + a lyrics array
and get back a karaoke-style timeline.

Pipeline per job:

```
audio bytes ──▶ Demucs vocal separation (optional, cached)
            ──▶ faster-whisper word-level ASR
            ──▶ pypinyin + rapidfuzz monotonic window matching
            ──▶ JSON {lines: [{index, startMs, endMs, confidence, matchedText}]}
```

Heavy ML deps (faster-whisper, demucs/torch) are imported **lazily** —
the HTTP server starts and `/health` answers even if they are not
installed. They only load the first time a job actually runs.

---

## Layout

```
singing-aligner/
├── app/
│   ├── config.py        # Settings dataclass (env-var driven)
│   ├── jobs.py          # In-memory + on-disk job registry
│   └── main.py          # FastAPI: /health, /align, /jobs/{job_id}
├── worker/
│   ├── demucs_runner.py # Pluggable vocal separation (ALIGN_DEMUCS_CMD)
│   ├── asr.py           # faster-whisper wrapper (lazy import)
│   ├── align.py         # pypinyin + rapidfuzz monotonic matcher
│   └── pipeline.py      # Wires the three steps together
├── tests/
│   └── test_align.py    # Hermetic unit tests
├── cache/               # Created at runtime; holds jobs + Demucs cache
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Run

```bash
cd ~/services/singing-aligner
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# torch / torchaudio only if you actually intend to use Demucs.
# pip install torch torchaudio

python -m app.main
# → uvicorn listening on 127.0.0.1:8088 by default
```

Test the server from another terminal:

```bash
curl -s http://127.0.0.1:8088/health
# {"status":"ok","version":"0.1.0","demucs_configured":false,"whisper_model":"Systran/faster-whisper-base","cache_root":".../cache"}

curl -s -X POST http://127.0.0.1:8088/align \
  -F 'file=@/path/to/song.wav' \
  -F 'lyrics_json=["第一句歌词","第二句歌词","第三句歌词"]' \
  -F 'use_demucs=false'
# {"job_id":"abc123ef4567","status":"queued"}

curl -s http://127.0.0.1:8088/jobs/abc123ef4567 | python3 -m json.tool
```

Run tests:

```bash
python -m unittest discover -s tests -v
# or, if you prefer pytest:
python -m pytest tests/ -q
```

---

## Environment variables

All settings are optional; defaults are chosen so the service can start
with `python -m app.main` and no env-vars.

| Var                         | Default                              | Purpose |
|-----------------------------|--------------------------------------|---------|
| `ALIGN_HOST`                | `127.0.0.1`                          | Bind address |
| `ALIGN_PORT`                | `8088`                               | Bind port |
| `ALIGN_LOG_LEVEL`           | `info`                               | uvicorn log level |
| `ALIGN_CACHE_ROOT`          | `<project>/cache`                    | Where jobs + Demucs cache live |
| `ALIGN_DEMUCS_CMD`          | *(empty)*                            | Shell template; supports `{input} {output_dir} {cache_dir}` |
| `ALIGN_WHISPER_MODEL`       | `Systran/faster-whisper-base`        | HuggingFace repo id |
| `ALIGN_WHISPER_DEVICE`      | `cpu`                                | `cpu` / `cuda` |
| `ALIGN_WHISPER_COMPUTE_TYPE`| `int8`                               | `int8` / `float16` / `float32` |
| `ALIGN_MAX_AUDIO_BYTES`     | `52428800` (50 MB)                   | Hard upload limit |
| `ALIGN_JOB_TTL_SECONDS`     | `21600` (6 h)                        | Reserved for future cleanup |
| `ALIGN_ENABLE_DEMUCS`       | `true`                               | Toggle Demucs entirely (requires cmd) |

### Configuring Demucs

Demucs is treated as an external command — the service `subprocess.run`s
the template you provide and looks for a `vocals.*` file in the output.
This means **PyTorch never has to load inside the HTTP process**, which
keeps memory usage low and crashes isolated.

```bash
# Example: default Demucs install on PATH
export ALIGN_DEMUCS_CMD='demucs --two-stems vocals -n htdemucs -o {output_dir} {input}'

# Disable vocal separation entirely (the default):
export ALIGN_DEMUCS_CMD=''
```

The first job for any given audio file pays the full Demucs cost; subsequent
uploads of the same bytes are served from a SHA-256-keyed cache in
`$ALIGN_CACHE_ROOT/demucs/`.

---

## Endpoint reference

### `GET /health`

Returns `{status, version, demucs_configured, whisper_model, cache_root}`.
No heavy imports happen — safe to use as a liveness probe.

### `POST /align`

`multipart/form-data` fields:

| Field         | Required | Description |
|---------------|----------|-------------|
| `file`        | yes      | Raw audio bytes (wav / mp3 / flac / m4a) |
| `lyrics_json` | yes      | JSON array of strings, e.g. `["line 1","line 2"]` |
| `filename`    | no       | Filename hint, defaults to `audio` |
| `use_demucs`  | no       | `true` / `false`, default `true`. Forced to `false` if `ALIGN_DEMUCS_CMD` is empty. |

Response: `202 Accepted` with `{"job_id": "<12-hex>", "status": "queued"}`.

Job processing runs in a daemon thread — the request returns immediately.

### `GET /jobs/{job_id}`

Returns the full job snapshot, including:

```json
{
  "job_id": "abc123ef4567",
  "status": "done",                       // queued | running | done | failed
  "created_at": 1719798234.56,
  "updated_at": 1719798251.02,
  "audio_path": ".../upload-.../song.wav",
  "audio_sha256": "8a7f…",
  "lyrics": ["第一句","第二句"],
  "use_demucs": true,
  "error": null,
  "result": {
    "lines": [
      {"index": 0, "startMs": 420, "endMs": 1820, "confidence": 0.91, "matchedText": "第一句歌词"},
      {"index": 1, "startMs": 2000, "endMs": 3400, "confidence": 0.88, "matchedText": "第二句歌词"}
    ],
    "asr_word_count": 142,
    "used_vocals_separation": true,
    "model": "Systran/faster-whisper-base"
  },
  "logs": ["[...]: received upload (...)", "[...]: step 1/3: vocal separation", ...]
}
```

The same object is mirrored to `cache/jobs/{job_id}.json` for
post-mortem inspection.

---

## Wiring the local Web project

Your Web project needs to talk to this service. The canonical pattern is
for the Web frontend to read a `REMOTE_ALIGN_URL` environment variable
and POST to it. Recommended setup:

```bash
# 1. Decide a URL the Web frontend can reach
export REMOTE_ALIGN_URL="http://127.0.0.1:8088"

# 2. Start this service on the same host
cd ~/services/singing-aligner
python -m app.main &

# 3. In your Web project, point it at the aligner:
export REMOTE_ALIGN_URL="http://127.0.0.1:8088"
yarn dev   # or whatever runs the Web frontend
```

If the Web frontend and the aligner run on **different machines** (e.g.
the Web is in Docker and this service is on the Mac mini), either:

* SSH-tunnel: `ssh -L 8088:127.0.0.1:8088 your-host` and use
  `http://127.0.0.1:8088` from the Web side; or
* Bind to LAN: set `ALIGN_HOST=0.0.0.0`, then use
  `http://<mac-mini-lan-ip>:8088` from the Web side — but be aware the
  endpoint is unauthenticated and uploads up to 50 MB.

The Web client only needs a tiny fetch helper:

```js
async function align(file, lyrics) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("lyrics_json", JSON.stringify(lyrics));
  fd.append("use_demucs", "false"); // start here
  const { job_id } = await fetch(`${process.env.REMOTE_ALIGN_URL}/align`, {
    method: "POST", body: fd,
  }).then(r => r.json());

  for (;;) {
    await new Promise(r => setTimeout(r, 1000));
    const job = await fetch(`${process.env.REMOTE_ALIGN_URL}/jobs/${job_id}`).then(r => r.json());
    if (job.status === "done") return job.result;
    if (job.status === "failed") throw new Error(job.error);
  }
}
```

---

## What's *not* in this drop

To stay deterministic and reviewable, this drop skips anything that
needs a network round-trip or GB-sized wheels:

* **No model download.** faster-whisper pulls the model the first time it
  runs — on a machine without that download, jobs fail with a clear
  error pointing at the model id.
* **No Demucs install.** torch / torchaudio are deliberately omitted
  from `requirements.txt`. Set `ALIGN_DEMUCS_CMD` only after you have
  installed both.
* **No auth / no rate limit.** Single-machine trust model. Drop a
  reverse proxy in front if exposing wider than loopback.
* **No job GC.** Snapshots pile up in `cache/jobs/`. Wire a cron to
  `rm -f cache/jobs/*.json` older than `ALIGN_JOB_TTL_SECONDS`.

---

## Next integration steps

When you are ready to move beyond the smoke test:

1. **Decide on Demucs.** Either keep it on (install torch + Demucs) or
   leave `ALIGN_DEMUCS_CMD=''` and rely on faster-whisper alone. For
   Mandarin pop with heavy accompaniment, Demucs noticeably improves
   word recall.
2. **Pin the Whisper size.** `faster-whisper-base` is the smallest; for
   Chinese singing you may want `faster-whisper-small` or `-medium`
   (`ALIGN_WHISPER_MODEL=Systran/faster-whisper-small`). Each step up
   roughly doubles the model size and runtime.
3. **Validate on real audio.** Run a known song through `/align`, eyeball
   the returned `lines[]`, and tune `ALIGN_DEMUCS_CMD` / model choice.
4. **Lock down the socket.** Bind to LAN (`ALIGN_HOST=0.0.0.0`) only
   after adding auth (an nginx + bearer token in front is the cheapest
   option).
5. **Add job GC.** A nightly cron that deletes `cache/jobs/*.json` older
   than `ALIGN_JOB_TTL_SECONDS` keeps the directory bounded.
