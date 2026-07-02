import { NotesTemplate } from './notes/NotesTemplate';
import { normalizeNotesConfig, notesDefaultConfig, type NotesTemplateConfig } from './notes/config';
import { RecordTemplate } from './record/RecordTemplate';
import { normalizeRecordConfig, recordDefaultConfig, type RecordTemplateConfig } from './record/config';
import { NeonSpectrumTemplate } from './neon-spectrum/NeonSpectrumTemplate';
import { normalizeNeonConfig, neonDefaultConfig, type NeonSpectrumConfig } from './neon-spectrum/config';
import { LiquidWaveTemplate } from './liquid-wave/LiquidWaveTemplate';
import { normalizeLiquidConfig, liquidDefaultConfig, type LiquidWaveConfig } from './liquid-wave/config';
import { LyricPosterTemplate } from './lyric-poster/LyricPosterTemplate';
import { normalizePosterConfig, posterDefaultConfig, type LyricPosterConfig } from './lyric-poster/config';
import type { TemplateDefinition } from './types';

const notesTemplate: TemplateDefinition<NotesTemplateConfig> = {
  id: 'notes',
  name: 'Notes',
  description: 'iPhone Notes style checklist lyrics template',
  defaultConfig: notesDefaultConfig,
  normalizeConfig: normalizeNotesConfig,
  component: NotesTemplate,
};

const recordTemplate: TemplateDefinition<RecordTemplateConfig> = {
  id: 'record',
  name: 'Record',
  description: 'iPhone Voice Memo style lyrics template',
  defaultConfig: recordDefaultConfig,
  normalizeConfig: normalizeRecordConfig,
  component: RecordTemplate,
};

const neonSpectrumTemplate: TemplateDefinition<NeonSpectrumConfig> = {
  id: 'neon-spectrum',
  name: 'Neon Spectrum',
  description: 'Neon nightclub stage with animated spectrum bars and glowing lyrics',
  defaultConfig: neonDefaultConfig,
  normalizeConfig: normalizeNeonConfig,
  component: NeonSpectrumTemplate,
};

const liquidWaveTemplate: TemplateDefinition<LiquidWaveConfig> = {
  id: 'liquid-wave',
  name: 'Liquid Wave',
  description: 'Dreamy liquid waves and ripples with ethereal floating lyrics',
  defaultConfig: liquidDefaultConfig,
  normalizeConfig: normalizeLiquidConfig,
  component: LiquidWaveTemplate,
};

const lyricPosterTemplate: TemplateDefinition<LyricPosterConfig> = {
  id: 'lyric-poster',
  name: 'Lyric Poster',
  description: 'Full-screen editorial poster with animated kinetic typography',
  defaultConfig: posterDefaultConfig,
  normalizeConfig: normalizePosterConfig,
  component: LyricPosterTemplate,
};

export const templateRegistry = {
  notes: notesTemplate,
  record: recordTemplate,
  'neon-spectrum': neonSpectrumTemplate,
  'liquid-wave': liquidWaveTemplate,
  'lyric-poster': lyricPosterTemplate,
} as const;

export type TemplateId = keyof typeof templateRegistry;

export function getTemplateDefinition(templateId: string | null | undefined): TemplateDefinition<unknown> {
  if (templateId && templateId in templateRegistry) {
    return templateRegistry[templateId as TemplateId] as TemplateDefinition<unknown>;
  }
  return templateRegistry.notes as TemplateDefinition<unknown>;
}
