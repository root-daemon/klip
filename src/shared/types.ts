import { SARVAM_DEFAULT_SPEAKER } from './sarvam';

// ── Voice / State Machine ──────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding';

/**
 * Which internal specialist is handling the current turn. This is a real
 * routing decision (see intent-router.ts), not cosmetic: `desktop` gets a
 * prompt biased toward resolving an on-screen target and emitting
 * POINT/TYPE tags; `conversation` gets the normal answer-focused prompt.
 * `null` means idle — no turn in flight.
 */
export type ActiveSpecialist = 'conversation' | 'desktop' | null;

export type BuddyNavigationMode =
  | 'followingCursor'
  | 'navigatingToTarget'
  | 'pointingAtTarget';

// ── Transcription ──────────────────────────────────────────────────────

export type TranscriptionProviderType = 'groq' | 'openai' | 'sarvam' | 'native';

export type GroqTranscriptionModel =
  | 'whisper-large-v3'
  | 'whisper-large-v3-turbo';

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
}

// ── Overlay / Displays ─────────────────────────────────────────────────

export interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  /** Usable area excluding the taskbar — the pet docks relative to this. */
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  /** True for the display KLIP treats as home base for its resting dock. */
  isPrimary: boolean;
}

/**
 * Prefix used to hand an overlay window its display info through
 * `webPreferences.additionalArguments`, so the renderer can read it
 * synchronously at startup instead of racing an IPC message.
 */
export const DISPLAY_INFO_ARG_PREFIX = '--klip-display-info=';

// ── Screen Capture ─────────────────────────────────────────────────────

export interface ScreenCapture {
  dataBase64: string;
  displayId: number;
  imageWidth: number;
  imageHeight: number;
  displayBounds: { x: number; y: number; width: number; height: number };
  isCursorScreen: boolean;
}

// ── Claude API ─────────────────────────────────────────────────────────

export type ClaudeModel = 'claude-sonnet-4-6' | 'claude-opus-4-6';

export type OpenAIModel = 'gpt-5' | 'gpt-5-mini' | 'gpt-4o';

export type GeminiModel = 'gemini-3.1-pro-preview' | 'gemini-3.6-flash';

/** Which service backs the Mind (reasoning) capability. */
export type MindProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

/** Which service backs the Voice (TTS) capability. */
export type TtsProvider = 'elevenlabs' | 'sarvam';

/** Extended-thinking budget mapping. */
export type ReasoningDepth = 'off' | 'medium' | 'deep';

/** System-prompt variant. */
export type ReplyTone = 'concise' | 'friendly' | 'detailed';

/** How the push-to-talk shortcut behaves. */
export type PttMode = 'hold' | 'toggle';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ── Element Pointing ───────────────────────────────────────────────────

export interface DetectedElement {
  x: number;
  y: number;
  label: string;
  screenIndex: number;
  /** True for a [CLICK:...] tag — the pet also performs a real OS
   *  click here (if autoClickEnabled) instead of only pointing. */
  click?: boolean;
}

export interface WalkthroughStep extends DetectedElement {
  /** 1-based position in the walkthrough sequence. */
  step: number;
  /** Total number of steps in the walkthrough. */
  total: number;
}

export interface Walkthrough {
  steps: WalkthroughStep[];
}

/**
 * A request from the model to type text into whatever field the user
 * has focused. Currently fulfilled via clipboard handoff (text copied
 * to clipboard, user presses ⌘V); a future "auto-type" mode will use
 * a native key-event hook to type directly when the user has opted in.
 */
export interface TypeRequest {
  text: string;
  /** What was typed/copied — surfaced in the toast UI for confirmation. */
  preview: string;
  /** True when the text was actually auto-typed; false when copied. */
  autoTyped: boolean;
}

/**
 * A real file the agent produced on disk from a [EXCEL:...] / [PDF:...]
 * tag (see element-detector.ts + document-generator.ts) — written to
 * ~/Documents/KLIP and opened with the OS default app so the user sees
 * the finished result immediately.
 */
export interface DocumentCreated {
  kind: 'excel' | 'pdf';
  filename: string;
  path: string;
}

/**
 * One executed step from the real multi-step computer-use agent loop
 * (see computer-use-agent.ts) — used to drive the overlay's live task
 * HUD and the pet's per-step animation (reading/writing/clicking/...).
 */
export type AgentActionKind = 'observe' | 'click' | 'type' | 'scroll' | 'key' | 'wait' | 'drag' | 'move';

export interface AgentStepEvent {
  step: number;
  action: string;
  kind: AgentActionKind;
  detail?: string;
}

// ── Local Connections (Ollama / OpenAI-compatible local endpoints) ─────

export interface OllamaModelInfo {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
}

export interface OllamaPullProgress {
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
}

export interface LocalConnection {
  id: string;
  type: 'local' | 'external';
  label?: string;
  url: string;
  enabled: boolean;
  bearerEnabled: boolean;
  prefixId?: string;
  modelIds: string[];
  activeModelId?: string;
  tags: string[];
}

// ── API Keys ───────────────────────────────────────────────────────────

export type ApiKeyName = 'anthropic' | 'openai' | 'gemini' | 'elevenlabs' | 'sarvam' | 'groq';

export interface ApiKeyStatus {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  elevenlabs: boolean;
  sarvam: boolean;
  groq: boolean;
}

/** Result of a live round-trip against a provider with a candidate key. */
export interface ApiKeyValidation {
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  error?: string;
}

/** OS-level permission snapshot. Values are true when granted or when
 *  the platform has no such gate. */
export interface PermissionStatus {
  microphone: boolean;
  screen: boolean;
  accessibility: boolean;
  /** Raw OS status for the mic so the UI can distinguish "not asked yet"
   *  from "explicitly blocked". */
  microphoneStatus: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';
}

// ── Voice / TTS ────────────────────────────────────────────────────────

/** Built-in voice presets we curate for the voice picker. */
export interface VoicePreset {
  id: string;
  name: string;
  description: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: 'Fahco4VZzobUeiPqni1S', name: 'Tom', description: 'custom · en-US' },
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena', description: 'warm · conversational · en-US' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'calm · narrator · en-US' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'strong · confident · en-US' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'soft · friendly · en-US' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'well-rounded · en-US' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'crisp · narration · en-US' },
];

/** Sarvam AI (Bulbul v3) speaker presets — strong Indian-language coverage.
 *  v2's speaker roster (anushka, meera, ...) was retired alongside the
 *  v2 model; these ids are v3-only and not interchangeable with v2. */
export const SARVAM_VOICE_PRESETS: VoicePreset[] = [
  { id: 'shubh', name: 'Shubh', description: 'default · multilingual' },
  { id: 'priya', name: 'Priya', description: 'warm · conversational · multilingual' },
  { id: 'aditya', name: 'Aditya', description: 'steady · confident · multilingual' },
  { id: 'kavya', name: 'Kavya', description: 'bright · energetic · multilingual' },
  { id: 'dev', name: 'Dev', description: 'clear · assistant-like · multilingual' },
  { id: 'ishita', name: 'Ishita', description: 'calm · narrator · multilingual' },
];

// ── Chat History ───────────────────────────────────────────────────────

export interface ChatEntry {
  id: string;
  timestamp: number;
  userText: string;
  assistantText: string;
}

// ── Memory / Context ───────────────────────────────────────────────────

export interface MemoryStats {
  /** Approximate total tokens currently held in context. */
  tokens: number;
  /** Soft cap that triggers auto-compaction. */
  tokenBudget: number;
  /** Full messages held verbatim. */
  messageCount: number;
  /** Messages that have been summarized into the rolling summary. */
  summarizedCount: number;
  /** Whether a rolling summary is currently prepended to context. */
  hasSummary: boolean;
  /** Unix ms of last auto/manual compaction, or null. */
  lastCompactedAt: number | null;
}

// ── Settings ───────────────────────────────────────────────────────────

export type StreamVisibility = 'off' | 'responses' | 'always';

export interface StreamWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KlipSettings {
  // Mind
  mindProvider: MindProvider;
  selectedModel: ClaudeModel;
  selectedOpenAIModel: OpenAIModel;
  selectedGeminiModel: GeminiModel;
  reasoningDepth: ReasoningDepth;
  replyTone: ReplyTone;

  // Voice (TTS)
  ttsProvider: TtsProvider;
  voiceId: string;
  voiceSpeed: number;    // 0.7 – 1.2 (ElevenLabs accepted range)
  voiceStability: number; // 0 – 1
  /** Sarvam (Bulbul) speaker id — see SARVAM_VOICE_PRESETS. */
  sarvamSpeaker: string;
  speakReplies: boolean;

  // Ear (transcription)
  groqTranscriptionModel: GroqTranscriptionModel;
  transcriptionProvider: TranscriptionProviderType;

  // General
  isClickyCursorEnabled: boolean;
  launchAtLogin: boolean;
  pushToTalkShortcut: string;
  /**
   * How the push-to-talk shortcut behaves:
   *   'hold'   — record while the key is held, send on release
   *               (Windows/Linux only; macOS falls back to 'toggle' because
   *               Electron's globalShortcut exposes no key-up event there)
   *   'toggle' — first tap starts recording, second tap stops and sends
   */
  pttMode: PttMode;
  /**
   * If true, Klip may type text directly into the focused field when
   * the model emits a [TYPE:...] tag. Requires Accessibility permission
   * on macOS and the native auto-typer module to be available; falls
   * back to clipboard handoff in either case. Off by default.
   */
  autoTypeEnabled: boolean;
  /**
   * If true, Klip may actually move the OS mouse and click when the
   * model emits a [CLICK:...] tag. Same permission story as auto-type
   * (Accessibility on macOS, native module required); when disabled or
   * unavailable, a [CLICK:...] tag degrades to pointing only — the pet
   * shows where it would click, but nothing is actually clicked. Off
   * by default: this is real, unsupervised control of the user's mouse.
   */
  autoClickEnabled: boolean;
  /**
   * Enables the approved computer-use loop for explicit desktop commands.
   * Each input action still requires a separate, visible confirmation.
   */
  computerUseEnabled: boolean;
  /**
   * Controls the transparent stream window:
   * - 'off'       — never shown
   * - 'responses' — shown only while Klip is actively answering
   * - 'always'    — shown continuously once the app starts
   */
  streamVisibility: StreamVisibility;
  /** Last known position + size of the stream window; null = auto-place. */
  streamWindowBounds: StreamWindowBounds | null;

  // Local model connections
  localConnections: LocalConnection[];

  // Lifecycle
  onboardingComplete: boolean;
  apiKeyStatus: ApiKeyStatus;
  /** false when OS safeStorage is unavailable (keys stored unencrypted). */
  encryptionAvailable: boolean;
}

export const DEFAULT_SETTINGS: KlipSettings = {
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
  pushToTalkShortcut: 'Ctrl+K',
  pttMode: 'hold',
  autoTypeEnabled: false,
  autoClickEnabled: false,
  computerUseEnabled: true,
  streamVisibility: 'off',
  streamWindowBounds: null,

  localConnections: [],

  onboardingComplete: false,
  apiKeyStatus: { anthropic: false, openai: false, gemini: false, elevenlabs: false, sarvam: false, groq: false },
  encryptionAvailable: true,
};

// ── IPC Channels ───────────────────────────────────────────────────────

export const IPC = {
  // Main → Renderer
  VOICE_STATE_CHANGED: 'voice-state-changed',
  TRANSCRIPT_UPDATE: 'transcript-update',
  AI_RESPONSE_CHUNK: 'ai-response-chunk',
  AI_RESPONSE_COMPLETE: 'ai-response-complete',
  ELEMENT_DETECTED: 'element-detected',
  WALKTHROUGH: 'walkthrough',
  WALKTHROUGH_STEP: 'walkthrough-step',
  TYPE_FULFILLED: 'type-fulfilled',
  DOCUMENT_CREATED: 'document-created',
  AGENT_STEP: 'agent-step',
  CURSOR_POSITION: 'cursor-position',
  SETTINGS_CHANGED: 'settings-changed',
  PERMISSION_STATUS: 'permission-status',
  MEMORY_STATS: 'memory-stats',
  CHAT_ENTRY_ADDED: 'chat-entry-added',
  /** A turn failed (bad key, network, provider error). Payload: message. */
  AI_ERROR: 'ai-error',
  /** Which specialist is handling the in-flight turn, or null once idle. */
  ACTIVE_SPECIALIST_CHANGED: 'active-specialist-changed',
  /** The push-to-talk accelerator fired (used by setup to verify it). */
  PTT_SHORTCUT_FIRED: 'ptt-shortcut-fired',
  /** Mic input level 0..1 while capture is active (throttled). */
  MIC_LEVEL: 'mic-level',
  /** getUserMedia / AudioContext failed in the capture renderer. */
  MIC_ERROR: 'mic-error',
  /** State of the safe observe → approve → act computer-use loop. */
  COMPUTER_USE_STATE: 'computer-use-state',

  // Renderer → Main
  /** Round-trip a candidate key against its provider. */
  VALIDATE_API_KEY: 'validate-api-key',
  /** Same check against the key already in the encrypted store. */
  VALIDATE_STORED_API_KEY: 'validate-stored-api-key',
  GET_APP_VERSION: 'get-app-version',
  /** While active, the PTT shortcut only emits PTT_SHORTCUT_FIRED and
   *  does not start recording — lets setup verify the binding safely. */
  PTT_TEST_START: 'ptt-test-start',
  PTT_TEST_STOP: 'ptt-test-stop',
  /** Run mic capture without transcription so setup can show levels. */
  MIC_TEST_START: 'mic-test-start',
  MIC_TEST_STOP: 'mic-test-stop',
  PUSH_TO_TALK_START: 'push-to-talk-start',
  PUSH_TO_TALK_STOP: 'push-to-talk-stop',
  SET_MODEL: 'set-model',
  SET_OPENAI_MODEL: 'set-openai-model',
  SET_GEMINI_MODEL: 'set-gemini-model',
  SET_MIND_PROVIDER: 'set-mind-provider',
  SET_REASONING_DEPTH: 'set-reasoning-depth',
  SET_REPLY_TONE: 'set-reply-tone',
  SET_TTS_PROVIDER: 'set-tts-provider',
  SET_VOICE_ID: 'set-voice-id',
  SET_VOICE_SPEED: 'set-voice-speed',
  SET_VOICE_STABILITY: 'set-voice-stability',
  SET_SARVAM_SPEAKER: 'set-sarvam-speaker',
  SET_SPEAK_REPLIES: 'set-speak-replies',
  SET_GROQ_MODEL: 'set-groq-model',
  SET_TRANSCRIPTION_PROVIDER: 'set-transcription-provider',
  PLAY_SARVAM_VOICE_PREVIEW: 'play-sarvam-voice-preview',
  TOGGLE_CURSOR: 'toggle-cursor',
  SET_LAUNCH_AT_LOGIN: 'set-launch-at-login',
  SET_PUSH_TO_TALK_SHORTCUT: 'set-push-to-talk-shortcut',
  SET_PTT_MODE: 'set-ptt-mode',
  CANCEL_PUSH_TO_TALK: 'cancel-push-to-talk',
  SET_AUTO_TYPE_ENABLED: 'set-auto-type-enabled',
  SET_AUTO_CLICK_ENABLED: 'set-auto-click-enabled',
  SET_COMPUTER_USE_ENABLED: 'set-computer-use-enabled',
  SET_STREAM_VISIBILITY: 'set-stream-visibility',
  SET_STREAM_WINDOW_BOUNDS: 'set-stream-window-bounds',
  CLEAR_STREAM: 'clear-stream',
  SUSPEND_PUSH_TO_TALK_SHORTCUT: 'suspend-push-to-talk-shortcut',
  RESUME_PUSH_TO_TALK_SHORTCUT: 'resume-push-to-talk-shortcut',
  GET_SETTINGS: 'get-settings',
  GET_PERMISSIONS: 'get-permissions',
  REQUEST_PERMISSION: 'request-permission',
  OPEN_EXTERNAL: 'open-external',
  QUIT_APP: 'quit-app',
  REPLAY_ONBOARDING: 'replay-onboarding',
  COMPLETE_ONBOARDING: 'complete-onboarding',
  CLEAR_CONTEXT: 'clear-context',
  COMPACT_CONTEXT: 'compact-context',
  GET_MEMORY_STATS: 'get-memory-stats',
  GET_CHAT_HISTORY: 'get-chat-history',
  CLEAR_CHAT_HISTORY: 'clear-chat-history',
  PLAY_VOICE_PREVIEW: 'play-voice-preview',

  // API Key Management
  SET_API_KEY: 'set-api-key',
  DELETE_API_KEY: 'delete-api-key',
  GET_API_KEY_STATUS: 'get-api-key-status',

  // Local Connection Management
  GET_LOCAL_CONNECTIONS: 'get-local-connections',
  ADD_LOCAL_CONNECTION: 'add-local-connection',
  UPDATE_LOCAL_CONNECTION: 'update-local-connection',
  DELETE_LOCAL_CONNECTION: 'delete-local-connection',
  TEST_LOCAL_CONNECTION: 'test-local-connection',
  QUICK_CONNECT_OLLAMA: 'quick-connect-ollama',
  GET_OLLAMA_MODELS: 'get-ollama-models',
  SET_LOCAL_CONNECTION_KEY: 'set-local-connection-key',
  DELETE_LOCAL_CONNECTION_KEY: 'delete-local-connection-key',

  // Ollama Model Management
  PULL_OLLAMA_MODEL: 'pull-ollama-model',
  OLLAMA_PULL_PROGRESS: 'ollama-pull-progress',
  OLLAMA_PULL_COMPLETE: 'ollama-pull-complete',
  OLLAMA_PULL_ERROR: 'ollama-pull-error',
  DELETE_OLLAMA_MODEL: 'delete-ollama-model',
  CREATE_OLLAMA_MODEL: 'create-ollama-model',
} as const;
