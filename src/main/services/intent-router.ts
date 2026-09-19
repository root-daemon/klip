import type { ActiveSpecialist } from '../../shared/types';

/**
 * Local, zero-cost intent routing — decides which specialist prompt a
 * turn gets before any model call is made. This is deliberately a plain
 * heuristic rather than an extra LLM call: classifying "does the user
 * want something done on screen, or just an answer" almost always shows
 * up in the verbs they use, and a wrong guess here only costs a slightly
 * different system-prompt framing, not a wrong tool call — so it doesn't
 * need model-grade judgment to be useful.
 */

const ACTION_VERBS =
  /\b(click|open|close|point|show me|find (the|my)|type|fill in|write|draft|paste|select|choose|pick|navigate|go to|switch to|scroll|drag|press|hit|tap|enter|toggle|check|uncheck|expand|collapse|minimize|maximize)\b/i;

const LOCATION_QUESTIONS =
  /\bwhere('?s| is| are)\b.*\b(button|icon|link|field|menu|tab|option|setting|toggle|checkbox|panel)\b/i;

const HOW_TO_PATTERN = /\bhow (do|can) i\b/i;

export function classifyIntent(transcript: string): ActiveSpecialist {
  const text = transcript.trim();
  if (!text) return 'conversation';
  if (ACTION_VERBS.test(text) || LOCATION_QUESTIONS.test(text) || HOW_TO_PATTERN.test(text)) {
    return 'desktop';
  }
  return 'conversation';
}
