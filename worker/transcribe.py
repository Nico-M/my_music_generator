"""
Transcribe pipeline — uses faster-whisper to generate lyric drafts.

Pipeline:
1. Convert audio to 16kHz mono WAV via ffmpeg
2. Run faster-whisper with word_timestamps=True
3. Write transcribed lines to LyricLine table (source="transcribed")
4. Save full transcript JSON to Project.transcriptJson

⚠️ Prisma uses camelCase column names. All SQL column references are quoted.
⚠️ "index" is an SQLite reserved word — must be quoted as "index".
⚠️ Deletes ALL existing lines for the project (二选一：转写覆盖所有歌词).
"""

import json
import sqlite3
import os
import subprocess


def run_transcribe(project_id: str, db_path: str, uploads_dir: str):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row

    try:
        # 1. Get audio path from project
        row = conn.execute(
            'SELECT "audioPath" FROM Project WHERE "id"=?', (project_id,)
        ).fetchone()
        if row is None:
            raise ValueError(f"Project {project_id} not found")
        audio_path = row["audioPath"]

        # Resolve the audio file path
        # Audio paths are stored as /data/uploads/xxx.mp3
        # In the development environment, actual path is uploads_dir + filename
        filename = os.path.basename(audio_path)
        full_audio_path = os.path.join(uploads_dir, filename)

        if not os.path.exists(full_audio_path):
            raise FileNotFoundError(f"Audio file not found: {full_audio_path}")

        # 2. Convert to 16kHz mono WAV
        wav_path = os.path.join(
            uploads_dir, f"{os.path.splitext(filename)[0]}_16k.wav"
        )
        print(f"Converting {full_audio_path} -> {wav_path}")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                full_audio_path,
                "-acodec",
                "pcm_s16le",
                "-ac",
                "1",
                "-ar",
                "16000",
                wav_path,
            ],
            capture_output=True,
            check=True,
        )

        # 3. Run faster-whisper
        from faster_whisper import WhisperModel

        print("Loading Whisper model...")
        model = WhisperModel("base", device="cpu", compute_type="int8")
        print("Transcribing...")
        segments, info = model.transcribe(
            wav_path, word_timestamps=True, language="zh"
        )
        # ⚠️ segments is a lazy generator — materialize immediately
        segments = list(segments)
        print(f"Transcribed {len(segments)} segments")

        # 4. Collect word-level timestamps + segment texts
        words = []
        segment_texts = []
        for seg in segments:
            segment_texts.append(
                {"start": seg.start, "end": seg.end, "text": seg.text}
            )
            if seg.words:
                for word in seg.words:
                    words.append(
                        {"word": word.word, "start": word.start, "end": word.end}
                    )

        transcript_data = {"segments": segment_texts, "words": words}

        # 5. Write transcribed lines to LyricLine
        #    ⚠️ Delete ALL existing lines — transcribe replaces everything (二选一)
        conn.execute(
            'DELETE FROM LyricLine WHERE "projectId"=?',
            (project_id,),
        )

        for idx, seg in enumerate(segment_texts):
            line_id = f"{project_id}_t{idx}"
            conn.execute(
                """INSERT INTO LyricLine ("id", "projectId", "index", "text", "startMs", "endMs", "source")
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    line_id,
                    project_id,
                    idx,
                    seg["text"],
                    int(seg["start"] * 1000),
                    int(seg["end"] * 1000),
                    "transcribed",
                ),
            )

        # 6. Save full transcript to Project.transcriptJson
        conn.execute(
            'UPDATE Project SET "transcriptJson"=? WHERE "id"=?',
            (json.dumps(transcript_data, ensure_ascii=False), project_id),
        )

        conn.commit()
        print(f"Transcribe completed for project {project_id}")

        # Cleanup WAV file
        if os.path.exists(wav_path):
            os.remove(wav_path)

    finally:
        conn.close()
