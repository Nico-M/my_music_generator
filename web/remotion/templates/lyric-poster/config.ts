export interface LyricPosterConfig {
  colorTheme: 'swiss-red' | 'bauhaus-navy' | 'vintage-ochre';
  layout: 'center-emphasis' | 'top-title' | 'bottom-wave';
  backgroundStyle: 'blur-cover' | 'gradient' | 'cover-image' | 'dark-solid';
  typographyScale: 'normal' | 'large' | 'xlarge';
  showWaveform: boolean;
  accentColor: string;
}

export const posterDefaultConfig: LyricPosterConfig = {
  colorTheme: 'swiss-red',
  layout: 'center-emphasis',
  backgroundStyle: 'blur-cover',
  typographyScale: 'large',
  showWaveform: true,
  accentColor: '#E63946',
};

export function normalizePosterConfig(input: unknown): LyricPosterConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return posterDefaultConfig;
  }
  const raw = input as Partial<LyricPosterConfig>;
  const validThemes = ['swiss-red', 'bauhaus-navy', 'vintage-ochre'] as const;
  const validLayouts = ['center-emphasis', 'top-title', 'bottom-wave'] as const;
  const validBg = ['blur-cover', 'gradient', 'cover-image', 'dark-solid'] as const;
  const validScale = ['normal', 'large', 'xlarge'] as const;
  return {
    colorTheme: validThemes.includes(raw.colorTheme as typeof validThemes[number])
      ? (raw.colorTheme as LyricPosterConfig['colorTheme'])
      : posterDefaultConfig.colorTheme,
    layout: validLayouts.includes(raw.layout as typeof validLayouts[number])
      ? (raw.layout as LyricPosterConfig['layout'])
      : posterDefaultConfig.layout,
    backgroundStyle: validBg.includes(raw.backgroundStyle as typeof validBg[number])
      ? (raw.backgroundStyle as LyricPosterConfig['backgroundStyle'])
      : posterDefaultConfig.backgroundStyle,
    typographyScale: validScale.includes(raw.typographyScale as typeof validScale[number])
      ? (raw.typographyScale as LyricPosterConfig['typographyScale'])
      : posterDefaultConfig.typographyScale,
    showWaveform:
      typeof raw.showWaveform === 'boolean' ? raw.showWaveform : posterDefaultConfig.showWaveform,
    accentColor:
      typeof raw.accentColor === 'string' && raw.accentColor.startsWith('#')
        ? raw.accentColor
        : posterDefaultConfig.accentColor,
  };
}

export function getPosterColors(theme: LyricPosterConfig['colorTheme']) {
  switch (theme) {
    case 'swiss-red':
      return {
        bg: '#0E0E11',
        cardBg: '#16161B',
        accent: '#E63946',
        accentSecondary: '#FF4D6D',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.45)',
        gridLine: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.12)',
      };
    case 'bauhaus-navy':
      return {
        bg: '#0A1128',
        cardBg: '#101B3D',
        accent: '#F7B801',
        accentSecondary: '#3B82F6',
        textPrimary: '#F4F4F9',
        textSecondary: 'rgba(244, 244, 249, 0.45)',
        gridLine: 'rgba(247, 184, 1, 0.12)',
        border: 'rgba(247, 184, 1, 0.22)',
      };
    case 'vintage-ochre':
      return {
        bg: '#1C1917',
        cardBg: '#262220',
        accent: '#F59E0B',
        accentSecondary: '#10B981',
        textPrimary: '#F5F5F4',
        textSecondary: 'rgba(245, 245, 244, 0.45)',
        gridLine: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.2)',
      };
  }
}
