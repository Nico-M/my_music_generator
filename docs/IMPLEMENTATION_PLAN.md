# 实施计划

基于 `docs/DESIGN.md v4` 的逐阶段构建指南。

> **本文档记录项目如何建成，Phase 1-7 已全部落地。** 若要重新搭建或在另一台机器上复现，按本文档从头执行即可。

---

## 前置准备

> **项目根目录**：当前仓库根目录即为项目根目录，不额外套一层外层项目目录。

```bash
# Web（Next.js）—— 在 web/ 下初始化
npx create-next-app@latest web --typescript --tailwind --app --src-dir
cd web
npm install @prisma/client @remotion/player @remotion/renderer remotion zustand pinyin-pro
npm install prisma --save-dev
npx prisma init
cd ..

# 数据目录
mkdir -p data/uploads data/renders

# Docker Compose
touch docker-compose.yml
```

无需 Python 环境，无需本地机器学习依赖。

---

## Phase 1：骨架（上传 + 项目 + DB）

**目录**：`web/`

### 1.1 Prisma schema

`web/prisma/schema.prisma` — 直接复制 DESIGN.md §3 的三个模型：
- `Project`
- `LyricLine` — source 取值 `manual | transcribed | asr-aligned`（`transcribed-aligned` / `weighted` / `aligned` 仅为历史数据，现行代码不再产出，见 DESIGN §5.4）
- `Job` — type 为 `transcribe | render`

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
│ 识别（歌词库命中）  │ → asr-aligned                       │
│ 识别（降级断句）    │ → transcribed                       │
│ 用户编辑某行文本    │ → manual（关键！）                   │
│ 用户手动微调时间    │ 保留原 source（只改 startMs/endMs）  │
└─────────────────────┴─────────────────────────────────────┘
```

**关键规则**：自动产生的行带 `transcribed` / `asr-aligned` 标记。一旦用户碰过该行文本，source 变为 `manual`。这保证了下次重跑识别时 `DELETE WHERE source IN ('transcribed','asr-aligned')` 不会误删用户改过的行。用户只微调时间不动文本时，source 保持不变。

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

## Phase 3：（已删除）兜底粗排 weighted

早期实现过按字数权重把演唱时长等分的 `weighted-layout.ts` 与 `POST /timeline/weighted` 端点。有 ASR 时间戳后它毫无竞争力，且会让用户误以为时间线已经对齐好，已连同端点、按钮、`source="weighted"` 一起删除。原因见 DESIGN §5.4。

**本阶段不需要实现任何代码**，保留此节仅为记录演进。

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
// web/src/app/api/projects/[id]/render/route.ts
import { spawn } from 'child_process';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function POST(req, { params }) {
  const job = await prisma.job.create({
    data: { type: 'render', status: 'queued', projectId: params.id }
  });

  // fire-and-forget：分离子进程，不被 route handler 生命周期影响
  const workerScript = path.resolve(process.cwd(), 'scripts/render-worker.ts');
  spawn('npx', ['tsx', workerScript, job.id], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  return Response.json({ jobId: job.id });
}
```

**文件**：`web/scripts/render-worker.ts`
```ts
// 独立的 tsx 脚本，被 route handler 以子进程方式启动
// 它加载 job → 调 Remotion render → 更新 DB
const jobId = process.argv[2];
const job = await prisma.job.findUnique({
  where: { id: jobId },
  include: { project: { include: { lines: true } } },
});

try {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'running' } });
  const outputPath = await renderLyricVideo(/* project, lines, template, audio, frames */);
  await prisma.job.update({ where: { id: jobId }, data: { status: 'done', resultPath: outputPath } });
} catch (e) {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'failed', error: e.message } });
}
await prisma.$disconnect();
```

- 前端轮询 `GET /api/jobs/:id` 获取 status / resultPath
- Route 秒回，不会超时

> **⚠️ 为什么不直接在 route handler 里 await renderMedia**：5400 帧（3 分钟 @30fps）耗时数分钟，Next.js route handler 会超时。分离子进程方案在本地/自托管场景中足够可靠。这也是**应用内唯一保留的子进程**——渲染本来就该在独立进程跑，与已删除的 job 轮询型 Python worker 不是一回事。

**API**：`web/app/api/files/[id]/download/route.ts`
- GET → 读取 outputPath 返回文件流

**验证**：点「渲染」→ 等待 → 下载 MP4 → 播放确认画面和音频同步。

---

## Phase 6：歌词识别（transcribe job）

### 6.1 Job 结构

`Job(type="transcribe")` 仍是异步任务：route handler 建行后立即返回 `jobId`，实际工作在同一进程内 fire-and-forget 执行，前端轮询 `/api/jobs/[id]`。

早期这里是 Python worker 轮询 SQLite。删掉 worker 后，任务仍走 DB 表是为了**保持前端协议不变**——任务状态、错误信息、重试语义都没变，只是执行者从独立进程换成了同一个 Next.js 进程。

### 6.2 识别管线

**文件**：`web/src/lib/minimax-asr.ts`、`web/src/lib/lrc.ts`、`web/src/lib/lyric-align.ts`、`web/src/app/api/projects/[id]/lyrics/transcribe/route.ts`

```
POST /lyrics/transcribe
  │
  1. 建 Job(type="transcribe", status="running")，立即返回 jobId
  │
  2. 并行：
  │     a. MiniMax ASR（音频 + API Key）→ 逐字时间戳 AsrUnit[]
  │         ⚠️ 时长 > 500s 或文件 > 50MB 提前拒绝
  │     b. 歌词库 api.lrc.cx（title + artist）→ LrcLine[]
  │
  3. 歌词库命中 → alignLrcToAsr(units, lrcLines)（§7）
  │     匹配率 < 50% → 视为未命中，走 4
  │
  4. 未命中 → minimax-llm.ts 对 ASR 原文断句，按比例分配时间
  │
  5. 事务内：DELETE 旧 source IN ('transcribed','asr-aligned') 的行 → INSERT 新行
  │     ——用户手改过的行 source='manual'，不会被删
  │
  6. Job 标 done（或 failed + error）
```

**关键约束**：整条链路不写 `Project` 表的临时字段，中间产物（ASR units、歌词库结果）只在内存里活一次调用。

### 6.3 前端

- 点「识别歌词」→ `POST /lyrics/transcribe` → 用 `use-jobs.ts` 轮询
- 降级时（歌词来自 ASR）界面必须显示提示，否则用户会以为文字是准的

**验证**：上传一首歌 → 点「识别歌词」→ 等待 → 歌词文字与时间轴同时出现，且时间轴对得上演唱。

---

## Phase 7：拼音对齐

**文件**：`web/src/lib/lyric-align.ts`

```
alignLrcToAsr(units: AsrUnit[], lrcLines: LrcLine[]): AlignResult
  │
  1. cjkOnly: 两侧只保留 CJK 字符，记录每个 ASR 字符的时间
  │
  2. toPinyin: pinyin-pro → 一字一音节（简繁自然统一）
  │
  3. alignByPinyin: DP 求 LCS → 单调的「ASR 下标 → 歌词下标」映射
  │     未命中间隙在相邻锚点间线性插值
  │
  4. matchRate < 0.5 → 返回 { rows: [], reason } 交给调用方降级
  │
  5. 按歌词行分桶，取桶内 ASR 字符首尾时间作为该行 startMs/endMs
  │     某行被唱到的字符 < 该行字数一半 → 丢弃（本录音没唱这段）
  │
输出: { rows: LyricRow[], matchRate }
```

**为什么不用字符集合重叠**：那正是被删掉的 `assisted` 路径的做法，丢顺序、折叠重复字、游标不可逆。LCS 在拼音序列上天然单调，重复段（副歌）不会带偏后续行。原因详见 DESIGN §5.4。

**验证**：

- 用一首歌词库能命中的歌 → 识别 → 时间轴与演唱节奏吻合，副歌第二遍不错位
- 用一首歌词库查不到的歌 → 识别 → 拿到带错字提示的草稿，流程不阻塞

---

## Phase 8：LRC 导入导出（未实现）

计划提供：

- `parseLRC(text)` / `toLRC(lines)` 放在 `web/src/lib/lrc.ts`（该文件现已存在，负责的是**歌词库查询与解析**，导入导出可直接复用其解析部分）
- `POST /api/projects/:id/lyrics/import-lrc` → 解析 LRC 直接填时间
- `GET /api/projects/:id/export.lrc` → 导出当前时间线

价值是让用户的校准劳动可复用。当前未做。

---

## Phase 9：Docker Compose 部署

**文件**：`docker-compose.yml`

```yaml
services:
  web:
    build: ./web
    ports: ["3000:3000"]
    volumes: ["./data:/data"]
```

单服务，无 `depends_on`。

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

## 实施顺序

```
Phase 1 ── Phase 2 ── Phase 4 ── Phase 5 ── Phase 6 ── Phase 7 ✅
 (骨架)    (编辑器)    (预览)     (渲染)    (识别)     (拼音对齐)
             │
           Phase 3(weighted) 与 Phase 8(LRC) 已删除/未实现
```

每个 phase 完成时应当：
1. `npx tsc --noEmit` 与 `next build` 通过
2. 手动验证核心交互路径
3. 保留项目数据不破坏

---

## 常见陷阱

| 陷阱 | 对策 |
|---|---|
| 歌词库时间轴被误用 | 歌词库的 LRC 时间对应原版录音，**永远丢弃**，只取其文字 |
| 拼音对齐忽略简繁 | `pinyin-pro` 在拼音层统一，不要自己做简繁转换 |
| 匹配率低却硬写结果 | 低于 50% 直接放弃并降级，坏数据比没有更危险 |
| 重复段（副歌）错位 | 用 LCS 保证映射单调，不要用滑动窗口贪心 |
| ASR 超时/超长 | 调用前用 ffprobe 的 durationMs 判断，超 500s 提前拒绝 |
| API Key 进日志 | 服务端只透传，不落库、不打日志 |
| 识别覆盖用户改过的行 | 只删 `source IN ('transcribed','asr-aligned')`，`manual` 不动 |
| `index` 是 SQLite 保留字 | Prisma 生成的 SQL 无此问题；手写 SQL 时加双引号 `"index"` |
| 浏览器无法加载 `/data/...` 文件路径 | 用 `/api/files/:id/*` 路由提供 HTTP URL，组件中做路径转换 |
| durationInFrames 不知道填多少 | 用 Remotion `calculateMetadata` 动态计算 `Math.ceil(durationMs/1000*30)` |
| render 阻塞 Next.js 超时 | render 走后台 job + 前端轮询，不在 route handler 里同步等 |
| Docker 中文字体方块 | Dockerfile 安装 `fonts-noto-cjk` 和 Chromium 系统依赖 |
