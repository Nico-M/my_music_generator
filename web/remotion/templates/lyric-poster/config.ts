export interface LyricPosterConfig {
  layout: 'center-emphasis' | 'top-title' | 'bottom-wave';
  backgroundStyle: 'gradient' | 'cover-image' | 'dark-solid';
  typographyScale: 'normal' | 'large' | 'xlarge';
  showWaveform: boolean;
  accentColor: string;
}

export const posterDefaultConfig: LyricPosterConfig = {
  layout: 'center-emphasis',
  backgroundStyle: 'gradient',
  typographyScale: 'large',
  showWaveform: true,
  accentColor: '#FFFFFF',
};

export function normalizePosterConfig(input: unknown): LyricPosterConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return posterDefaultConfig;
  }
  const raw = input as Partial<LyricPosterConfig>;
  const validLayouts = ['center-emphasis', 'top-title', 'bottom-wave'] as const;
  const validBg = ['gradient', 'cover-image', 'dark-solid'] as const;
  const validScale = ['normal', 'large', 'xlarge'] as const;
  return {
    layout: validLayouts.includes(raw.layout as typeof validLayouts[number])
      ? (raw.layout as LyricPosterConfig['layout'])
      : posterDefaultConfig.layout,
    backgroundStyle: validBg.includes(raw.backgroundStyle as typeof validBg[number])
      ? (raw.backgroundStyle as LyricPosterConfig['backgroundStyle'])
      : posterDefaultConfig.backgroundStyle,
    typographyScale: validScale.includes(raw.typographyScale as typeof validScale[number])
      ? (raw.typographyScale as LyricPosterConfig['typographyScale'])
      : posterDefaultConfig.typographyScale,
    showWaveform: typeof raw.showWaveform === 'boolean' ? raw.showWaveform : posterDefaultConfig.showWaveform,
    accentColor: typeof raw.accentColor === 'string' && raw.accentColor.startsWith('#')
      ? raw.accentColor : posterDefaultConfig.accentColor,
  };
}
