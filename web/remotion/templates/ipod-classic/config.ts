export interface IPodClassicConfig {
  bodyColor: 'space-gray' | 'silver' | 'u2-black' | 'classic-white';
  wheelColor: 'black' | 'gray' | 'red' | 'white';
  showCables: boolean;
  showLyrics: boolean;
  screenBacklightGlow: boolean;
  albumName?: string;
}

export const ipodDefaultConfig: IPodClassicConfig = {
  bodyColor: 'space-gray',
  wheelColor: 'black',
  showCables: true,
  showLyrics: true,
  screenBacklightGlow: true,
  albumName: '',
};

export function normalizeIPodConfig(input: unknown): IPodClassicConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ipodDefaultConfig;
  }
  const raw = input as Partial<IPodClassicConfig>;
  const validBodies = ['space-gray', 'silver', 'u2-black', 'classic-white'] as const;
  const validWheels = ['black', 'gray', 'red', 'white'] as const;

  return {
    bodyColor: validBodies.includes(raw.bodyColor as typeof validBodies[number])
      ? (raw.bodyColor as IPodClassicConfig['bodyColor'])
      : ipodDefaultConfig.bodyColor,
    wheelColor: validWheels.includes(raw.wheelColor as typeof validWheels[number])
      ? (raw.wheelColor as IPodClassicConfig['wheelColor'])
      : ipodDefaultConfig.wheelColor,
    showCables: typeof raw.showCables === 'boolean' ? raw.showCables : ipodDefaultConfig.showCables,
    showLyrics: typeof raw.showLyrics === 'boolean' ? raw.showLyrics : ipodDefaultConfig.showLyrics,
    screenBacklightGlow:
      typeof raw.screenBacklightGlow === 'boolean'
        ? raw.screenBacklightGlow
        : ipodDefaultConfig.screenBacklightGlow,
    albumName: typeof raw.albumName === 'string' ? raw.albumName : ipodDefaultConfig.albumName,
  };
}

export function getBodyThemeStyles(bodyColor: IPodClassicConfig['bodyColor']) {
  switch (bodyColor) {
    case 'silver':
      return {
        bodyBg: 'linear-gradient(145deg, #d8dbe0 0%, #c6cace 30%, #b4b8be 70%, #cacdd2 100%)',
        outerBorder: 'rgba(255, 255, 255, 0.5)',
        innerShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.7), inset 0 -2px 3px rgba(0, 0, 0, 0.25)',
        bevelEdge: 'rgba(0, 0, 0, 0.35)',
      };
    case 'u2-black':
      return {
        bodyBg: 'linear-gradient(145deg, #24262a 0%, #17181a 35%, #0e0f11 70%, #191a1d 100%)',
        outerBorder: 'rgba(255, 255, 255, 0.16)',
        innerShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.2), inset 0 -2px 3px rgba(0, 0, 0, 0.85)',
        bevelEdge: 'rgba(0, 0, 0, 0.85)',
      };
    case 'classic-white':
      return {
        bodyBg: 'linear-gradient(145deg, #ffffff 0%, #f4f5f8 35%, #e8ebf0 70%, #f8f9fb 100%)',
        outerBorder: 'rgba(255, 255, 255, 0.9)',
        innerShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.95), inset 0 -2px 3px rgba(0, 0, 0, 0.15)',
        bevelEdge: 'rgba(0, 0, 0, 0.25)',
      };
    case 'space-gray':
    default:
      return {
        bodyBg: 'linear-gradient(145deg, #484e55 0%, #383e45 25%, #2a2e33 50%, #33383f 75%, #22252a 100%)',
        outerBorder: 'rgba(255, 255, 255, 0.26)',
        innerShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.26), inset 0 -2px 4px rgba(0, 0, 0, 0.7)',
        bevelEdge: 'rgba(15, 17, 20, 0.95)',
      };
  }
}

export function getWheelThemeStyles(wheelColor: IPodClassicConfig['wheelColor']) {
  switch (wheelColor) {
    case 'gray':
      return {
        wheelBg: 'linear-gradient(145deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)',
        centerBg: 'radial-gradient(circle at 45% 45%, #94a3b8 0%, #64748b 80%)',
        textColor: '#FFFFFF',
      };
    case 'red':
      return {
        wheelBg: 'linear-gradient(145deg, #e53935 0%, #c62828 50%, #b71c1c 100%)',
        centerBg: 'radial-gradient(circle at 45% 45%, #242528 0%, #131416 80%)',
        textColor: '#FFFFFF',
      };
    case 'white':
      return {
        wheelBg: 'linear-gradient(145deg, #ffffff 0%, #edf1f5 50%, #dce1e7 100%)',
        centerBg: 'radial-gradient(circle at 45% 45%, #f8fafc 0%, #e2e8f0 80%)',
        textColor: '#64748b',
      };
    case 'black':
    default:
      return {
        wheelBg: 'linear-gradient(145deg, #24262a 0%, #18191b 50%, #121315 100%)',
        centerBg: 'radial-gradient(circle at 45% 45%, #2b2e33 0%, #17181a 80%)',
        textColor: '#E8ECF0',
      };
  }
}
