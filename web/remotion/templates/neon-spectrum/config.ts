export interface NeonSpectrumConfig {
  colorTheme: 'cyan-magenta' | 'purple-pink' | 'blue-green' | 'red-gold';
  visualizerStyle?: 'wave' | 'bars';
  barCount: number;
  glowIntensity: 'low' | 'medium' | 'high';
  showParticles: boolean;
  showScanLines: boolean;
}

export const neonDefaultConfig: NeonSpectrumConfig = {
  colorTheme: 'cyan-magenta',
  visualizerStyle: 'wave',
  barCount: 28,
  glowIntensity: 'high',
  showParticles: true,
  showScanLines: true,
};

export function normalizeNeonConfig(input: unknown): NeonSpectrumConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return neonDefaultConfig;
  }
  const raw = input as Partial<NeonSpectrumConfig>;
  const validThemes = ['cyan-magenta', 'purple-pink', 'blue-green', 'red-gold'] as const;
  const validGlows = ['low', 'medium', 'high'] as const;
  const validStyles = ['wave', 'bars'] as const;
  return {
    colorTheme: validThemes.includes(raw.colorTheme as typeof validThemes[number])
      ? (raw.colorTheme as NeonSpectrumConfig['colorTheme'])
      : neonDefaultConfig.colorTheme,
    visualizerStyle: validStyles.includes(raw.visualizerStyle as typeof validStyles[number])
      ? (raw.visualizerStyle as NeonSpectrumConfig['visualizerStyle'])
      : neonDefaultConfig.visualizerStyle,
    barCount:
      typeof raw.barCount === 'number' && raw.barCount >= 8 && raw.barCount <= 48
        ? raw.barCount
        : neonDefaultConfig.barCount,
    glowIntensity: validGlows.includes(raw.glowIntensity as typeof validGlows[number])
      ? (raw.glowIntensity as NeonSpectrumConfig['glowIntensity'])
      : neonDefaultConfig.glowIntensity,
    showParticles:
      typeof raw.showParticles === 'boolean' ? raw.showParticles : neonDefaultConfig.showParticles,
    showScanLines:
      typeof raw.showScanLines === 'boolean' ? raw.showScanLines : neonDefaultConfig.showScanLines,
  };
}

export interface WaveThemeDef {
  name: string;
  color: string;
  glow: string;
}

export function getThemeColors(theme: NeonSpectrumConfig['colorTheme']) {
  switch (theme) {
    case 'cyan-magenta':
      return {
        primary: '#00F5FF',
        secondary: '#FF007A',
        tertiary: '#BD00FF',
        quaternary: '#FF9900',
        bg: '#07050E',
        cardBg: 'rgba(18, 12, 32, 0.82)',
        cardBorder: 'rgba(0, 245, 255, 0.28)',
        waves: [
          { name: 'cyan', color: '#00F5FF', glow: '#00D2FF' },
          { name: 'purple', color: '#BD00FF', glow: '#9D00FF' },
          { name: 'magenta', color: '#FF007A', glow: '#FF1493' },
          { name: 'orange', color: '#FF9900', glow: '#FF6600' },
        ] as WaveThemeDef[],
      };
    case 'purple-pink':
      return {
        primary: '#FB923C',
        secondary: '#E879F9',
        tertiary: '#C084FC',
        quaternary: '#FBBF24',
        bg: '#090412',
        cardBg: 'rgba(24, 10, 36, 0.82)',
        cardBorder: 'rgba(232, 121, 249, 0.28)',
        waves: [
          { name: 'tangerine', color: '#FB923C', glow: '#F97316' },
          { name: 'pink', color: '#E879F9', glow: '#D946EF' },
          { name: 'violet', color: '#C084FC', glow: '#A855F7' },
          { name: 'gold', color: '#FBBF24', glow: '#F59E0B' },
        ] as WaveThemeDef[],
      };
    case 'blue-green':
      return {
        primary: '#10B981',
        secondary: '#06B6D4',
        tertiary: '#3B82F6',
        quaternary: '#34D399',
        bg: '#020B08',
        cardBg: 'rgba(6, 22, 16, 0.82)',
        cardBorder: 'rgba(16, 185, 129, 0.28)',
        waves: [
          { name: 'cyan', color: '#06B6D4', glow: '#0891B2' },
          { name: 'emerald', color: '#10B981', glow: '#059669' },
          { name: 'blue', color: '#3B82F6', glow: '#2563EB' },
          { name: 'mint', color: '#34D399', glow: '#10B981' },
        ] as WaveThemeDef[],
      };
    case 'red-gold':
      return {
        primary: '#F59E0B',
        secondary: '#EF4444',
        tertiary: '#F43F5E',
        quaternary: '#FB923C',
        bg: '#0E0604',
        cardBg: 'rgba(28, 12, 8, 0.82)',
        cardBorder: 'rgba(245, 158, 11, 0.28)',
        waves: [
          { name: 'gold', color: '#F59E0B', glow: '#D97706' },
          { name: 'red', color: '#EF4444', glow: '#DC2626' },
          { name: 'rose', color: '#F43F5E', glow: '#E11D48' },
          { name: 'amber', color: '#FB923C', glow: '#EA580C' },
        ] as WaveThemeDef[],
      };
  }
}
