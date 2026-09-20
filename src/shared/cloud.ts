/** Explicit allowlist: credentials, conversations and device settings never sync. */
export interface CloudPreferences {
  replyTone: 'concise' | 'friendly' | 'detailed';
  reasoningDepth: 'off' | 'medium' | 'deep';
  voiceSpeed: number;
  voiceStability: number;
  speakReplies: boolean;
  isClickyCursorEnabled: boolean;
}

export interface PreferenceDocument {
  preferences: CloudPreferences | null;
  version: number;
}

export interface CloudStatus {
  configured: boolean;
  signedIn: boolean;
  email?: string;
  hasSavedPreferences: boolean;
}

export type CloudAuthStep = 'sign-in' | 'sign-up' | 'confirm-sign-up' | 'mfa' | 'forgot-password' | 'reset-password';
export interface CloudAuthInput { email?: string; password?: string; code?: string }
export type CloudAction = 'status' | 'sign-in' | 'cancel' | 'sign-out' | 'save' | 'restore'
  | 'sign-up' | 'confirm-sign-up' | 'resend-code' | 'mfa' | 'forgot-password' | 'reset-password';
export type CloudResult = { ok: true; status: CloudStatus; message?: string; nextStep?: CloudAuthStep }
  | { ok: false; status: CloudStatus; error: string };
export const CLOUD_IPC = 'cloud-account';
export const CLOUD_SCOPE = 'klip/preferences';

const keys = ['replyTone', 'reasoningDepth', 'voiceSpeed', 'voiceStability',
  'speakReplies', 'isClickyCursorEnabled'] as const;

export function parsePreferences(value: unknown): CloudPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid preferences.');
  const p = value as Record<string, unknown>;
  if (Object.keys(p).length !== keys.length || keys.some(k => !Object.hasOwn(p, k)) ||
      !['concise', 'friendly', 'detailed'].includes(p.replyTone as string) ||
      !['off', 'medium', 'deep'].includes(p.reasoningDepth as string) ||
      typeof p.voiceSpeed !== 'number' || !Number.isFinite(p.voiceSpeed) || p.voiceSpeed < 0.7 || p.voiceSpeed > 1.2 ||
      typeof p.voiceStability !== 'number' || !Number.isFinite(p.voiceStability) || p.voiceStability < 0 || p.voiceStability > 1 ||
      typeof p.speakReplies !== 'boolean' || typeof p.isClickyCursorEnabled !== 'boolean') {
    throw new Error('Invalid preferences.');
  }
  return Object.fromEntries(keys.map(k => [k, p[k]])) as unknown as CloudPreferences;
}

export function pickPreferences(settings: CloudPreferences): CloudPreferences {
  return parsePreferences(Object.fromEntries(keys.map(k => [k, settings[k]])));
}

export function parseDocument(value: unknown): PreferenceDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid cloud response.');
  const d = value as PreferenceDocument;
  if (!Number.isSafeInteger(d.version) || d.version < 0 ||
      (d.preferences === null ? d.version !== 0 : d.version === 0)) throw new Error('Invalid cloud response.');
  return { version: d.version, preferences: d.preferences === null ? null : parsePreferences(d.preferences) };
}
