import type { TranscriptionResult } from '../../shared/types';
import type { TranscriptionProvider } from './transcription';
import { getApiKey } from './key-store';
import { buildWav } from './audio-util';

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

/**
 * Sarvam AI (Saarika) speech-to-text. Strong at Indian-language and
 * code-switched (Hindi/English etc.) speech; `language_code: 'unknown'`
 * lets Saarika auto-detect rather than forcing English like the Groq
 * path does.
 */
export class SarvamSttProvider implements TranscriptionProvider {
  private audioChunks: Buffer[] = [];
  onPartialTranscript?: (text: string) => void;

  async start(): Promise<void> {
    const apiKey = getApiKey('sarvam');
    if (!apiKey) throw new Error('Sarvam API key not configured. Add it in the KLIP panel.');
    this.audioChunks = [];
  }

  sendAudio(pcm16Buffer: Buffer): void {
    this.audioChunks.push(pcm16Buffer);
  }

  async stop(): Promise<TranscriptionResult> {
    const pcmData = Buffer.concat(this.audioChunks);
    this.audioChunks = [];

    if (pcmData.length < 3200) {
      return { text: '', isFinal: true };
    }

    const wavBuffer = buildWav(pcmData, 16000, 1, 16);
    const apiKey = getApiKey('sarvam');
    if (!apiKey) throw new Error('Sarvam API key not configured. Add it in the KLIP panel.');

    const formData = new FormData();
    const arrayBuf = wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength) as ArrayBuffer;
    formData.append('file', new Blob([arrayBuf], { type: 'audio/wav' }), 'recording.wav');
    formData.append('model', 'saarika:v2.5');
    formData.append('language_code', 'unknown');

    const res = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: formData,
    });

    if (!res.ok) throw new Error(`Sarvam transcription error ${res.status}: ${await res.text()}`);
    const result = (await res.json()) as { transcript?: string };

    return { text: result.transcript ?? '', isFinal: true };
  }
}
