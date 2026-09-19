import { useState } from 'react';
import type { KlipSettings, TtsProvider } from '../../../shared/types';
import { VOICE_PRESETS, SARVAM_VOICE_PRESETS } from '../../../shared/types';
import { ProviderKey } from './ProviderKey';
import { Slider } from './Slider';

interface VoiceTabProps {
  settings: KlipSettings;
}

export function VoiceTab({ settings }: VoiceTabProps) {
  const [providerOpen, setProviderOpen] = useState(false);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  const provider = settings.ttsProvider;
  const isElevenLabs = provider === 'elevenlabs';
  const isSarvam = provider === 'sarvam';

  const selectedVoice = VOICE_PRESETS.find((v) => v.id === settings.voiceId) ?? VOICE_PRESETS[0];
  const selectedSpeaker =
    SARVAM_VOICE_PRESETS.find((v) => v.id === settings.sarvamSpeaker) ?? SARVAM_VOICE_PRESETS[0];

  const providerLabel = isElevenLabs ? 'ElevenLabs' : 'Sarvam AI';
  const providerLogoText = isElevenLabs ? '11' : 'S';
  const providerLogoClass = isElevenLabs ? 'eleven' : 'sarvam';

  return (
    <>
      <h1 className="main-h1">
        Voice<em>.</em>
      </h1>
      <p className="main-lead">
        How KLIP sounds. Pick a provider and voice, tune speed and stability, or mute replies
        for silent mode.
      </p>

      <div className="section">
        <div className="section-title">Voice provider</div>

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
                { id: 'elevenlabs', label: 'ElevenLabs', sub: 'Large curated voice catalog · speed & stability tuning' },
                { id: 'sarvam', label: 'Sarvam AI', sub: 'Bulbul v2 · strong Indian-language and multilingual voices' },
              ] as Array<{ id: TtsProvider; label: string; sub: string }>
            ).map((p) => (
              <button
                key={p.id}
                className={`voice-item ${provider === p.id ? 'on' : ''}`}
                onClick={() => {
                  window.klip.setTtsProvider(p.id);
                  setProviderOpen(false);
                }}
              >
                <div className="nm">{p.label}</div>
                <div className="sub">{p.sub}</div>
              </button>
            ))}
          </div>
        )}

        {isElevenLabs && (
          <ProviderKey
            name="elevenlabs"
            providerLabel="ElevenLabs"
            providerLogo="11"
            providerLogoClass="eleven"
            isSet={settings.apiKeyStatus.elevenlabs}
            keyPlaceholder="xi-..."
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
        <p className="section-hint">Gives KLIP a voice. Required to speak replies aloud.</p>
      </div>

      {isElevenLabs && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Voice</div>
          <div className="vpreview">
            <button
              className="play-btn"
              onClick={() => window.klip.playVoicePreview(settings.voiceId)}
              aria-label="Preview voice"
            >
              ▶
            </button>
            <div className="vpreview-meta">
              <div className="vpreview-name">{selectedVoice.name}</div>
              <div className="vpreview-sub">{selectedVoice.description}</div>
            </div>
            <button className="btn xs" onClick={() => setVoicePickerOpen((x) => !x)}>
              {voicePickerOpen ? 'Close' : 'Change'}
            </button>
          </div>

          {voicePickerOpen && (
            <div className="voice-list">
              {VOICE_PRESETS.map((v) => (
                <button
                  key={v.id}
                  className={`voice-item ${v.id === settings.voiceId ? 'on' : ''}`}
                  onClick={() => {
                    window.klip.setVoiceId(v.id);
                    setVoicePickerOpen(false);
                  }}
                >
                  <div className="nm">{v.name}</div>
                  <div className="sub">{v.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isSarvam && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Speaker</div>
          <div className="vpreview">
            <button
              className="play-btn"
              onClick={() => window.klip.playSarvamVoicePreview(settings.sarvamSpeaker)}
              aria-label="Preview speaker"
            >
              ▶
            </button>
            <div className="vpreview-meta">
              <div className="vpreview-name">{selectedSpeaker.name}</div>
              <div className="vpreview-sub">{selectedSpeaker.description}</div>
            </div>
            <button className="btn xs" onClick={() => setVoicePickerOpen((x) => !x)}>
              {voicePickerOpen ? 'Close' : 'Change'}
            </button>
          </div>

          {voicePickerOpen && (
            <div className="voice-list">
              {SARVAM_VOICE_PRESETS.map((v) => (
                <button
                  key={v.id}
                  className={`voice-item ${v.id === settings.sarvamSpeaker ? 'on' : ''}`}
                  onClick={() => {
                    window.klip.setSarvamSpeaker(v.id);
                    setVoicePickerOpen(false);
                  }}
                >
                  <div className="nm">{v.name}</div>
                  <div className="sub">{v.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="section">
        {isElevenLabs && (
          <>
            <div className="row">
              <div className="row-main">
                <div className="row-t">Speed</div>
                <div className="row-s">how fast KLIP speaks</div>
              </div>
              <div style={{ width: 220 }}>
                <Slider
                  value={settings.voiceSpeed}
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)}×`}
                  onChange={(v) => window.klip.setVoiceSpeed(v)}
                />
              </div>
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-t">Stability</div>
                <div className="row-s">lower = more expressive, higher = more consistent</div>
              </div>
              <div style={{ width: 220 }}>
                <Slider
                  value={settings.voiceStability}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => window.klip.setVoiceStability(v)}
                />
              </div>
            </div>
          </>
        )}
        <div className="row">
          <div className="row-main">
            <div className="row-t">Speak replies aloud</div>
            <div className="row-s">auto-play voice response after each answer</div>
          </div>
          <button
            className={`toggle ${settings.speakReplies ? 'on' : ''}`}
            onClick={() => window.klip.setSpeakReplies(!settings.speakReplies)}
            aria-label="Toggle speak replies"
          />
        </div>
      </div>
    </>
  );
}
