'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { DEFAULT_LOCALE, messages, type Locale } from '@/lib/i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('locale');
    const initial: Locale = (stored === 'zh' || stored === 'en') ? stored : DEFAULT_LOCALE;
    setLocaleState(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = locale;
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  }, []);

  const resolveT = useCallback(
    (key: string, values: Record<string, string | number> = {}): string => {
      const parts = key.split('.');
      let obj: any = messages[locale];
      for (const part of parts) {
        if (obj == null) return key;
        obj = obj[part];
      }
      if (typeof obj !== 'string') return key;
      return obj.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
    },
    [locale]
  );

  if (!mounted) {
    return (
      <div lang="zh-CN" data-lang="zh">
        {children}
      </div>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: resolveT }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
