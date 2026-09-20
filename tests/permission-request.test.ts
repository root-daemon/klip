import { describe, expect, test } from 'bun:test';
import { planMacScreenRecordingPermissionRequest } from '../src/main/services/permission-request';

describe('macOS Screen Recording permission requests', () => {
  test('registers a first capture attempt and opens System Settings when permission has not been decided', () => {
    expect(planMacScreenRecordingPermissionRequest('not-determined')).toEqual({
      shouldProbeCapture: true,
      shouldOpenSettings: true,
    });
  });

  test('takes the user to System Settings after a prior denial without probing again', () => {
    expect(planMacScreenRecordingPermissionRequest('denied')).toEqual({
      shouldProbeCapture: false,
      shouldOpenSettings: true,
    });
  });

  test('does nothing after Screen Recording has already been granted', () => {
    expect(planMacScreenRecordingPermissionRequest('granted')).toEqual({
      shouldProbeCapture: false,
      shouldOpenSettings: false,
    });
  });
});
