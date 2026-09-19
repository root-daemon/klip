import { useState, useEffect, useRef, useCallback } from 'react';
import type { VoiceState, WalkthroughStep, TypeRequest, DisplayInfo } from '../../shared/types';
import { Waveform } from './Waveform';
import { KlipPet, type PetMood } from './KlipPet';

// Vite resolves `new URL(..., import.meta.url)` at build time and emits
// the worklet as a static asset. The `.js` file is hand-written plain
// JS (worklets must be), so it isn't part of the TS compilation unit;
// we only need its URL to feed `audioWorklet.addModule()`.
const captureWorkletUrl = new URL('../audio-capture-worklet.js', import.meta.url).href;

// KLIP docks in the bottom-right corner of the primary display's work
// area (i.e. above the taskbar), like the original product spec — it
// no longer chases the real mouse cursor around. `companionPos`
// represents the pet's visual *center* (the wrapping div is negatively
// margined by half its size), so the dock target is inset from the
// corner by margin + radius.
const PET_RADIUS = 20;
const DOCK_MARGIN = 24;

function computeDockPos(info: DisplayInfo | null): { x: number; y: number } {
  if (!info) return { x: 0, y: 0 };
  const localRight = info.workArea.x - info.bounds.x + info.workArea.width;
  const localBottom = info.workArea.y - info.bounds.y + info.workArea.height;
  return {
    x: localRight - DOCK_MARGIN - PET_RADIUS,
    y: localBottom - DOCK_MARGIN - PET_RADIUS,
  };
}

const POINTING_PHRASES = [
  'right here!',
  'found it!',
  'this one!',
  'over here!',
  'look!',
  'here it is!',
  'this thing!',
  'see this?',
];

function randomPhrase(): string {
  return POINTING_PHRASES[Math.floor(Math.random() * POINTING_PHRASES.length)];
}

type CursorMode = 'following' | 'navigating' | 'holding' | 'returning';

export function OverlayApp() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [currentStep, setCurrentStep] = useState<WalkthroughStep | null>(null);
  const [pointingPhrase, setPointingPhrase] = useState('');
  const [cursorMode, setCursorMode] = useState<CursorMode>('following');
  const [companionPos, setCompanionPos] = useState({ x: 0, y: 0 });
  const [isCursorOnThisDisplay, setIsCursorOnThisDisplay] = useState(false);
  const [typeToast, setTypeToast] = useState<TypeRequest | null>(null);
  const typeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A brief happy/concerned reaction overrides the base voice-state mood
  // right when a turn lands — the pet blinks success or flinches error,
  // then settles back into whatever voiceState says next.
  const [reactionPulse, setReactionPulse] = useState<'success' | 'error' | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerReaction = useCallback((kind: 'success' | 'error') => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    setReactionPulse(kind);
    reactionTimerRef.current = setTimeout(() => {
      setReactionPulse(null);
      reactionTimerRef.current = null;
    }, kind === 'success' ? 700 : 900);
  }, []);
  // Seeded synchronously from the window's launch arguments so the first
  // cursor-position message already has a coordinate space to map into.
  const displayRef = useRef<DisplayInfo | null>(window.klip.getDisplayInfo());
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepsRef = useRef<WalkthroughStep[]>([]);
  const returnAnimRef = useRef<number | null>(null);
  const companionPosRef = useRef({ x: 0, y: 0 });
  const dockPosRef = useRef(computeDockPos(displayRef.current));
  const [dockPos, setDockPosState] = useState(dockPosRef.current);
  const setDockPos = useCallback((pos: { x: number; y: number }) => {
    dockPosRef.current = pos;
    setDockPosState(pos);
  }, []);

  // ── Mic capture ──────────────────────────────────────────────────────
  // The audio graph (stream → AudioContext → AudioWorkletNode → destination)
  // is built once on first PTT and kept warm across turns. Start/stop just
  // toggles a flag inside the worklet so we don't pay getUserMedia or
  // worklet-module-load latency on every press.
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  /** true while getUserMedia / addModule are in flight. */
  const micStartingRef = useRef(false);
  /** set by stopMic so a pending start can bail before attaching. */
  const micStopRequestedRef = useRef(false);
  /** Peak RMS since the last level report; reported ~20×/s to main. */
  const micPeakRef = useRef(0);
  const micLevelSentAtRef = useRef(0);

  // ── TTS playback (cancelable) ───────────────────────────────────────
  const ttsRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const stopCurrentTts = useCallback(() => {
    const current = ttsRef.current;
    if (!current) return;
    try {
      current.audio.pause();
      current.audio.src = '';
    } catch { /* ignore */ }
    URL.revokeObjectURL(current.url);
    ttsRef.current = null;
  }, []);

  useEffect(() => {
    const ensureGraph = async (): Promise<AudioWorkletNode | null> => {
      if (workletNodeRef.current) return workletNodeRef.current;
      if (micStartingRef.current) return null;
      micStartingRef.current = true;
      micStopRequestedRef.current = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
        // If a stop arrived while we were waiting on getUserMedia, the
        // user has already released the key. Don't bother building the
        // graph; the next press will re-enter and rebuild.
        if (micStopRequestedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }
        const ctx = new AudioContext({ sampleRate: 16000 });
        await ctx.audioWorklet.addModule(captureWorkletUrl);
        const source = ctx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(ctx, 'capture-processor');
        node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          // Cheap RMS so the panel's mic check (and any future meter)
          // can show that sound is actually arriving. Throttled to
          // ~20 Hz; the chunk itself is forwarded untouched.
          const pcm = new Int16Array(e.data);
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) {
            const s = pcm[i] / 32768;
            sum += s * s;
          }
          const rms = pcm.length ? Math.sqrt(sum / pcm.length) : 0;
          if (rms > micPeakRef.current) micPeakRef.current = rms;
          const now = performance.now();
          if (now - micLevelSentAtRef.current > 50) {
            micLevelSentAtRef.current = now;
            // Speech RMS sits around 0.05–0.3; scale so normal talking
            // fills most of the meter.
            window.klip.reportMicLevel(Math.min(1, micPeakRef.current * 4));
            micPeakRef.current = 0;
          }
          window.klip.sendAudioChunk(e.data);
        };
        // Pull-graph: source → worklet → destination. The worklet
        // leaves its outputs zeroed when 'enabled', so connecting to
        // destination is silent — we only need it so the audio engine
        // schedules `process()`.
        source.connect(node);
        node.connect(ctx.destination);
        mediaStreamRef.current = stream;
        audioCtxRef.current = ctx;
        workletNodeRef.current = node;
        return node;
      } catch (err) {
        console.error('[KLIP] Mic capture init failed:', err);
        // Nobody reads the overlay's devtools console on a packaged
        // build. Translate the DOMException into something a person can
        // act on and hand it to main, which shows it in the panel.
        const e = err as { name?: string; message?: string };
        const friendly =
          e.name === 'NotAllowedError' || e.name === 'SecurityError'
            ? 'microphone access is blocked for KLIP. Allow it in your OS privacy settings.'
            : e.name === 'NotFoundError' || e.name === 'OverconstrainedError'
              ? 'no microphone was found. Plug one in or pick a default input device in your sound settings.'
              : e.name === 'NotReadableError'
                ? 'the microphone is busy or unreadable — another app may be holding it.'
                : `${e.name ?? 'Error'}: ${e.message ?? String(err)}`;
        window.klip.reportMicError(friendly);
        return null;
      } finally {
        micStartingRef.current = false;
      }
    };

    const startMic = async () => {
      // Reset the stop flag at the top so subsequent presses always
      // get a fresh start signal. On the very first press, ensureGraph
      // also resets this; on press 2+, ensureGraph short-circuits with
      // the existing node and would never clear the flag — leaving it
      // stuck `true` and silently bailing every subsequent call.
      micStopRequestedRef.current = false;
      const node = await ensureGraph();
      // If a stop landed between ensureGraph resolving and now, don't
      // open the gate — the worklet stays muted.
      if (!node || micStopRequestedRef.current) return;
      node.port.postMessage('start');
    };

    const stopMic = () => {
      // Flag for any in-flight ensureGraph to bail before opening the
      // gate. If the graph already exists, just mute the worklet —
      // tearing down would force a fresh getUserMedia next turn.
      micStopRequestedRef.current = true;
      workletNodeRef.current?.port.postMessage('stop');
    };

    const unsubStart = window.klip.onStartCapture(() => startMic());
    const unsubStop = window.klip.onStopCapture(() => stopMic());

    // Play TTS audio. Any previous playback is interrupted first so
    // back-to-back responses don't stack on top of each other.
    const unsubPlayAudio = window.klip.onPlayAudio(async (audioData, mimeType) => {
      stopCurrentTts();
      try {
        const blob = new Blob([audioData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        ttsRef.current = { audio, url };
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (ttsRef.current?.audio === audio) ttsRef.current = null;
        };
        await audio.play();
      } catch (err) {
        console.error('[KLIP] Audio playback failed:', err);
        stopCurrentTts();
      }
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubPlayAudio();
      // Real teardown on unmount — stopMic only mutes the worklet so
      // back-to-back PTT turns stay warm. When the overlay actually
      // goes away (display unplug, app quit) we release the mic and
      // close the AudioContext.
      micStopRequestedRef.current = true;
      workletNodeRef.current?.port.postMessage('stop');
      workletNodeRef.current?.disconnect();
      workletNodeRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  const setCursorModeSync = useCallback((mode: CursorMode) => {
    setCursorMode(mode);
  }, []);

  const setCompanionPosSync = useCallback((pos: { x: number; y: number }) => {
    companionPosRef.current = pos;
    setCompanionPos(pos);
  }, []);

  const startReturnAnimation = useCallback(() => {
    setCursorModeSync('returning');

    const animate = () => {
      const target = dockPosRef.current;
      const current = companionPosRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        setCompanionPosSync(target);
        setCursorModeSync('following');
        returnAnimRef.current = null;
        return;
      }

      const next = { x: current.x + dx * 0.08, y: current.y + dy * 0.08 };
      setCompanionPosSync(next);
      returnAnimRef.current = requestAnimationFrame(animate);
    };

    returnAnimRef.current = requestAnimationFrame(animate);
  }, [setCursorModeSync, setCompanionPosSync]);

  useEffect(() => {
    if (cursorMode === 'following') {
      setCompanionPosSync(dockPos);
    }
  }, [cursorMode, dockPos, setCompanionPosSync]);

  useEffect(() => {
    // displayRef is seeded synchronously from launch args above; this
    // push also carries bounds updates after a DPI / resolution change,
    // which is also when the dock corner needs recomputing.
    const unsubDisplayInfo = window.klip.onDisplayInfo((info) => {
      displayRef.current = info;
      setDockPos(computeDockPos(info));
    });

    const unsubs = [
      window.klip.onVoiceStateChanged(setVoiceState),
      window.klip.onCursorPosition((pos) => {
        // Only used to decide whether the clipboard/type toast (which
        // follows the user's actual attention) should show on this
        // display — the pet itself no longer tracks the cursor.
        if ((pos as { off?: boolean }).off) {
          setIsCursorOnThisDisplay(false);
          return;
        }
        const bounds = displayRef.current?.bounds;
        if (!bounds) {
          setIsCursorOnThisDisplay(false);
          return;
        }
        const onThis =
          pos.x >= bounds.x && pos.x < bounds.x + bounds.width &&
          pos.y >= bounds.y && pos.y < bounds.y + bounds.height;
        setIsCursorOnThisDisplay(onThis);
      }),
      window.klip.onWalkthrough((w) => {
        // Cache the steps. Main drives advancement via WALKTHROUGH_STEP.
        if (returnAnimRef.current) {
          cancelAnimationFrame(returnAnimRef.current);
          returnAnimRef.current = null;
        }
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        if (!w) {
          stepsRef.current = [];
          setCurrentStep(null);
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            startReturnAnimation();
          }, 1500);
          return;
        }
        stepsRef.current = w.steps;
      }),
      window.klip.onTypeFulfilled((req) => {
        if (typeToastTimerRef.current) clearTimeout(typeToastTimerRef.current);
        setTypeToast(req);
        typeToastTimerRef.current = setTimeout(() => {
          setTypeToast(null);
          typeToastTimerRef.current = null;
        }, 5000);
      }),
      window.klip.onAiResponseComplete(() => triggerReaction('success')),
      window.klip.onAiError(() => triggerReaction('error')),
      window.klip.onWalkthroughStep((i) => {
        if (i === null) {
          // Walkthrough ending — the WALKTHROUGH(null) event will
          // schedule the return animation. Just clear current step UI.
          setCurrentStep(null);
          return;
        }
        const step = stepsRef.current[i];
        if (!step) return;
        setPointingPhrase(randomPhrase());
        setCurrentStep(step);
        const bounds = displayRef.current?.bounds;
        setCompanionPosSync({
          x: step.x - (bounds?.x ?? 0),
          y: step.y - (bounds?.y ?? 0),
        });
        setCursorModeSync('navigating');
        setTimeout(() => setCursorModeSync('holding'), 650);
      }),
    ];

    return () => {
      unsubDisplayInfo();
      unsubs.forEach((u) => u());
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (typeToastTimerRef.current) clearTimeout(typeToastTimerRef.current);
      if (returnAnimRef.current) cancelAnimationFrame(returnAnimRef.current);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, [setCursorModeSync, setCompanionPosSync, startReturnAnimation, triggerReaction]);

  useEffect(() => {
    if (voiceState === 'listening') {
      // User started a new turn — interrupt anything KLIP was saying.
      stopCurrentTts();
      setCurrentStep(null);
      stepsRef.current = [];
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (returnAnimRef.current) {
        cancelAnimationFrame(returnAnimRef.current);
        returnAnimRef.current = null;
      }
      setCursorModeSync('following');
    }
  }, [voiceState, setCursorModeSync, stopCurrentTts]);

  const isNavigating = cursorMode === 'navigating';
  const isHolding = cursorMode === 'holding';

  // Walkthrough steps are always *on* one specific display (the one the
  // cursor was on when the screenshot was taken). Render the annotated
  // cursor only on that display so users with multiple monitors don't
  // see the pet flying around on a screen the step isn't on.
  const isStepOnThisDisplay = (() => {
    if (!currentStep) return false;
    const b = displayRef.current?.bounds;
    if (!b) return false;
    return (
      currentStep.x >= b.x && currentStep.x < b.x + b.width &&
      currentStep.y >= b.y && currentStep.y < b.y + b.height
    );
  })();

  // At rest, the pet only shows on its home display (the dock); while
  // pointing at something, it shows wherever that target actually is.
  const isPrimaryDisplay = displayRef.current?.isPrimary ?? false;
  const showOnThisDisplay =
    isNavigating || isHolding ? isStepOnThisDisplay : isPrimaryDisplay;

  const cursorTransition = isNavigating
    ? 'left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : cursorMode === 'following'
      ? 'left 0.05s linear, top 0.05s linear'
      : 'none';

  const showAnnotation = (isNavigating || isHolding) && isStepOnThisDisplay;
  const isMultiStep = (currentStep?.total ?? 0) > 1;
  const petMood: PetMood = reactionPulse ?? voiceState;

  return (
    <div className="overlay-container">
      {showOnThisDisplay && (
        <>
          {showAnnotation && (
            <div
              className="target-halo"
              style={{ left: companionPos.x, top: companionPos.y }}
            />
          )}

          <div
            className={`klip-pet-wrap ${isNavigating || isHolding ? 'navigating' : ''}`}
            style={{
              left: companionPos.x,
              top: companionPos.y,
              transition: cursorTransition,
            }}
          >
            <KlipPet mood={petMood} size={40} />
          </div>

          {voiceState === 'listening' && (
            <div
              className="overlay-waveform"
              style={{ left: companionPos.x + 44, top: companionPos.y + 2 }}
            >
              <Waveform state="listening" bars={10} height={22} />
            </div>
          )}

          {showAnnotation && (
            <div
              className="pointing-bubble"
              style={{
                left: companionPos.x + 44,
                top: companionPos.y - 8,
              }}
            >
              {isMultiStep && (
                <span className="step-badge">
                  {currentStep!.step}
                  <span className="step-badge-total">/{currentStep!.total}</span>
                </span>
              )}
              <span className="bubble-text">
                {isMultiStep ? currentStep!.label : pointingPhrase}
              </span>
            </div>
          )}
        </>
      )}

      {typeToast && isCursorOnThisDisplay && (
        <div className="type-toast" role="status">
          <div className="type-toast-row">
            <span className="type-toast-icon" aria-hidden>
              {typeToast.autoTyped ? '⌨️' : '📋'}
            </span>
            <div className="type-toast-text">
              <div className="type-toast-title">
                {typeToast.autoTyped ? (
                  'Typed for you'
                ) : (
                  <>
                    Copied — press{' '}
                    <kbd>{window.klip.platform === 'darwin' ? '⌘V' : 'Ctrl+V'}</kbd> to paste
                  </>
                )}
              </div>
              <div className="type-toast-preview">&ldquo;{typeToast.preview}&rdquo;</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
