/**
 * The overlay sends 16-bit PCM mono audio. This deliberately tiny helper
 * keeps end-of-speech detection local and deterministic: the main process
 * can decide when a macOS tap-to-talk turn has gone quiet without waiting
 * for another global shortcut event.
 */
export const SPEECH_RMS_THRESHOLD = 0.012;

export function pcm16Rms(buffer: Buffer): number {
  const samples = Math.floor(buffer.length / 2);
  if (samples === 0) return 0;

  let sum = 0;
  for (let offset = 0; offset + 1 < buffer.length; offset += 2) {
    const sample = buffer.readInt16LE(offset) / 32768;
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples);
}

export function containsSpeech(buffer: Buffer): boolean {
  return pcm16Rms(buffer) >= SPEECH_RMS_THRESHOLD;
}
