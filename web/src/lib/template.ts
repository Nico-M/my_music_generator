export const DEFAULT_CREATOR_NAME = '音乐';
export const DEFAULT_TEMPLATE_ID = 'notes';
export const FPS = 30;

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

export interface RenderInput extends Record<string, unknown> {
  data: BaseVideoData;
  templateId: string;
  templateConfig?: Record<string, unknown>;
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

interface LegacyTemplateConfig {
  username?: unknown;
}

export function getDurationInFrames(durationMs: number): number {
  return Math.max(1, Math.ceil((Math.max(0, durationMs || 0) / 1000) * FPS));
}

export function resolveCreatorName(
  creatorName: string | null | undefined,
  legacyTemplate: string | null | undefined
): string {
  const normalizedCreator = normalizeNonEmptyString(creatorName);
  if (normalizedCreator) return normalizedCreator;

  const legacy = parseLegacyTemplate(legacyTemplate);
  const legacyUsername = normalizeNonEmptyString(legacy.username);
  if (legacyUsername) return legacyUsername;

  return DEFAULT_CREATOR_NAME;
}

export function buildRenderInput(args: BuildRenderInputArgs): RenderInput {
  const creatorName = resolveCreatorName(args.creatorName, args.legacyTemplate);
  const templateId = normalizeTemplateId(args.templateId);
  const templateConfig = parseTemplateConfig(args.templateConfig);

  return {
    data: {
      title: args.title,
      singer: args.singer ?? null,
      creatorName,
      durationMs: args.durationMs,
      audioSrc: resolveAudioSrc(args.mode, args.audioPath, args.renderBaseUrl),
      lines: args.lines.map((line) => ({
        index: line.index,
        text: line.text,
        startMs: line.startMs ?? null,
        endMs: line.endMs ?? null,
      })),
    },
    templateId,
    templateConfig,
  };
}

function normalizeTemplateId(templateId: string | null | undefined): string {
  const value = normalizeNonEmptyString(templateId);
  return value ?? DEFAULT_TEMPLATE_ID;
}

function parseTemplateConfig(templateConfig: string | null | undefined): Record<string, unknown> {
  if (!templateConfig) return {};
  try {
    const parsed = JSON.parse(templateConfig) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep default empty object for malformed payloads from old data.
  }
  return {};
}

function parseLegacyTemplate(template: string | null | undefined): LegacyTemplateConfig {
  if (!template) return {};
  try {
    const parsed = JSON.parse(template) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LegacyTemplateConfig;
    }
  } catch {
    return {};
  }
  return {};
}

function resolveAudioSrc(mode: RenderInputMode, audioPath: string, renderBaseUrl?: string): string {
  if (!audioPath) return '';
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const apiPath = audioPath.replace('/data/uploads/', '/api/files/');
  if (mode === 'preview') return apiPath;

  const baseUrl = normalizeNonEmptyString(renderBaseUrl) ?? normalizeNonEmptyString(process.env.RENDER_BASE_URL);
  if (!baseUrl) {
    throw new Error('Missing renderBaseUrl for local audio asset rendering');
  }
  return new URL(apiPath, baseUrl).toString();
}

function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
