export interface AiSettings {
  apiKey: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
};

export const AI_SETTINGS_STORAGE_KEY = 'singing-video.aiSettings';

/**
 * The lyric recognition endpoint is fixed — this app targets MiniMax ASR only.
 * Users configure nothing but their API key.
 */
export const MINIMAX_ASR_URL = 'https://api.minimaxi.com/v1/speech_to_text';

/** Chat-completions endpoint used to punctuate the ASR transcript. */
export const MINIMAX_LLM_URL = 'https://api.minimax.cn/v1/chat/completions';

/** Public lyrics library used to obtain accurate lyric text. */
export const LRC_API_URL = 'https://api.lrc.cx/lyrics';

/** MiniMax rejects audio longer than this with a 400 (it does not truncate). */
export const MAX_AUDIO_DURATION_MS = 500_000;

/** MiniMax rejects uploads larger than this with a 413. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export function loadAiSettings(): AiSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return { ...DEFAULT_AI_SETTINGS };
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_SETTINGS.apiKey,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
