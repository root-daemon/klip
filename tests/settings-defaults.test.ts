import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let userDataDirectory = '';

mock.module('electron', () => ({
  app: {
    getPath: () => userDataDirectory,
  },
}));

describe('settings defaults', () => {
  beforeEach(() => {
    userDataDirectory = mkdtempSync(join(tmpdir(), 'klip-settings-'));
  });

  test('enables computer use for a fresh profile', async () => {
    const settings = await import('../src/main/services/settings-store');

    expect(settings.get('computerUseEnabled')).toBe(true);
  });
});
