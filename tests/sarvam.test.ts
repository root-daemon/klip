import { expect, test } from 'bun:test';
import { PROBES, SARVAM_TTS_MODEL } from '../src/main/services/provider-probes';
import { SARVAM_DEFAULT_SPEAKER, normalizeSarvamSpeaker } from '../src/shared/sarvam';

test('Sarvam key validation uses the supported Bulbul v3 model', () => {
  expect(SARVAM_TTS_MODEL).toBe('bulbul:v3');
  const probe = PROBES.sarvam('test-key');
  expect(JSON.parse(probe.body ?? '{}')).toMatchObject({
    model: 'bulbul:v3',
    speaker: SARVAM_DEFAULT_SPEAKER,
  });
});

test('migrates retired Bulbul v2 speakers while preserving valid Bulbul v3 speakers', () => {
  expect(normalizeSarvamSpeaker('anushka')).toBe(SARVAM_DEFAULT_SPEAKER);
  expect(normalizeSarvamSpeaker('priya')).toBe('priya');
});
