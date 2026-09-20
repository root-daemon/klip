import type { ApiKeyName } from '../../shared/types';
import { SARVAM_DEFAULT_SPEAKER, SARVAM_TTS_MODEL as sarvamTtsModel } from '../../shared/sarvam';

/** Backwards-compatible export for consumers of the provider probe. */
export const SARVAM_TTS_MODEL = sarvamTtsModel;

export interface ProviderProbe {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

/**
 * Minimal live requests used to validate an entered provider key. Kept pure
 * so the request contract can be tested without booting Electron/key storage.
 */
export const PROBES: Record<ApiKeyName, (key: string) => ProviderProbe> = {
  anthropic: (key) => ({
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  }),
  openai: (key) => ({
    url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  }),
  gemini: (key) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'hi' }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  }),
  elevenlabs: (key) => ({
    url: 'https://api.elevenlabs.io/v1/user',
    method: 'GET',
    headers: { 'xi-api-key': key },
  }),
  sarvam: (key) => ({
    url: 'https://api.sarvam.ai/text-to-speech',
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'hi',
      target_language_code: 'en-IN',
      speaker: SARVAM_DEFAULT_SPEAKER,
      model: SARVAM_TTS_MODEL,
    }),
  }),
  groq: (key) => ({
    url: 'https://api.groq.com/openai/v1/models',
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  }),
};
