import { app, BrowserWindow, Display, screen, nativeImage } from 'electron';
import path from 'path';
import { DISPLAY_INFO_ARG_PREFIX, type DisplayInfo, type StreamWindowBounds } from '../shared/types';

const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER === '1';

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/index.js');
}

/**
 * Window icon (title bar, taskbar, Alt-tab thumbnail). Without this,
 * an unpackaged dev build falls back to whatever icon is baked into
 * electron.exe itself rather than KLIP's — set explicitly so dev and
 * packaged builds always match. Same asset resolution as the tray icon
 * in main/index.ts.
 */
function getWindowIcon(): Electron.NativeImage | undefined {
  const assetRoot = path.join(__dirname, '../../../assets');
  const file = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const img = nativeImage.createFromPath(path.join(assetRoot, file));
  return img.isEmpty() ? undefined : img;
}

function loadPage(win: BrowserWindow, page: string): void {
  if (isDev) {
    const url = `http://localhost:5173/${page}.html`;
    console.log(`[Klip] Loading ${page} from dev server: ${url}`);
    win.loadURL(url);
  } else {
    const filePath = path.join(__dirname, '../../renderer', `${page}.html`);
    console.log(`[Klip] Loading ${page} from file: ${filePath}`);
    win.loadFile(filePath);
  }
}

/** The main Klip app window (settings + status). */
export function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 820,
    minHeight: 560,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    skipTaskbar: false,
    transparent: false,
    backgroundColor: '#0f0f11',
    title: 'KLIP',
    icon: getWindowIcon(),
    // Windows/Linux otherwise show Electron's stock "File Edit View
    // Window Help" bar above the panel. Alt still reveals it.
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true caused renderers to fail to render (blank screen)
      // — likely a require-resolution issue with our relative preload
      // path. Reverted; we'd need to bundle the preload as a single
      // self-contained file (esbuild) before flipping this on safely.
      sandbox: false,
    },
  });

  // Electron's implicit default menu (no Menu.setApplicationMenu call is
  // made — autoHideMenuBar only hides the bar, not the menu itself) gives
  // Ctrl/Cmd+- a working "Zoom Out" accelerator, but Ctrl/Cmd+Plus is a
  // long-standing Electron/Chromium quirk: the accelerator string "Plus"
  // doesn't reliably match the key event most keyboard layouts actually
  // send for that combo. Handle zoom-in (and reset) explicitly instead of
  // fighting the default menu's accelerator matching; zoom-out is left
  // alone since it already works.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    if (input.key === '=' || input.key === '+') {
      event.preventDefault();
      const z = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(Math.min(5, z + 0.5));
    } else if (input.key === '0') {
      event.preventDefault();
      win.webContents.setZoomLevel(0);
    }
  });

  loadPage(win, 'panel');
  return win;
}

/**
 * Maps each overlay's webContents id back to the Display it covers, so
 * `ipcMain.handle('get-display-info')` in main/index.ts can answer the
 * renderer's request based on which window the IPC came from. Solved
 * the race where the renderer's display-info listener attaches after
 * the one-shot push has already fired.
 */
export const overlayDisplayByWebContents = new Map<number, Display>();

function toDisplayInfo(display: Display): DisplayInfo {
  return {
    id: display.id,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    isPrimary: display.id === screen.getPrimaryDisplay().id,
  };
}

/** A transparent, click-through overlay covering one display. */
export function createOverlayWindow(display: Display): BrowserWindow {
  const { x, y, width, height } = display.bounds;
  const displayInfo = toDisplayInfo(display);

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Hand the renderer its coordinate space up front. The IPC push
      // below can land before React has attached its listener, so the
      // overlay needs a value it can read synchronously on mount.
      //
      // Safe as plain JSON only because every DisplayInfo field is
      // numeric, so the serialized value can never contain a space.
      // Windows splits additionalArguments on spaces — if this type ever
      // grows a string field (a display label, say), base64 it first.
      additionalArguments: [DISPLAY_INFO_ARG_PREFIX + JSON.stringify(displayInfo)],
    },
  });

  // Click-through: let mouse events pass to windows underneath
  win.setIgnoreMouseEvents(true, { forward: true });

  // Keep overlay above everything
  win.setAlwaysOnTop(true, 'screen-saver');

  // Visible on all workspaces / virtual desktops
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadPage(win, 'overlay');

  // Track which display this overlay covers so main can route cursor /
  // walkthrough events to the right window and answer bounds changes.
  // Capture the webContents id up front — by the time `closed` fires,
  // the webContents has been destroyed and accessing `.id` throws.
  const wcId = win.webContents.id;
  overlayDisplayByWebContents.set(wcId, display);
  win.on('closed', () => {
    overlayDisplayByWebContents.delete(wcId);
  });

  // Belt-and-braces: the preload already reads this same snapshot out of
  // argv on every load, including reloads, so this send is redundant
  // rather than an update path. It stays as a cheap safety net in case
  // the argv read ever fails. Bounds changes do NOT arrive here — the
  // window is destroyed and recreated by rebuildOverlays instead.
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('display-info', displayInfo);
  });

  return win;
}

/**
 * The transparent, draggable "stream" window that mirrors the live Q/A
 * so the user can read, scroll, and copy. It's a frameless BrowserWindow
 * with a CSS-drag region in the header; mouse events are enabled so
 * scrolling and text selection work normally.
 */
export function createStreamWindow(
  storedBounds: StreamWindowBounds | null,
): BrowserWindow {
  const bounds = storedBounds ?? defaultStreamBounds();

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 280,
    minHeight: 180,
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    title: 'KLIP Stream',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadPage(win, 'stream');
  return win;
}

function defaultStreamBounds(): StreamWindowBounds {
  const primary = screen.getPrimaryDisplay();
  const { workArea } = primary;
  const width = 380;
  const height = 320;
  // Anchor to the bottom-right corner of the primary work area with a
  // small gutter, so on first launch users can find it easily.
  return {
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
  };
}
