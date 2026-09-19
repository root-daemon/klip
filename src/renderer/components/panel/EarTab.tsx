import { useState } from 'react';
import type { KlipSettings, GroqTranscriptionModel, TranscriptionProviderType } from '../../../shared/types';
import { ProviderKey } from './ProviderKey';

interface EarTabProps {
  settings: KlipSettings;
}

const MODELS: Array<{
  id: GroqTranscriptionModel;
  name: string;
  sub: string;
  tag?: { label: string; cls: string };
}> = [
  { id: 'whisper-large-v3', name: 'Whisper Large v3', sub: 'highest accuracy · multilingual' },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    sub: 'fast · multilingual',
    tag: { label: 'default', cls: 'info' },
  },
];

export function EarTab({ settings }: EarTabProps) {
  const [providerOpen, setProviderOpen] = useState(false);

  const provider = settings.transcriptionProvider;
  const isGroq = provider === 'groq' || provider === 'native';
  const isSarvam = provider === 'sarvam';

  const providerLabel = isSarvam ? 'Sarvam AI' : 'Groq';
  const providerLogoText = isSarvam ? 'S' : 'G';
  const providerLogoClass = isSarvam ? 'sarvam' : 'groq';

  return (
    <>
      <h1 className="main-h1">
        Ear<em>.</em>
      </h1>
      <p className="main-lead">How KLIP hears you. Pick a transcription provider based on the tradeoff between speed, accuracy, and language coverage.</p>

      <div className="section">
        <div className="section-title">Transcription provider</div>

        <div className="provider-header">
          <button
            type="button"
            className="provider-pick"
            onClick={() => setProviderOpen((x) => !x)}
          >
            <div className={`provider-logo ${providerLogoClass}`}>{providerLogoText}</div>
            <span>{providerLabel}</span>
            <span className="chev">▾</span>
          </button>
        </div>

        {providerOpen && (
          <div className="voice-list" style={{ marginTop: 8 }}>
            {(
              [
                { id: 'groq', label: 'Groq', sub: 'Whisper Large v3 · very fast · English-tuned' },
                { id: 'sarvam', label: 'Sarvam AI', sub: 'Saarika v2.5 · strong Indian-language & code-switched speech' },
              ] as Array<{ id: TranscriptionProviderType; label: string; sub: string }>
            ).map((p) => (
              <button
                key={p.id}
                className={`voice-item ${provider === p.id ? 'on' : ''}`}
                onClick={() => {
                  window.klip.setTranscriptionProvider(p.id);
                  setProviderOpen(false);
                }}
              >
                <div className="nm">{p.label}</div>
                <div className="sub">{p.sub}</div>
              </button>
            ))}
          </div>
        )}

        {isGroq && (
          <ProviderKey
            name="groq"
            providerLabel="Groq"
            providerLogo="G"
            providerLogoClass="groq"
            isSet={settings.apiKeyStatus.groq}
            keyPlaceholder="gsk_..."
            hideProviderHeader
          />
        )}
        {isSarvam && (
          <ProviderKey
            name="sarvam"
            providerLabel="Sarvam AI"
            providerLogo="S"
            providerLogoClass="sarvam"
            isSet={settings.apiKeyStatus.sarvam}
            keyPlaceholder="sk_..."
            hideProviderHeader
          />
        )}
        <p className="section-hint">Transcribes your voice fast and accurately.</p>
      </div>

      {isGroq && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Model</div>
          <div className="model-list">
            {MODELS.map((m) => (
              <button
                key={m.id}
                className={`model-item ${settings.groqTranscriptionModel === m.id ? 'on' : ''}`}
                onClick={() => window.klip.setGroqModel(m.id)}
              >
                <div className="model-radio" />
                <div className="model-meta">
                  <div className="model-name">{m.name}</div>
                  <div className="model-sub">{m.sub}</div>
                </div>
                {m.tag && <div className={`model-tag ${m.tag.cls}`}>{m.tag.label}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {isSarvam && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 6 }}>Model</div>
          <p className="section-hint" style={{ margin: 0 }}>
            Sarvam always uses <strong>Saarika v2.5</strong> with automatic language detection —
            no model choice needed.
          </p>
        </div>
      )}
    </>
  );
}
