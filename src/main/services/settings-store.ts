import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { writeFileAtomic } from './fs-util';
import { parsePreferences, type CloudPreferences } from '../../shared/cloud';
import { normalizeSarvamSpeaker, SARVAM_DEFAULT_SPEAKER } from '../../shared/sarvam';
import { SARVAM_VOICE_PRESETS } from '../../shared/types';
import type {
  ClaudeModel,
  OpenAIModel,
  GeminiModel,
  MindProvider,
  TtsProvider,
  GroqTranscriptionModel,
  TranscriptionProviderType,
  ReasoningDepth,
  ReplyTone,
  StreamVisibility,
  StreamWindowBounds,
  LocalConnection,
  PttMode,
} from '../../shared/types';

/**
 * Simple JSON-file settings store.
 * Avoids the ESM-only `electron-store` v10 compatibility issues.
 */

export interface StoredSettings {
  mindProvider: MindProvider;
  selectedModel: ClaudeModel;
  selectedOpenAIModel: OpenAIModel;
  selectedGeminiModel: GeminiModel;
  reasoningDepth: ReasoningDepth;
  replyTone: ReplyTone;

  ttsProvider: TtsProvider;
  voiceId: string;
  voiceSpeed: number;
  voiceStability: number;
  sarvamSpeaker: string;
  speakReplies: boolean;

  groqTranscriptionModel: GroqTranscriptionModel;
  transcriptionProvider: TranscriptionProviderType;

  isClickyCursorEnabled: boolean;
  launchAtLogin: boolean;
  pushToTalkShortcut: string;
  pttMode: PttMode;
  autoTypeEnabled: boolean;
  autoClickEnabled: boolean;
  computerUseEnabled: boolean;
  streamVisibility: StreamVisibility;
  streamWindowBounds: StreamWindowBounds | null;

  localConnections: LocalConnection[];

  onboardingComplete: boolean;
}

const DEFAULTS: StoredSettings = {
  mindProvider: 'anthropic',
  selectedModel: 'claude-sonnet-4-6',
  selectedOpenAIModel: 'gpt-5',
  selectedGeminiModel: 'gemini-3.6-flash',
  reasoningDepth: 'off',
  replyTone: 'friendly',

  ttsProvider: 'elevenlabs',
  voiceId: 'pMsXgVXv3BLzUgSXRplE',
  voiceSpeed: 1.0,
  voiceStability: 0.5,
  sarvamSpeaker: SARVAM_DEFAULT_SPEAKER,
  speakReplies: true,

  groqTranscriptionModel: 'whisper-large-v3-turbo',
  transcriptionProvider: 'groq',

  isClickyCursorEnabled: true,
  launchAtLogin: false,
  pushToTalkShortcut: process.platform === 'darwin' ? 'Cmd+K' : 'Ctrl+K',
  // Default to 'toggle' on macOS because Electron's globalShortcut on
  // darwin can't detect key-up; 'hold' would record forever there.
  pttMode: process.platform === 'darwin' ? 'toggle' : 'hold',
  autoTypeEnabled: false,
  autoClickEnabled: false,
  computerUseEnabled: true,
  streamVisibility: 'off',
  streamWindowBounds: null,

  localConnections: [],

  onboardingComplete: false,
};

function getFilePath(): string {
  return path.join(app.getPath('userData'), 'klip-settings.json');
}

/**
 * In-memory cache. The settings file is the single source of truth across
 * runs, but within a run we own it — no external writers — so re-reading
 * disk on every `get`/`set` is wasted I/O. We hydrate once on first access
 * and keep the cache in sync with every `set`.
 */
let cache: StoredSettings | null = null;

/** Model IDs get retired by providers faster than this file gets edited.
 *  A value on disk that no longer matches a currently-offered option
 *  would otherwise wedge the user on a permanent 404 until they happen
 *  to reopen that picker — silently fall back to the current default
 *  instead. */
const VALID_GEMINI_MODELS: GeminiModel[] = ['gemini-3.6-flash', 'gemini-3.1-pro-preview'];
/** Same problem as Gemini above, for Sarvam: bulbul:v2's speaker roster
 *  (anushka, meera, ...) was retired when v3 shipped, and speaker ids
 *  aren't interchangeable across model versions. A stale v2 speaker on
 *  disk would otherwise 400 on every TTS call until the user happens to
 *  reopen the voice picker and pick a new one. */
const VALID_SARVAM_SPEAKERS = SARVAM_VOICE_PRESETS.map((v) => v.id);

function readDisk(): StoredSettings {
  try {
    const raw = fs.readFileSync(getFilePath(), 'utf-8');
    const merged: StoredSettings = { ...DEFAULTS, ...JSON.parse(raw) };
    if (!VALID_GEMINI_MODELS.includes(merged.selectedGeminiModel)) {
      merged.selectedGeminiModel = DEFAULTS.selectedGeminiModel;
    }
    if (!VALID_SARVAM_SPEAKERS.includes(merged.sarvamSpeaker)) {
      merged.sarvamSpeaker = DEFAULTS.sarvamSpeaker;
    }
    // Bulbul v3 retired the old v2 voice names. Existing installations keep
    // working without requiring users to find a new speaker themselves.
    merged.sarvamSpeaker = normalizeSarvamSpeaker(merged.sarvamSpeaker);
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function ensureLoaded(): StoredSettings {
  if (cache === null) cache = readDisk();
  return cache;
}

function write(data: StoredSettings): void {
  writeFileAtomic(getFilePath(), JSON.stringify(data, null, 2));
}

export function get<K extends keyof StoredSettings>(key: K): StoredSettings[K] {
  return ensureLoaded()[key];
}

export function set<K extends keyof StoredSettings>(key: K, value: StoredSettings[K]): void {
  const data = ensureLoaded();
  data[key] = (key === 'sarvamSpeaker'
    ? normalizeSarvamSpeaker(value as string)
    : value) as StoredSettings[K];
  // Persist after mutating the cache. If the disk write fails we still
  // have the new value in memory for the rest of the session — the next
  // launch will revert, which matches the previous behavior.
  write(data);
}

export function getAll(): StoredSettings {
  // Shallow copy so callers can't mutate the cache through the returned ref.
  return { ...ensureLoaded() };
}

/** Persist the entire restored preference set before exposing it to the running app. */
export function setPreferences(preferences: CloudPreferences): void {
  const next = { ...ensureLoaded(), ...parsePreferences(preferences) };
  write(next);
  cache = next;
}
