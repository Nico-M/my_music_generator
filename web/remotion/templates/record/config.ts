export interface RecordTemplateConfig {
  waveformStyle: 'bars' | 'wave';
}

export const recordDefaultConfig: RecordTemplateConfig = {
  waveformStyle: 'bars',
};

export function normalizeRecordConfig(input: unknown): RecordTemplateConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return recordDefaultConfig;
  }

  const raw = input as Partial<RecordTemplateConfig>;
  const style = raw.waveformStyle;
  return {
    waveformStyle:
      typeof style === 'string' && (style === 'bars' || style === 'wave')
        ? style
        : recordDefaultConfig.waveformStyle,
  };
}
