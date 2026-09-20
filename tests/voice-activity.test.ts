import { describe, expect, test } from 'bun:test';
import { containsSpeech, pcm16Rms, SPEECH_RMS_THRESHOLD } from '../src/main/services/voice-activity';

describe('voice activity', () => {
  test('does not mistake a silent PCM chunk for speech', () => {
    const silence = Buffer.alloc(3_200);
    expect(pcm16Rms(silence)).toBe(0);
    expect(containsSpeech(silence)).toBe(false);
  });

  test('detects ordinary audible PCM as speech', () => {
    const speech = Buffer.alloc(3_200);
    for (let offset = 0; offset < speech.length; offset += 2) speech.writeInt16LE(2_000, offset);

    expect(pcm16Rms(speech)).toBeGreaterThan(SPEECH_RMS_THRESHOLD);
    expect(containsSpeech(speech)).toBe(true);
  });

  test('handles the Uint8Array shape Electron IPC delivers from a renderer', () => {
    const pcm = Buffer.alloc(16);
    pcm.writeInt16LE(2_000, 0);
    const fromIpc = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);

    // This mirrors the conversion at CompanionManager's IPC boundary.
    const normalized = Buffer.from(fromIpc.buffer, fromIpc.byteOffset, fromIpc.byteLength);
    expect(containsSpeech(normalized)).toBe(true);
  });
});
