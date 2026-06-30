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

## 使用流程

1. 创建一个项目，上传你的录音文件
2. 选择录音的语言，启动转写（自动生成歌词文本）
3. 根据需要编辑歌词，或使用时间轴对齐工具精调
4. 选择一个喜欢的视觉模板
5. 点击渲染，等待视频生成
6. 下载最终的 MP4 视频

## 本地运行

项目基于 Next.js（Web 端）+ Python（后台 Worker）架构。Web 端负责项目管理、上传和任务入库，Worker 负责消费 SQLite 里的转写/对齐任务。

### 方式一：Docker Compose

使用 Docker Compose 启动 Web 和 Worker：

```bash
docker compose up --build
```

Web 服务默认运行在 `http://localhost:3000`。

如果是首次运行，先确认共享数据目录存在，并用 Prisma 初始化 SQLite 表结构：

```bash
mkdir -p data/uploads data/renders
cd web
npx prisma db push
cd ..
docker compose up --build
```

### 方式二：本地开发启动

1. 安装 Web 依赖：

```bash
cd web
npm install
```

2. 初始化 SQLite 数据库：

```bash
mkdir -p ../data/uploads ../data/renders
npx prisma db push
```

`prisma.config.ts` 默认会把数据库创建到 `../data/sqlite.db`。如果需要自定义路径，可以设置：

```bash
DATABASE_URL=file:/absolute/path/to/sqlite.db
```

3. 启动 Web：

```bash
npm run dev
```

4. 安装并启动 Worker：

```bash
cd ../worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Worker 正常启动后会输出类似：

```text
Worker started. Polling .../data/sqlite.db every 5s...
```

### 常见问题

- 如果执行 `python main.py` 提示 `python: command not found`，先运行 `source .venv/bin/activate`，或直接用 `.venv/bin/python main.py`。
- 如果 Worker 报 `sqlite3.OperationalError: unable to open database file`，通常是还没有创建 `data` 目录或没有执行 `npx prisma db push`。
- `faster-whisper` 会在首次转写时下载模型，首次执行需要网络，并且耗时会更长。

## 效果示例

<p align="center">
  <img src="assets/output_example.png" alt="输出视频示例" width="540">
</p>
