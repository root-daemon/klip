import { useEffect, useId, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { VoiceState } from '../../shared/types';

/** VoiceState plus two transient reaction states the overlay/panel can
 *  pulse into briefly after a turn completes or fails. */
export type PetMood = VoiceState | 'success' | 'error';

interface KlipPetProps {
  mood: PetMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CX = 24;
const CY = 24;
const BODY_R = 19;
const EYE_W = 7;
const EYE_H = 16;
const EYE_GAP = 11;
const EYE_CY = 24;

const SPRING = { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as const };

/**
 * The KLIP companion: a dark circular body with two glowing capsule
 * eyes, no mouth. Emotion reads entirely through eye shape, motion and
 * glow — driven by imperative AnimationControls rather than declarative
 * variants so a blink (its own transform layer, one level up from the
 * eye shape) never has to fight the mood animation for the same values.
 */
export function KlipPet({ mood, size = 44, className, style }: KlipPetProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');

  const body = useAnimation();
  const glow = useAnimation();
  const blink = useAnimation();
  const leftEye = useAnimation();
  const rightEye = useAnimation();
  const blinkingRef = useRef(false);

  useEffect(() => {
    switch (mood) {
      case 'idle':
        body.start({ scale: [1, 1.015, 1], x: 0, rotate: 0, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 1, scaleX: 1, y: 0, x: 0, rotate: 0, transition: SPRING });
        rightEye.start({ scaleY: 1, scaleX: 1, y: 0, x: 0, rotate: 0, transition: SPRING });
        glow.start({ opacity: 0.32, scale: 1, transition: { duration: 0.5 } });
        break;
      case 'listening':
        body.start({ scale: [1, 1.045, 1], x: 0, rotate: 0, transition: { duration: 1.05, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 1.28, scaleX: 1, y: -1, x: 0, rotate: 0, transition: SPRING });
        rightEye.start({ scaleY: 1.28, scaleX: 1, y: -1, x: 0, rotate: 0, transition: SPRING });
        glow.start({ opacity: [0.55, 0.95, 0.55], scale: [1.1, 1.4, 1.1], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'processing':
        body.start({ rotate: [-3, 3, -3], scale: 1, x: 0, transition: { duration: 1.7, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: 0.62, scaleX: 1, y: 0, x: [-1.5, 1.5, -1.5], rotate: 0, transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } });
        rightEye.start({ scaleY: 0.62, scaleX: 1, y: 0, x: [1.5, -1.5, 1.5], rotate: 0, transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } });
        glow.start({ opacity: [0.4, 0.7, 0.4], scale: [1, 1.2, 1], transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'responding':
        body.start({ scale: [1, 1.02, 0.985, 1.02, 1], x: 0, rotate: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        leftEye.start({ scaleY: [1, 0.68, 1.18, 0.82, 1], scaleX: 1, y: 0, x: 0, rotate: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        rightEye.start({ scaleY: [1, 0.85, 1.15, 0.7, 1], scaleX: 1, y: 0, x: 0, rotate: 0, transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } });
        glow.start({ opacity: [0.6, 0.9, 0.6], scale: [1.15, 1.32, 1.15], transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } });
        break;
      case 'success':
        body.start({ scale: [1, 1.2, 0.93, 1.05, 1], x: 0, rotate: 0, transition: { duration: 0.65, ease: 'easeOut' } });
        leftEye.start({ scaleY: 0.32, scaleX: 1.05, y: 2, x: 0, rotate: -10, transition: { duration: 0.22, ease: 'easeOut' } });
        rightEye.start({ scaleY: 0.32, scaleX: 1.05, y: 2, x: 0, rotate: 10, transition: { duration: 0.22, ease: 'easeOut' } });
        glow.start({ opacity: [0.9, 1, 0.7], scale: [1.3, 1.6, 1.2], transition: { duration: 0.6, ease: 'easeOut' } });
        break;
      case 'error':
        body.start({ x: [0, -3, 3, -2, 2, 0], scale: 1, rotate: 0, transition: { duration: 0.4 } });
        leftEye.start({ scaleY: 0.78, scaleX: 1, y: 1, x: 0, rotate: 14, transition: { duration: 0.25 } });
        rightEye.start({ scaleY: 0.78, scaleX: 1, y: 1, x: 0, rotate: -14, transition: { duration: 0.25 } });
        glow.start({ opacity: 0.85, scale: 1.15, transition: { duration: 0.3 } });
        break;
    }
  }, [mood, body, glow, leftEye, rightEye]);

  // Blink is a separate transform layer (a wrapping <motion.g> one level
  // above the eye shape) driven by its own controls, so it composes with
  // whatever the mood animation is doing to eye shape instead of racing
  // it for the same scaleY value.
  useEffect(() => {
    if (mood === 'success' || mood === 'error') return;
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
  }, [mood, blink]);

  const bodyGradId = `klip-body-${uid}`;
  const glowFilterId = `klip-glow-${uid}`;

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
        <circle cx={CX} cy={CY} r={BODY_R} fill={`url(#${bodyGradId})`} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        <motion.circle
          cx={CX}
          cy={CY}
          r={13}
          fill="var(--pet-glow-soft)"
          filter={`url(#${glowFilterId})`}
          animate={glow}
          initial={{ opacity: 0.3, scale: 1 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />

        <motion.g animate={blink} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <motion.rect
            x={CX - EYE_GAP - EYE_W / 2}
            y={EYE_CY - EYE_H / 2}
            width={EYE_W}
            height={EYE_H}
            rx={EYE_W / 2}
            fill="var(--pet-glow)"
            animate={leftEye}
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </motion.g>

        <motion.g animate={blink} initial={false} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <motion.rect
            x={CX + EYE_GAP - EYE_W / 2}
            y={EYE_CY - EYE_H / 2}
            width={EYE_W}
            height={EYE_H}
            rx={EYE_W / 2}
            fill="var(--pet-glow)"
            animate={rightEye}
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </motion.g>
      </motion.g>
    </svg>
  );
}
