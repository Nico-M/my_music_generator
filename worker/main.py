"""
Worker main loop — polls SQLite for transcribe/align jobs and executes them.

Prisma uses camelCase column names (e.g., "projectId", "audioPath", "transcriptJson").
The `index` column in LyricLine is an SQLite reserved word, so it must be quoted: "index".
"""

import time
import sqlite3
import json
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
DB_PATH = os.environ.get("DATABASE_PATH", str(DATA_DIR / "sqlite.db"))
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", str(DATA_DIR / "uploads"))

POLL_INTERVAL = 5  # seconds


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    # WAL mode + busy_timeout to avoid "database is locked" when web + worker
    # write concurrently
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def poll_jobs():
    print(f"Worker started. Polling {DB_PATH} every {POLL_INTERVAL}s...")
    conn = get_connection()
    try:
        while True:
            cursor = conn.execute(
                """SELECT id, "projectId", params, type
                   FROM Job
                   WHERE status='queued'
                   AND type IN ('transcribe', 'align')
                   LIMIT 1"""
            )
            row = cursor.fetchone()
            if row:
                job_id = row["id"]
                project_id = row["projectId"]
                params_json = row["params"]
                job_type = row["type"]
                print(f"Processing job {job_id} ({job_type}) for project {project_id}")

                conn.execute(
                    "UPDATE Job SET status='running' WHERE id=?",
                    (job_id,),
                )
                conn.commit()

                try:
                    if job_type == "transcribe":
                        from transcribe import run_transcribe

                        run_transcribe(project_id, DB_PATH, UPLOADS_DIR)
                        print(f"Job {job_id} completed successfully")
                        conn.execute(
                            "UPDATE Job SET status='done' WHERE id=?",
                            (job_id,),
                        )
                    elif job_type == "align":
                        from align import run_align

                        run_align(project_id, DB_PATH, UPLOADS_DIR)
                        print(f"Job {job_id} completed successfully")
                        conn.execute(
                            "UPDATE Job SET status='done' WHERE id=?",
                            (job_id,),
                        )
                    else:
                        raise ValueError(f"Unknown job type: {job_type}")
                except Exception as e:
                    print(f"Job {job_id} failed: {e}")
                    conn.execute(
                        "UPDATE Job SET status='failed', error=? WHERE id=?",
                        (str(e), job_id),
                    )
                conn.commit()

            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("Worker stopped by user")
    finally:
        conn.close()


if __name__ == "__main__":
    poll_jobs()
