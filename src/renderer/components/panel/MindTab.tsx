import { useState } from 'react';
import type {
  KlipSettings,
  ClaudeModel,
  OpenAIModel,
  GeminiModel,
  MindProvider,
  ReasoningDepth,
  ReplyTone,
} from '../../../shared/types';
import { ProviderKey } from './ProviderKey';
import { OllamaSection } from './OllamaSection';

interface MindTabProps {
  settings: KlipSettings;
}

interface ModelEntry<M extends string> {
  id: M;
  name: string;
  sub: string;
  tag?: { label: string; cls: string };
}

const CLAUDE_MODELS: Array<ModelEntry<ClaudeModel>> = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    sub: 'fast · balanced · default',
    tag: { label: 'recommended', cls: 'info' },
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    sub: 'deepest reasoning · slower',
  },
];

const OPENAI_MODELS: Array<ModelEntry<OpenAIModel>> = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    sub: 'frontier reasoning · supports extended thinking',
    tag: { label: 'recommended', cls: 'info' },
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    sub: 'fast + cheap reasoning model',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    sub: 'multimodal · fast',
  },
];

const GEMINI_MODELS: Array<ModelEntry<GeminiModel>> = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    sub: 'fast · cheap · supports extended thinking',
    tag: { label: 'recommended', cls: 'info' },
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    sub: 'deepest reasoning · slower · preview',
  },
];

export function MindTab({ settings }: MindTabProps) {
  const [providerOpen, setProviderOpen] = useState(false);

  const provider = settings.mindProvider;
  const isAnthropic = provider === 'anthropic';
  const isOpenAI = provider === 'openai';
  const isGemini = provider === 'gemini';
  const isOllama = provider === 'ollama';
  const setTone = (t: ReplyTone) => window.klip.setReplyTone(t);
  const setDepth = (d: ReasoningDepth) => window.klip.setReasoningDepth(d);

  const providerLabel = isAnthropic ? 'Anthropic' : isOpenAI ? 'OpenAI' : isGemini ? 'Gemini' : 'Local';
  const providerLogoText = isAnthropic ? 'A' : isOpenAI ? 'Ai' : isGemini ? 'G' : '⬡';
  const providerLogoClass = isAnthropic ? '' : isOpenAI ? 'openai' : isGemini ? 'gemini' : 'local';

  return (
    <>
      <h1 className="main-h1">
        Mind<em>.</em>
      </h1>
      <p className="main-lead">
        How KLIP thinks — which provider, which model, how deep it reasons, and the tone of
        its replies.
      </p>

      <div className="section">
        <div className="section-title">Model provider</div>

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
                { id: 'anthropic', label: 'Anthropic', sub: 'Claude Sonnet / Opus · built-in web search' },
                { id: 'openai', label: 'OpenAI', sub: 'GPT-5 · GPT-4o · reasoning effort' },
                { id: 'gemini', label: 'Gemini', sub: 'Gemini 2.5 Pro / Flash · Google Search grounding' },
                { id: 'ollama', label: 'Local', sub: 'Ollama · LM Studio · vLLM · any OpenAI-compatible endpoint' },
              ] as Array<{ id: MindProvider; label: string; sub: string }>
            ).map((p) => (
              <button
                key={p.id}
                className={`voice-item ${provider === p.id ? 'on' : ''}`}
                onClick={() => {
                  window.klip.setMindProvider(p.id);
                  setProviderOpen(false);
                }}
              >
                <div className="nm">{p.label}</div>
                <div className="sub">{p.sub}</div>
              </button>
            ))}
          </div>
        )}

        {isAnthropic && (
          <ProviderKey
            name="anthropic"
            providerLabel="Anthropic"
            providerLogo="A"
            isSet={settings.apiKeyStatus.anthropic}
            keyPlaceholder="sk-ant-..."
            hideProviderHeader
          />
        )}
        {isOpenAI && (
          <ProviderKey
            name="openai"
            providerLabel="OpenAI"
            providerLogo="Ai"
            providerLogoClass="openai"
            isSet={settings.apiKeyStatus.openai}
            keyPlaceholder="sk-..."
            hideProviderHeader
          />
        )}
        {isGemini && (
          <ProviderKey
            name="gemini"
            providerLabel="Gemini"
            providerLogo="G"
            providerLogoClass="gemini"
            isSet={settings.apiKeyStatus.gemini}
            keyPlaceholder="AIza..."
            hideProviderHeader
          />
        )}
        {!isOllama && (
          <p className="section-hint">Powers the reasoning behind every answer.</p>
        )}
      </div>

      {isOllama ? (
        <OllamaSection
          ollamaEnabled={
            (settings.localConnections ?? []).some((c) => c.enabled)
          }
          onToggleOllama={(enabled) => {
            const conns = settings.localConnections ?? [];
            conns.forEach((c) => {
              void window.klip.updateLocalConnection(c.id, { enabled });
            });
          }}
        />
      ) : (
        <>
          <div className="section">
            <div className="section-title" style={{ marginBottom: 14 }}>Model</div>
            <div className="model-list">
              {isAnthropic &&
                CLAUDE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`model-item ${settings.selectedModel === m.id ? 'on' : ''}`}
                    onClick={() => window.klip.setModel(m.id)}
                  >
                    <div className="model-radio" />
                    <div className="model-meta">
                      <div className="model-name">{m.name}</div>
                      <div className="model-sub">{m.sub}</div>
                    </div>
                    {m.tag && <div className={`model-tag ${m.tag.cls}`}>{m.tag.label}</div>}
                  </button>
                ))}
              {isOpenAI &&
                OPENAI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`model-item ${settings.selectedOpenAIModel === m.id ? 'on' : ''}`}
                    onClick={() => window.klip.setOpenAIModel(m.id)}
                  >
                    <div className="model-radio" />
                    <div className="model-meta">
                      <div className="model-name">{m.name}</div>
                      <div className="model-sub">{m.sub}</div>
                    </div>
                    {m.tag && <div className={`model-tag ${m.tag.cls}`}>{m.tag.label}</div>}
                  </button>
                ))}
              {isGemini &&
                GEMINI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`model-item ${settings.selectedGeminiModel === m.id ? 'on' : ''}`}
                    onClick={() => window.klip.setGeminiModel(m.id)}
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

          <div className="section">
            <div className="section-title" style={{ marginBottom: 6 }}>Reasoning depth</div>
            <p className="section-hint" style={{ margin: '0 0 14px' }}>
              How much KLIP thinks before replying.
            </p>
            <div className="seg">
              <button
                className={settings.reasoningDepth === 'off' ? 'on' : ''}
                onClick={() => setDepth('off')}
              >
                Off
              </button>
              <button
                className={settings.reasoningDepth === 'medium' ? 'on' : ''}
                onClick={() => setDepth('medium')}
              >
                Medium
              </button>
              <button
                className={settings.reasoningDepth === 'deep' ? 'on' : ''}
                onClick={() => setDepth('deep')}
              >
                Deep
              </button>
            </div>
          </div>
        </>
      )}

      <div className="section">
        <div className="section-title" style={{ marginBottom: 14 }}>Reply tone</div>
        <div className="seg">
          <button
            className={settings.replyTone === 'concise' ? 'on' : ''}
            onClick={() => setTone('concise')}
          >
            Concise
          </button>
          <button
            className={settings.replyTone === 'friendly' ? 'on' : ''}
            onClick={() => setTone('friendly')}
          >
            Friendly
          </button>
          <button
            className={settings.replyTone === 'detailed' ? 'on' : ''}
            onClick={() => setTone('detailed')}
          >
            Detailed
          </button>
        </div>
      </div>
    </>
  );
}
