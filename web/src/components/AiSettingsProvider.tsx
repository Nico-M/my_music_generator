'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { loadAiSettings, saveAiSettings, type AiSettings, DEFAULT_AI_SETTINGS } from '@/lib/ai-settings';
import { AiSettingsDialog } from './AiSettingsDialog';

interface AiSettingsContextValue {
  settings: AiSettings;
  setSettings: (settings: AiSettings) => void;
  openSettings: () => void;
  closeSettings: () => void;
  isSettingsOpen: boolean;
  isConfigured: boolean;
}

const AiSettingsContext = createContext<AiSettingsContextValue>({
  settings: { ...DEFAULT_AI_SETTINGS },
  setSettings: () => {},
  openSettings: () => {},
  closeSettings: () => {},
  isSettingsOpen: false,
  isConfigured: false,
});

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AiSettings>({ ...DEFAULT_AI_SETTINGS });
  const [mounted, setMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsState(loadAiSettings());
    setMounted(true);
  }, []);

  const setSettings = useCallback((next: AiSettings) => {
    setSettingsState(next);
    saveAiSettings(next);
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const isConfigured = useMemo(
    () =>
      settings.enabled &&
      settings.baseUrl.trim().length > 0 &&
      settings.apiKey.trim().length > 0 &&
      settings.model.trim().length > 0,
    [settings],
  );

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      settings: mounted ? settings : { ...DEFAULT_AI_SETTINGS },
      setSettings,
      openSettings,
      closeSettings,
      isSettingsOpen,
      isConfigured,
    }),
    [settings, mounted, setSettings, openSettings, closeSettings, isSettingsOpen, isConfigured],
  );

  return (
    <AiSettingsContext.Provider value={value}>
      {children}
      <AiSettingsDialog />
    </AiSettingsContext.Provider>
  );
}

export function useAiSettings() {
  return useContext(AiSettingsContext);
}
