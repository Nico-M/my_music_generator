export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-5.4',
  temperature: 0.1,
  enabled: false,
};

export const AI_SETTINGS_STORAGE_KEY = 'singing-video.aiSettings';

export function normalizeAiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_AI_SETTINGS.baseUrl;
  return trimmed.replace(/\/+$/, '');
}

export function loadAiSettings(): AiSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return { ...DEFAULT_AI_SETTINGS };
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_AI_SETTINGS.baseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_SETTINGS.apiKey,
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_AI_SETTINGS.model,
      temperature:
        typeof parsed.temperature === 'number' &&
        !Number.isNaN(parsed.temperature) &&
        parsed.temperature >= 0 &&
        parsed.temperature <= 2
          ? parsed.temperature
          : DEFAULT_AI_SETTINGS.temperature,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_AI_SETTINGS.enabled,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
