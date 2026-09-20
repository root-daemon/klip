import { motion } from 'framer-motion';

interface AdaptiveCursorProps {
  x: number;
  y: number;
}

/**
 * 1cm at a standard 96dpi CSS pixel density (1 / 2.54 * 96).
 * Diagonal down-right offset from the real cursor, same direction a
 * trailing assistive pointer would sit in.
 */
const GAP_PX = 38;
const OFFSET_X = GAP_PX * 0.7071;
const OFFSET_Y = GAP_PX * 0.7071;

/**
 * A tiny secondary cursor — reads as an actual pointer arrow, not a
 * decorative blob — that trails the real cursor at a fixed 1cm gap.
 * Same amber as the KLIP pet's eyes, so it reads as the same
 * intelligence quietly tracking alongside the user, separate from the
 * pet itself (which stays docked in the corner).
 *
 * Position updates arrive from main at ~30fps (the cursor broadcast
 * loop), which would read as a visible stutter if applied as an
 * instant snap; the short linear CSS transition below interpolates
 * between those steps so the motion reads as continuous.
 */
export function AdaptiveCursor({ x, y }: AdaptiveCursorProps) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x + OFFSET_X,
        top: y + OFFSET_Y,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
        transition: 'left 0.05s linear, top 0.05s linear',
        willChange: 'left, top',
      }}
      animate={{
        filter: [
          'drop-shadow(0 0 2px var(--pet-glow-soft)) drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
          'drop-shadow(0 0 7px var(--pet-glow-soft)) drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
          'drop-shadow(0 0 2px var(--pet-glow-soft)) drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
        ],
      }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
          fill="var(--pet-glow)"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
