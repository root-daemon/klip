import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { CLOUD_IPC, pickPreferences, type CloudAction, type CloudResult, type CloudStatus } from '../../shared/cloud';
import { CloudAuth, beginAuthorization, parseCloudConfig } from './cloud-auth';
import { CloudPreferencesClient } from './cloud-preferences';
import type { CompanionManager } from '../companion-manager';

export function registerCloudAccount(companion: CompanionManager, panel: () => BrowserWindow | null): void {
  let auth: CloudAuth | undefined;
  let preferences: CloudPreferencesClient | undefined;
  let configError: string | undefined;
  try {
    const configPath = path.join(app.getPath('userData'), 'klip-cloud.json');
    const env = process.env;
    const config = env.KLIP_CLOUD_API_URL || env.KLIP_CLOUD_AUTH_DOMAIN || env.KLIP_CLOUD_CLIENT_ID
      ? { apiUrl: env.KLIP_CLOUD_API_URL, authDomain: env.KLIP_CLOUD_AUTH_DOMAIN, clientId: env.KLIP_CLOUD_CLIENT_ID }
      : existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : null;
    if (config) {
      auth = new CloudAuth(parseCloudConfig(config));
      preferences = new CloudPreferencesClient(auth.config.apiUrl, () => auth!.accessToken());
    }
  } catch {
    configError = 'Cloud configuration is invalid. Check klip-cloud.json or the KLIP_CLOUD environment variables and restart.';
  }
  const status = (): CloudStatus => ({ configured: !!auth, signedIn: auth?.signedIn ?? false,
    email: auth?.email, hasSavedPreferences: !!auth?.signedIn && !!preferences?.hasSavedPreferences });
  let busy = false;
  let cancelLogin: (() => void) | undefined;
  app.on('before-quit', () => cancelLogin?.());

  ipcMain.handle(CLOUD_IPC, async (event, action: CloudAction): Promise<CloudResult> => {
    // Credentials and cloud actions belong only to the settings panel's top frame.
    if (event.sender !== panel()?.webContents || event.senderFrame !== event.sender.mainFrame) {
      return { ok: false, status: status(), error: 'Cloud accounts are only available from the settings panel.' };
    }
    if (action === 'cancel') {
      cancelLogin?.();
      return { ok: true, status: status() };
    }
    if (action === 'status') return configError
      ? { ok: false, status: status(), error: configError } : { ok: true, status: status() };
    if (!auth || !preferences) return { ok: false, status: status(), error: configError ?? 'Cloud accounts are not configured in this installation.' };
    if (busy) return { ok: false, status: status(), error: 'Wait for the current cloud action to finish.' };
    busy = true;
    try {
      switch (action) {
        case 'sign-in': {
          if (auth.signedIn) throw new Error('Sign out before switching accounts.');
          const login = await beginAuthorization(auth.config);
          let cancelled = false;
          cancelLogin = () => { cancelled = true; login.cancel(); };
          try {
            await shell.openExternal(login.url);
            await auth.complete(await login.code, login.verifier);
            if (cancelled) {
              await auth.signOut();
              throw new Error('Sign-in cancelled.');
            }
          } finally { login.cancel(); cancelLogin = undefined; }
          preferences.clear();
          await preferences.read();
          panel()?.show();
          panel()?.focus();
          return { ok: true, status: status(), message: 'Signed in. Save these preferences or restore your saved preferences.' };
        }
        case 'sign-out':
          preferences.clear();
          await auth.signOut();
          return { ok: true, status: status(), message: 'Signed out. Local preferences are unchanged.' };
        case 'save':
          await preferences.save(pickPreferences(companion.getSettings()));
          return { ok: true, status: status(), message: 'Preferences saved to your account.' };
        case 'restore': {
          const saved = await preferences.read();
          if (saved.preferences) companion.applyCloudPreferences(saved.preferences);
          return { ok: true, status: status(), message: saved.preferences ? 'Saved preferences restored.' : 'No preferences saved yet. You can save this device’s preferences.' };
        }
        default: throw new Error('Unknown cloud action.');
      }
    } catch (error) {
      return { ok: false, status: status(), error: error instanceof Error ? error.message : 'Cloud action failed.' };
    } finally { busy = false; }
  });
}
