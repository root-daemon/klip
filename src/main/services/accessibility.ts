import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AccessibleElement, ForegroundWindow } from './computer-use';

const execFileAsync = promisify(execFile);
const MAX_ELEMENTS = 350;

export interface AccessibilitySnapshot {
  foregroundWindow?: ForegroundWindow;
  elements: AccessibleElement[];
}

/**
 * Native semantic observation. The visual planner never has to depend on
 * these elements being present: macOS supplies them through System Events
 * when Accessibility is granted, while other platforms cleanly fall back to
 * vision coordinates until a UI Automation adapter is added.
 */
export async function captureAccessibilitySnapshot(): Promise<AccessibilitySnapshot> {
  if (process.platform !== 'darwin') return { elements: [] };

  try {
    const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', MACOS_ACCESSIBILITY_SCRIPT], {
      timeout: 2_000,
      maxBuffer: 1024 * 1024,
    });
    return parseAccessibilitySnapshot(stdout);
  } catch (err) {
    // Missing Accessibility permission, a protected app, and a transient
    // System Events failure all mean "semantic data unavailable", not that
    // visual computer use should stop. The input executor still requires the
    // same OS permission on macOS before it can click or type.
    console.warn('[Klip] accessibility snapshot unavailable:', err instanceof Error ? err.message : String(err));
    return { elements: [] };
  }
}

/** Exported for fixture tests; accepts only the deliberately small schema. */
export function parseAccessibilitySnapshot(raw: string): AccessibilitySnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { elements: [] };
  }
  if (!isRecord(parsed)) return { elements: [] };

  const foregroundWindow = parseWindow(parsed.foregroundWindow);
  const source = Array.isArray(parsed.elements) ? parsed.elements : [];
  const elements: AccessibleElement[] = [];
  for (const candidate of source.slice(0, MAX_ELEMENTS)) {
    const element = parseElement(candidate);
    if (element) elements.push(element);
  }
  return { ...(foregroundWindow ? { foregroundWindow } : {}), elements };
}

function parseWindow(value: unknown): ForegroundWindow | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  const bounds = parseBounds(value.bounds);
  return {
    id: value.id,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(typeof value.owner === 'string' ? { owner: value.owner } : {}),
    ...(bounds ? { bounds } : {}),
  };
}

function parseElement(value: unknown): AccessibleElement | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.role !== 'string' || typeof value.label !== 'string') {
    return undefined;
  }
  const bounds = parseBounds(value.bounds);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return undefined;
  return {
    id: value.id,
    role: value.role,
    label: value.label.slice(0, 200),
    bounds,
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
  };
}

function parseBounds(value: unknown): { x: number; y: number; width: number; height: number } | undefined {
  if (!isRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (
    typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number' ||
    !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)
  ) return undefined;
  return { x, y, width, height };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// System Events is the only macOS semantic-accessibility API Electron can
// reach without adding a brittle native dependency. We emit a deliberately
// narrow JSON shape: names/roles/bounds only, never an input's value.
const MACOS_ACCESSIBILITY_SCRIPT = `
const events = Application('System Events');
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
const asText = (value) => value === undefined || value === null ? '' : String(value);
const processes = safe(() => events.applicationProcesses.whose({ frontmost: true })(), []);
const process = processes[0];
if (!process) {
  JSON.stringify({ elements: [] });
} else {
  const window = safe(() => process.windows()[0], null);
  const position = safe(() => window.position(), null);
  const size = safe(() => window.size(), null);
  const foregroundWindow = window && position && size ? {
    id: asText(safe(() => process.bundleIdentifier(), safe(() => process.name(), 'frontmost'))) + ':' + asText(safe(() => window.name(), 'window')),
    title: asText(safe(() => window.name(), '')),
    owner: asText(safe(() => process.name(), '')),
    bounds: { x: Number(position[0]), y: Number(position[1]), width: Number(size[0]), height: Number(size[1]) }
  } : undefined;
  const contents = window ? safe(() => window.entireContents(), []) : [];
  const elements = [];
  for (let i = 0; i < contents.length && elements.length < ${MAX_ELEMENTS}; i += 1) {
    const element = contents[i];
    const elementPosition = safe(() => element.position(), null);
    const elementSize = safe(() => element.size(), null);
    if (!elementPosition || !elementSize || Number(elementSize[0]) <= 0 || Number(elementSize[1]) <= 0) continue;
    const name = asText(safe(() => element.name(), ''));
    const description = asText(safe(() => element.description(), ''));
    const role = asText(safe(() => element.role(), 'AXUnknown'));
    if (!name && !description && role === 'AXUnknown') continue;
    elements.push({
      id: 'ax-' + i,
      role,
      label: (name || description).slice(0, 200),
      enabled: Boolean(safe(() => element.enabled(), true)),
      bounds: { x: Number(elementPosition[0]), y: Number(elementPosition[1]), width: Number(elementSize[0]), height: Number(elementSize[1]) }
    });
  }
  JSON.stringify({ foregroundWindow, elements });
}
`;
