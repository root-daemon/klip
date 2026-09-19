import { motion } from 'framer-motion';

interface AdaptiveCursorProps {
  x: number;
  y: number;
}

/**
 * A small ambient indicator that rides right next to the real cursor —
 * separate from the KLIP pet, which lives docked in the corner. Reads
 * as "quietly sensing/learning": a glowing core, a sonar-style pulse
 * ring, and one particle orbiting it. Same amber as the pet's eyes so
 * it reads as the same intelligence, just a lighter-weight presence.
 */
export function AdaptiveCursor({ x, y }: AdaptiveCursorProps) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <motion.div
        style={{
          position: 'absolute',
          left: -10,
          top: -10,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1.5px solid var(--pet-glow)',
        }}
        animate={{ scale: [0.55, 1.7], opacity: [0.55, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <div
        style={{
          position: 'absolute',
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--pet-glow)',
          boxShadow: '0 0 9px var(--pet-glow-soft)',
        }}
      />
      <motion.div
        style={{ position: 'absolute', left: -15, top: -15, width: 30, height: 30 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
      >
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 0,
            width: 2.5,
            height: 2.5,
            borderRadius: '50%',
            background: 'var(--pet-glow)',
            opacity: 0.85,
          }}
        />
      </motion.div>
    </div>
  );
}
