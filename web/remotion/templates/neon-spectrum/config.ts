import type { TemplateParameterDefinition } from '../types';

export interface NeonSpectrumConfig {
  colorTheme: 'cyan-magenta' | 'purple-pink' | 'blue-green' | 'red-gold';
  barCount: number;
  glowIntensity: 'low' | 'medium' | 'high';
  showParticles: boolean;
  showScanLines: boolean;
}

export const neonDefaultConfig: NeonSpectrumConfig = {
  colorTheme: 'cyan-magenta',
  barCount: 32,
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
  return {
    colorTheme: validThemes.includes(raw.colorTheme as typeof validThemes[number])
      ? (raw.colorTheme as NeonSpectrumConfig['colorTheme'])
      : neonDefaultConfig.colorTheme,
    barCount: typeof raw.barCount === 'number' && raw.barCount >= 8 && raw.barCount <= 64
      ? raw.barCount : neonDefaultConfig.barCount,
    glowIntensity: validGlows.includes(raw.glowIntensity as typeof validGlows[number])
      ? (raw.glowIntensity as NeonSpectrumConfig['glowIntensity'])
      : neonDefaultConfig.glowIntensity,
    showParticles: typeof raw.showParticles === 'boolean' ? raw.showParticles : neonDefaultConfig.showParticles,
    showScanLines: typeof raw.showScanLines === 'boolean' ? raw.showScanLines : neonDefaultConfig.showScanLines,
  };
}

export function getThemeColors(theme: NeonSpectrumConfig['colorTheme']) {
  switch (theme) {
    case 'cyan-magenta':
      return { primary: '#00F0FF', secondary: '#FF00E5', tertiary: '#7B2FFF', bg: '#0A0015' };
    case 'purple-pink':
      return { primary: '#C084FC', secondary: '#F472B6', tertiary: '#8B5CF6', bg: '#0F001A' };
    case 'blue-green':
      return { primary: '#06FFD6', secondary: '#3B82F6', tertiary: '#10B981', bg: '#001015' };
    case 'red-gold':
      return { primary: '#FF3D00', secondary: '#FFB300', tertiary: '#FF6F00', bg: '#100800' };
  }

}
export const neonParameterDefinitions: readonly TemplateParameterDefinition<NeonSpectrumConfig>[] = [
  { key: 'colorTheme', kind: 'select', label: 'Color theme', defaultValue: 'cyan-magenta', options: [{ value: 'cyan-magenta', label: 'Cyan + Magenta' }, { value: 'purple-pink', label: 'Purple + Pink' }, { value: 'blue-green', label: 'Blue + Green' }, { value: 'red-gold', label: 'Red + Gold' }] },
  { key: 'barCount', kind: 'number', label: 'Bar count', defaultValue: 32, min: 8, max: 64, step: 1 },
  { key: 'glowIntensity', kind: 'select', label: 'Glow intensity', defaultValue: 'high', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
  { key: 'showParticles', kind: 'boolean', label: 'Show particles', defaultValue: true },
  { key: 'showScanLines', kind: 'boolean', label: 'Show scan lines', defaultValue: true },
] as const;
