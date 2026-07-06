import { DEFAULT_AI_SETTINGS, normalizeAiBaseUrl } from '@/lib/ai-settings';

export interface AiProviderSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

export function clampTemperature(value: unknown, fallback = 0.1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 2) return 2;
  return value;
}

export function validateProviderSettings(
  settings: unknown,
):
  | { ok: true; settings: AiProviderSettings; temperature: number; baseUrl: string }
  | { ok: false; error: string } {
  if (!settings || typeof settings !== 'object') {
    return { ok: false, error: 'baseUrl, apiKey and model are required' };
  }
  const s = settings as Record<string, unknown>;
  const baseUrl = normalizeAiBaseUrl(typeof s.baseUrl === 'string' ? s.baseUrl : '');
  const apiKey = typeof s.apiKey === 'string' ? s.apiKey.trim() : '';
  const model = typeof s.model === 'string' ? s.model.trim() : '';

  if (!baseUrl || !apiKey || !model) {
    return { ok: false, error: 'baseUrl, apiKey and model are required' };
  }

  const temperature = clampTemperature(s.temperature, 0.1);

  return {
    ok: true,
    settings: { baseUrl, apiKey, model, temperature },
    temperature,
    baseUrl,
  };
}

export { normalizeAiBaseUrl };
