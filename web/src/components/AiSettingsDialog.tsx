'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAiSettings } from './AiSettingsProvider';
import { DEFAULT_AI_SETTINGS, type AiSettings, normalizeAiBaseUrl } from '@/lib/ai-settings';
import { useI18n } from './LanguageProvider';
import { X } from './icons/IonIcons';

export function AiSettingsDialog() {
  const { settings, setSettings, isSettingsOpen, closeSettings } = useAiSettings();
  const { t } = useI18n();

  const [form, setForm] = useState<AiSettings>({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test connection states
  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [testModelCount, setTestModelCount] = useState<number | null>(null);

  // Dynamic model list fetched from the provider's OpenAI-compatible `/models` endpoint.
  // null = not fetched yet, [] = fetched but empty (fall back to free input).
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const modelsAbortRef = useRef<AbortController | null>(null);

  // True when the user has explicitly chosen to type a custom model name,
  // forcing the input to render even if a model list is available. Decoupled
  // from "saved model is not in the list" so the two cases can coexist:
  //   - legacy model absent from the list → keep it as a selectable custom option
  //   - user actively picks "Custom" → switch to text input for editing
  const [useCustomModelInput, setUseCustomModelInput] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const wasSettingsOpenRef = useRef(false);

  // Sync form with settings only when the dialog transitions from closed to
  // open. Re-running this effect on every `availableModels` change would
  // clobber any unsaved Base URL/API key edits the moment the user fetches
  // models or runs the connection test.
  useEffect(() => {
    const justOpened = isSettingsOpen && !wasSettingsOpenRef.current;
    if (justOpened) {
      setForm({ ...settings });
      setError(null);
      setTestState('idle');
      setTestError(null);
      setTestModelCount(null);
      setShowKey(false);
      // Initial custom-model mode from saved settings and current cached list.
      // For non-empty saved models, both the "saved model missing from list"
      // and "saved model present in list" branches end in `false`, so we
      // don't need to inspect `availableModels` here.
      setUseCustomModelInput(settings.model === '');
    }
    wasSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen, settings]);
  // Esc key closes
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSettingsOpen, closeSettings]);

  // Cancel any in-flight model fetch when the dialog closes or inputs change.
  useEffect(() => {
    return () => {
      modelsAbortRef.current?.abort();
    };
  }, []);

  // When the user edits baseUrl/apiKey after a successful fetch, the cached list
  // may be stale, so clear it to avoid offering models from the previous provider.
  // Also exit custom-input mode since the saved model probably belongs to the old provider.
  const lastFetchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSettingsOpen) return;
    const currentKey = `${normalizeAiBaseUrl(form.baseUrl)}::${form.apiKey}`;
    if (
      lastFetchKeyRef.current !== null &&
      lastFetchKeyRef.current !== currentKey
    ) {
      setAvailableModels(null);
      setModelsError(null);
      setTestModelCount(null);
      setTestState('idle');
      setTestError(null);
      setUseCustomModelInput(false);
    }
  }, [form.baseUrl, form.apiKey, isSettingsOpen]);

  const validate = useCallback((): string | null => {
    if (form.enabled) {
      if (!form.baseUrl.trim()) return t('ai.validationRequired');
      if (!form.apiKey.trim()) return t('ai.validationRequired');
      if (!form.model.trim()) return t('ai.validationRequired');
    }
    if (typeof form.temperature !== 'number' || Number.isNaN(form.temperature)) {
      return t('ai.validationTemperature');
    }
    if (form.temperature < 0 || form.temperature > 2) {
      return t('ai.validationTemperature');
    }
    return null;
  }, [form, t]);

  const fetchModels = useCallback(
    async (baseUrl: string, apiKey: string) => {
      // Abort the previous request before starting a new one.
      modelsAbortRef.current?.abort();
      const controller = new AbortController();
      modelsAbortRef.current = controller;
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch('/api/ai/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              baseUrl: normalizeAiBaseUrl(baseUrl),
              apiKey,
              model: 'placeholder',
              temperature: form.temperature,
            },
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setAvailableModels([]);
          setModelsError(data.error || t('ai.connectionFailed'));
          return;
        }
        const data = (await res.json()) as { models?: unknown };
        const models = Array.isArray(data.models)
          ? (data.models.filter((m): m is string => typeof m === 'string') as string[])
          : [];
        if (controller.signal.aborted) return;
        setAvailableModels(models);
        // After a successful refetch, prefer the dropdown again. If the saved
        // model is still absent from the new list, the "select missing model
        // as custom" branch in the JSX will surface it.
        if (models.length > 0) setUseCustomModelInput(false);
        lastFetchKeyRef.current = `${normalizeAiBaseUrl(baseUrl)}::${apiKey}`;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAvailableModels([]);
        setModelsError(t('ai.connectionFailed'));
      } finally {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      }
    },
    [form.temperature, t],
  );

  const handleTestConnection = useCallback(async () => {
    const err = validate();
    if (err) {
      setTestState('error');
      setTestError(err);
      return;
    }
    setTestState('loading');
    setTestError(null);
    setTestModelCount(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            baseUrl: normalizeAiBaseUrl(form.baseUrl),
            apiKey: form.apiKey,
            model: form.model,
            temperature: form.temperature,
          },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { models?: unknown };
        const models: string[] = Array.isArray(data.models)
          ? (data.models.filter((m): m is string => typeof m === 'string') as string[])
          : [];
        setTestModelCount(models.length);
        setTestState('ok');
        setAvailableModels(models);
        setModelsError(null);
        if (models.length > 0) setUseCustomModelInput(false);
        lastFetchKeyRef.current = `${normalizeAiBaseUrl(form.baseUrl)}::${form.apiKey}`;
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setTestState('error');
        setTestError(data.error || t('ai.connectionFailed'));
      }
    } catch {
      setTestState('error');
      setTestError(t('ai.connectionFailed'));
    }
  }, [form, validate, t]);

  const handleSave = useCallback(() => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSettings({
      ...form,
      baseUrl: normalizeAiBaseUrl(form.baseUrl),
    });
    closeSettings();
  }, [form, validate, setSettings, closeSettings]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) closeSettings();
    },
    [closeSettings],
  );

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdrop}
    >
      <div
        ref={dialogRef}
        className="rounded-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {t('ai.title')}
          </h2>
          <button
            onClick={closeSettings}
            className="btn-ghost !p-1"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('ai.description')}
          </p>

          {/* Enable checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              {t('ai.enabled')}
            </span>
          </label>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('ai.baseUrl')}
            </label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="input-field !py-1.5 !text-xs w-full"
              placeholder={DEFAULT_AI_SETTINGS.baseUrl}
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('ai.apiKey')}
            </label>
            <div className="flex gap-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                className="input-field !py-1.5 !text-xs flex-1"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="btn-ghost !py-1.5 !px-2 !text-xs shrink-0"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                {showKey ? t('ai.hideKey') : t('ai.showKey')}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('ai.model')}
            </label>
            {(() => {
              const hasModelList = availableModels !== null && availableModels.length > 0;
              const isModelMissingFromList =
                hasModelList && form.model !== '' && !availableModels.includes(form.model);

              if (!useCustomModelInput && hasModelList) {
                // Dropdown: list provider's models only. If the saved model isn't
                // in the list, the select naturally deselects it — the user then
                // clicks "Edit custom" below to switch into input mode.
                return (
                  <>
                    <select
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      className="input-field !py-1.5 !text-xs w-full"
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {isModelMissingFromList && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => setUseCustomModelInput(true)}
                          className="btn-ghost !py-0.5 !px-1.5 !text-[10px]"
                          style={{ color: 'var(--color-text-subtle)' }}
                        >
                          {t('ai.editCustomModel')}
                        </button>
                      </div>
                    )}
                  </>
                );
              }

              // Free-text input: custom input active, no list, or empty list.
              return (
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="input-field !py-1.5 !text-xs w-full"
                  placeholder={DEFAULT_AI_SETTINGS.model}
                />
              );
            })()}
            <div className="flex items-center gap-3 mt-1">
              {/* Toggle between dropdown and custom input. */}
              {availableModels !== null && availableModels.length > 0 && !useCustomModelInput && (
                <button
                  type="button"
                  onClick={() => setUseCustomModelInput(true)}
                  className="btn-ghost !py-0.5 !px-1.5 !text-[10px]"
                  style={{ color: 'var(--color-text-subtle)' }}
                >
                  {t('ai.useCustomInput')}
                </button>
              )}
              {availableModels !== null && availableModels.length > 0 && useCustomModelInput && (
                <button
                  type="button"
                  onClick={() => setUseCustomModelInput(false)}
                  className="btn-ghost !py-0.5 !px-1.5 !text-[10px]"
                  style={{ color: 'var(--color-text-subtle)' }}
                >
                  {t('ai.backToList')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!form.baseUrl.trim() || !form.apiKey.trim()) {
                    setModelsError(t('ai.validationRequired'));
                    return;
                  }
                  fetchModels(form.baseUrl, form.apiKey);
                }}
                disabled={modelsLoading}
                className="btn-ghost !py-1 !px-2 !text-[10px]"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                {modelsLoading ? t('ai.loadingModels') : t('ai.fetchModels')}
              </button>
              {modelsError && (
                <span className="text-[10px]" style={{ color: 'var(--color-danger)' }}>
                  {modelsError}
                </span>
              )}
              {availableModels !== null && availableModels.length === 0 && !modelsError && (
                <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
                  {t('ai.noModels')}
                </span>
              )}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('ai.temperature')}
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setForm({ ...form, temperature: isNaN(val) ? 0 : val });
              }}
              className="input-field !py-1.5 !text-xs w-full"
            />
          </div>

          {/* Test connection status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testState === 'loading'}
              className="btn-secondary !py-1.5 !px-3 !text-xs"
            >
              {testState === 'loading' ? t('ai.testingConnection') : t('ai.testConnection')}
            </button>
            {testState === 'ok' && (
              <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                {t('ai.connectionOk')}{testModelCount !== null ? ` (${testModelCount} models)` : ''}
              </span>
            )}
            {testState === 'error' && testError && (
              <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
                {testError}
              </span>
            )}
          </div>

          {/* Validation error */}
          {error && (
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button onClick={closeSettings} className="btn-ghost !py-1.5 !px-3 !text-xs">
            {t('ai.cancel')}
          </button>
          <button onClick={handleSave} className="btn-primary !py-1.5 !px-3 !text-xs">
            {t('ai.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
