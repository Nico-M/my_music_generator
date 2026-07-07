import {
  notesDefaultConfig,
  normalizeNotesConfig,
  notesParameterDefinitions,
  type NotesTemplateConfig,
} from './notes/config';
import {
  recordDefaultConfig,
  normalizeRecordConfig,
  recordParameterDefinitions,
  type RecordTemplateConfig,
} from './record/config';
import {
  neonDefaultConfig,
  normalizeNeonConfig,
  neonParameterDefinitions,
  type NeonSpectrumConfig,
} from './neon-spectrum/config';
import {
  liquidDefaultConfig,
  normalizeLiquidConfig,
  liquidParameterDefinitions,
  type LiquidWaveConfig,
} from './liquid-wave/config';
import {
  posterDefaultConfig,
  normalizePosterConfig,
  posterParameterDefinitions,
  type LyricPosterConfig,
} from './lyric-poster/config';
import type { TemplateMetadata } from './types';

export const templateMetadata = {
  notes: {
    id: 'notes',
    name: 'Notes',
    description: {
      zh: 'iPhone Notes 风格清单歌词模板',
      en: 'iPhone Notes style checklist lyrics template',
    },
    defaultConfig: notesDefaultConfig,
    normalizeConfig: normalizeNotesConfig,
    parameters: notesParameterDefinitions,
  },
  record: {
    id: 'record',
    name: 'Record',
    description: {
      zh: 'iPhone 语音备忘录风格歌词模板',
      en: 'iPhone Voice Memo style lyrics template',
    },
    defaultConfig: recordDefaultConfig,
    normalizeConfig: normalizeRecordConfig,
    parameters: recordParameterDefinitions,
  },
  'neon-spectrum': {
    id: 'neon-spectrum',
    name: 'Neon Spectrum',
    description: {
      zh: '霓虹夜店舞台，动态频谱条和发光歌词',
      en: 'Neon nightclub stage with animated spectrum bars and glowing lyrics',
    },
    defaultConfig: neonDefaultConfig,
    normalizeConfig: normalizeNeonConfig,
    parameters: neonParameterDefinitions,
  },
  'liquid-wave': {
    id: 'liquid-wave',
    name: 'Liquid Wave',
    description: {
      zh: '梦幻液态波浪，空灵浮动的歌词',
      en: 'Dreamy liquid waves and ripples with ethereal floating lyrics',
    },
    defaultConfig: liquidDefaultConfig,
    normalizeConfig: normalizeLiquidConfig,
    parameters: liquidParameterDefinitions,
  },
  'lyric-poster': {
    id: 'lyric-poster',
    name: 'Lyric Poster',
    description: {
      zh: '全屏编辑海报，动态文字排印',
      en: 'Full-screen editorial poster with animated kinetic typography',
    },
    defaultConfig: posterDefaultConfig,
    normalizeConfig: normalizePosterConfig,
    parameters: posterParameterDefinitions,
  },
} as const;

export type TemplateId = keyof typeof templateMetadata;
export const templateOptions = Object.values(templateMetadata);

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value in templateMetadata;
}

export function getTemplateMetadata(templateId: string | null | undefined): TemplateMetadata {
  if (isTemplateId(templateId)) {
    return templateMetadata[templateId] as unknown as TemplateMetadata;
  }
  return templateMetadata.notes as unknown as TemplateMetadata;
}
