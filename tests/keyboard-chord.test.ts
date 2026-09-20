import { describe, expect, test } from 'bun:test';
import { pressAndReleaseChord } from '../src/main/services/keyboard-chord';

describe('keyboard chord execution', () => {
  test('keeps modifier and key order identical for press and release', async () => {
    const calls: unknown[][] = [];
    const keyboard = {
      pressKey: async (...keys: unknown[]) => { calls.push(['press', ...keys]); },
      releaseKey: async (...keys: unknown[]) => { calls.push(['release', ...keys]); },
    };

    await pressAndReleaseChord(keyboard, ['LeftCmd', 'Space']);

    expect(calls).toEqual([
      ['press', 'LeftCmd', 'Space'],
      ['release', 'LeftCmd', 'Space'],
    ]);
  });
});
