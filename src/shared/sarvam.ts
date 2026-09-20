/** Sarvam's current Bulbul TTS request contract. */
export const SARVAM_TTS_MODEL = 'bulbul:v3';

/** Speakers accepted by Bulbul v3. Keep requests and the picker in sync. */
export const SARVAM_BULBUL_V3_SPEAKERS = [
  'aditya', 'ritu', 'ashutosh', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
  'simran', 'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun',
  'manan', 'sumit', 'roopa', 'kabir', 'aayan', 'shubh', 'advait', 'anand',
  'tanya', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani',
  'mohit', 'kavitha', 'rehan', 'soham', 'rupali',
] as const;

export type SarvamBulbulV3Speaker = (typeof SARVAM_BULBUL_V3_SPEAKERS)[number];

/** A compatible voice used for new installs and retired-voice migrations. */
export const SARVAM_DEFAULT_SPEAKER: SarvamBulbulV3Speaker = 'priya';

export function isSarvamBulbulV3Speaker(value: string): value is SarvamBulbulV3Speaker {
  return (SARVAM_BULBUL_V3_SPEAKERS as readonly string[]).includes(value);
}

/** Never send a retired speaker id to Bulbul v3. */
export function normalizeSarvamSpeaker(value: string): SarvamBulbulV3Speaker {
  return isSarvamBulbulV3Speaker(value) ? value : SARVAM_DEFAULT_SPEAKER;
}
