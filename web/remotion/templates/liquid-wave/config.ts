import type { TemplateParameterDefinition } from '../types';

export interface LiquidWaveConfig {
  colorScheme: 'ocean' | 'sunset' | 'aurora' | 'mono';
  rippleCount: number;
  waveSpeed: 'slow' | 'medium' | 'fast';
  showParticles: boolean;
  blurAmount: 'soft' | 'medium' | 'strong';
}

export const liquidDefaultConfig: LiquidWaveConfig = {
  colorScheme: 'ocean',
  rippleCount: 4,
  waveSpeed: 'medium',
  showParticles: true,
  blurAmount: 'medium',
};

export function normalizeLiquidConfig(input: unknown): LiquidWaveConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return liquidDefaultConfig;
  }
  const raw = input as Partial<LiquidWaveConfig>;
  const validSchemes = ['ocean', 'sunset', 'aurora', 'mono'] as const;
  const validSpeeds = ['slow', 'medium', 'fast'] as const;
  const validBlurs = ['soft', 'medium', 'strong'] as const;
  return {
    colorScheme: validSchemes.includes(raw.colorScheme as typeof validSchemes[number])
      ? (raw.colorScheme as LiquidWaveConfig['colorScheme'])
      : liquidDefaultConfig.colorScheme,
    rippleCount: typeof raw.rippleCount === 'number' && raw.rippleCount >= 2 && raw.rippleCount <= 8
      ? raw.rippleCount : liquidDefaultConfig.rippleCount,
    waveSpeed: validSpeeds.includes(raw.waveSpeed as typeof validSpeeds[number])
      ? (raw.waveSpeed as LiquidWaveConfig['waveSpeed'])
      : liquidDefaultConfig.waveSpeed,
    showParticles: typeof raw.showParticles === 'boolean' ? raw.showParticles : liquidDefaultConfig.showParticles,
    blurAmount: validBlurs.includes(raw.blurAmount as typeof validBlurs[number])
      ? (raw.blurAmount as LiquidWaveConfig['blurAmount'])
      : liquidDefaultConfig.blurAmount,
  };
}

export function getLiquidColors(scheme: LiquidWaveConfig['colorScheme']) {
  switch (scheme) {
    case 'ocean':
      return { base: '#0B1A2E', accent1: '#1A6B8A', accent2: '#4ECDC4', accent3: '#A8E6CF' };
    case 'sunset':
      return { base: '#1A0B1E', accent1: '#FF6B6B', accent2: '#FFB347', accent3: '#FFD93D' };
    case 'aurora':
      return { base: '#0A0E1A', accent1: '#00FF87', accent2: '#60EFFF', accent3: '#7B2FFF' };
    case 'mono':
      return { base: '#0A0A0A', accent1: '#333333', accent2: '#666666', accent3: '#999999' };
  }

}
export const liquidParameterDefinitions: readonly TemplateParameterDefinition<LiquidWaveConfig>[] = [
  { key: 'colorScheme', kind: 'select', label: 'Color scheme', defaultValue: 'ocean', options: [{ value: 'ocean', label: 'Ocean' }, { value: 'sunset', label: 'Sunset' }, { value: 'aurora', label: 'Aurora' }, { value: 'mono', label: 'Mono' }] },
  { key: 'rippleCount', kind: 'number', label: 'Ripple count', defaultValue: 4, min: 2, max: 8, step: 1 },
  { key: 'waveSpeed', kind: 'select', label: 'Wave speed', defaultValue: 'medium', options: [{ value: 'slow', label: 'Slow' }, { value: 'medium', label: 'Medium' }, { value: 'fast', label: 'Fast' }] },
  { key: 'showParticles', kind: 'boolean', label: 'Show particles', defaultValue: true },
  { key: 'blurAmount', kind: 'select', label: 'Blur amount', defaultValue: 'medium', options: [{ value: 'soft', label: 'Soft' }, { value: 'medium', label: 'Medium' }, { value: 'strong', label: 'Strong' }] },
] as const;
