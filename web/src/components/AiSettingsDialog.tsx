'use client';

import { useState, useEffect, useRef } from 'react';
import { useAiSettings } from './AiSettingsProvider';
import type { AiSettings } from '@/lib/ai-settings';
import { useI18n } from './LanguageProvider';
import { X } from './icons/IonIcons';

export function AiSettingsDialog() {
  const { settings, setSettings, isSettingsOpen, closeSettings } = useAiSettings();
  const { t } = useI18n();

  const [form, setForm] = useState<AiSettings>({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync form with settings when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setForm({ ...settings });
      setError(null);
      setShowKey(false);
      setTestState('idle');
      setTestError(null);
    }
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

  // Cancel any in-flight test when the dialog closes
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleTest = async () => {
    const key = form.apiKey.trim();
    if (!key) {
      setTestState('error');
      setTestError(t('ai.validationRequired'));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTestState('loading');
    setTestError(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { apiKey: key } }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.ok) {
        setTestState('ok');
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setTestState('error');
        setTestError(data.error || t('ai.connectionFailed'));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setTestState('error');
      setTestError(t('ai.connectionFailed'));
    }
  };

  const handleSave = () => {
    const key = form.apiKey.trim();
    if (!key) {
      setError(t('ai.validationRequired'));
      return;
    }
    setError(null);
    setSettings({ apiKey: key });
    closeSettings();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeSettings();
  };

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={handleBackdrop}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {t('ai.settingsTitle')}
          </h2>
          <button
            onClick={closeSettings}
            className="btn-ghost !p-1"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] leading-5" style={{ color: 'var(--color-text-subtle)' }}>
            {t('ai.keyHint')}
          </p>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('ai.apiKey')}
            </label>
            <div className="flex gap-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => {
                  setForm({ apiKey: e.target.value });
                  setTestState('idle');
                  setTestError(null);
                }}
                className="input-field !py-1.5 !text-xs flex-1"
                placeholder="sk-..."
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

          {/* Test connection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testState === 'loading'}
              className="btn-secondary !py-1.5 !px-3 !text-xs"
            >
              {testState === 'loading' ? t('ai.testingConnection') : t('ai.testConnection')}
            </button>
            {testState === 'ok' && (
              <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                {t('ai.connectionOk')}
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
