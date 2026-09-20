import { useState, useEffect } from 'react';
import type { VoiceState, KlipSettings, MemoryStats } from '../../shared/types';
import { HomeTab } from './panel/HomeTab';
import { ChatsTab } from './panel/ChatsTab';
import { MindTab } from './panel/MindTab';
import { VoiceTab } from './panel/VoiceTab';
import { EarTab } from './panel/EarTab';
import { GeneralTab } from './panel/GeneralTab';
import { SettingsTab } from './panel/SettingsTab';
import { AgentsTab } from './panel/AgentsTab';
import { IntegrationsTab } from './panel/IntegrationsTab';
import { PermissionsBanner } from './panel/PermissionsBanner';
import { Onboarding } from './panel/Onboarding';
import { KlipPet } from './KlipPet';

type Tab = 'home' | 'chats' | 'mind' | 'voice' | 'ear' | 'general' | 'settings' | 'agents' | 'integrations';

export function PanelApp() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [settings, setSettings] = useState<KlipSettings | null>(null);
  const [memory, setMemory] = useState<MemoryStats | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [version, setVersion] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    window.klip.getSettings().then(setSettings);
    window.klip.getMemoryStats().then(setMemory);
    window.klip.getAppVersion().then(setVersion).catch(() => {});

    let errTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubs = [
      window.klip.onVoiceStateChanged(setVoiceState),
      window.klip.onSettingsChanged(setSettings),
      window.klip.onMemoryStats(setMemory),
      // Turn failures used to vanish into the main-process console. Show
      // them in a dismissable strip so "nothing happened" becomes "here's
      // why nothing happened".
      window.klip.onAiError((m) => {
        setLastError(m);
        if (errTimer) clearTimeout(errTimer);
        errTimer = setTimeout(() => setLastError(null), 12_000);
      }),
    ];
    return () => {
      unsubs.forEach((u) => u());
      if (errTimer) clearTimeout(errTimer);
    };
  }, []);

  if (!settings) return null;

  if (!settings.onboardingComplete) {
    return <Onboarding settings={settings} voiceState={voiceState} />;
  }

  const { apiKeyStatus } = settings;
  const mindNeeds =
    settings.mindProvider === 'openai'
      ? !apiKeyStatus.openai
      : settings.mindProvider === 'gemini'
        ? !apiKeyStatus.gemini
        : settings.mindProvider === 'ollama'
          ? !(settings.localConnections ?? []).some((c) => c.enabled)
          : !apiKeyStatus.anthropic;
  const sttProvider = settings.transcriptionProvider === 'sarvam' ? 'sarvam' : 'groq';

  const navItem = (
    id: Tab,
    label: string,
    icon: string,
    opts: { needs?: boolean } = {},
  ) => (
    <button
      className={`nav-item ${tab === id ? 'on' : ''}`}
      onClick={() => setTab(id)}
    >
      <span className="nav-icon" aria-hidden>{icon}</span>
      <span className="label">{label}</span>
      {opts.needs && <span className="dot warn" />}
    </button>
  );

  return (
    <div className="panel-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <KlipPet mood={voiceState} size={30} />
          </div>
          <div className="sidebar-title">KLIP</div>
        </div>

        <nav className="nav">
          {navItem('home', 'Home', '⌂')}
          {navItem('chats', 'Chats', '◆')}

          <div className="nav-label">Providers</div>
          {navItem('mind', 'Mind', '◈', { needs: mindNeeds })}
          {navItem('voice', 'Voice', '◉', { needs: settings.speakReplies && !apiKeyStatus[settings.ttsProvider] })}
          {navItem('ear', 'Ear', '◐', { needs: !apiKeyStatus[sttProvider] })}

          <div className="nav-label">Crew</div>
          {navItem('agents', 'Agents', '✦')}

          <div className="nav-label">Capabilities</div>
          {navItem('integrations', 'MCP Integrations', '⬡')}

          <div className="nav-label">System</div>
          {navItem('settings', 'Settings', '⚙')}
          {navItem('general', 'General', '▤')}
        </nav>

        <div className="sidebar-foot">
          <button className="nav-item quit" onClick={() => window.klip.quit()}>
            <span className="label">Quit</span>
          </button>
          <div className="sidebar-version">{version ? `v${version}` : ''}</div>
        </div>
      </aside>

      <main className="main">
        <PermissionsBanner />
        {lastError && (
          <div className="error-strip" role="alert">
            <span className="error-strip-text">{lastError}</span>
            <button className="error-strip-close" onClick={() => setLastError(null)} aria-label="Dismiss">×</button>
          </div>
        )}
        {!settings.encryptionAvailable && (
          <div className="perm-banner">
            <div className="perm-banner-head">
              <span className="perm-banner-title">API keys are not encrypted</span>
              <span className="perm-banner-sub">
                OS secure storage is unavailable on this system. Keys are not encrypted and are
                readable by anything that can read the file.
              </span>
            </div>
          </div>
        )}
        {tab === 'home' && (
          <HomeTab
            voiceState={voiceState}
            settings={settings}
            memory={memory}
            onNavigate={(t) => setTab(t)}
          />
        )}
        {tab === 'chats' && <ChatsTab />}
        {tab === 'mind' && <MindTab settings={settings} />}
        {tab === 'voice' && <VoiceTab settings={settings} />}
        {tab === 'ear' && <EarTab settings={settings} />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'settings' && <SettingsTab settings={settings} />}
        {tab === 'general' && <GeneralTab settings={settings} memory={memory} />}
      </main>
    </div>
  );
}
