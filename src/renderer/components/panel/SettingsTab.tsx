import type { ApiKeyName, KlipSettings } from '../../../shared/types';
import { ProviderKey } from './ProviderKey';

interface SettingsTabProps {
  settings: KlipSettings;
}

const PROVIDERS: Array<{
  name: ApiKeyName;
  label: string;
  logo: string;
  logoClass?: string;
  placeholder: string;
  purpose: string;
}> = [
  { name: 'anthropic', label: 'Anthropic', logo: 'A', placeholder: 'sk-ant-...', purpose: 'reasoning · Mind' },
  { name: 'openai', label: 'OpenAI', logo: 'Ai', logoClass: 'openai', placeholder: 'sk-...', purpose: 'reasoning · Mind' },
  { name: 'gemini', label: 'Gemini', logo: 'G', logoClass: 'gemini', placeholder: 'AIza...', purpose: 'reasoning · Mind' },
  { name: 'elevenlabs', label: 'ElevenLabs', logo: '11', logoClass: 'eleven', placeholder: 'xi-...', purpose: 'voice · Voice' },
  { name: 'sarvam', label: 'Sarvam AI', logo: 'S', logoClass: 'sarvam', placeholder: 'sk_...', purpose: 'voice + transcription · Voice & Ear' },
  { name: 'groq', label: 'Groq', logo: 'G', logoClass: 'groq', placeholder: 'gsk_...', purpose: 'transcription · Ear' },
];

/**
 * A single consolidated place to add, replace, remove and test every
 * provider key — Mind/Voice/Ear each still let you manage their own
 * active provider's key inline, but this is the one screen that shows
 * every key at once, and the fastest way back into onboarding.
 */
export function SettingsTab({ settings }: SettingsTabProps) {
  const connectedCount = PROVIDERS.filter((p) => settings.apiKeyStatus[p.name]).length;

  return (
    <>
      <h1 className="main-h1">
        Settings<em>.</em>
      </h1>
      <p className="main-lead">
        Every provider key in one place. Each save round-trips against the provider before it's
        kept, so a bad or revoked key never gets you stuck silently.
      </p>

      <div className="section">
        <div className="section-row" style={{ marginBottom: 14 }}>
          <div className="section-title">API keys</div>
          <div className="section-sub">{connectedCount} of {PROVIDERS.length} connected</div>
        </div>
        <div className="keyring">
          {PROVIDERS.map((p, i) => (
            <div className={`keyring-item ${i === 0 ? 'first' : ''}`} key={p.name}>
              <div className="keyring-head">
                <div className={`provider-logo ${p.logoClass ?? ''}`}>{p.logo}</div>
                <div>
                  <div className="nm">{p.label}</div>
                  <div className="sub">{p.purpose}</div>
                </div>
              </div>
              <ProviderKey
                name={p.name}
                providerLabel={p.label}
                providerLogo={p.logo}
                providerLogoClass={p.logoClass}
                isSet={settings.apiKeyStatus[p.name]}
                keyPlaceholder={p.placeholder}
                hideProviderHeader
              />
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 4 }}>Setup</div>
        <div className="row">
          <div className="row-main">
            <div className="row-t">Run onboarding again</div>
            <div className="row-s">re-check permissions, keys, the shortcut and your mic step by step</div>
          </div>
          <button className="btn xs" onClick={() => window.klip.replayOnboarding()}>
            Re-onboard →
          </button>
        </div>
      </div>
    </>
  );
}
