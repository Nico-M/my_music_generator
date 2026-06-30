# 实施计划

基于 `docs/DESIGN.md v3` 的逐阶段构建指南。从零搭建项目，按 phase 顺序推进。

---

## 前置准备

> **项目根目录**：当前仓库根目录即为项目根目录，不额外套一层外层项目目录。

```bash
# Web 容器（Next.js）—— 在 web/ 下初始化
npx create-next-app@latest web --typescript --tailwind --app --src-dir
cd web
npm install @prisma/client @remotion/player @remotion/renderer remotion zustand
npm install prisma --save-dev
npx prisma init
cd ..

# Worker 容器（Python）
mkdir -p worker
cd worker
python -m venv venv
source venv/bin/activate
pip install faster-whisper ffmpeg-python
pip freeze > requirements.txt
cd ..

# 共享卷
mkdir -p data/uploads data/renders

# Docker Compose
touch docker-compose.yml
```

---

## Phase 1：骨架（上传 + 项目 + DB）

**目录**：`web/`

### 1.1 Prisma schema

`web/prisma/schema.prisma` — 直接复制 DESIGN.md §3 的三个模型：
- `Project` — 含 `transcriptJson Json?`
- `LyricLine` — source 枚举 `manual | transcribed | transcribed-aligned | weighted | aligned | lrc`
- `Job` — type 含 `transcribe | align | render`

```bash
cd web
npx prisma db push
```

### 1.2 文件上传 API

`web/app/api/uploads/audio/route.ts`
- 接收 `form-data` 音频文件
- 存储到 `/data/uploads/{createId}.mp3`
- 调用 `ffprobe` 获取 `durationMs`
- 返回 `{ audioPath, durationMs }`

```ts
// 核心逻辑
import { execSync } from 'child_process';
import { createId } from '@paralleldrive/cuid2';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('audio') as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const audioPath = `/data/uploads/${createId()}.mp3`;
  await fs.writeFile(audioPath, buffer);

  // ffprobe
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`
  );
  const durationMs = Math.round(parseFloat(output.toString()) * 1000);

  return Response.json({ audioPath, durationMs });
}
```

### 1.3 项目 CRUD API

`web/app/api/projects/route.ts` — POST 创建项目
`web/app/api/projects/[id]/route.ts` — GET/PATCH

- POST 接受 `{ title, audioPath, durationMs }`
- 创建 Project，返回完整对象
- GET 返回 Project（含关联的 lines）
- PATCH 允许改 title / vocalStartMs / vocalEndMs / template

### 1.4 项目编辑器页面

`web/app/projects/[id]/page.tsx`
- 调用 `/api/projects/[id]` 加载项目数据
- 用 Zustand store 管理编辑器状态
- 页面布局：左栏编辑区 / 右栏预览区

### 1.5 音频静态服务（文件路径 ←→ HTTP URL）

`web/app/api/files/[id]/route.ts`
```ts
// 把 /data/uploads/xxx.mp3 暴露成 HTTP URL
// 浏览器 <audio> 和 Remotion Player 都需要 HTTP URL
import fs from 'fs/promises';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const filePath = `/data/uploads/${params.id}`;
  const buffer = await fs.readFile(filePath);
  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'audio/mpeg' }
  });
}
```

> **为什么需要这个**：`Project.audioPath` 存的是服务器文件系统路径（如 `/data/uploads/xxx.mp3`），但浏览器 `<audio>` 和 Remotion Player 在客户端运行时需要 HTTP URL（如 `/api/files/xxx.mp3`）。组件中通过 `audioPath.replace('/data/uploads/', '/api/files/')` 转换。

**验证**：能打开浏览器创建项目、上传音频、看到页面渲染。

---

## Phase 2：手动时间线编辑器

### 2.1 AudioPlayer 组件

**文件**：`web/components/AudioPlayer.tsx`

功能：
- HTML `<audio>` 播放/暂停
- 键盘快捷键：空格（播放/暂停）、左右箭头（前后 3s）
- 显示当前播放时间 / 总时长
- 暴露 `currentTimeMs` 给父组件（Zustand store）

```tsx
interface AudioPlayerProps {
  audioPath: string;
  onTimeUpdate?: (currentMs: number) => void;
}
```

### 2.2 LyricDraftEditor 组件

**文件**：`web/components/LyricDraftEditor.tsx`

功能：
- 多行文本框，用户粘贴歌词（按行拆）
- 显示 ASR 草稿（如果有 `source="transcribed"` 的行）
- 用户可自由编辑文本
- 保存按钮调用 `PUT /api/projects/:id/lyrics`
- 若已有时间线（startMs/endMs 非零），编辑文字不碰时间线
- **编辑草稿行时，source 从 `transcribed` 变为 `manual`**（见下方状态机）

#### Source 状态机（所有路径的中枢）

```
┌─────────────────────┬─────────────────────────────────────┐
│        操作         │           source 变化               │
├─────────────────────┼─────────────────────────────────────┤
│ 用户粘贴歌词        │ → manual                            │
│ transcribe 写入     │ → transcribed                       │
│ 用户编辑某行文本    │ transcribed → manual（关键！）       │
│ assisted 生成时间线 │ → transcribed-aligned               │
│ weighted 粗排       │ → weighted                          │
│ LRC 导入            │ → lrc                               │
│ 用户手动微调时间    │ 保留原 source（只改 startMs/endMs）  │
└─────────────────────┴─────────────────────────────────────┘
```

**关键规则**：`transcribed` 行只由 ASR 生成。一旦用户碰过文本（哪怕改一个字），该行变为 `manual`。这保证了：
- 下次重跑 transcribe 不会误删用户改过的行（`DELETE WHERE source='transcribed'`）
- assisted 可以直接处理**所有行**（不挑 source），因为用户没改过的 transcribed 行也需要时间线

```tsx
interface LyricDraftEditorProps {
  lines: LyricLine[];
  onSave: (textLines: string[]) => void;
}
```

### 2.3 TimelineList 组件

**文件**：`web/components/TimelineList.tsx`

功能：
- 显示每行歌词及其 `startMs` / `endMs`
- 当前播放句高亮（由 AudioPlayer 驱动）
- 用户可在当前播放位置 tap 打点（设当前句 startMs = currentTimeMs）
- 微调：+/- 0.1s / 0.5s 按钮，或直接输入毫秒值
- 句尾自动衔接：`line[i].endMs = line[i+1].startMs`
- 保存按钮调用 `PUT /api/projects/:id/timeline`

```tsx
interface TimelineListProps {
  lines: LyricLine[];
  currentTimeMs: number;
  onLinesChange: (lines: LyricLine[]) => void;
  onSave: (lines: LyricLine[]) => void;
}
```

### 2.4 Zustand store

**文件**：`web/lib/store.ts`

```ts
interface EditorStore {
  project: Project | null;
  lines: LyricLine[];
  currentTimeMs: number;
  isPlaying: boolean;

  setProject: (p: Project) => void;
  setLines: (lines: LyricLine[]) => void;
  setCurrentTimeMs: (ms: number) => void;
  updateLine: (index: number, partial: Partial<LyricLine>) => void;
  saveTimeline: () => Promise<void>;
  saveLyrics: (texts: string[]) => Promise<void>;
}
```

### 2.5 API：PUT /lyrics 与 PUT /timeline

`web/app/api/projects/[id]/lyrics/route.ts`
- 接收 `{ texts: string[] }`
- 按行拆，替换 LyricLine.text
- **不修改** startMs/endMs 已有值
- 行数变化时增删行记录

`web/app/api/projects/[id]/timeline/route.ts`
- 接收 `{ lines: [{ index, startMs, endMs }] }`
- 批量更新所有行的时间戳

**验证**：手动粘贴歌词 → 边听边 tap 打点 → 保存 → 刷新后数据保留。

---

## Phase 3：兜底粗排（weighted）

**文件**：`web/lib/weighted-layout.ts`

```ts
export function weightedLayout(
  lines: { text: string }[],
  durationMs: number,
  vocalStartMs?: number,
  vocalEndMs?: number
): { index: number; startMs: number; endMs: number }[]
```

算法：
1. 按每行字数计算权重 `weight = text.length`
2. 可用时长 = `(vocalEndMs ?? durationMs) - (vocalStartMs ?? 0)`
3. 每行时长 = `(weight / totalWeight) * availableDuration`
4. 累计分配 startMs，endMs = startMs + lineDuration
5. 衔接相邻行间隙

**API**：`web/app/api/projects/[id]/timeline/weighted/route.ts`
- POST，无需参数
- 读项目获取 lines 和 durationMs
- 调用 `weightedLayout()`，写回 DB
- 设置 `source="weighted"`，清除旧时间线

**验证**：粘贴歌词 → 点「粗排」→ 看到每行分配了时间线（虽然不准）。

---

## Phase 4：竖屏预览（Remotion Player）

### 4.1 Remotion Composition

**文件**：`web/remotion/LyricVideo.tsx`
- 接收 `lines` + `template` 作为 `inputProps`
- `useCurrentFrame()` 计算当前播放时间 `tMs`
- 找到 `currentIdx`（tMs 落在哪一行）
- 渲染 `<Audio>` 组件（音频路径）
- 渲染 `<Header>` + `<ScrollingList>`

`web/remotion/Header.tsx`
- 标题（《歌名》- 歌手）
- 平台角标（"7950..."）

`web/remotion/ScrollingList.tsx`
- 接收 `lines` 和 `currentIdx`
- 每行渲染：`index < currentIdx` → ✅ 已唱，`=== currentIdx` → 黄色高亮 + 当前文字，`> currentIdx` → ⭕ 空心圈
- 滚动逻辑：`targetScroll = currentIdx * lineHeight - viewportH / 2`

### 4.2 Remotion 注册 + calculateMetadata

`web/remotion/Root.tsx`
```tsx
import { Composition } from 'remotion';

// ⚠️ durationInFrames 取决于音频时长，运行时通过 calculateMetadata 动态计算
export const RemotionRoot: React.FC = () => (
  <Composition
    id="LyricVideo"
    component={LyricVideo}
    durationInFrames={300}        // 占位值，实际由 calculateMetadata 覆盖
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }) => {
      const durationInFrames = Math.ceil((props.durationMs || 0) / 1000 * 30);
      return { durationInFrames, props };
    }}
  />
);
```

> **durationInFrames 计算**：`Math.ceil(durationMs / 1000 * 30)`。其中 `durationMs` 来自 ffprobe，通过 `inputProps` 传入。Remotion 的 `calculateMetadata` 会在渲染/播放前执行，允许动态决定帧数。

### 4.3 PreviewPanel 组件

**文件**：`web/components/PreviewPanel.tsx`

```tsx
import { Player } from '@remotion/player';

export const PreviewPanel: React.FC<{ lines: LyricLine[]; template: TemplateConfig; durationMs: number }> = ({
  lines, template, durationMs
}) => (
  <Player
    component={LyricVideo}
    inputProps={{ lines, template, durationMs }}
    durationInFrames={Math.ceil(durationMs / 1000 * 30)}
    compositionWidth={1080}
    compositionHeight={1920}
    fps={30}
    controls
  />
);
```

**验证**：预览面板实时跟随时间线勾选显示歌词，暂停/播放正常。

---

## Phase 5：渲染

**文件**：`web/lib/render.ts`

```ts
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

export async function renderLyricVideo(
  projectId: string,
  lines: LyricLine[],
  template: TemplateConfig,
  audioPath: string,
  durationInFrames: number
): Promise<string> {
  const composition = await selectComposition({
    id: 'LyricVideo',
    inputProps: { lines, template, audioSrc: audioPath },
    durationInFrames,
    fps: 30,
    width: 1080,
    height: 1920,
  });

  const outputPath = `/data/renders/${projectId}.mp4`;
  await renderMedia({
    composition,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { lines, template, audioSrc: audioPath },
  });

  return outputPath;
}
```

**API**：`web/app/api/projects/[id]/render/route.ts`
- POST → 创建 `Job(type="render", status="queued")`，立即返回 `{ jobId }`
- 起一个分离的 Node 子进程执行实际渲染，route handler 不等待

```ts
// web/app/api/projects/[id]/render/route.ts
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';

export async function POST(req, { params }) {
  const job = await prisma.job.create({
    data: { type: 'render', status: 'queued', projectId: params.id }
  });

  // fire-and-forget：分离子进程，不被 route handler 生命周期影响
  spawn('node', ['scripts/render-worker.js', job.id], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  return Response.json({ jobId: job.id });
}
```

**文件**：`web/scripts/render-worker.js`
```js
// 独立的 Node 脚本，被 route handler 以子进程方式启动
// 它加载 job → 调 Remotion render → 更新 DB
const { prisma } = require('./lib/prisma');
const { renderLyricVideo } = require('./lib/render');

async function main() {
  const jobId = process.argv[2];
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { project: { include: { lines: true } } } });

  try {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'running' } });
    const outputPath = await renderLyricVideo(
      job.project.id,
      job.project.lines,
      job.project.template,
      job.project.audioPath,
      Math.ceil((job.project.durationMs || 0) / 1000 * 30)
    );
    await prisma.job.update({ where: { id: jobId }, data: { status: 'done', resultPath: outputPath } });
  } catch (e) {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'failed', error: e.message } });
  }
  await prisma.$disconnect();
}
main();
```

- 前端轮询 `GET /api/jobs/:id` 获取 status/progress/resultPath
- Route 秒回，不会超时

> **⚠️ 为什么不直接在 route handler 里 await renderMedia**：5400 帧（3 分钟 @30fps）耗时数分钟，Next.js route handler 会超时。分离子进程方案在本地/自托管 MVP 中足够可靠。
>
> **后续扩展**：生产部署时，把 render-worker.js 的逻辑移到独立容器中，通过 DB 轮询 job 表工作（和 Python worker 同模式）。

**API**：`web/app/api/files/[id]/download/route.ts`
- GET → 读取 outputPath 返回文件流

**验证**：点「渲染」→ 等待 → 下载 MP4 → 播放确认画面和音频同步。

---

## Phase 6：ASR 歌词草稿

### 6.1 Worker 主循环

**文件**：`worker/main.py`

```python
import time, sqlite3, os

DB_PATH = "/data/sqlite.db"
UPLOADS_DIR = "/data/uploads"

def poll_jobs():
    conn = sqlite3.connect(DB_PATH)
    # ⚠️ 关键：打开 WAL 模式 + busy_timeout，否则 web+worker 两进程并发写会 database is locked
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    while True:
        # ⚠️ Prisma 默认使用 camelCase 列名，不是 snake_case
        # 运行 npx prisma db push 后用 .schema 核对真实列名
        cursor = conn.execute(
            'SELECT id, "projectId", params FROM Job WHERE type=\'transcribe\' AND status=\'queued\' LIMIT 1'
        )
        row = cursor.fetchone()
        if row:
            job_id, project_id, params_json = row
            conn.execute("UPDATE Job SET status='running' WHERE id=?", (job_id,))
            conn.commit()
            try:
                from transcribe import run_transcribe
                run_transcribe(project_id, DB_PATH, UPLOADS_DIR)
                conn.execute("UPDATE Job SET status='done' WHERE id=?", (job_id,))
            except Exception as e:
                conn.execute("UPDATE Job SET status='failed', error=? WHERE id=?", (str(e), job_id))
            conn.commit()
        time.sleep(5)

if __name__ == "__main__":
    poll_jobs()
```

### 6.2 Transcribe 管线

**文件**：`worker/transcribe.py`

```python
from faster_whisper import WhisperModel
import json, sqlite3, ffmpeg

def run_transcribe(project_id: str, db_path: str, uploads_dir: str):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")

    # ⚠️ Prisma 默认 camelCase 列名；运行 .schema 核对后再写 SQL
    row = conn.execute('SELECT "audioPath" FROM Project WHERE "id"=?', (project_id,)).fetchone()
    audio_path = row[0]

    # 1. ffmpeg 转 wav/mono/16k
    wav_path = audio_path.replace('.mp3', '_16k.wav')
    ffmpeg.input(audio_path).output(wav_path, acodec='pcm_s16le', ac=1, ar=16000).run()

    # 2. faster-whisper with word_timestamps
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, info = model.transcribe(wav_path, word_timestamps=True, language="zh")
    # ⚠️ segments 是惰性生成器（generator），立即物化，否则只能迭代一次
    segments = list(segments)

    # 3. 收集词级时间戳 + segment
    words = []
    segment_texts = []
    for seg in segments:
        segment_texts.append({"start": seg.start, "end": seg.end, "text": seg.text})
        for word in seg.words:
            words.append({"word": word.word, "start": word.start, "end": word.end})

    transcript_data = {"segments": segment_texts, "words": words}

    # 4. 写回 LyricLine (source="transcribed")
    #    ⚠️ index 是 SQLite 保留字，必须加双引号
    #    ⚠️ 仅删旧的 transcribed 行，不碰 manual/transcribed-aligned/weighted 行
    conn.execute('DELETE FROM LyricLine WHERE "projectId"=? AND "source"=\'transcribed\'', (project_id,))
    for idx, seg in enumerate(segment_texts):
        conn.execute(
            'INSERT INTO LyricLine ("id", "projectId", "index", "text", "startMs", "endMs", "source") VALUES (?,?,?,?,?,?,?)',
            (f"{project_id}_t{idx}", project_id, idx, seg["text"],
             int(seg["start"]*1000), int(seg["end"]*1000), "transcribed")
        )

    # 5. 写回 Project.transcriptJson
    conn.execute('UPDATE Project SET "transcriptJson"=? WHERE "id"=?',
                 (json.dumps(transcript_data, ensure_ascii=False), project_id))
    conn.commit()
```

> **⚠️ Prisma ↔ 裸 SQL schema 一致性（通用规则）**：Worker 绕过 Prisma 直接写 SQL，但 Prisma 建的 SQLite 数据库默认使用 camelCase 列名（`projectId`、`audioPath`、`createdAt`），不会自动做 snake_case 转换。Web 端用 Prisma Client 没这个问题，但 worker 的每个手写 SQL 都可能踩坑。
>
> 操作流程：
> 1. 运行 `npx prisma db push` 让 Prisma 建表
> 2. 用 `sqlite3 /data/sqlite.db ".schema [表名]"` 核对每个表的真实列名
> 3. 所有手写 SQL 列名加双引号，例如 `"projectId"`、`"audioPath"`、`"createdAt"`
> 4. `index` 是 SQLite 保留字，必须加双引号 `"index"`；或在 Prisma schema 中加 `@map("line_order")` 彻底避开

### 6.3 API 入口

`web/app/api/projects/[id]/lyrics/transcribe/route.ts`
- POST → 创建 Job(type="transcribe")，返回 jobId
- worker 轮询到后执行

**验证**：上传一首歌 → 点「识别歌词」→ 等待 → 看到 ASR 生成的歌词草稿和时间线。

---

## Phase 7：transcribe-assisted 主路径

**文件**：`web/lib/assisted-layout.ts`

```ts
interface WordTimestamp {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptData {
  segments: Segment[];
  words: WordTimestamp[];
}

/**
 * 把用户确认后的歌词行，模糊匹配到 ASR 词级时间戳上
 */
export function assistedLayout(
  userLines: { index: number; text: string }[],
  transcriptData: TranscriptData
): { index: number; startMs: number; endMs: number; confidence: number }[]
```

核心逻辑：
1. 将 ASR words 按顺序排列成词序列
2. 对每个用户歌词行，在词序列中模糊匹配（编辑距离 + 拼音）
3. 匹配到的首个词的 start = 该行 startMs，末词的 end = endMs
4. 计算 confidence = 匹配词数 / 期望词数
5. 衔接相邻行间隙

**API**：`web/app/api/projects/[id]/timeline/assisted/route.ts`

```ts
export async function POST(req, { params }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { lines: true }
  });

  if (!project.transcriptJson) {
    return Response.json({ error: '请先运行识别歌词' }, { status: 400 });
  }

  // assisted 作用于当前项目的所有行，不区分 source。
  // 用户编辑过的行（manual）和 ASR 原始行（transcribed）都需要时间线。
  // 唯一例外：已经有 transcribed-aligned 或 weighted 时间线的行，
  // 如果用户没改过文字，assisted 会覆盖更新。
  const allLines = project.lines.sort((a, b) => a.index - b.index);
  const transcriptData = JSON.parse(project.transcriptJson);
  const result = assistedLayout(allLines, transcriptData);

  // 写回 DB
  await prisma.$transaction(
    result.map(line =>
      prisma.lyricLine.update({
        where: { id: project.lines.find(l => l.index === line.index)!.id },
        data: { startMs: line.startMs, endMs: line.endMs, source: 'transcribed-aligned', confidence: line.confidence }
      })
    )
  );

  return Response.json({ lines: result });
}
```

**验证**：上传音频 → ASR 识别 → 粘贴/确认歌词 → 点「生成时间线」→ 时间线精准匹配音频节奏。

---

## Phase 8：强制对齐（增强）

**文件**：`worker/align.py`

- Demucs 分离人声 → WhisperX forced alignment
- 需要 GPU 机器
- 写回 `source="aligned"` + confidence
- 暂缓实施，不是 MVP 要求

---

## Phase 9：LRC 导入导出

**文件**：`web/lib/lrc.ts`

```ts
export function parseLRC(lrcText: string): { timeMs: number; text: string }[]
export function toLRC(lines: LyricLine[]): string
```

API：
- `POST /api/projects/:id/lyrics/import-lrc` → 解析 LRC 直接填 startMs
- `GET /api/projects/:id/export.lrc` → 导出当前时间线为 LRC

---

## Phase 10：Docker Compose 部署

**文件**：`docker-compose.yml`

```yaml
version: '3.8'
services:
  web:
    build: ./web
    ports: ["3000:3000"]
    volumes: ["./data:/data"]
    depends_on: [worker]
  worker:
    build: ./worker
    volumes: ["./data:/data"]
```

> **⚠️ Remotion 系统依赖**：`@remotion/renderer` 依赖 headless Chromium。Dockerfile 中必须安装：
> ```
> RUN apt-get update && apt-get install -y \
>   chromium \
>   fonts-noto-cjk \          # 中文字体（缺了这个歌词渲染成方块）
>   libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
>   libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
>   libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
>   libgbm1 libpango-1.0-0 libcairo2 libasound2
> ```

---

## 实施顺序建议

```
Phase 1 ───── Phase 2 ───── Phase 3 ───── Phase 4 ───── Phase 5
  (骨架)       (手动编辑)      (weighted)      (预览)        (渲染)
                                               │
Phase 6 ───── Phase 7       ← MVP 验收边界     │
(ASR 草稿)   (assisted)    (phase 1-7 做完)    │
                                               │
Phase 8 ───── Phase 9 ───── Phase 10           │
(align 增强)  (LRC)         (部署)              │
                                                │
Phase 4-5 自测时用手动校准过的歌验证预览=渲染同构，
不要被 weighted 的烂时间线误导以为是组件 bug。
```

每个 phase 完成时应当：
1. `npm run build` 通过（Phase 1-5, 7-9）
2. 手动验证核心交互路径
3. 保留项目数据不破坏

---

## 常见陷阱

| 陷阱 | 对策 |
|---|---|
| PUT /lyrics 覆盖了好时间戳 | design 里已解耦：PUT /lyrics 只改文本不碰时间线 |
| assisted 秒回 but transcribe 还没跑 | API 返回 400 + 提示，前端引导用户先跑 transcribe |
| weighted 被当主路径 | 前端 UI 中 assisted 按钮应排在 weighted 前面 |
| Phase 4-5 用 weighted 测预览误判 | 用手动校准过的歌测同构，不用 weighted |
| transcriptJson 太大 | faster-whisper word timestamps 通常 < 500KB，SQLite 存 JSON 无压力 |
| `index` 是 SQLite 保留字 | worker 手写 SQL 时加双引号 `"index"`，或 Prisma schema 用 `@map("line_order")` 映射 |
| web + worker 并发写 SQLite | 两进程都开 `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` |
| transcribe 误删用户改过的行 | 只删 `source='transcribed'` 的行；用户编辑文本时 source 变为 `manual`，不会被删 |
| 浏览器无法加载 `/data/...` 文件路径 | 用 `/api/files/xxx` 路由提供 HTTP URL，组件中做路径转换 |
| durationInFrames 不知道填多少 | 用 Remotion `calculateMetadata` 动态计算 `Math.ceil(durationMs/1000*30)` |
| render 阻塞 Next.js 超时 | render 走后台 job + 前端轮询，不在 route handler 里同步等 |
| Docker 中文字体方块 | Dockerfile 安装 `fonts-noto-cjk` 和 Chromium 系统依赖 |
