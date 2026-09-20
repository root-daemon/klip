import type { ApiKeyName, ApiKeyValidation } from '../../shared/types';
import { getApiKey } from './key-store';
import { PROBES } from './provider-probes';

/**
 * Prove a key is accepted by its provider before we rely on it.
 *
 * For the two reasoning providers we make a *real* one-token completion
 * rather than listing models: a list call authenticates fine on an
 * account with no credit, and the user then hits "credit balance too
 * low" on their first actual question. The completion costs a fraction
 * of a cent and catches billing, quota and model-access problems too.
 * Transcription / TTS use free whoami-style endpoints.
 */

const TIMEOUT_MS = 15_000;

/** Pull the human-readable message out of a provider error body. */
function extractMessage(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string; detail?: { message?: string } | string };
    if (typeof j.error === 'string') return j.error;
    if (j.error?.message) return j.error.message;
    if (typeof j.detail === 'string') return j.detail;
    if (j.detail && typeof j.detail === 'object' && j.detail.message) return j.detail.message;
    if (j.message) return j.message;
  } catch { /* not JSON */ }
  return text.slice(0, 200);
}

export async function validateApiKey(name: ApiKeyName, key: string): Promise<ApiKeyValidation> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: 'Key is empty.' };
  const build = PROBES[name];
  if (!build) return { ok: false, error: `Unknown provider "${name}".` };

  const probe = build(trimmed);
  try {
    const res = await fetch(probe.url, {
      method: probe.method,
      headers: probe.headers,
      body: probe.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };

    let detail = '';
    try { detail = extractMessage(await res.text()); } catch { /* ignore */ }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'The provider rejected this key. Double-check it was copied in full.' };
    }
    if (res.status === 429) {
      // Rate-limit vs. out-of-quota both come back as 429 from OpenAI;
      // the body tells them apart.
      if (/quota|billing|credit/i.test(detail)) {
        return { ok: false, error: `Key works but the account can't be billed: ${detail}` };
      }
      return { ok: true };
    }
    return { ok: false, error: `Provider returned HTTP ${res.status}${detail ? `: ${detail}` : ''}` };
  } catch (err) {
    const e = err as Error & { name?: string; cause?: { code?: string } };
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return { ok: false, error: 'Timed out reaching the provider. Check your internet connection or firewall.' };
    }
    const code = e.cause?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return { ok: false, error: 'Could not resolve the provider host — are you offline?' };
    }
    return { ok: false, error: `Network error: ${e.message}` };
  }
}

/** Validate whatever key is currently saved for `name`. */
export async function validateStoredApiKey(name: ApiKeyName): Promise<ApiKeyValidation> {
  const key = getApiKey(name);
  if (!key) return { ok: false, error: 'No key saved.' };
  return validateApiKey(name, key);
}
