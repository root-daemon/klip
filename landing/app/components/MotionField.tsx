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
    let spotlight: HTMLElement | null = null;
    let spotlightX = 50;
    let spotlightY = 50;

    const paint = () => {
      document.documentElement.style.setProperty('--pointer-x', `${x}%`);
      document.documentElement.style.setProperty('--pointer-y', `${y}%`);
      if (spotlight) {
        spotlight.style.setProperty('--spot-x', `${spotlightX}%`);
        spotlight.style.setProperty('--spot-y', `${spotlightY}%`);
      }
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      x = Math.round((event.clientX / window.innerWidth) * 100);
      y = Math.round((event.clientY / window.innerHeight) * 100);

      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-spotlight]')
        : null;

      if (target) {
        const bounds = target.getBoundingClientRect();
        spotlight = target;
        spotlightX = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
        spotlightY = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
      }

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
