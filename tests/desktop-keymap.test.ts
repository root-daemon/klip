import { describe, expect, test } from 'bun:test';
import { nativeKeyName } from '../src/main/services/desktop-keymap';

describe('desktop key map', () => {
  test('maps OpenAI META to Command on macOS instead of the invalid Super flag', () => {
    expect(nativeKeyName('META', 'darwin')).toBe('LeftCmd');
    expect(nativeKeyName('CMD', 'darwin')).toBe('LeftCmd');
  });

  test('keeps META as Super on non-macOS systems', () => {
    expect(nativeKeyName('META', 'win32')).toBe('LeftSuper');
    expect(nativeKeyName('ctrl', 'win32')).toBe('LeftControl');
  });
});
