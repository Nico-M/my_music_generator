export interface NotesTemplateConfig {
  showCheckbox: boolean;
}

export const notesDefaultConfig: NotesTemplateConfig = {
  showCheckbox: true,
};

export function normalizeNotesConfig(input: unknown): NotesTemplateConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return notesDefaultConfig;
  }

  const raw = input as Partial<NotesTemplateConfig>;
  return {
    showCheckbox: typeof raw.showCheckbox === 'boolean' ? raw.showCheckbox : notesDefaultConfig.showCheckbox,
  };
}
