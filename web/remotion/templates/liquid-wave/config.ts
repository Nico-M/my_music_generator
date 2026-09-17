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

export function getLiquidColors(scheme: LiquidWaveConfig['colorScheme']) {
  switch (scheme) {
    case 'ocean':
      return {
        base: '#071527',
        accent1: '#00D2D3',
        accent2: '#54A0FF',
        accent3: '#55E6C1',
        cardBg: 'rgba(7, 21, 39, 0.72)',
        cardBorder: 'rgba(0, 210, 211, 0.25)',
      };
    case 'sunset':
      return {
        base: '#22092C',
        accent1: '#FF6B81',
        accent2: '#FEE140',
        accent3: '#FA709A',
        cardBg: 'rgba(34, 9, 44, 0.72)',
        cardBorder: 'rgba(255, 107, 129, 0.25)',
      };
    case 'aurora':
      return {
        base: '#0B132B',
        accent1: '#48CAE4',
        accent2: '#7209B7',
        accent3: '#4ADE80',
        cardBg: 'rgba(11, 19, 43, 0.72)',
        cardBorder: 'rgba(72, 202, 228, 0.25)',
      };
    case 'mono':
      return {
        base: '#111315',
        accent1: '#F1F2F6',
        accent2: '#A4B0BE',
        accent3: '#57606F',
        cardBg: 'rgba(17, 19, 21, 0.72)',
        cardBorder: 'rgba(241, 242, 246, 0.22)',
      };
  }
}
