import { randomUUID } from 'crypto';
import { screen } from 'electron';
import { captureDisplays } from './screen-capture';
import { captureAccessibilitySnapshot } from './accessibility';
import { isAccessibilityGranted } from './auto-typer';
import type { DesktopAdapter, DesktopMouseButton, DesktopObservation, DesktopPoint } from './computer-use';
import { buildPointerPath } from './cursor-motion';
import { nativeKeyName } from './desktop-keymap';
import { pressAndReleaseChord } from './keyboard-chord';

type NutMouse = {
  setPosition(point: unknown): Promise<void>;
  click(button?: unknown): Promise<void>;
  doubleClick?(button?: unknown): Promise<void>;
  scrollUp?(amount: number): Promise<void>;
  scrollDown?(amount: number): Promise<void>;
  pressButton?(button?: unknown): Promise<void>;
  releaseButton?(button?: unknown): Promise<void>;
  drag?(points: unknown[]): Promise<void>;
};

type NutKeyboard = {
  config: { autoDelayMs: number };
  type(text: string): Promise<void>;
  pressKey(...keys: unknown[]): Promise<void>;
  releaseKey(...keys: unknown[]): Promise<void>;
};

type NutModule = {
  mouse: NutMouse;
  keyboard: NutKeyboard;
  Point: new (x: number, y: number) => unknown;
  Button: { LEFT: unknown; RIGHT?: unknown; MIDDLE?: unknown };
  Key: Record<string, unknown>;
};

let nut: NutModule | null = null;
let nutLoadAttempted = false;
const POINTER_FRAME_MS = 16;

async function loadNut(): Promise<NutModule> {
  if (nut) return nut;
  if (nutLoadAttempted) throw new Error('Desktop input support is unavailable. Reinstall KLIP to enable computer use.');
  nutLoadAttempted = true;
  try {
    nut = await import('@nut-tree-fork/nut-js') as unknown as NutModule;
    return nut;
  } catch (err) {
    throw new Error(`Desktop input support is unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assertInputPermission(): void {
  if (process.platform === 'darwin' && !isAccessibilityGranted()) {
    throw new Error('Allow KLIP in macOS Accessibility settings before approving computer actions.');
  }
}

/**
 * Real desktop adapter. On macOS observations combine the System Events
 * accessibility tree with visual screenshots; on other platforms they
 * deliberately retain the same vision-action flow while semantic adapters
 * can be added without changing ComputerUseController.
 */
export class ElectronDesktopAdapter implements DesktopAdapter {
  async observe(): Promise<DesktopObservation> {
    const [captures, accessibility] = await Promise.all([
      captureDisplays({ cursorOnly: true }),
      captureAccessibilitySnapshot(),
    ]);
    if (captures.length === 0) throw new Error('I cannot inspect the active screen. Allow screen recording and try again.');

    return {
      id: randomUUID(),
      capturedAt: Date.now(),
      screens: captures.map((capture) => ({
        displayId: capture.displayId,
        imageWidth: capture.imageWidth,
        imageHeight: capture.imageHeight,
        displayBounds: capture.displayBounds,
        dataBase64: capture.dataBase64,
        elements: accessibility.elements.filter((element) => containedBy(element.bounds, capture.displayBounds)),
      })),
      ...(accessibility.foregroundWindow ? { foregroundWindow: accessibility.foregroundWindow } : {}),
    };
  }

  async click(
    point: DesktopPoint,
    options: { doubleClick?: boolean; button?: DesktopMouseButton; keys?: string[] } = {},
  ): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    await withModifierKeys(lib, options.keys, async () => {
      await movePointer(lib, point);
      const button = resolveMouseButton(lib, options.button);
      if (options.doubleClick && lib.mouse.doubleClick) await lib.mouse.doubleClick(button);
      else await lib.mouse.click(button);
    });
  }

  async move(point: DesktopPoint, options: { keys?: string[] } = {}): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    await withModifierKeys(lib, options.keys, () => movePointer(lib, point));
  }

  async type(text: string): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    lib.keyboard.config.autoDelayMs = 5;
    await lib.keyboard.type(text);
  }

  async key(keys: string[]): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    const resolved = keys.map((key) => resolveKey(lib.Key, key));
    if (resolved.length === 0) throw new Error('No keyboard keys were supplied.');
    await pressAndReleaseChord(lib.keyboard, resolved);
  }

  async scroll(
    deltaY: number,
    at?: DesktopPoint,
    options: { keys?: string[]; deltaX?: number } = {},
  ): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    if (options.deltaX) throw new Error('Horizontal scrolling is not supported by this desktop adapter.');
    await withModifierKeys(lib, options.keys, async () => {
      if (at) await movePointer(lib, at);
      // OpenAI computer tool scroll values are pixels. nut.js expects wheel
      // steps, so preserve direction while converting to a bounded count.
      const amount = Math.max(1, Math.min(20, Math.round(Math.abs(deltaY) / 100)));
      if (deltaY > 0 && lib.mouse.scrollDown) await lib.mouse.scrollDown(amount);
      else if (deltaY < 0 && lib.mouse.scrollUp) await lib.mouse.scrollUp(amount);
      else throw new Error('This platform does not support mouse scrolling.');
    });
  }

  async drag(from: DesktopPoint, to: DesktopPoint, options: { keys?: string[] } = {}): Promise<void> {
    assertInputPermission();
    const lib = await loadNut();
    await withModifierKeys(lib, options.keys, async () => {
      await movePointer(lib, from);
      if (!lib.mouse.pressButton || !lib.mouse.releaseButton) {
        if (!lib.mouse.drag) throw new Error('This platform does not support dragging.');
        await lib.mouse.drag([new lib.Point(Math.round(to.x), Math.round(to.y))]);
        return;
      }
      await lib.mouse.pressButton(lib.Button.LEFT);
      try {
        for (const point of buildPointerPath(from, to)) {
          await lib.mouse.setPosition(new lib.Point(point.x, point.y));
          await nextPointerFrame();
        }
      } finally {
        await lib.mouse.releaseButton(lib.Button.LEFT);
      }
    });
  }
}

function resolveMouseButton(lib: NutModule, button: DesktopMouseButton | undefined): unknown {
  switch (button) {
    case 'right':
      if (!lib.Button.RIGHT) throw new Error('This platform does not support right-clicking.');
      return lib.Button.RIGHT;
    case 'middle':
      if (!lib.Button.MIDDLE) throw new Error('This platform does not support middle-clicking.');
      return lib.Button.MIDDLE;
    default:
      return lib.Button.LEFT;
  }
}

async function withModifierKeys<T>(lib: NutModule, keys: string[] | undefined, action: () => Promise<T>): Promise<T> {
  if (!keys?.length) return action();
  const resolved = keys.map((key) => resolveKey(lib.Key, key));
  await lib.keyboard.pressKey(...resolved);
  try {
    return await action();
  } finally {
    await lib.keyboard.releaseKey(...resolved);
  }
}

async function movePointer(lib: NutModule, destination: DesktopPoint): Promise<void> {
  const current = screen.getCursorScreenPoint();
  const path = buildPointerPath(current, destination);
  for (const point of path) {
    await lib.mouse.setPosition(new lib.Point(point.x, point.y));
    await nextPointerFrame();
  }
}

function nextPointerFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, POINTER_FRAME_MS));
}

function resolveKey(keys: Record<string, unknown>, raw: string): unknown {
  const normalized = raw.trim().toUpperCase();
  const name = nativeKeyName(raw);
  const value = keys[name] ?? keys[normalized];
  if (!value) throw new Error(`Unsupported keyboard key: ${raw}`);
  return value;
}

function containedBy(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
): boolean {
  const centerX = inner.x + inner.width / 2;
  const centerY = inner.y + inner.height / 2;
  return centerX >= outer.x && centerX < outer.x + outer.width && centerY >= outer.y && centerY < outer.y + outer.height;
}
