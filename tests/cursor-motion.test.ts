import { describe, expect, test } from 'bun:test';
import { buildPointerPath } from '../src/main/services/cursor-motion';

describe('computer-use cursor motion', () => {
  test('breaks a distant approved target into visible pointer movement', () => {
    expect(buildPointerPath({ x: 0, y: 0 }, { x: 240, y: 0 })).toEqual([
      { x: 60, y: 0 },
      { x: 120, y: 0 },
      { x: 180, y: 0 },
      { x: 240, y: 0 },
    ]);
  });
});
