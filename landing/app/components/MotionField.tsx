'use client';

import { useEffect } from 'react';

/** Gives the page a subtle, pointer-responsive light field without a custom cursor. */
export function MotionField() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    let frame = 0;
    let x = 50;
    let y = 35;

    const paint = () => {
      document.documentElement.style.setProperty('--pointer-x', `${x}%`);
      document.documentElement.style.setProperty('--pointer-y', `${y}%`);
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      x = Math.round((event.clientX / window.innerWidth) * 100);
      y = Math.round((event.clientY / window.innerHeight) * 100);
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
