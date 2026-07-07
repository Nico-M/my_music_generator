import { NotesTemplate } from './notes/NotesTemplate';
import { RecordTemplate } from './record/RecordTemplate';
import { NeonSpectrumTemplate } from './neon-spectrum/NeonSpectrumTemplate';
import { LiquidWaveTemplate } from './liquid-wave/LiquidWaveTemplate';
import { LyricPosterTemplate } from './lyric-poster/LyricPosterTemplate';
import {
  templateMetadata,
  isTemplateId,
  getTemplateMetadata,
  templateOptions,
  type TemplateId,
} from './metadata';
import type { TemplateDefinition } from './types';

const notesTemplate = {
  ...templateMetadata.notes,
  component: NotesTemplate,
};

const recordTemplate = {
  ...templateMetadata.record,
  component: RecordTemplate,
};

const neonSpectrumTemplate = {
  ...templateMetadata['neon-spectrum'],
  component: NeonSpectrumTemplate,
};

const liquidWaveTemplate = {
  ...templateMetadata['liquid-wave'],
  component: LiquidWaveTemplate,
};

const lyricPosterTemplate = {
  ...templateMetadata['lyric-poster'],
  component: LyricPosterTemplate,
};

export const templateRegistry = {
  notes: notesTemplate,
  record: recordTemplate,
  'neon-spectrum': neonSpectrumTemplate,
  'liquid-wave': liquidWaveTemplate,
  'lyric-poster': lyricPosterTemplate,
} as const;

export function getTemplateDefinition(templateId: string | null | undefined): TemplateDefinition<Record<string, unknown>> {
  if (templateId && templateId in templateRegistry) {
    return templateRegistry[templateId as TemplateId] as unknown as TemplateDefinition<Record<string, unknown>>;
  }
  return templateRegistry.notes as unknown as TemplateDefinition<Record<string, unknown>>;
}

export { templateMetadata, templateOptions, getTemplateMetadata, isTemplateId };
export type { TemplateId };
