# 唱歌视频生成器 — 技术方案 v3.1

> 用户上传一段音频，优先粘贴/确认歌词文本，应用生成可编辑时间线；用户边听边校准，预览「抖音 Notes Todo」竖屏模板，最终渲染 1080×1920 的竖屏 MP4。ASR 识别歌词是辅助入口：用于生成可编辑草稿，不是 MVP 的唯一地基。

## 0. 核心理念（决定一切的四条）

1. **先做「纯手动也可靠」的编辑器，再用自动化提速。** 用户手里有歌词时，必须能靠粘贴歌词 + 粗排 + 手动打点完成整条流程；ASR、强制对齐都只是加速器，不能成为阻塞点。
2. **歌词识别和时间线对齐分开。** `transcribe` 只负责从音频生成可编辑歌词草稿；`align` 才负责把已确认歌词对到音频时间线上。两者混在一起会让失败原因不可控。
3. **预览与渲染共用同一份 React 组件。** 所见即所得靠的是「同一个 Remotion Composition，预览用 Player、导出用 Renderer」，绝不能两套 DOM。
4. **faster-whisper 的词时间戳是最廉价的好东西。** 即使 ASR 识别文字是错的，它产生的词级时间戳来自音频声学，位置是准的。用用户确认后的正确歌词模糊匹配到这些时间戳上，就能以接近零额外成本获得接近 align 质量的时间线。

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 + 轻 API | **Next.js (App Router) + TypeScript** | route handlers 当 API，省一个服务 |
| UI | React + Tailwind + Zustand | 编辑器状态用 Zustand，简单够用 |
| 预览 | **`@remotion/player`** | 与渲染共用 Composition |
| 渲染 | **Remotion (`@remotion/renderer`)** | todo 模板就是 HTML/CSS，天生契合 |
| DB | **SQLite + Prisma**（MVP）| 单机够用，以后换 Postgres 零成本 |
| 音频探针 | `ffprobe` | 取时长 |
| **AI worker** | **Python：faster-whisper；后续 WhisperX + Demucs** | MVP 先做歌词草稿识别；强制对齐后置 |
| 队列 | **DB 轮询**（MVP）| 别上 Redis/BullMQ，过早复杂化 |
| 存储 | 本地磁盘 + 静态目录 | MVP 不上 S3 |
| 部署 | Docker Compose（web / worker 两个容器）| 本地或自托管环境 |

**为什么不是 NestJS**：MVP 阶段它的模块/DI 仪式感是纯负担，Next.js route handlers 完全够。
**为什么必须有 Python**：faster-whisper / WhisperX / Demucs 都在 Python 生态，Node 没有等价成熟方案。

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────┐
│  Next.js (web 容器)                               │
│  ┌───────────────┐   ┌──────────────────────┐    │
│  │ 编辑器前端      │   │ route handlers (API) │    │
│  │ - 播放器        │   │ - 上传/项目/歌词      │    │
│  │ - 歌词草稿确认  │←→ │ - 起识别/对齐任务    │    │
│  │ - 时间线列表    │   │ - 起渲染任务          │    │
│  │ - Remotion      │   │ - ffprobe / Remotion │    │
│  │   Player 预览   │   │   render             │    │
│  └───────────────┘   └──────────┬───────────┘    │
└──────────────────────────────────┼────────────────┘
                                    │ 写 job 行
                          ┌─────────▼─────────┐
                          │  SQLite (Prisma)   │  ← 共享卷
                          └─────────▲─────────┘
                                    │ 轮询 job
┌───────────────────────────────────┼────────────────┐
│  Python worker (worker 容器)        │                │
│  轮询循环                            │                │
│  ┌──────────────────────────────┐  │                │
│  │ transcribe job:              │  │                │
│  │  faster-whisper → 歌词草稿    │  │                │
│  └──────────────────────────────┘  │                │
│  ┌──────────────────────────────┐  │                │
│  │ align job（后续增强）:         │  │                │
│  │  WhisperX/Demucs → 句级时间戳 │  │                │
│  └──────────────────────────────┘  │                │
└─────────────────────────────────────────────────────┘
         共享卷: /data/uploads  /data/renders
```

渲染放在 web 容器（Remotion 是 Node），AI 任务放在 worker 容器（Python）。两边通过 DB 的 job 表 + 共享卷通信。

---

## 3. 数据模型（Prisma）

```prisma
model Project {
  id           String      @id @default(cuid())
  title        String                           // 《Simon》- 周菲戈
  audioPath    String                           // /data/uploads/xxx.mp3
  durationMs   Int         @default(0)          // ffprobe
  vocalStartMs Int         @default(0)          // 人声起点（用户/对齐填）
  vocalEndMs   Int         @default(0)          // 人声终点
  template     Json                             // 模板配置，见 §6
  transcriptJson Json?                          // faster-whisper 原始词级时间戳（供本地 worker 对齐复用）
  lines        LyricLine[]
  jobs         Job[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model LyricLine {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  index      Int                              // 行序
  text       String
  startMs    Int                              // 句首
  endMs      Int                              // 句尾
  source     String   @default("manual")      // manual | transcribed | transcribed-aligned | weighted | aligned | lrc（transcribed-aligned 为历史数据，已不再产生）
  confidence Float?                            // 识别/对齐置信度，低的高亮提醒用户
  @@unique([projectId, index])
}

model Job {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type       String                            // "transcribe" | "align" | "render"
  status     String   @default("queued")       // queued|running|done|failed
  progress   Int      @default(0)              // 0-100
  params     Json?                             // 任务入参快照
  resultPath String?                           // 渲染产物路径
  error      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**关键设计**：`source` 和 `confidence` 是体验关键——ASR 草稿行标 `transcribed`，时间线粗排行标 `weighted`，强制对齐结果标 `aligned`。前端把低置信度或自动生成的行高亮提醒用户确认，但永远允许用户手动覆盖。

`aligned` 是最有价值的 source 值：它代表真实的声学时间位置（Demucs 人声分离 + 词级 ASR + 拼音模糊匹配），质量远好于 weighted 的字数猜测。旧版本用纯 JS 的 `assisted` 路径产出 `transcribed-aligned`，已删除——原因见 §5.2。

---

## 4. API

```
# 上传与项目
POST   /api/uploads/audio          form-data，存盘 + ffprobe → 返回 {audioPath, durationMs}
POST   /api/projects               创建项目
GET    /api/projects/:id           项目详情（含 lines）
PATCH  /api/projects/:id           改 title / vocalStart/End / template

# 歌词
PUT    /api/projects/:id/lyrics    整批替换歌词文本（粘贴/确认），按行拆；**不自动重算时间线**
POST   /api/projects/:id/lyrics/transcribe     起 transcribe job，生成可编辑歌词草稿
POST   /api/projects/:id/lyrics/import-lrc     导入 LRC（带时间戳，直接填 startMs）

# 时间线（用户显式触发，永不偷跑）
POST   /api/projects/:id/timeline/weighted     字数权重兜底粗排（同步，永不失败）
POST   /api/projects/:id/timeline/align        起 align job（异步）→ 返回 jobId
PUT    /api/projects/:id/timeline              保存用户校准后的全部行时间

# 任务
GET    /api/jobs/:id               轮询 status/progress/result

# 渲染
POST   /api/projects/:id/render    起 render job → jobId
GET    /api/files/:id/download     下载 MP4

# 导出
GET    /api/projects/:id/export.lrc   导出 LRC（用户劳动可复用）
```

核心路径是 `PUT lyrics → align（异步，声学时间戳）→ 手动校准 → preview → render`；`weighted` 是纯兜底（align 不可用时显示让用户点，保证任何环境下都能进入编辑和渲染）。

**重要规则**：`PUT /lyrics` 永远只替换歌词文本，绝不碰时间线数据。用户改歌词后需要显式点击「精确对齐」或「字数粗排」触发新计算。这是为了防止 transcribe 已产生的好时间戳被意外覆盖。

**对齐的前置条件只有一个：项目有歌词。** `align` 的远端服务自带 Demucs + 词级 ASR，只接收音频 + 歌词，不读本地 `transcriptJson`。只有降级到本地 worker（无 `REMOTE_ALIGN_URL`）时才需要先跑一次 transcribe，因为那条路径复用本地词级时间戳、没有自己的 ASR。因此「用户自己提供歌词」的场景不再被强制跑一遍识别。

---

## 5. 自动化管线（Python worker）

### 5.1 MVP：歌词草稿识别（transcribe）

**认知前提**：唱歌 ASR 不可能 100% 准，尤其中文流行歌、混响、伴奏、人声叠加时会错词漏词。所以 MVP 不承诺“自动提取即最终歌词”，只承诺“生成可编辑草稿，减少手打成本”。

```
输入: audioPath, language(optional), vocalStart/End(optional)
  │
  1. ffmpeg 转 wav/mono/16k
  │
  2. faster-whisper transcribe（word_timestamps=True）
  │     - 得到词级时间戳（关键产物：即使识别文字是错的，时间戳来自声学是准的）
  │     - 同时得到 segment 文本、start/end、avg_logprob/no_speech_prob
  │
  3. segment → LyricLine 草稿
  │     - 按停顿/标点/长度拆行
  │     - startMs/endMs 直接来自 segment
  │
  4. 写回 LyricLine.source="transcribed" + confidence
  │
输出: 用户可编辑的歌词草稿 + 初始句级时间线 + 可复用词级 transcript（存入 Project.transcriptJson）
```

### 5.2 已删除：assisted（纯 JS 字符匹配）——为什么不再提供

早期版本提供过一条纯 JS 的同步对齐路径（`assisted`，产出 `source="transcribed-aligned"`），做法是拿用户歌词行去本地 `transcriptJson` 的 ASR **segment** 里找字符重叠最高的那一段。实测在真实中文歌词上准确率不可接受，已连同端点、按钮与实现一起删除。删除原因记录于此，避免以后被重新实现回来：

1. **字符重叠用去重集合，丢失顺序。** 打分函数把两侧文本拆成字符 `Set` 求交，因此「我爱他」与「他爱我」得分 1.0，而中文歌词里词序互换、人称互换极其常见。
2. **重复字被折叠。** 同一个字符只计一次，「谢谢谢谢」在打分时等价于一句只有一个字的行。
3. **单调游标不可逆。** 匹配到一段 ASR 后，游标直接跳到该段之后，永不回退。一次误命中会连带后面所有行的搜索窗口整体偏移，表现为「后半段全跑偏」而不是偶发单行错。
4. **命中阈值过低（0.3）。** 集合重叠 30% 在 10 字以上的行里很容易碰巧达到，进一步放大了第 3 点。
5. **精度粒度是 ASR 句子级。** 即使文字匹配对了，时间也只能取整段的起止，无法利用词级时间戳。

更关键的是**它比 `weighted` 更有害**：`weighted` 的粗排结果一眼能看出是"平均分"，用户会去校准；而 assisted 会给出带 confidence 百分比、看起来很精确、实际错误的时间线，用户会误以为已经对齐好了。**看起来准确但错误的坏数据，比明显粗糙的兜底更危险。**

### 5.3 兜底：字数权重粗排（weighted）

```
输入: 用户确认后的歌词行 + audio duration/vocalStart/vocalEnd
  │
  1. 按每行字数/词数计算权重
  │
  2. 把可用演唱时长按权重分配
  │
  3. 衔接相邻行 startMs/endMs
  │
输出: source="weighted" 的可编辑初始时间线
```

这是永不阻塞的地基：ASR 失败、align 失败、没有 GPU，都可以靠它进入编辑和渲染。

### 5.4 主路径：声学对齐（align）

**认知前提**：用户已经确认歌词文本后，对齐才有意义。**前置条件只有"项目有歌词"，不需要先跑识别歌词。**

```
输入: audioPath, 已确认歌词行 [{index, text}], vocalStart/End(optional)
  │
  1. Demucs 分离人声（可选增强）
  │
  2. faster-whisper 词级 ASR（Demucs 生效时对分离人声与原音频各跑一遍，按词数/覆盖率/置信度选优）
  │
  3. pypinyin + rapidfuzz 单调窗口匹配：整词序列滑窗，ratio/partial_ratio 混合覆盖度与长度惩罚
  │
  4. 每行算 confidence，低于阈值或整体覆盖率不足时退化为按时长的比例分配
  │
  5. 写库前过质量门（行数下限、零时长比例、时间单调性、高置信度短匹配假阳性）
  │
输出: source="aligned" 的句级时间线（异步 job，分钟级）
```

**部署形态**：两条可互换的实现，按 `REMOTE_ALIGN_URL` 是否配置切换。

- **远端服务（推荐）**：`REMOTE_ALIGN_URL` 指向一个自带 Demucs + faster-whisper 的 FastAPI 服务。只接收 `file` + `lyrics_json`（+ 可选 `audio_duration_ms`），**不读本地 `transcriptJson`**，因此本地是否跑过 transcribe 完全不影响结果。
- **本地 worker（降级）**：未配置 `REMOTE_ALIGN_URL` 时创建 `Job(type="align", status="queued")`，由 `worker/main.py` 取走。这条路径复用本地 `transcriptJson` 的词级时间戳、自身不做 ASR，因此**必须**先跑过一次识别歌词；守卫会返回 400 并说明原因。

前端的「精确对齐」按钮对两种形态是同一个入口，按 job 状态轮询。

**降级策略（永不阻塞）**：

```
align 失败 / 服务不可达 / 用户跳过 → 前端提示，用户可点 weighted 兜底
无歌词 → 提示先粘贴歌词或跑一次识别歌词（无论哪条对齐路径都需要歌词）
本地 worker 路径且无 transcriptJson → 400，提示先跑识别歌词
weighted → 永不失败，保证任何环境下都能进入编辑和渲染
render 失败 → 保留项目和时间线，允许重试
```

worker 与 web 的接口：worker 轮询 `Job(type in ["transcribe", "align"], status="queued")`，干完写回 DB。web 不直接耦合 Python 服务。

**两条路径的质量对比**：

| 路径 | 时间源 | 文字源 | 质量 | 速度 | 依赖 |
|---|---|---|---|---|---|
| weighted | 字数猜测 | 用户正确歌词 | ★★ | 毫秒 | 无 |
| align（远端） | 声学真实（词级）+ 人声分离 + 双路 ASR 择优 | 用户正确歌词 | ★★★★★ | 分钟级 | 远端服务（建议 GPU） |
| align（本地 worker） | 声学真实（词级，复用 transcribe 结果） | 用户正确歌词 | ★★★ | 分钟级 | 先跑 transcribe；CPU 可跑 |

`align` 是唯一推荐的对齐方式，`weighted` 是永不失败的兜底。二者之间不再有第三条路径——曾经的 `assisted` 已删除，原因见 §5.2。

---

## 6. 模板与「预览=渲染」同构（Remotion）

模板配置存在 `Project.template`（JSON），驱动同一个 Composition：

```ts
type TemplateConfig = {
  preset: "douyin-notes";
  bg: "#000000";
  platformBadge: { icon: "douyin"; id: string };   // 抖音号: 7950...
  title: string;                                     // 《Simon》- 周菲戈
  highlightColor: "#FACC15";                         // 当前句黄色勾
  fontSize: number;
  // ...间距、字体
};
```

**同构的实现（最关键的一段）**：

```tsx
// remotion/LyricVideo.tsx —— 预览和渲染都用它
export const LyricVideo: React.FC<{lines: LyricLine[]; template: TemplateConfig}> =
  ({ lines, template }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const tMs = (frame / fps) * 1000;
    const currentIdx = lines.findIndex(l => tMs >= l.startMs && tMs < l.endMs);

    return (
      <AbsoluteFill style={{ background: template.bg }}>
        <Audio src={audioSrc} />                {/* 音频带进去，免后期对齐 */}
        <Header template={template} />
        <ScrollingList lines={lines} currentIdx={currentIdx} />
      </AbsoluteFill>
    );
  };
```

- 预览：`<Player component={LyricVideo} inputProps={{lines, template}} />`，编辑时实时勾选。
- 渲染：`renderMedia({ composition: LyricVideo, inputProps, codec:'h264' })` → 1080×1920/30fps。
- **同一份 `lines`、同一个组件 → 预览勾到哪、视频就勾到哪。** 用户调好的预览和导出零漂移。

勾选逻辑：`index < currentIdx` 显示已勾 ✅ + 黄色，`=== currentIdx` 高亮，`> currentIdx` 空心圈 ⭕。和参考的抖音图一致。

---

## 7. 两个容易踩坑的点

**A. 长歌词滚动**：参考图 15 行刚好一屏，但歌词一多必须滚。`ScrollingList` 让 `currentIdx` 始终居中：

```tsx
const targetScroll = currentIdx * lineHeight - viewportH / 2;
const scroll = interpolate(/* spring 平滑过渡到 targetScroll */);
// translateY(-scroll)
```

**B. 音画同步**：靠 Remotion 的 `<Audio>` 把原始音频直接编进 Composition，避免渲完帧再 mux 导致差一两帧。

---

## 8. 目录结构

```
singing_video/
├─ web/                          # Next.js
│  ├─ app/
│  │  ├─ api/                    # route handlers（§4）
│  │  ├─ projects/[id]/page.tsx  # 编辑器主工作台
│  ├─ components/
│  │  ├─ AudioPlayer.tsx         # 播放/暂停/回退3s/播当前句
│  │  ├─ LyricDraftEditor.tsx    # ASR 草稿确认/手动粘贴歌词
│  │  ├─ TimelineList.tsx        # 句列表 + 打点 + 微调
│  │  └─ PreviewPanel.tsx        # @remotion/player
│  ├─ remotion/
│  │  ├─ LyricVideo.tsx          # ★ 预览=渲染 同构组件
│  │  ├─ Header.tsx
│  │  └─ ScrollingList.tsx
│  ├─ lib/
│  │  ├─ weighted-layout.ts      # 字数权重兜底粗排
│  │  ├─ remote-align.ts         # 远端声学对齐客户端 + 结果质量门
│  │  ├─ render.ts               # @remotion/renderer 调用
│  │  └─ lrc.ts                  # LRC 导入导出
│  └─ prisma/schema.prisma
├─ worker/                       # Python
│  ├─ main.py                    # 轮询 Job(transcribe/align)
│  ├─ transcribe.py              # faster-whisper 歌词草稿
│  ├─ align.py                   # 本地降级对齐（复用 transcribe 词级时间戳）
│  └─ requirements.txt
├─ data/                         # 共享卷：uploads / renders
└─ docker-compose.yml
```

---

## 9. 阶段拆分（更新后）

| 阶段 | 内容 | 产出 |
|---|---|---|
| **1. 骨架** | Next.js + Prisma + 上传 + ffprobe + 项目创建 | 能传音频建项目 |
| **2. 歌词确认与手动时间线编辑器 ★先做** | 粘贴歌词、播放器、句列表、tap 打点、句尾自动衔接、快捷键、微调、保存 | **用户提供歌词时，纯手动也能完成一首** |
| **3. 兜底粗排（先做，无依赖）** | `weighted-layout.ts` 字数权重 | 纯 JS，0 外部依赖，用于自测编辑器交互 |
| **4. 竖屏预览** | `@remotion/player` + `LyricVideo` 同构组件 + 滚动 | 实时勾选预览 |
| **5. 渲染** | `@remotion/renderer` → 1080×1920/30fps/h264 带音频 | 出 MP4 |
| **6. ASR 歌词草稿** | Python worker：faster-whisper（word_timestamps=True）识别 + 词级时间戳 → 存入 Project.transcriptJson | 无歌词时可先生成草稿；词级时间戳供本地降级对齐复用 |
| **7. 声学对齐 ★主路径** | 远端服务（`remote-align.ts`：Demucs + 词级 ASR + pypinyin/rapidfuzz 单调窗口匹配 + 质量门）；无 `REMOTE_ALIGN_URL` 时降级到 `worker/align.py` | **一键精准时间线** |
| **8. LRC + 打磨** | LRC 导入导出、错误处理、空状态 | 可复用、好用 |
| **9. 部署** | Docker Compose（web + worker + 可选 align 服务）本地或自托管 | 上线 |

**MVP 验收边界**：包含 **phase 1-7**。phase 1-5 是「骨架/手工可用版」，可手动完成一首；phase 6 让「无歌词也能起步」，phase 7 让「一键精准时间线」成为现实。做完 phase 5 不视为 MVP 完成。

**关键调整（v3.1）**：删除 phase 7 原定的 `transcribe-assisted`（纯 JS 路径）。它拿用户歌词去 ASR segment 里做去重字符集重叠匹配，实测中文歌词准确率不可接受，且单调游标不可逆会让一次误命中污染后续所有行。现在 `align` 直接作为主路径——**它的前置条件只有"有歌词"**，远端服务自带 Demucs + 词级 ASR，不读本地 `transcriptJson`。`weighted` 保持纯兜底。详细原因见 §5.2。

---

## 10. 风险与预案

| 风险 | 预案 |
|---|---|
| 唱歌 ASR 错词漏词 | ASR 文字只作为草稿，不要求准确；对齐以用户提供的正确歌词为准，靠拼音模糊匹配定位声学时间 |
| align 服务不可达 / 超时 | job 标 failed 并保留错误信息；前端提示用户改点 weighted 兜底，全流程仍可完成 |
| 用户自带歌词却被强制跑识别 | 已修正：守卫改为"项目是否有歌词"，远端对齐不再要求 `transcriptJson`；只有本地降级路径才需要先跑 transcribe |
| PUT /lyrics 误覆盖好时间戳 | PUT /lyrics 不再自动触发任何时间线计算；时间线生成始终是用户的显式操作 |
| **无 GPU** | 本地 worker 路径 CPU int8 可跑（慢但能跑）；或直接跑远端服务；两条都不可用时 weighted 兜底 |
| 对齐质量差 | 写库前过质量门（行数下限、零时长比例、时间单调性、高置信度短匹配假阳性）；低置信行标红引导校准；永远保留手动打点 |
| Remotion 渲染慢（5400 帧） | MVP 接受；以后量产再评估 ffmpeg+ASS 路线 |
| SQLite 并发 | MVP 单用户够；多用户再换 Postgres（Prisma 零成本切） |

---

## 附：成功标准

第一版成功的标准：用户上传音频后，粘贴歌词并点击「精确对齐」→ 声学对齐跑出一版准确的时间线。用户只需听一遍确认，少数不匹配行手动微调，即可生成节奏正确、预览与导出一致的 9:16 竖屏歌词 todo 视频。如果没有歌词，先用 ASR 生成草稿再确认，流程同样顺畅；如果对齐服务不可用，点「字数粗排」也能拿到一版可编辑的初稿，全流程不阻塞。
