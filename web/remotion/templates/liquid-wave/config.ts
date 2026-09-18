export interface LiquidWaveConfig {
  colorScheme: 'mono' | 'ocean' | 'aurora' | 'sunset';
  rippleCount: number;
  waveSpeed: 'slow' | 'medium' | 'fast';
  showParticles: boolean;
  blurAmount: 'soft' | 'medium' | 'strong';
}

export const liquidDefaultConfig: LiquidWaveConfig = {
  colorScheme: 'mono',
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
  const validSchemes = ['mono', 'ocean', 'sunset', 'aurora'] as const;
  const validSpeeds = ['slow', 'medium', 'fast'] as const;
  const validBlurs = ['soft', 'medium', 'strong'] as const;
  return {
    colorScheme: validSchemes.includes(raw.colorScheme as typeof validSchemes[number])
      ? (raw.colorScheme as LiquidWaveConfig['colorScheme'])
      : liquidDefaultConfig.colorScheme,
    rippleCount:
      typeof raw.rippleCount === 'number' && raw.rippleCount >= 2 && raw.rippleCount <= 8
        ? raw.rippleCount
        : liquidDefaultConfig.rippleCount,
    waveSpeed: validSpeeds.includes(raw.waveSpeed as typeof validSpeeds[number])
      ? (raw.waveSpeed as LiquidWaveConfig['waveSpeed'])
      : liquidDefaultConfig.waveSpeed,
    showParticles:
      typeof raw.showParticles === 'boolean' ? raw.showParticles : liquidDefaultConfig.showParticles,
    blurAmount: validBlurs.includes(raw.blurAmount as typeof validBlurs[number])
      ? (raw.blurAmount as LiquidWaveConfig['blurAmount'])
      : liquidDefaultConfig.blurAmount,
  };
}

export interface LiquidColorScheme {
  base: string;
  text: string;
  muted: string;
  accent1: string;
  accent2: string;
  accent3: string;
  glassBorder: string;
  glassBg: string;
  glassGlow: string;
}

export function getLiquidColors(scheme: LiquidWaveConfig['colorScheme']): LiquidColorScheme {
  switch (scheme) {
    case 'mono':
    default:
      return {
        base: '#000000',
        text: '#FFFFFF',
        muted: '#9A9A9A',
        accent1: '#FFFFFF',
        accent2: '#D8D8D8',
        accent3: '#686874',
        glassBorder: 'rgba(198, 198, 198, 0.42)',
        glassBg:
          'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(12, 12, 14, 0.65) 50%, rgba(160, 175, 200, 0.06) 100%)',
        glassGlow: 'rgba(186, 208, 255, 0.22)',
      };
    case 'ocean':
      return {
        base: '#000000',
        text: '#FFFFFF',
        muted: '#8299A8',
        accent1: '#38BDF8',
        accent2: '#0EA5E9',
        accent3: '#0D9488',
        glassBorder: 'rgba(56, 189, 248, 0.42)',
        glassBg:
          'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(6, 16, 24, 0.65) 50%, rgba(14, 116, 144, 0.06) 100%)',
        glassGlow: 'rgba(56, 189, 248, 0.24)',
      };
    case 'sunset':
      return {
        base: '#000000',
        text: '#FFFFFF',
        muted: '#A88C8C',
        accent1: '#FB7185',
        accent2: '#F59E0B',
        accent3: '#BE123C',
        glassBorder: 'rgba(251, 113, 133, 0.42)',
        glassBg:
          'linear-gradient(135deg, rgba(251, 113, 133, 0.12) 0%, rgba(20, 8, 14, 0.65) 50%, rgba(180, 83, 9, 0.06) 100%)',
        glassGlow: 'rgba(251, 113, 133, 0.24)',
      };
    case 'aurora':
      return {
        base: '#000000',
        text: '#FFFFFF',
        muted: '#9A8AA8',
        accent1: '#C084FC',
        accent2: '#34D399',
        accent3: '#7E22CE',
        glassBorder: 'rgba(192, 132, 252, 0.42)',
        glassBg:
          'linear-gradient(135deg, rgba(192, 132, 252, 0.12) 0%, rgba(16, 8, 24, 0.65) 50%, rgba(52, 211, 153, 0.06) 100%)',
        glassGlow: 'rgba(192, 132, 252, 0.24)',
      };
  }
}
