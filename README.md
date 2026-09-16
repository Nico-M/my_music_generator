# Singing Video Generator

![站点截图](assets/Screenshot_singvid.jpeg)

## 简介

**Singing Video Generator** 是一个利用你自己的录音，自动生成歌词/演唱视频的在线工具。上传一段人声或音乐录音，选择喜欢的视觉模板，即可快速生成一条带有歌词字幕和动态画面的视频。

适合用于翻唱展示、社媒短视频、音乐 Demo、练唱记录等场景。

## 核心功能

- **录音上传** — 支持 MP3、WAV、M4A、OGG 等常见音频格式
- **智能转写** — 自动识别录音中的歌词/语音内容
- **时间轴对齐** — 将歌词行精确对齐到录音的时间位置
- **多模板选择** — 可选不同的视觉风格与排布方式
- **视频渲染** — 基于 Remotion 引擎生成高质量 MP4 视频
- **成品下载** — 一键下载渲染完成的视频文件

<p align="center">
  <img src="assets/screen-shot-01.jpg" alt="编辑器工作台" width="820">
</p>

## 使用流程

1. 创建一个项目，上传你的录音文件
2. 选择录音的语言，启动转写（自动生成歌词文本）
3. 根据需要编辑歌词，或使用时间轴对齐工具精调
4. 选择一个喜欢的视觉模板
5. 点击渲染，等待视频生成
6. 下载最终的 MP4 视频

<p align="center">
  <img src="assets/screen-shot-02.jpg" alt="时间线对齐" width="820">
</p>

## 架构

项目由三个可独立运行的组件构成：

```
┌──────────────────────────────────────────────────────────────┐
│  web/  (Next.js)                                             │
│  项目管理、上传、歌词编辑、时间线校准、预览、渲染调度            │
│  独占 SQLite；对 worker 通过 Job 表通信，对 aligner 通过 HTTP   │
└───────┬──────────────────────────────────────┬───────────────┘
        │ 写/读 Job 表 (SQLite)                 │ HTTP (REMOTE_ALIGN_URL)
        ▼                                      ▼
┌───────────────────────┐        ┌───────────────────────────────┐
│  worker/  (Python)    │        │  aligner/  (FastAPI)          │
│  轮询 SQLite 消费任务   │        │  Demucs 人声分离               │
│  · 识别歌词 (ASR)      │        │  faster-whisper 词级 ASR       │
│  · 精确对齐 (降级路径)  │        │  pypinyin + rapidfuzz 对齐     │
│  需与 web 共享文件系统   │        │  可部署在本机或另一台机器        │
└───────────────────────┘        └───────────────────────────────┘
```

**关于两条对齐路径**：`aligner` 是主路径，自带人声分离与 ASR，只需要音频和歌词，可部署在算力更强的机器上。`worker` 里的对齐实现是降级路径——它复用本地已识别出的词级时间戳，不做 ASR，因此必须先在界面上跑一次「识别歌词」。仅当未配置 `REMOTE_ALIGN_URL` 时才会走到它。

如果不需要 AI 对齐，可以只跑 `web`，用「字数粗排」按歌词字数平均分配时间完成整条流程。

## 本地运行

### 前置要求

- Node.js 18+ 与 npm
- Python 3.10+
- （可选）`ffmpeg`，用于音频探针与 Demucs

### 方式一：本地开发启动

**1. 初始化数据目录与数据库**

```bash
mkdir -p data/uploads data/renders
cd web
npm install
npx prisma db push
```

`prisma.config.ts` 默认会把数据库创建到 `../data/sqlite.db`。如需自定义路径：

```bash
DATABASE_URL=file:/absolute/path/to/sqlite.db
```

**2. 启动 Web**

```bash
npm run dev
```

默认运行在 `http://localhost:3000`。

**3. 启动 Worker（可选）**

需要「识别歌词」功能时才启动。它消费 SQLite 里的转写/对齐任务，因此必须与 Web 共享同一个 `data/` 目录。

```bash
cd ../worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

正常启动会输出：

```text
Worker started. Polling .../data/sqlite.db every 5s...
```

**4. 启动 aligner（可选，推荐）**

需要「精确对齐」时才启动。详见 [`aligner/README.md`](aligner/README.md)，简版：

```bash
cd aligner
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# 需要人声分离时再装（约 2GB）
pip install torch torchaudio
cp .env.example .env      # 按需修改，尤其是 ALIGN_DEMUCS_CMD
python -m app.main
```

然后在 `web/.env.local` 中指向它：

```bash
REMOTE_ALIGN_URL=http://127.0.0.1:8088
```

改动 `web/.env.local` 后需要重启 Web 服务才会生效。

### 方式二：Docker Compose（尚未可用）

> ⚠️ `docker-compose.yml` 已定义 `web` 与 `worker` 两个服务，但两个 `Dockerfile` 尚未编写，且 `aligner` 服务未接入。目前请使用上面的本地开发方式启动。

### 功能与组件对照

| 功能 | 依赖组件 | 未启动时的表现 |
|---|---|---|
| 项目管理、歌词编辑、时间线校准、渲染、下载 | `web` | — |
| 识别歌词（ASR 生成草稿） | `web` + `worker` | 按钮报错，可手动粘贴歌词 |
| 字数粗排（按字数分配时间） | `web` | 无外部依赖，永不失败 |
| 精确对齐（声学对齐） | `web` + `aligner` | 按钮报错，退回字数粗排 |

### 常见问题

- **`python: command not found`** — 先 `source .venv/bin/activate`，或直接用 `.venv/bin/python main.py`。
- **`sqlite3.OperationalError: unable to open database file`** — 通常是没创建 `data/` 目录，或没执行 `npx prisma db push`。
- **首次转写很慢** — `faster-whisper` 首次运行会从 HuggingFace 下载模型，需要网络。
- **`aligner` 的 `/health` 里 `demucs_configured` 为 `false`** — 说明 `ALIGN_DEMUCS_CMD` 为空或指向的文件不存在，此时会静默跳过人声分离、只用原音频跑 ASR，对齐质量下降但不报错。参考 [`aligner/README.md`](aligner/README.md#configuring-demucs)。
- **精确对齐一直失败** — 确认 `REMOTE_ALIGN_URL` 指向的服务在运行（`curl $REMOTE_ALIGN_URL/health`）。注意 Web 只在启动时读取该变量，且只要它非空就一定走远端，不会自动降级到 `worker`。
- **对齐结果全行置信度相同、时间均匀分布** — 说明远端走到了 `proportional_fallback`（按歌词长度比例分配），而非真正的声学匹配，通常意味着 ASR 覆盖率不足。可尝试更换 `ALIGN_WHISPER_MODEL` 或先确认音频质量。

## 效果示例

<p align="center">
  <img src="assets/screen-shot-03.jpg" alt="渲染输出" width="820">
</p>

<p align="center">
  <img src="assets/output_example.png" alt="输出视频示例" width="540">
</p>
