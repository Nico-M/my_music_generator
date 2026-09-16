# 唱歌视频生成器 — 技术方案 v4

> 用户上传一段音频，应用调用外部服务自动识别歌词并对齐时间线；用户边听边校准，预览「抖音 Notes Todo」竖屏模板，最终渲染 1080×1920 的竖屏 MP4。

## 0. 核心理念（决定一切的四条）

1. **时间轴必须来自用户自己的录音。** 歌词库的歌词文字是准的，但它自带的 LRC 时间轴对应原版录音，与用户的演唱速度、编曲都不同，只能丢弃。逐字时间戳一律来自对当前音频的 ASR。
2. **文字与时间来自不同来源，各取所长。** 语音识别在歌唱场景错字多，但它的时间戳对得上用户的演唱；歌词库文字准确，但时间轴不可用。两者通过拼音对齐合并 —— 拼音层不受简繁差异影响。
3. **预览与渲染共用同一份 React 组件。** 所见即所得靠的是「同一个 Remotion Composition，预览用 Player、导出用 Renderer」，绝不能两套 DOM。
4. **不引入本地机器学习依赖。** 识别与对齐全部走外部 API，整个应用是一个 Next.js 服务。曾经存在的 Python worker 与独立对齐服务（faster-whisper / Demucs / WhisperX）已全部移除，原因见 §5.2、§5.4。

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 + API | **Next.js (App Router) + TypeScript** | route handlers 当 API，单服务 |
| UI | React + Tailwind + Zustand | 编辑器状态用 Zustand，简单够用 |
| 预览 | **`@remotion/player`** | 与渲染共用 Composition |
| 渲染 | **Remotion (`@remotion/renderer`)** | 模板就是 HTML/CSS，天生契合 |
| DB | **SQLite + Prisma** | 单机够用，以后换 Postgres 零成本 |
| 音频探针 | `ffprobe` | 取时长 |
| 歌词识别 | **MiniMax ASR**（外部 API） | 逐字时间戳，对应本录音 |
| 歌词文字 | **api.lrc.cx**（外部 API） | 准确歌词，时间轴丢弃 |
| 简繁 / 拼音对齐 | **`pinyin-pro`** | 纯 JS，简繁在拼音层自然统一 |
| 部署 | Docker Compose（单 web 服务） | 本地或自托管环境 |

**为什么不再需要 Python**：曾用本地 faster-whisper 做识别、Demucs 做人声分离，但中文歌唱场景下识别错字多，且需要约 2GB 的本地依赖。改用商业 ASR 后，文字质量由歌词库保证、时间轴由 ASR 保证，本地 ML 链路失去存在理由。

**为什么保留 SQLite**：单用户场景下并发压力低，Prisma 让将来切 Postgres 的成本接近零。

---

## 2. 系统架构

```
┌────────────────────────────────────────────────────────────┐
│  web/  (Next.js，单容器)                                     │
│  ┌───────────────┐   ┌────────────────────────────────┐    │
│  │ 编辑器前端      │   │ route handlers (API)           │    │
│  │ - 播放器        │   │ - 上传 / 项目 / 歌词            │    │
│  │ - 时间线列表    │←→ │ - 起识别任务 / 起渲染任务        │    │
│  │ - Remotion      │   │ - ffprobe / Remotion render    │    │
│  │   Player 预览   │   │ - 独占 SQLite (Prisma)          │    │
│  └───────────────┘   └───────────┬────────────────────┘    │
└──────────────────────────────────┼─────────────────────────┘
                                   │ HTTP（并行）
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      ┌────────────────────┐            ┌──────────────────────┐
      │ MiniMax ASR        │            │ 歌词库 (api.lrc.cx)   │
      │ 本录音的逐字时间戳   │            │ 准确的歌词文字         │
      └────────────────────┘            └──────────────────────┘
                 │                                   │
                 └──────────────┬────────────────────┘
                                ▼
                    拼音对齐（pinyin-pro）→ 时间线
```

渲染与任务调度都在 web 进程内：Remotion 是 Node 包，ASR 与歌词库是 HTTP 调用，没有需要独立进程的重活。任务状态仍写在 SQLite 的 `Job` 表里，前端轮询 `/api/jobs/[id]`。

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
  source     String   @default("manual")      // manual | transcribed | asr-aligned | lrc（transcribed-aligned / weighted / aligned 为历史数据，已不再产生）
  confidence Float?                            // 识别/对齐置信度，低的高亮提醒用户
  @@unique([projectId, index])
}

model Job {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type       String                            // "transcribe" | "render"
  status     String   @default("queued")       // queued|running|done|failed
  progress   Int      @default(0)              // 0-100
  params     Json?                             // 任务入参快照
  resultPath String?                           // 渲染产物路径
  error      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**关键设计**：`source` 和 `confidence` 是体验关键——ASR 草稿行标 `transcribed`，歌词库 + 拼音对齐的行标 `asr-aligned`。前端把低置信度或自动生成的行高亮提醒用户确认，但永远允许用户手动覆盖。

`asr-aligned` 是最有价值的 source 值：它代表时间轴来自真实声学位置（MiniMax ASR 逐字时间戳）与准确歌词文字（歌词库）的合并结果，质量远好于早年按字数平分的猜测。旧版本产出的 `weighted` / `aligned` / `transcribed-aligned` 现已全部废弃——原因见 §5.2、§5.4。

---

## 4. API

```
# 上传与项目
POST   /api/uploads/audio          form-data，存盘 + ffprobe → 返回 {audioPath, durationMs}
POST   /api/projects               创建项目
GET    /api/projects/:id           项目详情（含 lines）
PATCH  /api/projects/:id           改 title / artist / vocalStart / vocalEnd / template

# 歌词与时间线
POST   /api/projects/:id/lyrics/transcribe   起 transcribe job：ASR 时间戳 + 歌词库文字
                                             + 拼音对齐，一次产出歌词与时间线
PUT    /api/projects/:id/timeline            保存用户校准后的全部行时间

# 任务
GET    /api/jobs/:id               轮询 status / result

# 渲染与文件
POST   /api/projects/:id/render    起 render job → jobId
GET    /api/files/:id/preview      预览产物
GET    /api/files/:id/download     下载 MP4

# 配置
POST   /api/ai/test-connection     校验浏览器传来的 MiniMax API Key
```

核心路径是 `transcribe（异步，一次产出文字 + 时间线）→ 手动校准 → preview → render`。

**为什么合并成一步**：早期把「识别歌词」与「对齐时间线」拆成两次操作，理由是失败原因可控。实际使用中用户每次都要点两次、等两次，而两者的耗时几乎全部来自同一次 ASR 调用——歌词库查询和拼音对齐都在本地毫秒级完成。拆分的收益兑现不了，成本却是实打实的，因此合并。歌词库未命中时仍会完成识别，只是文字来自 ASR 原文 + LLM 断句，并在界面上提示需要手工校正。

**`PUT /timeline` 只替换时间**，不碰文字；识别永远是显式触发的，不会在用户编辑过程中偷跑覆盖。

---

## 5. 自动化管线

### 5.1 识别：一次调用产出文字 + 时间线（transcribe）

**认知前提**：唱歌 ASR 不可能 100% 准，尤其中文流行歌、混响、伴奏、人声叠加时会错词漏词。所以不承诺「自动提取即最终歌词」，只承诺「生成可编辑草稿 + 可信的时间轴，减少手打成本」。

```
输入: audioPath, title, artist
  │
  1. 并行取两个来源
  │     a. MiniMax ASR → 逐字时间戳 + 识别文本（时长 > 500s 直接拒绝）
  │     b. 歌词库 api.lrc.cx（按 title + artist 查询）→ 准确歌词文字，时间轴丢弃
  │
  2. 两个来源都有 → 拼音对齐（见 5.2）
  │     歌词库未命中/匹配度过低 → 降级：ASR 原文 + LLM 断句，标记需人工校正
  │
  3. 写回 LyricLine + source
  │
输出: 可编辑歌词行 + 句级时间线
```

### 5.2 拼音对齐（`web/src/lib/lyric-align.ts`）

把准确歌词映射到本录音的时间戳上。核心是**在拼音层做最长公共子序列（LCS）**：

```
输入: ASR units（逐字时间戳）, 歌词库行
  │
  1. cjkOnly: 两侧都只保留 CJK 字符，标点/拉丁文不参与索引
  │
  2. toPinyin: pinyin-pro 转拼音，一字一音节
  │     —— 简繁在此自然统一（听/聽 同为 ting）
  │
  3. alignByPinyin: 动态规划求 LCS，得到「ASR 下标 → 歌词下标」的单调映射
  │     未命中的间隙在锚点之间线性插值
  │
  4. 整体匹配率 < 50% → 判定不是同一首，放弃（返回原因，走降级）
  │
  5. 命中歌词下标按行分桶，ASR 字符的首尾时间即该行时间
  │     某行被唱到的字符不足该行字数一半 → 丢弃（对应本录音没唱的部分）
  │
输出: 行级时间线
```

**为什么必须单调**：LCS 映射天然单调，重复段落（副歌）不会把后面所有行带偏。早年字符集合重叠的做法不具备这个性质，一次误命中会污染后续所有行——见 §5.4。

**匹配率门槛的作用**：用户可能翻唱的是另一首歌、或歌词库查错了。低于 50% 直接放弃而不是硬凑，因为「看起来对齐好了但全是错的」比「明确告诉用户没匹配上」更有害。

### 5.3 降级：LLM 断句

歌词库未命中，或匹配率低于门槛时：

```
输入: ASR 识别文本 + 音频时长
  │
  1. MiniMax 文本模型按语义断行（原 ASR 文本无换行）
  │
  2. 时间按断句结果的比例分配
  │
  3. 界面提示：歌词来自语音识别，可能有错字，请在时间线里校正
  │
输出: 可编辑歌词行 + 时间线（source="transcribed"）
```

识别本身不会失败，只是质量降一档，并且**明确告知用户降级了**。

### 5.4 已删除的路径——为什么不再提供

以下实现曾经存在，现已连同端点、按钮、依赖一起删除。记录于此，避免以后被重新实现回来。

| 已删除 | 原做法 | 删除原因 |
|---|---|---|
| **assisted**（字符匹配对齐） | 拿歌词行去 ASR segment 里找字符重叠最高的一段 | 用去重字符 `Set` 求交，丢失顺序：「我爱他」与「他爱我」得分相同；重复字被折叠；单调游标不可逆，一次误命中连带后续全偏；命中阈值仅 0.3 形同虚设。**它比粗排更有害**——粗排一眼看得出是平均分，它却给出带 confidence、看着精确实则错误的时间线 |
| **weighted**（字数权重粗排） | 按每行字数把演唱时长等分 | 与 ASR 时间戳相比毫无竞争力；有 ASR 时它只是坏数据。且它让用户误以为已经对齐 |
| **Python worker + faster-whisper** | 本地进程轮询 Job 表跑识别 | 中文歌唱场景错字多，需约 2GB 本地依赖，却仍要用户手动校正。商业 ASR 免费额度足够，质量更好 |
| **独立 aligner 服务**（FastAPI + Demucs + 词级 ASR） | 通过 `REMOTE_ALIGN_URL` 调用的远端对齐服务 | 需 GPU、分钟级耗时、单独部署与维护，而它解决的「词级时间戳」问题，MiniMax ASR 一次调用就给了。Demucs 人声分离对最终质量的影响远小于维护成本 |

**从中学到的**：分词/对齐这类问题，在**拼音层用 LCS** 与在**字符层用集合重叠**是质变而非量变。前者单调、可解释、可拒绝；后者是启发式打分的堆积，调参永远调不到可靠。

---

## 6. 外部依赖与失败模式

| 依赖 | 用途 | 失败时 |
|---|---|---|
| MiniMax ASR | 逐字时间戳 | 直接失败并提示；时长超 500s 提前拒绝 |
| api.lrc.cx 歌词库 | 歌词文字 | 降级到 LLM 断句，界面提示需校正 |
| MiniMax 文本模型 | 降级时的断句 | 用 ASR 原始分段断行 |

**隐私**：音频会上传至 MiniMax；歌曲名与歌手名会发往歌词库。API Key 只存浏览器 `localStorage`，随请求头发送，不落库。

---

## 7. 模板与「预览=渲染」同构（Remotion）

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

## 8. 两个容易踩坑的点

**A. 长歌词滚动**：参考图 15 行刚好一屏，但歌词一多必须滚。`ScrollingList` 让 `currentIdx` 始终居中：

```tsx
const targetScroll = currentIdx * lineHeight - viewportH / 2;
const scroll = interpolate(/* spring 平滑过渡到 targetScroll */);
// translateY(-scroll)
```

**B. 音画同步**：靠 Remotion 的 `<Audio>` 把原始音频直接编进 Composition，避免渲完帧再 mux 导致差一两帧。

---

## 9. 目录结构

```
singing_web/my_music_generator/
├─ web/                          # Next.js（唯一服务）
│  ├─ src/app/
│  │  ├─ api/                    # route handlers（§4）
│  │  └─ projects/[id]/page.tsx  # 编辑器主工作台
│  ├─ src/components/            # 播放器、歌词编辑、时间线、设置面板
│  ├─ src/remotion/              # ★ 预览=渲染 同构组件
│  ├─ src/lib/
│  │  ├─ minimax-asr.ts          # MiniMax ASR 客户端（逐字时间戳）
│  │  ├─ minimax-llm.ts          # 降级断句用
│  │  ├─ lrc.ts                  # 歌词库查询 + LRC 解析
│  │  ├─ lyric-align.ts          # ★ 拼音 LCS 对齐
│  │  ├─ lyric-rows.ts           # 行拆分/衔接
│  │  ├─ render.ts               # @remotion/renderer 调用
│  │  └─ paths.ts / store.ts     # 目录约定、状态
│  └─ prisma/schema.prisma
├─ data/                         # uploads / renders
├─ docs/                         # 本文件与实施计划
├─ assets/                       # README 截图
└─ docker-compose.yml
```

---

## 10. 阶段拆分

| 阶段 | 内容 | 状态 |
|---|---|---|
| **1. 骨架** | Next.js + Prisma + 上传 + ffprobe + 项目创建 | ✅ |
| **2. 时间线编辑器** | 播放器、句列表、打点、微调、快捷键、保存 | ✅ |
| **3. 竖屏预览** | `@remotion/player` + 同构组件 + 滚动 | ✅ |
| **4. 渲染** | `@remotion/renderer` → 1080×1920/30fps/h264 带音频 | ✅ |
| **5. 歌词识别与对齐** | MiniMax ASR + 歌词库 + 拼音 LCS，一次产出文字与时间线 | ✅ |
| **6. 降级路径** | 歌词库未命中 → LLM 断句 + 界面提示 | ✅ |
| **7. 收敛与清理** | 删除 worker / aligner / 远端对齐 / 粗排 / 字数对齐 | ✅ |
| **8. 部署** | Docker Compose（单 web 服务）本地或自托管 | 待做 |

**已交付**：上传音频 → 一键识别 → 得到带错字提示的歌词与时间线 → 手动校准 → 预览 → 导出 MP4，全流程可用，无本地 ML 依赖。

**尚未做**：LRC 导入导出（用户劳动成果复用）、多用户、Postgres。

---

## 11. 风险与预案

| 风险 | 预案 |
|---|---|
| 唱歌 ASR 错词漏词 | ASR 文字只作草稿；歌词库命中时文字来自歌词库，未命中时明确提示需校正 |
| 歌词库查错歌 / 用户翻唱别的歌 | 拼音匹配率低于 50% 直接放弃并降级，不硬凑 |
| MiniMax 不可用或超时 | job 标 failed 并保留错误信息；音源与项目数据不受影响，可重试 |
| 音频超过 500 秒 | 调用前用 ffprobe 的时长提前拒绝，不浪费一次上传 |
| API Key 泄漏 | 只存浏览器 `localStorage`，不落库、不进日志；服务端仅透传 |
| 对齐质量差 | 低匹配率的行不产出，界面提示需人工校正；永远保留手动打点 |
| Remotion 渲染慢（5400 帧） | 当前接受；量产再评估 ffmpeg + ASS 路线 |
| SQLite 并发 | 单用户够；多用户再换 Postgres（Prisma 零成本切） |

---

## 附：成功标准

用户上传音频后点一次「识别歌词」，得到一版歌词基本正确、时间轴对得上演唱的时间线。用户听一遍确认，少数行手动微调，即可生成节奏正确、预览与导出一致的 9:16 竖屏歌词视频。歌词库没命中时也能拿到带错字提示的草稿，全流程不阻塞。
