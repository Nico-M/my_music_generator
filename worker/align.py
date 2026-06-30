"""
Align pipeline — uses faster-whisper word timestamps + pinyin-aware matching
to align user-confirmed lyrics to audio.

How it works:
1. Load user's confirmed lyrics and transcriptJson (word timestamps) from DB
2. Convert both user lyrics and ASR word text to pinyin
3. Use rapidfuzz to find best-matching ASR word sequence for each user line
4. Map matched word positions to timestamps
5. Low-confidence lines get weighted fallback from remaining audio duration
6. Write aligned results to LyricLine (source="aligned")

对比 JS 端 assisted：
- pypinyin 处理中文字音转换：ASR 可能写错字但拼音是对的
- rapidfuzz 模糊匹配更强
- 利用整个词序列而非滑窗，全局匹配更稳
"""

import json
import sqlite3
import os
import math

try:
    from pypinyin import lazy_pinyin, Style
except ImportError:
    # Fallback if pypinyin not available
    def lazy_pinyin(text, style=None):
        return list(text)

    class Style:
        NORMAL = None


def text_to_pinyin(text: str) -> list[str]:
    """Convert Chinese text to pinyin list for matching."""
    text = text.strip().lower()
    try:
        # Get pinyin without tone marks for fuzzy matching
        return lazy_pinyin(text, style=Style.TONE3)
    except Exception:
        # Fallback: return characters
        return list(text)


def run_align(project_id: str, db_path: str, uploads_dir: str):
    """Run alignment: match user lyrics to ASR word timestamps."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row

    try:
        # 1. Load project with lines and transcript
        project = conn.execute(
            'SELECT "id", "transcriptJson", "durationMs" FROM Project WHERE "id"=?',
            (project_id,),
        ).fetchone()
        if project is None:
            raise ValueError(f"Project {project_id} not found")
        if not project["transcriptJson"]:
            raise ValueError("请先运行识别歌词 (Run ASR transcription first)")

        transcript_data = json.loads(project["transcriptJson"])
        words = transcript_data.get("words", [])
        duration_ms = project["durationMs"] or 0

        # Get segments total duration as fallback
        segments = transcript_data.get("segments", [])
        if duration_ms <= 0 and segments:
            duration_ms = int(segments[-1]["end"] * 1000)

        # 2. Load user lyrics lines
        rows = conn.execute(
            'SELECT "id", "index", "text" FROM LyricLine WHERE "projectId"=? ORDER BY "index" ASC',
            (project_id,),
        ).fetchall()
        if not rows:
            raise ValueError("用户还没有歌词 (User has no lyrics yet)")

        line_ids = {row["index"]: row["id"] for row in rows}
        user_lines = [
            {"index": row["index"], "text": row["text"]} for row in rows
        ]

        if not words:
            # No word timestamps — use segment timestamps directly
            _align_from_segments(conn, project_id, line_ids, user_lines, segments, duration_ms)
            conn.commit()
            print(f"Align completed for project {project_id} (from segments, no word timestamps)")
            return

        # 3. Build pinyin index for ASR words
        # word_pinyin[i] = pinyin list for words[i].word
        word_texts = []
        word_pinyins = []
        for w in words:
            txt = w.get("word", "").strip().lower()
            word_texts.append(txt)
            word_pinyins.append(text_to_pinyin(txt))

        # 4. Match each user line to a segment of ASR words
        from rapidfuzz import fuzz

        matched_lines = 0
        word_cursor = 0
        results = []

        for ul in user_lines:
            if not ul["text"].strip():
                results.append({"index": ul["index"], "startMs": 0, "endMs": 0, "confidence": 0})
                continue

            # Convert user line to pinyin
            user_py = text_to_pinyin(ul["text"])
            user_py_str = " ".join(user_py)

            best_start = word_cursor
            best_end = word_cursor
            best_score = 0

            # Search forward for best matching word span
            # Try different window sizes: from 1 to ~3x user pinyin length
            max_window = min(word_cursor + len(user_py) * 4 + 10, len(word_texts))

            for start in range(word_cursor, max_window):
                for end in range(start + 1, min(start + len(user_py) * 5 + 5, len(word_texts)) + 1):
                    # Build combined word text for this span
                    span_text = "".join(word_texts[start:end])
                    span_py = []
                    for wl in word_pinyins[start:end]:
                        span_py.extend(wl)
                    span_py_str = " ".join(span_py)

                    # Score: mix of pinyin similarity and character overlap
                    py_score = fuzz.ratio(user_py_str, span_py_str) / 100.0
                    char_score = fuzz.partial_ratio(ul["text"].strip().lower(), span_text) / 100.0
                    combined = py_score * 0.7 + char_score * 0.3

                    if combined > best_score:
                        best_score = combined
                        best_start = start
                        best_end = end

            if best_score >= 0.35 and best_end > best_start:
                start_sec = words[best_start]["start"]
                end_sec = words[best_end - 1]["end"]
                results.append({
                    "index": ul["index"],
                    "startMs": int(start_sec * 1000),
                    "endMs": int(end_sec * 1000),
                    "confidence": round(best_score, 2),
                })
                word_cursor = best_end
                matched_lines += 1
            else:
                results.append({"index": ul["index"], "startMs": 0, "endMs": 0, "confidence": 0})

        # 5. Fallback: fill unmatched lines with weighted distribution
        _fill_unmatched(results, duration_ms)

        # 6. Write results to DB
        for r in results:
            line_id = line_ids.get(r["index"])
            if not line_id:
                continue
            conn.execute(
                """UPDATE LyricLine
                   SET "startMs"=?, "endMs"=?, "source"='aligned', "confidence"=?
                   WHERE "id"=?""",
                (r["startMs"] if r["startMs"] > 0 else None,
                 r["endMs"] if r["endMs"] > 0 else None,
                 r["confidence"],
                 line_id),
            )

        conn.commit()
        matched = sum(1 for r in results if r["confidence"] > 0)
        fallback = sum(1 for r in results if r["confidence"] == 0)
        print(f"Align completed for project {project_id}: {matched}/{len(results)} matched, {fallback} fallback")

    finally:
        conn.close()


def _align_from_segments(
    conn, project_id, line_ids, user_lines, segments, duration_ms
):
    """Fallback alignment using segment text + timestamps (no word timestamps)."""
    from rapidfuzz import fuzz

    seg_cursor = 0
    results = []

    for ul in user_lines:
        if not ul["text"].strip():
            results.append({"index": ul["index"], "startMs": 0, "endMs": 0, "confidence": 0})
            continue

        best_idx = -1
        best_score = 0

        for i in range(seg_cursor, len(segments)):
            score = fuzz.ratio(ul["text"].strip().lower(), segments[i]["text"].strip().lower()) / 100.0
            if score > best_score:
                best_score = score
                best_idx = i

        if best_idx >= 0 and best_score >= 0.3:
            seg = segments[best_idx]
            results.append({
                "index": ul["index"],
                "startMs": int(seg["start"] * 1000),
                "endMs": int(seg["end"] * 1000),
                "confidence": round(best_score, 2),
            })
            seg_cursor = best_idx + 1
        else:
            results.append({"index": ul["index"], "startMs": 0, "endMs": 0, "confidence": 0})

    _fill_unmatched(results, duration_ms)

    for r in results:
        line_id = line_ids.get(r["index"])
        if not line_id:
            continue
        conn.execute(
            """UPDATE LyricLine
               SET "startMs"=?, "endMs"=?, "source"='aligned', "confidence"=?
               WHERE "id"=?""",
            (r["startMs"] if r["startMs"] > 0 else None,
             r["endMs"] if r["endMs"] > 0 else None,
             r["confidence"],
             line_id),
        )


def _fill_unmatched(results: list, duration_ms: int):
    """Fill unmatched lines (confidence=0) with equal time distribution."""
    if duration_ms <= 0:
        return

    # Find matched lines and define blocks
    block_start = 0
    block_time_start = 0.0

    for i, r in enumerate(results):
        if r["confidence"] > 0 and r["endMs"] > 0:
            # Fill preceding block
            if i > block_start:
                _fill_block(results, block_start, i, block_time_start, r["startMs"])
            block_start = i + 1
            block_time_start = r["endMs"]

    # Fill trailing block
    if len(results) > block_start:
        _fill_block(results, block_start, len(results), block_time_start, duration_ms)

    # Ensure last line ends at duration
    if results:
        last = results[-1]
        if last["endMs"] < duration_ms * 0.9:
            results[-1] = {**last, "endMs": duration_ms}


def _fill_block(results: list, start: int, end: int, time_start: float, time_end: float):
    """Fill a block of lines equally within [time_start, time_end)."""
    count = end - start
    available = time_end - time_start
    if count <= 0 or available <= 0:
        return

    each = available / count
    for i in range(start, end):
        s = time_start + (i - start) * each
        e = s + each if i < end - 1 else time_end
        results[i]["startMs"] = int(s)
        results[i]["endMs"] = int(e)
