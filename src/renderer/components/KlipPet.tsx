import { useCallback, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import type { VoiceState } from '../../shared/types';

/** VoiceState plus two transient reaction states the overlay/panel can
 *  pulse into briefly after a turn completes or fails, plus two
 *  activity states used by the computer-use agent loop's live step
 *  HUD (see AgentTaskHud) to show what the current step is actually
 *  doing rather than a generic "processing" spinner throughout. */
export type PetMood = VoiceState | 'success' | 'error' | 'writing' | 'reading';

interface KlipPetProps {
  mood: PetMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Normalized-ish pixel offset (small range, e.g. -3..3) toward the
   *  real cursor — only acted on while idle. Lets the eyes "notice"
   *  where the user's pointer actually is. */
  gaze?: { x: number; y: number };
  /** True when the real cursor is close by — triggers a wave hello
   *  (once per cooldown window) while idle. */
  isCursorNear?: boolean;
  /** Overrides the default amber eye/glow color — used to give the
   *  "desktop" specialist a visually distinct identity from
   *  "conversation" while a turn is in flight (see intent-router.ts). */
  accentColor?: string;
  /** Paired with `accentColor`: the translucent ambient-glow variant. */
  accentGlowSoft?: string;
}

const CX = 24;
const CY = 24;
const BODY_R = 19;
const EYE_W = 7;
const EYE_H = 16;
const EYE_GAP = 11;
const EYE_CY = 24;
const HAND_CX = 38;
const HAND_CY = 37;
/** Minimum time between waves, whether triggered by the idle timer or
 *  by the cursor approaching, so hovering nearby doesn't spam it. */
const WAVE_COOLDOWN_MS = 4500;

const SPRING = { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as const };

/** A gentle dome — "^" happy-squint eye — used only for `success`. */
function happyArcPath(ex: number, ey: number): string {
  return `M ${ex - 5.2} ${ey + 1.5} Q ${ex} ${ey - 5.5} ${ex + 5.2} ${ey + 1.5}`;
}

/** A soft sag — worried-squint eye — used only for `error`. */
function worriedArcPath(ex: number, ey: number): string {
  return `M ${ex - 4.6} ${ey - 1.2} Q ${ex} ${ey + 4} ${ex + 4.6} ${ey - 1.2}`;
}

/**
 * The KLIP companion: a dark circular body with two glowing capsule
 * eyes, no mouth, plus a small hand (palm, one thumb, three fingers —
 * four digits in right-ish proportion, not a blob) that peeks out to
 * wave. Emotion reads through eye shape, motion and glow — driven by
 * imperative AnimationControls rather than declarative variants so a
 * blink (its own transform layer, one level above the eye shape)
 * never has to fight the mood animation for the same values.
 *
 * `success`/`error` swap the capsule for a drawn arc (happy squint /
 * worried squint) rather than squashing+rotating the capsule — a
 * heavily flattened, rotated rect reads as a wedge/horn at small
 * sizes, not an expression.
 */
export function KlipPet({
  mood,
  size = 44,
  className,
  style,
  gaze,
  isCursorNear,
  accentColor = 'var(--pet-glow)',
  accentGlowSoft = 'var(--pet-glow-soft)',
}: KlipPetProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');

  const body = useAnimation();
  const glow = useAnimation();
  const blink = useAnimation();
  const leftEye = useAnimation();
  const rightEye = useAnimation();
  const gazeControls = useAnimation();
  const hand = useAnimation();
  const blinkingRef = useRef(false);
  const lastWaveAtRef = useRef(0);

  const isHappy = mood === 'success';
  const isWorried = mood === 'error';
  const showCapsuleEyes = !isHappy && !isWorried;

  useEffect(() => {
    // The hand only stays visible for 'writing' (see that case below);
    // every other mood keeps it hidden here so leaving 'writing' always
    // puts it away, the same way performWave() does when its own
    // animation finishes.
    if (mood !== 'writing') {
      hand.start({ opacity: 0, scale: 0, rotate: 0, transition: { duration: 0.2 } });
    }
    switch (mood) {
      case 'idle':
        body.start({ scale: [1, 1.015, 1], x: 0, y: 0, rotate: 0, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 1, scaleX: 1, y: 0, x: 0, transition: SPRING });
        rightEye.start({ scaleY: 1, scaleX: 1, y: 0, x: 0, transition: SPRING });
        glow.start({ opacity: 0.32, scale: 1, transition: { duration: 0.5 } });
        break;
      case 'listening':
        body.start({ scale: [1, 1.045, 1], x: 0, y: 0, rotate: 0, transition: { duration: 1.05, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 1.28, scaleX: 1, y: -1, x: 0, transition: SPRING });
        rightEye.start({ scaleY: 1.28, scaleX: 1, y: -1, x: 0, transition: SPRING });
        glow.start({ opacity: [0.55, 0.95, 0.55], scale: [1.1, 1.4, 1.1], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'processing':
        // A little head-tilt-and-bob "thinking" pose: eyes narrow, drift
        // side to side and lift slightly, like glancing up in thought.
        body.start({ rotate: [-3, 3, -3], y: [0, -1.5, 0], scale: 1, x: 0, transition: { duration: 1.7, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 0.62, scaleX: 1, y: [-1, -2.2, -1], x: [-1.5, 1.5, -1.5], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } });
        rightEye.start({ scaleY: 0.62, scaleX: 1, y: [-1, -2.2, -1], x: [1.5, -1.5, 1.5], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } });
        glow.start({ opacity: [0.4, 0.7, 0.4], scale: [1, 1.2, 1], transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'responding':
        body.start({ scale: [1, 1.02, 0.985, 1.02, 1], x: 0, y: 0, rotate: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: [1, 0.68, 1.18, 0.82, 1], scaleX: 1, y: 0, x: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        rightEye.start({ scaleY: [1, 0.85, 1.15, 0.7, 1], scaleX: 1, y: 0, x: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        glow.start({ opacity: [0.6, 0.9, 0.6], scale: [1.15, 1.32, 1.15], transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'success':
        // Eyes become the drawn happy arc below — a cheerful little
        // bounce is all the capsule-driven body/glow need to do.
        body.start({ scale: [1, 1.22, 0.92, 1.06, 1], x: 0, y: [0, -3, 0, -1, 0], rotate: 0, transition: { duration: 0.6, ease: 'easeOut' } });
        glow.start({ opacity: [0.9, 1, 0.7], scale: [1.3, 1.6, 1.2], transition: { duration: 0.6, ease: 'easeOut' } });
        break;
      case 'error':
        // Eyes become the drawn worried arc below.
        body.start({ x: [0, -3, 3, -2, 2, 0], y: 0, scale: 1, rotate: 0, transition: { duration: 0.4 } });
        glow.start({ opacity: 0.85, scale: 1.15, transition: { duration: 0.3 } });
        break;
      case 'writing':
        // Eyes dip slightly, as if looking down at the page, while the
        // hand comes out and stays out — a small rotate+bob loop reads
        // as short pen strokes rather than the one-shot wave gesture.
        body.start({ scale: 1, x: 0, y: [0, -1, 0], rotate: 0, transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 0.78, scaleX: 1, y: 1.5, x: 0, transition: SPRING });
        rightEye.start({ scaleY: 0.78, scaleX: 1, y: 1.5, x: 0, transition: SPRING });
        glow.start({ opacity: [0.45, 0.65, 0.45], scale: [1.05, 1.15, 1.05], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } });
        hand.start({
          opacity: 1,
          scale: 1,
          rotate: [-10, 8, -10],
          y: [0, 2, 0],
          transition: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'reading':
        // A fast left-right saccade sweep — deliberately quicker and
        // tighter than the idle "glance" quirk, to read as scanning
        // text rather than a casual look-around.
        body.start({ scale: 1, x: 0, y: 0, rotate: 0, transition: { duration: 0.3 } });
        leftEye.start({ scaleY: 0.92, scaleX: 1, x: [-3, 3, -3], y: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        rightEye.start({ scaleY: 0.92, scaleX: 1, x: [-3, 3, -3], y: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        glow.start({ opacity: [0.4, 0.6, 0.4], scale: 1.1, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        break;
    }
  }, [mood, body, glow, leftEye, rightEye, hand]);

  // Blink is a separate transform layer (a wrapping <motion.g> one level
  // above the eye shape) driven by its own controls, so it composes with
  // whatever the mood animation is doing to eye shape instead of racing
  // it for the same scaleY value.
  useEffect(() => {
    if (!showCapsuleEyes) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 1800 + Math.random() * 3200;
      timer = setTimeout(async () => {
        if (blinkingRef.current) {
          scheduleBlink();
          return;
        }
        blinkingRef.current = true;
        await blink.start({ scaleY: 0.08, transition: { duration: 0.09, ease: 'easeIn' } });
        await blink.start({ scaleY: 1, transition: { duration: 0.15, ease: 'easeOut' } });
        blinkingRef.current = false;
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, [showCapsuleEyes, blink]);

  // A cute idle quirk: every so often, glance to one side and back —
  // independent of blink, only while genuinely idle (mood's own idle
  // pose is a one-shot settle, not a repeating loop, so it never fights
  // this for the same values).
  useEffect(() => {
    if (mood !== 'idle') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleGlance = () => {
      const delay = 5000 + Math.random() * 6000;
      timer = setTimeout(async () => {
        if (cancelled) return;
        const dir = Math.random() > 0.5 ? 1 : -1;
        await Promise.all([
          leftEye.start({ x: 2.5 * dir, transition: { duration: 0.28, ease: 'easeOut' } }),
          rightEye.start({ x: 2.5 * dir, transition: { duration: 0.28, ease: 'easeOut' } }),
        ]);
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 450));
        if (cancelled) return;
        await Promise.all([
          leftEye.start({ x: 0, transition: { duration: 0.3, ease: 'easeOut' } }),
          rightEye.start({ x: 0, transition: { duration: 0.3, ease: 'easeOut' } }),
        ]);
        scheduleGlance();
      }, delay);
    };
    scheduleGlance();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mood, leftEye, rightEye]);

  // Eyes "notice" the real cursor: a separate transform layer (like
  // blink) that nudges eye position toward wherever the caller says
  // the cursor is, only while idle — once KLIP is listening/thinking/
  // speaking it's paying attention to the conversation, not the mouse.
  useEffect(() => {
    if (mood === 'idle' && gaze) {
      gazeControls.start({ x: gaze.x, y: gaze.y, transition: { duration: 0.28, ease: 'easeOut' } });
    } else {
      gazeControls.start({ x: 0, y: 0, transition: { duration: 0.2, ease: 'easeOut' } });
    }
  }, [mood, gaze?.x, gaze?.y, gazeControls]);

  // Waving hand — shared by the idle-timer trigger below and the
  // cursor-proximity trigger the caller reports via `isCursorNear`.
  // The cooldown lives here so either source respects it.
  const performWave = useCallback(async () => {
    const now = Date.now();
    if (now - lastWaveAtRef.current < WAVE_COOLDOWN_MS) return;
    lastWaveAtRef.current = now;
    await hand.start({
      opacity: 1,
      scale: 1,
      rotate: [0, -22, 12, -18, 8, 0],
      transition: { duration: 1.1, ease: 'easeInOut' },
    });
    await hand.start({ opacity: 0, scale: 0, transition: { duration: 0.25, ease: 'easeIn' } });
  }, [hand]);

  // A little hand peeks out and waves every so often while idle.
  useEffect(() => {
    if (mood !== 'idle') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleWave = () => {
      const delay = 9000 + Math.random() * 8000;
      timer = setTimeout(async () => {
        if (cancelled) return;
        await performWave();
        if (cancelled) return;
        scheduleWave();
      }, delay);
    };
    scheduleWave();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mood, performWave]);

  // Says hi the moment the cursor actually gets close, instead of
  // waiting for the random idle timer — fires once per approach
  // (edge-triggered) so lingering nearby doesn't wave on repeat.
  const wasNearRef = useRef(false);
  useEffect(() => {
    if (mood !== 'idle') {
      wasNearRef.current = false;
      return;
    }
    if (isCursorNear && !wasNearRef.current) {
      void performWave();
    }
    wasNearRef.current = !!isCursorNear;
  }, [mood, isCursorNear, performWave]);

  const bodyGradId = `klip-body-${uid}`;
  const glowFilterId = `klip-glow-${uid}`;
  const leftEyeX = CX - EYE_GAP;
  const rightEyeX = CX + EYE_GAP;

  const emotedPath = isHappy ? happyArcPath : isWorried ? worriedArcPath : null;
  const emotedColor = isWorried ? 'var(--destructive)' : 'var(--pet-glow)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <radialGradient id={bodyGradId} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="var(--pet-body-hi)" />
          <stop offset="100%" stopColor="var(--pet-body)" />
        </radialGradient>
        <filter id={glowFilterId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      <motion.g animate={body} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        {/* Hand: a palm plus four digits (three fingers + one thumb) in
            roughly true proportion — not a plain circle. Hidden at rest
            (opacity/scale 0), the shared `hand` controls scale it in and
            rotate the whole unit as one rigid piece for the wave. */}
        <motion.g
          animate={hand}
          initial={{ opacity: 0, scale: 0 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <g transform={`translate(${HAND_CX} ${HAND_CY})`}>
            {/* Thumb, angled off the side of the palm */}
            <rect
              x={-0.75} y={-1.6} width={1.5} height={3.1} rx={0.75}
              fill={`url(#${bodyGradId})`}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"
              transform="rotate(-55 -3.9 0)"
            />
            {/* Three fingers, gently fanned */}
            {[-1.7, 0, 1.7].map((fx, i) => (
              <rect
                key={fx}
                x={fx - 0.75} y={-3.7} width={1.5} height={3.9} rx={0.75}
                fill={`url(#${bodyGradId})`}
                stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"
                transform={`rotate(${(i - 1) * 13} ${fx} 0)`}
              />
            ))}
            {/* Palm */}
            <ellipse
              cx={0} cy={1.3} rx={3.3} ry={2.7}
              fill={`url(#${bodyGradId})`}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.6"
            />
          </g>
        </motion.g>

        <circle cx={CX} cy={CY} r={BODY_R} fill={`url(#${bodyGradId})`} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        <motion.circle
          cx={CX}
          cy={CY}
          r={13}
          fill={accentGlowSoft}
          filter={`url(#${glowFilterId})`}
          animate={glow}
          initial={{ opacity: 0.3, scale: 1 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {emotedPath ? (
            <motion.g
              key="emoted-eyes"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <path d={emotedPath(leftEyeX, EYE_CY)} stroke={emotedColor} strokeWidth={3.2} strokeLinecap="round" fill="none" />
              <path d={emotedPath(rightEyeX, EYE_CY)} stroke={emotedColor} strokeWidth={3.2} strokeLinecap="round" fill="none" />
            </motion.g>
          ) : (
            <motion.g
              key="capsule-eyes"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <motion.g animate={blink} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                <motion.g animate={leftEye} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <motion.g animate={gazeControls} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <rect
                      x={leftEyeX - EYE_W / 2}
                      y={EYE_CY - EYE_H / 2}
                      width={EYE_W}
                      height={EYE_H}
                      rx={EYE_W / 2}
                      fill={accentColor}
                    />
                    <circle cx={leftEyeX - 1.3} cy={EYE_CY - EYE_H / 2 + 3.6} r={1.1} fill="rgba(255,255,255,0.85)" />
                  </motion.g>
                </motion.g>
              </motion.g>

              <motion.g animate={blink} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                <motion.g animate={rightEye} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <motion.g animate={gazeControls} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <rect
                      x={rightEyeX - EYE_W / 2}
                      y={EYE_CY - EYE_H / 2}
                      width={EYE_W}
                      height={EYE_H}
                      rx={EYE_W / 2}
                      fill={accentColor}
                    />
                    <circle cx={rightEyeX - 1.3} cy={EYE_CY - EYE_H / 2 + 3.6} r={1.1} fill="rgba(255,255,255,0.85)" />
                  </motion.g>
                </motion.g>
              </motion.g>
            </motion.g>
          )}
        </AnimatePresence>
      </motion.g>
    </svg>
  );
}
