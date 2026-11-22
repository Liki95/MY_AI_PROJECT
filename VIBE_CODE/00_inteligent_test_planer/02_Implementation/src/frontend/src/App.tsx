import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { PublicSettings } from './types';
import GeneratorPanel from './components/GeneratorPanel';
import SettingsPanel from './components/SettingsPanel';

export default function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api.getSettings());
      setSettingsError(null);
    } catch (e) {
      setSettingsError(e instanceof ApiError ? e.message : 'Failed to load settings.');
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <main className="layout">
      <GeneratorPanel settings={settings} />
      <SettingsPanel settings={settings} loadError={settingsError} onSettingsChange={setSettings} onRetry={loadSettings} />
    </main>
  );
}
