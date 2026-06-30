'use client';

import { useI18n } from './LanguageProvider';

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="flex items-center rounded-lg overflow-hidden shrink-0"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        height: 32,
      }}
    >
      <button
        onClick={() => setLocale('zh')}
        className="px-2.5 text-xs font-medium transition-colors h-full"
        style={{
          color: locale === 'zh' ? 'var(--color-primary)' : 'var(--color-text-subtle)',
          background: locale === 'zh' ? 'var(--color-surface)' : 'transparent',
        }}
        aria-label="Switch to Chinese"
      >
        中
      </button>
      <span style={{ color: 'var(--color-border)', fontSize: 11 }}>|</span>
      <button
        onClick={() => setLocale('en')}
        className="px-2.5 text-xs font-medium transition-colors h-full"
        style={{
          color: locale === 'en' ? 'var(--color-primary)' : 'var(--color-text-subtle)',
          background: locale === 'en' ? 'var(--color-surface)' : 'transparent',
        }}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
