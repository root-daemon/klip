import { systemPreferences, screen } from 'electron';

/**
 * Native desktop-control wrapper (keyboard + mouse). The underlying
 * module (`@nut-tree-fork/nut-js`) ships native bindings for libnut and
 * emits global keyboard/mouse events through the OS. We load it lazily
 * so a failed install doesn't crash the main process — every consumer
 * goes through one of the exported functions below, each of which
 * returns `false` if the module or the required permission is
 * unavailable, and the caller falls back to a safer degraded behavior
 * (clipboard handoff for typing, point-only for clicking).
 *
 * Coordinate space: every function here takes/returns Electron's
 * logical (DIP) pixel coordinates — the same space as `screen.bounds`,
 * screenshots, and the [POINT:...]/[CLICK:...] tag math — NOT nut-js's
 * own coordinates. nut-js/libnut reports its screen size as "the
 * hardware resolution" (physical pixels), confirmed empirically on this
 * codebase: at 150% Windows scaling, nut-js's cursor readback was
 * exactly 1.5x Electron's `screen.getCursorScreenPoint()` in both axes.
 * Passing logical coordinates straight through (the original bug) means
 * every click lands short of its target by the scale factor — barely
 * noticeable near the screen origin, badly wrong everywhere else. All
 * physical/logical conversion is centralized in toPhysicalPoint/
 * toLogicalPoint below so callers only ever think in logical pixels.
 */

type NutJs = typeof import('@nut-tree-fork/nut-js');

/** Logical (Electron) → physical (nut-js) pixel coordinates, using the
 *  scale factor of whichever display actually contains the point.
 *  Correct for single-monitor and uniform-DPI multi-monitor setups;
 *  best-effort only for genuinely mixed-DPI multi-monitor arrangements
 *  (Windows doesn't expose a simpler mapping for that case). */
function toPhysicalPoint(x: number, y: number): { x: number; y: number } {
  const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const sf = display.scaleFactor || 1;
  return { x: Math.round(x * sf), y: Math.round(y * sf) };
}

/** Physical (nut-js) → logical (Electron) pixel coordinates — the
 *  inverse of toPhysicalPoint, used when reading the cursor position
 *  back out. Finds the containing display by its own physical bounds
 *  (logical bounds scaled by that display's own factor). */
function toLogicalPoint(physX: number, physY: number): { x: number; y: number } {
  for (const d of screen.getAllDisplays()) {
    const sf = d.scaleFactor || 1;
    const px0 = d.bounds.x * sf;
    const py0 = d.bounds.y * sf;
    if (physX >= px0 && physX < px0 + d.bounds.width * sf && physY >= py0 && physY < py0 + d.bounds.height * sf) {
      return { x: Math.round(physX / sf), y: Math.round(physY / sf) };
    }
  }
  const sf = screen.getPrimaryDisplay().scaleFactor || 1;
  return { x: Math.round(physX / sf), y: Math.round(physY / sf) };
}

let nutJs: NutJs | null = null;
let loadAttempted = false;

async function load(): Promise<NutJs | null> {
  if (loadAttempted) return nutJs;
  loadAttempted = true;
  try {
    nutJs = await import('@nut-tree-fork/nut-js');
  } catch (err) {
    console.error('[Klip] auto-typer native module unavailable:', err);
    nutJs = null;
  }
  return nutJs;
}

/**
 * Whether the OS permission required for auto-typing is currently granted.
 * On macOS this is Accessibility (Input Monitoring is not enough — typing
 * keystrokes globally requires the Accessibility trust list). On other
 * platforms there is no equivalent gate.
 */
export function isAccessibilityGranted(): boolean {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

/**
 * Surface the macOS Accessibility prompt and add Klip to the trust
 * list. The user still has to enable the checkbox themselves; the OS
 * does not return a granted state until they do, but the dialog gives
 * them the discovery path.
 */
export function promptAccessibility(): boolean {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(true);
}

/**
 * Type `text` into whatever the OS considers the focused element.
 * Returns true when the keys were sent successfully, false when the
 * caller should fall back to clipboard handoff (module missing,
 * permission missing, or libnut threw).
 */
export async function typeText(text: string): Promise<boolean> {
  if (!text) return false;
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    // Default delay is fine for native apps; web inputs sometimes drop
    // characters at zero delay, but raising this hurts the "magical"
    // feel. If we see drops in practice we can bump to ~5–10ms.
    lib.keyboard.config.autoDelayMs = 0;
    await lib.keyboard.type(text);
    return true;
  } catch (err) {
    console.error('[Klip] auto-type failed:', err);
    return false;
  }
}

/**
 * Move the real OS cursor to (x, y) — real screen coordinates, already
 * mapped from screenshot-pixel space by the caller — and perform a left
 * click. Returns false (same contract as typeText) when the native
 * module or Accessibility permission is unavailable; the caller treats
 * that as "pointing only, nothing was actually clicked".
 */
export async function clickAt(x: number, y: number): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    const p = toPhysicalPoint(x, y);
    await lib.mouse.setPosition(new lib.Point(p.x, p.y));
    await lib.mouse.leftClick();
    return true;
  } catch (err) {
    console.error('[Klip] auto-click failed:', err);
    return false;
  }
}

/** Scroll at the current OS cursor position — the same "steps" unit nut-js
 *  uses; the actual pixel distance per step is OS-dependent. */
export async function scroll(direction: 'up' | 'down', amount: number): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    if (direction === 'up') await lib.mouse.scrollUp(amount);
    else await lib.mouse.scrollDown(amount);
    return true;
  } catch (err) {
    console.error('[Klip] auto-scroll failed:', err);
    return false;
  }
}

// ── Extended primitives for the computer-use agent loop ──────────────
// (element-detector.ts / computer-use-agent.ts) — the click/scroll
// helpers above stay as-is since the walkthrough system already
// depends on their exact signatures; these are additive.

type NutKeyEnum = Awaited<ReturnType<typeof load>> extends infer L
  ? L extends { Key: infer K }
    ? K
    : never
  : never;
type NutKeyValue = NutKeyEnum[keyof NutKeyEnum];

export async function moveMouseTo(x: number, y: number): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    const p = toPhysicalPoint(x, y);
    await lib.mouse.setPosition(new lib.Point(p.x, p.y));
    return true;
  } catch (err) {
    console.error('[Klip] mouse move failed:', err);
    return false;
  }
}

export async function mouseClick(button: 'left' | 'right', count: 1 | 2 | 3 = 1): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    for (let i = 0; i < count; i++) {
      if (button === 'left') await lib.mouse.leftClick();
      else await lib.mouse.rightClick();
    }
    return true;
  } catch (err) {
    console.error('[Klip] mouse click failed:', err);
    return false;
  }
}

export async function mouseDrag(x1: number, y1: number, x2: number, y2: number): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  try {
    const p1 = toPhysicalPoint(x1, y1);
    const p2 = toPhysicalPoint(x2, y2);
    await lib.mouse.drag([new lib.Point(p1.x, p1.y), new lib.Point(p2.x, p2.y)]);
    return true;
  } catch (err) {
    console.error('[Klip] mouse drag failed:', err);
    return false;
  }
}

/** Returns the cursor position in logical (Electron) pixels — converted
 *  back from nut-js's physical coordinates, so callers never need to
 *  think about the physical/logical distinction themselves. */
export async function getCursorPos(): Promise<{ x: number; y: number } | null> {
  const lib = await load();
  if (!lib) return null;
  try {
    const p = await lib.mouse.getPosition();
    return toLogicalPoint(p.x, p.y);
  } catch (err) {
    console.error('[Klip] cursor position read failed:', err);
    return null;
  }
}

/** xdotool-style key names (the convention Anthropic's computer-use tool
 *  reports, e.g. "Return", "ctrl+s", "alt+Tab") mapped to nut-js's Key
 *  enum. Unrecognized tokens are dropped with a warning rather than
 *  throwing — a best-effort press beats failing the whole action. */
function resolveKeyToken(token: string, Key: NutKeyEnum): NutKeyValue | null {
  const t = token.trim().toLowerCase();
  const table: Record<string, keyof NutKeyEnum> = {
    ctrl: 'LeftControl', control: 'LeftControl',
    alt: 'LeftAlt', option: 'LeftAlt',
    shift: 'LeftShift',
    super: 'LeftSuper', cmd: 'LeftCmd', command: 'LeftCmd', win: 'LeftWin', meta: 'LeftMeta',
    return: 'Return', enter: 'Return',
    escape: 'Escape', esc: 'Escape',
    tab: 'Tab',
    space: 'Space',
    backspace: 'Backspace',
    delete: 'Delete', del: 'Delete',
    insert: 'Insert',
    home: 'Home', end: 'End',
    page_up: 'PageUp', pageup: 'PageUp', prior: 'PageUp',
    page_down: 'PageDown', pagedown: 'PageDown', next: 'PageDown',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right',
    capslock: 'CapsLock',
  };
  if (table[t]) return Key[table[t]];
  if (/^f([1-9]|1\d|2[0-4])$/.test(t)) return Key[`F${t.slice(1)}` as keyof NutKeyEnum];
  if (/^[a-z]$/.test(t)) return Key[t.toUpperCase() as keyof NutKeyEnum];
  if (/^[0-9]$/.test(t)) return Key[`Num${t}` as keyof NutKeyEnum];
  console.warn(`[Klip] unrecognized key token "${token}" — skipped`);
  return null;
}

/** Presses a combo like "ctrl+s" or a single key like "Return", holding
 *  modifiers for the duration of the main key press (natural ordering,
 *  matching nut-js's own pressKey/releaseKey contract). */
export async function pressKeyCombo(text: string): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  const keys = text.split('+').map((t) => resolveKeyToken(t, lib.Key)).filter((k): k is NutKeyValue => k !== null);
  if (keys.length === 0) return false;
  try {
    await lib.keyboard.pressKey(...keys);
    await lib.keyboard.releaseKey(...keys);
    return true;
  } catch (err) {
    console.error('[Klip] key combo failed:', err);
    return false;
  }
}

export async function holdKeyFor(text: string, seconds: number): Promise<boolean> {
  const lib = await load();
  if (!lib) return false;
  if (!isAccessibilityGranted()) return false;
  const keys = text.split('+').map((t) => resolveKeyToken(t, lib.Key)).filter((k): k is NutKeyValue => k !== null);
  if (keys.length === 0) return false;
  try {
    await lib.keyboard.pressKey(...keys);
    await new Promise((r) => setTimeout(r, Math.min(seconds, 300) * 1000));
    await lib.keyboard.releaseKey(...keys);
    return true;
  } catch (err) {
    console.error('[Klip] hold key failed:', err);
    return false;
  }
}
