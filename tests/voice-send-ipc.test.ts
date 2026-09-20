import { describe, expect, test } from 'bun:test';
import { IPC } from '../src/shared/types';

describe('manual voice send IPC', () => {
  test('uses the existing push-to-talk stop channel rather than discarding the recording', () => {
    expect(IPC.PUSH_TO_TALK_STOP).toBe('push-to-talk-stop');
    expect(IPC.PUSH_TO_TALK_STOP).not.toBe(IPC.CANCEL_PUSH_TO_TALK);
  });
});
