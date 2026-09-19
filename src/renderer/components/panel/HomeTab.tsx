import type { KlipSettings, VoiceState, MemoryStats } from '../../../shared/types';
import { Waveform } from '../Waveform';
import { Tour } from './Tour';

interface HomeTabProps {
  voiceState: VoiceState;
  settings: KlipSettings;
  memory: MemoryStats | null;
  onNavigate: (tab: 'chats' | 'mind' | 'voice' | 'ear' | 'general') => void;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const MIND_LOGO: Record<string, { text: string; cls: string; label: string }> = {
  anthropic: { text: 'A', cls: '', label: 'Anthropic' },
  openai: { text: 'Ai', cls: 'openai', label: 'OpenAI' },
  gemini: { text: 'G', cls: 'gemini', label: 'Gemini' },
  ollama: { text: '⬡', cls: 'local', label: 'Local' },
};

export function HomeTab({ voiceState, settings, memory, onNavigate }: HomeTabProps) {
  const { apiKeyStatus, mindProvider, ttsProvider, transcriptionProvider } = settings;
  const sttProvider = transcriptionProvider === 'sarvam' ? 'sarvam' : 'groq';
  const localConn = (settings.localConnections ?? []).find((c) => c.enabled);
  const mindReady =
    mindProvider === 'openai'
      ? apiKeyStatus.openai
      : mindProvider === 'gemini'
        ? apiKeyStatus.gemini
        : mindProvider === 'ollama'
          ? !!localConn
          : apiKeyStatus.anthropic;
  // Voice is only a requirement when the user wants spoken replies.
  const voiceRequired = settings.speakReplies;
  const required = [mindReady, apiKeyStatus[sttProvider], ...(voiceRequired ? [apiKeyStatus[ttsProvider]] : [])];
  const connectedCount = required.filter(Boolean).length;
  const ready = connectedCount === required.length;
  const total = required.length;

  const modelLabel =
    mindProvider === 'openai'
      ? settings.selectedOpenAIModel === 'gpt-5'
        ? 'GPT-5'
        : settings.selectedOpenAIModel === 'gpt-5-mini'
          ? 'GPT-5 mini'
          : 'GPT-4o'
      : mindProvider === 'gemini'
        ? settings.selectedGeminiModel === 'gemini-3.1-pro-preview'
          ? 'Gemini 3.1 Pro'
          : 'Gemini 3.6 Flash'
        : mindProvider === 'ollama'
          ? (localConn?.activeModelId ?? localConn?.modelIds[0] ?? 'Local model')
          : settings.selectedModel === 'claude-sonnet-4-6'
            ? 'Claude Sonnet 4.6'
            : 'Claude Opus 4.6';

  const pct = memory ? Math.round((memory.tokens / memory.tokenBudget) * 100) : 0;

  const shortcutKeys = settings.pushToTalkShortcut.split('+').filter(Boolean);
  const mindLogo = MIND_LOGO[mindProvider] ?? MIND_LOGO.anthropic;

  return (
    <>
      <h1 className="main-h1">
        Welcome back<em>.</em>
      </h1>
      <p className="main-lead">
        {ready
          ? 'Hold the push-to-talk shortcut from anywhere and KLIP will listen, think, and reply.'
          : `${connectedCount} of ${total} providers connected. Add the remaining keys to start talking.`}
      </p>

      <div className="home-hero">
        <div className="home-wave-wrap">
          <Waveform state={ready ? voiceState : 'idle'} bars={23} height={72} />
          {ready ? (
            <div className="home-ptt">
              hold{' '}
              {shortcutKeys.map((k, i) => (
                <kbd key={`${k}-${i}`}>{k}</kbd>
              ))}{' '}
              to talk
            </div>
          ) : (
            <div className="home-ptt blocked">add the missing key to start talking</div>
          )}
        </div>
        <div className="home-status">
          <div className="status-chip">
            <div
              className={`dot ${
                voiceState === 'listening' || voiceState === 'responding'
                  ? 'active'
                  : ready
                    ? ''
                    : 'warn'
              }`}
            />
            <div style={{ flex: 1 }}>
              <div className="t">
                {voiceState === 'listening'
                  ? 'Listening'
                  : voiceState === 'processing'
                    ? 'Thinking'
                    : voiceState === 'responding'
                      ? 'Responding'
                      : ready
                        ? 'Ready'
                        : 'Setup needed'}
              </div>
              <div className="s">{ready ? 'all providers connected' : `${connectedCount} of ${total} connected`}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Memory</div>
          <div className="stat-value">{formatTokens(memory?.tokens ?? 0)}</div>
          <div className="stat-sub">of {formatTokens(memory?.tokenBudget ?? 250_000)} tokens ({pct}%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Model</div>
          <div className="stat-value" style={{ fontSize: 22, lineHeight: 1.15 }}>{modelLabel}</div>
          <div className="stat-sub">{settings.reasoningDepth === 'off' ? 'no extended thinking' : `${settings.reasoningDepth} reasoning`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Messages</div>
          <div className="stat-value">{memory?.messageCount ?? 0}</div>
          <div className="stat-sub">
            {memory?.summarizedCount
              ? `${memory.summarizedCount} summarized`
              : 'in this session'}
          </div>
        </div>
      </div>

      <div className="provider-summary">
        <h3>Connected providers</h3>
        <div className="provider-row">
          <div className={`provider-logo ${mindLogo.cls}`}>{mindLogo.text}</div>
          <div className="nm">
            {mindLogo.label}{' '}
            <span className="purpose" style={{ marginLeft: 6 }}>· reasoning</span>
          </div>
          {mindReady ? (
            <span className="pill-saved">Connected</span>
          ) : (
            <button className="goto" onClick={() => onNavigate('mind')}>Add key →</button>
          )}
        </div>
        <div className="provider-row">
          <div className={`provider-logo ${ttsProvider === 'sarvam' ? 'sarvam' : 'eleven'}`}>
            {ttsProvider === 'sarvam' ? 'S' : '11'}
          </div>
          <div className="nm">
            {ttsProvider === 'sarvam' ? 'Sarvam AI' : 'ElevenLabs'}{' '}
            <span className="purpose" style={{ marginLeft: 6 }}>· voice</span>
          </div>
          {apiKeyStatus[ttsProvider] ? (
            <span className="pill-saved">Connected</span>
          ) : !voiceRequired ? (
            <span className="purpose">off — text only</span>
          ) : (
            <button className="goto" onClick={() => onNavigate('voice')}>Add key →</button>
          )}
        </div>
        <div className="provider-row">
          <div className={`provider-logo ${sttProvider === 'sarvam' ? 'sarvam' : 'groq'}`}>
            {sttProvider === 'sarvam' ? 'S' : 'G'}
          </div>
          <div className="nm">
            {sttProvider === 'sarvam' ? 'Sarvam AI' : 'Groq'}{' '}
            <span className="purpose" style={{ marginLeft: 6 }}>· transcription</span>
          </div>
          {apiKeyStatus[sttProvider] ? (
            <span className="pill-saved">Connected</span>
          ) : (
            <button className="goto" onClick={() => onNavigate('ear')}>Add key →</button>
          )}
        </div>
      </div>

      <Tour shortcut={settings.pushToTalkShortcut} onNavigate={onNavigate} />
    </>
  );
}
