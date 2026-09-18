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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onMouseDown={handleBackdrop}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl overflow-hidden border border-white/20 bg-[#0c0a17]/95 backdrop-blur-2xl shadow-2xl shadow-indigo-950/50"
      >
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-cyan-400" />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('ai.settingsTitle')}</span>
          </h2>
          <button
            onClick={closeSettings}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] leading-5 text-slate-400">
            {t('ai.keyHint')}
          </p>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-white mb-1.5">
              {t('ai.apiKey')}
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => {
                  setForm({ apiKey: e.target.value });
                  setTestState('idle');
                  setTestError(null);
                }}
                className="w-full h-10 px-3.5 rounded-xl bg-[#1A1A1A] border border-white/5 text-white placeholder:text-white/20 text-xs focus:outline-none focus:ring-2 focus:ring-white/20 font-mono transition-all"
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="h-10 px-3.5 text-xs rounded-xl bg-black/60 hover:bg-white/5 text-white/80 hover:text-white border border-white/10 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
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
              className="px-3.5 py-1.5 text-xs rounded-xl bg-black/60 hover:bg-white/5 text-white/90 border border-white/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              {testState === 'loading' ? t('ai.testingConnection') : t('ai.testConnection')}
            </button>
            {testState === 'ok' && (
              <span className="text-xs text-emerald-400 font-medium">
                {t('ai.connectionOk')}
              </span>
            )}
            {testState === 'error' && testError && (
              <span className="text-xs text-rose-400 font-medium">
                {testError}
              </span>
            )}
          </div>

          {/* Validation error */}
          {error && (
            <p className="text-xs text-rose-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10 bg-black/40">
          <button
            onClick={closeSettings}
            className="px-4 py-2 text-xs rounded-xl bg-black/60 border border-white/10 hover:bg-white/5 active:scale-[0.98] text-white/80 hover:text-white transition-all cursor-pointer"
          >
            {t('ai.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-md shadow-white/5 transition-all cursor-pointer"
          >
            {t('ai.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
