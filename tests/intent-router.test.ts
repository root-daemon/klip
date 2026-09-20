import { describe, expect, test } from 'bun:test';
import { isComputerUseIntent } from '../src/main/services/intent-router';

describe('computer-use intent routing', () => {
  test('routes app-launch requests into the approved computer-use loop', () => {
    expect(isComputerUseIntent('Launch Safari for me')).toBe(true);
  });
});
