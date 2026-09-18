export type MusicWidgetTheme = 'frosted-light' | 'frosted-dark' | 'sunset-glow' | 'aurora';

export interface MusicWidgetConfig {
  theme: MusicWidgetTheme;
  showLyrics: boolean;
  showStatusBar: boolean;
  showVolumeBar: boolean;
  glowEffect: boolean;
  layout: 'lockscreen' | 'compact';
}

export const musicWidgetDefaultConfig: MusicWidgetConfig = {
  theme: 'frosted-light',
  showLyrics: true,
  showStatusBar: true,
  showVolumeBar: true,
  glowEffect: true,
  layout: 'lockscreen',
};

export function normalizeMusicWidgetConfig(input: unknown): MusicWidgetConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return musicWidgetDefaultConfig;
  }

  const raw = input as Partial<MusicWidgetConfig>;
  const validThemes: MusicWidgetTheme[] = ['frosted-light', 'frosted-dark', 'sunset-glow', 'aurora'];
  const validLayouts = ['lockscreen', 'compact'] as const;

  return {
    theme: validThemes.includes(raw.theme as MusicWidgetTheme)
      ? (raw.theme as MusicWidgetTheme)
      : musicWidgetDefaultConfig.theme,
    showLyrics: typeof raw.showLyrics === 'boolean' ? raw.showLyrics : musicWidgetDefaultConfig.showLyrics,
    showStatusBar: typeof raw.showStatusBar === 'boolean' ? raw.showStatusBar : musicWidgetDefaultConfig.showStatusBar,
    showVolumeBar: typeof raw.showVolumeBar === 'boolean' ? raw.showVolumeBar : musicWidgetDefaultConfig.showVolumeBar,
    glowEffect: typeof raw.glowEffect === 'boolean' ? raw.glowEffect : musicWidgetDefaultConfig.glowEffect,
    layout: validLayouts.includes(raw.layout as (typeof validLayouts)[number])
      ? (raw.layout as MusicWidgetConfig['layout'])
      : musicWidgetDefaultConfig.layout,
  };
}

export interface WidgetThemeStyles {
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  titleColor: string;
  subtitleColor: string;
  timeColor: string;
  controlColor: string;
  trackBg: string;
  progressFilled: string;
  thumbColor: string;
  thumbShadow: string;
  volumeTrackBg: string;
  speakerColor: string;
  airPlayBg: string;
  airPlayColor: string;
  lyricsActiveColor: string;
  lyricsInactiveColor: string;
  lyricsGlow: string;
}

export function getWidgetThemeStyles(theme: MusicWidgetTheme): WidgetThemeStyles {
  switch (theme) {
    case 'frosted-dark':
      return {
        cardBg: 'linear-gradient(135deg, rgba(32, 36, 46, 0.65) 0%, rgba(18, 21, 28, 0.75) 100%)',
        cardBorder: '1.5px solid rgba(255, 255, 255, 0.22)',
        cardShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.55), inset 0 1px 1.5px rgba(255, 255, 255, 0.25)',
        titleColor: '#FFFFFF',
        subtitleColor: '#A0AAB8',
        timeColor: '#CBD5E1',
        controlColor: '#FFFFFF',
        trackBg: 'rgba(255, 255, 255, 0.25)',
        progressFilled: '#FFFFFF',
        thumbColor: '#FFFFFF',
        thumbShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        volumeTrackBg: 'rgba(255, 255, 255, 0.25)',
        speakerColor: '#E2E8F0',
        airPlayBg: '#0A84FF',
        airPlayColor: '#FFFFFF',
        lyricsActiveColor: '#FFFFFF',
        lyricsInactiveColor: 'rgba(255, 255, 255, 0.42)',
        lyricsGlow: '0 0 24px rgba(255, 255, 255, 0.7)',
      };

    case 'sunset-glow':
      return {
        cardBg: 'linear-gradient(135deg, rgba(255, 242, 246, 0.38) 0%, rgba(255, 224, 235, 0.22) 100%)',
        cardBorder: '1.5px solid rgba(255, 235, 242, 0.6)',
        cardShadow: '0 32px 64px -12px rgba(70, 20, 45, 0.4), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.7)',
        titleColor: '#281422',
        subtitleColor: '#633B53',
        timeColor: '#4A2A3E',
        controlColor: '#281422',
        trackBg: 'rgba(45, 20, 35, 0.8)',
        progressFilled: '#E11D48',
        thumbColor: '#FFFFFF',
        thumbShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
        volumeTrackBg: 'rgba(45, 20, 35, 0.8)',
        speakerColor: '#281422',
        airPlayBg: '#F43F5E',
        airPlayColor: '#FFFFFF',
        lyricsActiveColor: '#FFF1F2',
        lyricsInactiveColor: 'rgba(255, 228, 230, 0.45)',
        lyricsGlow: '0 0 22px rgba(244, 63, 94, 0.6)',
      };

    case 'aurora':
      return {
        cardBg: 'linear-gradient(135deg, rgba(16, 34, 48, 0.62) 0%, rgba(22, 26, 44, 0.72) 100%)',
        cardBorder: '1.5px solid rgba(56, 189, 248, 0.35)',
        cardShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(56, 189, 248, 0.35)',
        titleColor: '#F0FDF4',
        subtitleColor: '#7DD3FC',
        timeColor: '#BAE6FD',
        controlColor: '#38BDF8',
        trackBg: 'rgba(255, 255, 255, 0.22)',
        progressFilled: '#38BDF8',
        thumbColor: '#FFFFFF',
        thumbShadow: '0 0 10px rgba(56, 189, 248, 0.7)',
        volumeTrackBg: 'rgba(255, 255, 255, 0.22)',
        speakerColor: '#7DD3FC',
        airPlayBg: '#0284C7',
        airPlayColor: '#FFFFFF',
        lyricsActiveColor: '#38BDF8',
        lyricsInactiveColor: 'rgba(186, 230, 253, 0.42)',
        lyricsGlow: '0 0 22px rgba(56, 189, 248, 0.65)',
      };

    case 'frosted-light':
    default:
      // Exact match to reference image!
      return {
        cardBg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.22) 100%)',
        cardBorder: '1.5px solid rgba(255, 255, 255, 0.52)',
        cardShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.35), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.7)',
        titleColor: '#22252D',
        subtitleColor: '#4D5361',
        timeColor: '#363C48',
        controlColor: '#1B1E24',
        trackBg: 'rgba(25, 28, 35, 0.85)',
        progressFilled: '#1B1E24',
        thumbColor: '#FFFFFF',
        thumbShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
        volumeTrackBg: 'rgba(25, 28, 35, 0.85)',
        speakerColor: '#22252D',
        airPlayBg: '#2F80ED',
        airPlayColor: '#FFFFFF',
        lyricsActiveColor: '#FFFFFF',
        lyricsInactiveColor: 'rgba(255, 255, 255, 0.45)',
        lyricsGlow: '0 0 20px rgba(255, 255, 255, 0.6)',
      };
  }
}
