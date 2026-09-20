import type { DesktopPoint } from './computer-use';

const POINTER_STEP_PX = 60;
const MAX_POINTER_STEPS = 12;

/**
 * Break an approved pointer jump into short visible movements. The desktop
 * adapter applies these at a frame cadence, allowing both the OS pointer and
 * KLIP's companion overlay to visibly travel to the action target.
 */
export function buildPointerPath(from: DesktopPoint, to: DesktopPoint): DesktopPoint[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.min(MAX_POINTER_STEPS, Math.ceil(distance / POINTER_STEP_PX)));
  return Array.from({ length: steps }, (_, index) => {
    const ratio = (index + 1) / steps;
    return {
      x: Math.round(from.x + (to.x - from.x) * ratio),
      y: Math.round(from.y + (to.y - from.y) * ratio),
    };
  });
}
