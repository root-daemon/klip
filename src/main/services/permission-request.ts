/**
 * macOS has no Electron API that presents a Screen Recording consent dialog.
 * A capture attempt registers KLIP with TCC; System Settings is where the user
 * explicitly grants or restores access.
 */
export const MAC_SCREEN_RECORDING_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

export type MacMediaAccessStatus =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unknown';

export interface MacScreenRecordingPermissionPlan {
  /** Make a first capture request so macOS associates the permission with KLIP. */
  shouldProbeCapture: boolean;
  /** Take the user to the only place where Screen Recording can be granted. */
  shouldOpenSettings: boolean;
}

export function planMacScreenRecordingPermissionRequest(
  status: MacMediaAccessStatus,
): MacScreenRecordingPermissionPlan {
  if (status === 'granted') {
    return { shouldProbeCapture: false, shouldOpenSettings: false };
  }

  return {
    shouldProbeCapture: status === 'not-determined',
    shouldOpenSettings: true,
  };
}
