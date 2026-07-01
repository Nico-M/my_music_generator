import { NotesTemplate } from './notes/NotesTemplate';
import { normalizeNotesConfig, notesDefaultConfig, type NotesTemplateConfig } from './notes/config';
import { RecordTemplate } from './record/RecordTemplate';
import { normalizeRecordConfig, recordDefaultConfig, type RecordTemplateConfig } from './record/config';
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

export const templateRegistry = {
  notes: notesTemplate,
  record: recordTemplate,
} as const;

export type TemplateId = keyof typeof templateRegistry;

export function getTemplateDefinition(templateId: string | null | undefined): TemplateDefinition<unknown> {
  if (templateId && templateId in templateRegistry) {
    return templateRegistry[templateId as TemplateId] as TemplateDefinition<unknown>;
  }
  return templateRegistry.notes as TemplateDefinition<unknown>;
}
