import { getApiKey } from './key-store';
import { normalizeSarvamSpeaker, SARVAM_TTS_MODEL } from '../../shared/sarvam';

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

export interface SarvamTtsOptions {
  speaker: string;
  /** BCP-47-ish language code Sarvam expects, e.g. 'en-IN', 'hi-IN'. */
  languageCode?: string;
}

/**
 * Sarvam AI (Bulbul v3) text-to-speech. Returns base64 WAV audio per
 * their response contract; decoded to a Buffer here so the caller can
 * treat it identically to the ElevenLabs MP3 buffer.
 */
export class SarvamTTS {
  async synthesize(text: string, options: SarvamTtsOptions): Promise<Buffer> {
    const apiKey = getApiKey('sarvam');
    if (!apiKey) {
      throw new Error('Sarvam API key not configured. Add it in the KLIP panel.');
    }

    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text,
        target_language_code: options.languageCode ?? 'en-IN',
        speaker: normalizeSarvamSpeaker(options.speaker),
        model: SARVAM_TTS_MODEL,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam TTS error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as { audios?: string[] };
    const audioB64 = data.audios?.[0];
    if (!audioB64) throw new Error('Sarvam TTS returned no audio.');
    return Buffer.from(audioB64, 'base64');
  }
}
