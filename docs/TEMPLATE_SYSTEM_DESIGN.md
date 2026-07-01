# 模板系统设计方案

> 目标：把当前固定的 iPhone Notes 风格歌词视频，演进为可扩展的模板系统。后续新增 iPhone Record / Voice Memo 风格时，不需要重写编辑器、渲染流程和项目数据模型。

---

## 1. 背景与问题

当前项目已经具备完整的视频生成主链路：

- 基础数据：`Project`、`LyricLine`、音频、歌词、timeline
- 预览：`@remotion/player`
- 导出：`@remotion/renderer`
- 当前模板：固定写死在 `web/remotion/LyricVideo.tsx`

但现状还不能称为“模板系统”，主要问题有三点：

1. `template` 字段目前只承载了一个 `username`，并没有表达“选择了哪个模板”。
2. `LyricVideo` 既是通用视频入口，又是具体的 Notes 视觉实现，职责混在一起。
3. 预览和导出虽然共用 Remotion 组件，但没有“模板注册层”，后续新增模板时只能继续堆 `if/else`。

这会直接导致两个后果：

- 一旦加入第二个模板，数据结构、UI 表单、Remotion 组件边界会迅速混乱。
- 模板新增越多，公共数据模型越容易被模板私货污染。

---

## 2. 设计目标

本方案的目标很明确：

1. 基础内容与模板表现彻底分层。
2. 模板切换不影响歌词、timeline、音频等公共数据。
3. 预览与导出继续共用同一套模板渲染组件。
4. 新增模板时，变更集中在模板目录和模板注册表，不扩散到业务主链路。
5. 模板可以声明自己的配置项，但不能反向污染公共数据模型。

---

## 3. 核心原则

### 3.1 基础内容是稳定层

以下信息属于“歌曲/项目本身”，不应该因为模板变化而变化：

- `title`
- `singer`
- `audioPath` / `audioSrc`
- `durationMs`
- `lines`
- `timeline`
- 品牌名 / 展示名（当前代码里叫 `username`）

这些数据应作为所有模板共享的输入。

### 3.2 模板只负责“怎么展示”

模板的职责应限制在以下范围：

- 背景样式
- 顶部信息区布局
- 歌词排版与滚动方式
- 当前行高亮方式
- 辅助视觉元素，如勾选框、波形、录音计时、卡片外壳

模板不应该接管以下内容：

- 歌词文本来源
- timeline 生成逻辑
- 项目创建流程
- 渲染任务调度

### 3.3 模板配置必须局部化

模板专属配置只能存在于自己的 `templateConfig` 中，不能散落为一堆全局字段。

例如：

- Notes 模板可以有 `showCheckbox`
- Record 模板可以有 `waveformStyle`

但这些字段都不应该出现在 `Project` 的顶层字段中。

---

## 4. 边界划分

推荐把系统拆为三层。

### 4.1 基础数据层

只表达“这首歌/这个项目是什么”。

```ts
export interface BaseVideoData {
  title: string;
  singer?: string | null;
  creatorName?: string | null;
  durationMs: number;
  audioSrc?: string;
  lines: Array<{
    index: number;
    text: string;
    startMs: number | null;
    endMs: number | null;
  }>;
}
```

### 4.2 模板描述层

只表达“当前选的是哪个模板，以及它自己的配置是什么”。

```ts
export interface TemplateSelection {
  templateId: string;
  templateConfig: Record<string, unknown>;
}
```

### 4.3 模板渲染层

只负责把 `BaseVideoData + templateConfig` 渲染成视频画面。

```ts
export interface TemplateRenderProps<TConfig> {
  data: BaseVideoData;
  config: TConfig;
}
```

---

## 5. 数据模型建议

当前 `Project.template` 是一个 JSON 字符串，内部只放 `username`。这不够用。

主线方案直接拆字段，不继续把 `templateId` 藏在 JSON 字符串里。这个项目当前只有 SQLite + 三张主表，schema 迁移成本低于长期维护“JSON 万能字段”的成本。

```prisma
model Project {
  id             String  @id @default(cuid())
  title          String
  audioPath      String
  durationMs     Int
  singer         String?
  creatorName    String?
  templateId     String  @default("notes")
  templateConfig String?
  template       String? // 旧字段：仅用于兼容 { "username": "..." }，迁移完成后删除
}
```

字段语义：

- `creatorName`：通用展示名，替代当前 `username`
- `templateId`：当前模板，如 `notes`、`record`
- `templateConfig`：模板专属配置，JSON 字符串
- `template`：旧字段，只做兼容读取和迁移来源

### 5.1 旧数据兼容

当前已有项目的 `template` 字段只包含 `{ "username": "音乐" }`。迁移策略：

1. schema 先新增 `creatorName`、`templateId`、`templateConfig`，保留旧 `template`。
2. 读取项目时，如果 `creatorName` 为空，则从旧 `template.username` 回填运行时展示值。
3. 数据迁移脚本将旧 `template.username` 写入 `creatorName`，并把 `templateId` 设为 `notes`。
4. 确认旧数据迁移完成后，再删除旧 `template` 字段。

运行时兼容不能替代数据迁移。它只是保证迁移窗口内旧项目仍可预览和导出。

---

## 6. 命名约定

当前字段名 `username` 只适合 Notes 模板，不适合通用模板系统。

主线统一使用 `creatorName`。它比 `username` 更通用，能覆盖：

- Notes 风格里的“账号名”
- Record 风格里的“来源/演唱者展示位”
- 未来社媒截图类模板的署名信息

如果后续产品明确转向品牌矩阵，可以再改为 `brandName`。当前阶段不要同时维护两个同义字段。

---

## 7. 模板注册中心设计

不要把模板选择逻辑散在多个组件里，应该建立统一 registry。

```ts
export interface TemplateDefinition<TConfig> {
  id: string;
  name: string;
  description: string;
  defaultConfig: TConfig;
  normalizeConfig: (input: unknown) => TConfig;
  component: React.ComponentType<TemplateRenderProps<TConfig>>;
}
```

注册表示例：

```ts
export const templateRegistry = {
  notes: notesTemplate,
  record: recordTemplate,
} as const;

export type TemplateId = keyof typeof templateRegistry;
```

实际代码不要用任意 `string` 直接索引 registry。提供一个显式查找函数，统一处理未知模板回退：

```ts
export function getTemplateDefinition(templateId: string | null | undefined) {
  if (templateId && templateId in templateRegistry) {
    return templateRegistry[templateId as TemplateId];
  }

  return templateRegistry.notes;
}
```

### 为什么必须有 `normalizeConfig`

因为模板配置来自数据库，是不可信输入。

`normalizeConfig` 的职责是：

- 合并默认值
- 丢弃非法字段
- 兼容旧配置
- 防止模板组件内部到处写空值判断

这一步不要偷懒，否则模板越多，脏数据越多。

---

## 8. Remotion 层设计

### 8.1 不再让 `LyricVideo` 代表某个具体模板

建议把当前 `LyricVideo` 重构为统一入口，例如：

`templateId` 的类型统一为 `string`（或全程用 `TemplateId`），不要在这里写死 `'notes' | 'record'`。因为它最终来自数据库 `Project.templateId`（Prisma 里是 `String`），写死字面量联合会和 DB 取值打架，未知值的兜底交给 `getTemplateDefinition`。

```ts
export interface TemplateVideoProps {
  data: BaseVideoData;
  templateId: string;
  templateConfig?: Record<string, unknown>;
}
```

运行时流程：

1. `TemplateVideo` 根据 `templateId` 读取 registry
2. 找到模板定义
3. 用 `normalizeConfig` 得到安全配置
4. 由 `TemplateVideo` 统一渲染音频，再渲染模板组件

音频属于 base data，不是模板表现（见 §3.1）。因此 `<Audio>` 必须由统一入口 `TemplateVideo` 渲染，而不是散落到每个模板组件内部——否则每新增一个模板都要记得自己塞 `<Audio>`，漏一个就是“导出视频没声音”，而且这类问题在浏览器预览里未必立刻暴露，到导出才发现。

```tsx
import { Audio } from 'remotion';

export const TemplateVideo: React.FC<TemplateVideoProps> = ({
  data,
  templateId,
  templateConfig,
}) => {
  const definition = getTemplateDefinition(templateId);
  const config = definition.normalizeConfig(templateConfig);
  const Component = definition.component;

  return (
    <>
      {data.audioSrc && <Audio src={data.audioSrc} />}
      <Component data={data} config={config} />
    </>
  );
};
```

对应地，模板组件只负责画面，不再自行渲染 `<Audio>`；当前 `LyricVideo.tsx` 顶层的 `<Audio>` 迁移时要上移到 `TemplateVideo`，不要跟着 `Header` / `ScrollingList` 一起进模板目录。

### 8.2 Remotion bundle 边界

当前 Remotion bundle 入口是 `web/remotion/index.ts`，导出时由 `@remotion/bundler` 单独打包。模板渲染代码必须遵守这个边界：

- `TemplateVideo`、模板组件、模板渲染 registry 放在 `web/remotion/templates/`
- 这些文件只能依赖 React、Remotion、纯函数工具和静态资源
- 不能 import Prisma、Next route handler、Node `fs/path`、`@/lib/render` 等服务端代码
- 不能依赖浏览器外部全局状态，如 Zustand editor store

编辑器侧可以有自己的模板元信息，例如模板名称、选择器文案、设置表单组件；但这部分不要被 Remotion bundle 引入。

推荐目录：

```text
web/remotion/
  TemplateVideo.tsx
  constants.ts
  templates/
    types.ts
    registry.ts
    shared/
      timing.ts
    notes/
      NotesTemplate.tsx
      config.ts
    record/
      RecordTemplate.tsx
      config.ts

web/src/templates/
  metadata.ts
  NotesTemplateSettings.tsx
  RecordTemplateSettings.tsx
```

`BaseVideoData`、`RenderInput` 这类公共类型会被 `web/remotion/*` 和 `web/src/lib/*` 同时消费。可以把它们放在纯类型文件里，并且只允许 `import type` 引入；不要从 `src/lib` 运行时 import Remotion registry 或模板组件，否则会破坏 bundle 边界。

### 8.3 `Root.tsx` 只注册统一 Composition

Composition 仍建议只保留一个入口，而不是每个模板单独注册一个 Composition。

原因：

- 预览和导出调用方式统一
- 模板切换只是改 props，不是改 composition id
- 未来批量渲染或任务调度更简单

迁移时注意：`Root.tsx` 现有 `defaultProps` 是旧形状 `{ lines, durationMs, title }`，`component` 换成 `TemplateVideo` 后必须同步改成新 props 形状 `{ data, templateId, templateConfig }`，否则 Remotion Studio 和 `selectComposition()` 的默认 props 类型会对不上。

### 8.4 时长来源

视频总时长由项目音频时长决定，不由模板决定。

统一规则：

```ts
import { FPS } from './constants';

const durationInFrames = Math.max(1, Math.ceil((durationMs / 1000) * FPS));
```

`Root.tsx` 中的 `durationInFrames: 300` 只是 Remotion 默认值。预览和导出必须都用同一条规则从 `Project.durationMs` 推导真实帧数。

当前导出链路的真实入口是 `web/scripts/render-worker.ts`，不是 `web/src/lib/render.ts`。导出侧 `selectComposition()` 拿到的是 Root 默认 300 帧，必须在 worker 中保留显式覆盖：

```ts
composition.durationInFrames = durationInFrames;
```

预览侧通过 `<Player durationInFrames={durationInFrames} />` 控制时长；导出侧通过上面的 composition mutation 控制时长。两条机制不同，但帧数计算必须来自同一个 helper 或同一个 `FPS` 常量。

---

## 9. 预览与导出链路

预览和导出的输入必须统一，否则“所见即所得”会失真。

### 9.1 统一输入结构

```ts
export interface RenderInput {
  data: BaseVideoData;
  templateId: string;
  templateConfig?: Record<string, unknown>;
}
```

这里“统一”指结构统一，不表示每个字段在预览和导出时取值完全相同。尤其是 `audioSrc`：

- 预览侧：浏览器可访问的 API URL，例如 `/api/files/xxx.mp3`
- 导出侧：Remotion 离线渲染可访问的绝对 URL，例如 `http://localhost:3000/api/files/xxx.mp3`

模板层不关心这两者的差异。差异必须在 `RenderInput` 组装层解决。

### 9.2 统一 `buildRenderInput`

必须消灭 `PreviewPanel` 和 `render-worker.ts` 各自手拼 input props 的现状。

建议提供一个统一 builder：

```ts
export type RenderInputMode = 'preview' | 'render';

export interface BuildRenderInputArgs {
  mode: RenderInputMode;
  title: string;
  singer?: string | null;
  creatorName?: string | null;
  audioPath: string;
  durationMs: number;
  lines: BaseLyricLine[];
  templateId?: string | null;
  templateConfig?: string | null;
  legacyTemplate?: string | null;
  renderBaseUrl?: string;
}

export function buildRenderInput(args: BuildRenderInputArgs): RenderInput {
  // mode="preview" 时把 /data/uploads/xxx 转为 /api/files/xxx
  // mode="render" 时把 /data/uploads/xxx 转为带 host 的绝对 URL
}
```

这个函数是预览和导出一致性的核心。后续新增模板时，不允许绕过它直接拼 `inputProps`。

`buildRenderInput` 必须放在 `web/src/lib/` 这类 worker 子进程可 import 的位置，并保持纯函数约束：

- 不能依赖 Next request/response
- 不能依赖 React hooks 或浏览器状态
- 不能 import Prisma client
- 可以接收 `renderBaseUrl` 作为参数，由调用方传入

`web/src/lib/render.ts` 当前不是实际导出入口。如果保留它，只能作为被 `render-worker.ts` 复用的薄封装；否则应在实现阶段删除，避免团队误改死代码。

### 9.3 PreviewPanel

`PreviewPanel` 不再直接依赖 Notes 风格组件，而是统一传给 `TemplateVideo`。

```tsx
<Player
  component={TemplateVideo}
  inputProps={renderInput}
  ...
/>
```

### 9.4 render-worker.ts

真正的导出由 `POST /api/projects/[id]/render` 创建 job 后，spawn detached 子进程执行 `web/scripts/render-worker.ts`。所以导出侧的改造目标是 worker，而不是未被调用的 `web/src/lib/render.ts`。

```ts
const renderInput = buildRenderInput({
  mode: 'render',
  title: project.title,
  singer: project.singer,
  creatorName: project.creatorName,
  audioPath: project.audioPath,
  durationMs: project.durationMs,
  lines: project.lines,
  templateId: project.templateId,
  templateConfig: project.templateConfig,
  legacyTemplate: project.template,
  renderBaseUrl: renderParams.renderBaseUrl,
});

const composition = await selectComposition({
  serveUrl: bundlePath,
  id: 'LyricVideo',
  inputProps: renderInput,
});

await renderMedia({
  composition,
  serveUrl: bundlePath,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps: renderInput,
});
```

这样才能保证：

- 编辑器预览显示什么
- Remotion 导出就生成什么

中间没有第二套模板分支逻辑。

---

## 10. 前端编辑器设计

编辑器建议分成“基础信息区”和“模板设置区”。

### 10.1 基础信息区

所有模板共享：

- 标题
- 演唱者
- `creatorName`
- 歌词
- timeline

### 10.2 模板设置区

只管理模板选择和模板专属配置：

- 模板选择器
- 当前模板预览缩略信息
- 模板专属设置组件

例如：

- Notes 模板可以有 `NotesTemplateSettings`
- Record 模板可以有 `RecordTemplateSettings`

两个模板阶段优先手写设置组件，不引入动态表单 schema。动态 schema 可以作为模板数量明显增加后的扩展点。

### 10.3 切换模板的行为规则

切换模板时：

- 保留歌词
- 保留 timeline
- 保留音频
- 保留标题/演唱者
- 只切换视觉表现和模板专属配置

这是模板系统最重要的用户预期，不能打破。

---

## 11. 模板目录结构建议

模板代码分两类：Remotion 渲染代码和编辑器配置 UI。两者不要混放。

```text
web/remotion/templates/
  types.ts                 # 渲染侧公共类型
  registry.ts              # 渲染侧 registry
  shared/timing.ts         # 当前歌词行等纯函数
  notes/NotesTemplate.tsx
  notes/config.ts
  record/RecordTemplate.tsx
  record/config.ts

web/src/templates/
  metadata.ts              # 编辑器模板列表、名称、描述
  NotesTemplateSettings.tsx
  RecordTemplateSettings.tsx
```

职责建议：

- `web/remotion/templates/*`：只服务 Remotion 预览/导出
- `web/src/templates/*`：只服务 Next 编辑器 UI
- `web/src/lib/template.ts`：保留数据解析、旧数据兼容和 `buildRenderInput`
- `web/scripts/render-worker.ts`：实际导出入口，必须复用 `buildRenderInput`

---

## 12. Notes 模板与 Record 模板的职责示例

### 12.1 Notes 模板

表现特征：

- iPhone Notes 深色背景
- 顶部标题栏
- 纵向滚动歌词列表
- 当前句高亮
- 可选勾选框 / 待办清单感

适合沿用当前实现，只需把现有 `Header` 和 `ScrollingList` 迁入模板目录。

### 12.2 Record 模板

第一版建议不要做逐字卡拉 OK，先做句级推进版本。

表现特征：

- iPhone Record / Voice Memo 风格背景
- 顶部歌曲名 / 演唱者
- 中间当前句大字显示
- 上下显示前后句，透明度递减
- 底部用“伪波形”或进度条表现正在播放

第一版可以完全复用已有 timeline，不必新增音频频谱分析能力。

---

## 13. 推荐的公共辅助接口

很多模板都会用到“当前播放到第几句”的逻辑，这部分不应散在各模板内部。

建议抽公共 helper：

```ts
export interface ActiveLineState {
  currentIndex: number;
  previousIndex: number;
  nextIndex: number;
  progressInLine: number;
  currentTimeMs: number;
}

export function getActiveLineState(
  lines: BaseVideoData['lines'],
  currentTimeMs: number
): ActiveLineState
```

公共辅助的职责：

- 计算当前句索引
- 计算当前句内进度
- 处理首句前 / 尾句后状态
- 避免每个模板重复写一套时间逻辑

---

## 14. API 与存储影响

如果落地模板系统，接口层建议同步升级。

### 14.1 项目创建

创建项目时应支持：

```json
{
  "title": "Song Title",
  "singer": "Singer",
  "creatorName": "音乐",
  "templateId": "notes",
  "templateConfig": {}
}
```

### 14.2 项目更新

项目编辑页至少要能单独更新：

- `templateId`
- `templateConfig`
- `creatorName`

不要要求前端每次都手工序列化整个旧 `template` JSON 再回传，这种接口很脆。

---

## 15. 迁移方案

建议按三步迁移，避免一次改爆。

### Phase 1：抽象层落地，不改视觉

- 引入 `TemplateVideo`
- 引入 `templateRegistry`
- 把当前 Notes 实现迁成 `notes` 模板
- 预览和导出都切到统一入口
- 引入 `buildRenderInput`，`PreviewPanel` 和 `render-worker.ts` 都通过它生成 `inputProps`
- 抽出 `getActiveLineState`
- 统一 `FPS` 和 `durationInFrames` 推导规则
- 让 `render-worker.ts` 复用同一个 `renderInput` 调用 `selectComposition` 和 `renderMedia`
- 删除 `render-worker.ts` 内重复的 `toAbsoluteFileUrl`

此阶段目标是“功能不变，只重构边界”。

验收标准：

- `PreviewPanel` 不再手拼 Remotion `inputProps`
- `render-worker.ts` 不再手拼 Remotion `inputProps`
- `render-worker.ts` 内 `selectComposition` 和 `renderMedia` 使用同一个 `renderInput`
- `render-worker.ts` 不再保留第二份 `toAbsoluteFileUrl`
- 预览和导出使用同一个 `TemplateVideo`
- `<Audio>` 由 `TemplateVideo` 统一渲染，模板组件内不再出现 `<Audio>`
- `Root.tsx` 的 `component` 和 `defaultProps` 已更新为 `TemplateVideo` 的新 props 形状
- 导出侧仍显式覆盖 `composition.durationInFrames`
- 旧 Notes 效果视觉不回退
- 本地预览能播放音频，导出 MP4 也能播放音频

### Phase 2：模板数据模型升级

- schema 新增 `creatorName`、`templateId`、`templateConfig`
- 从旧 `template.username` 兼容读取 `creatorName`
- 增加旧数据迁移脚本或一次性迁移逻辑
- 页面加入模板选择器
- 页面加入模板设置区

此阶段目标是“用户可以切换模板，但先只有 notes 可选”。

### Phase 3：新增 Record 模板

- 新增 `record` 模板组件
- 新增 `record` 的设置组件
- 补充 Record 模板预览与渲染测试

此阶段目标是“第二个模板接入，验证体系成立”。

---

## 16. 非目标

当前阶段不建议做以下事情：

1. 不要做一个通用到接近低代码平台的模板 DSL。
2. 不要让模板定义自己的数据源。
3. 不要让模板接管时间线生成算法。
4. 不要为了模板系统引入过重的插件化机制。

这几个方向都超出当前项目体量，会显著拉高复杂度。

---

## 17. 风险与注意事项

### 17.1 最大风险：公共字段命名失控

如果继续使用 `username` 这种强模板语义字段，后面模板一多会越来越别扭。

### 17.2 最大风险：模板配置变成垃圾场

如果没有 registry 和 `normalizeConfig`，数据库里的模板配置会迅速腐化。

### 17.3 最大风险：预览与导出输入不一致

如果 `PreviewPanel` 和 `render-worker.ts` 分别拼自己的 props，模板系统最后会变成“双实现”。`buildRenderInput` 是这个风险的主要约束点。

### 17.4 最大风险：Remotion bundle 引入服务端代码

模板 registry 如果直接 import Next/Node/Prisma 侧代码，导出构建可能失败，或者把不该进入浏览器/Remotion 的逻辑打进 bundle。渲染侧 registry 必须保持纯 React/Remotion。

### 17.5 最大风险：音频 URL 解析错误

预览侧和导出侧都叫 `audioSrc`，但解析规则不同。模板层消费的是最终 URL，URL 解析只能在 `buildRenderInput` 中集中处理。

---

## 18. 最小可实施接口草案

下面是一套建议的最小接口，足够支持 Notes 和 Record 两个模板。

```ts
export interface BaseLyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export interface BaseVideoData {
  title: string;
  singer?: string | null;
  creatorName?: string | null;
  durationMs: number;
  audioSrc?: string;
  lines: BaseLyricLine[];
}

export interface RenderInput {
  data: BaseVideoData;
  templateId: string; // 来自 Project.templateId；未知值由 getTemplateDefinition 兜底回退 notes
  templateConfig?: Record<string, unknown>;
}

export interface TemplateRenderProps<TConfig> {
  data: BaseVideoData;
  config: TConfig;
}

export interface TemplateDefinition<TConfig> {
  id: string;
  name: string;
  description: string;
  defaultConfig: TConfig;
  normalizeConfig: (input: unknown) => TConfig;
  component: React.ComponentType<TemplateRenderProps<TConfig>>;
}

export type RenderInputMode = 'preview' | 'render';

export interface BuildRenderInputArgs {
  mode: RenderInputMode;
  title: string;
  singer?: string | null;
  creatorName?: string | null;
  audioPath: string;
  durationMs: number;
  lines: BaseLyricLine[];
  templateId?: string | null;
  templateConfig?: string | null;
  legacyTemplate?: string | null;
  renderBaseUrl?: string;
}
```

这套接口的重点不是“绝对完美”，而是：

- 足够小
- 足够清晰
- 足够支撑第二个模板接入

---

## 19. 结论

当前最正确的方向不是“给现有 Notes 组件多加几个 props”，而是先建立模板系统边界。

建议执行顺序：

1. 先抽统一 `TemplateVideo` 和 `templateRegistry`
2. 再升级 `Project` 的模板数据结构
3. 最后接入 `record` 模板

这样做的好处是：

- 不打断现有主链路
- 能快速验证第二个模板
- 后续新增第三、第四个模板时不会继续堆技术债

如果下一步进入实现阶段，优先级最高的是 Phase 1，也就是先把现有 Notes 模板从“写死的页面实现”迁成“注册式模板实现”。
