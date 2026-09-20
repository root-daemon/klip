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
  /\b(click|open|launch|start|close|point|show me|find (the|my)|type|fill in|write|draft|paste|select|choose|pick|navigate|go to|switch to|focus|scroll|drag|press|hit|tap|enter|toggle|check|uncheck|expand|collapse|minimize|maximize)\b/i;

const LOCATION_QUESTIONS =
  /\bwhere('?s| is| are)\b.*\b(button|icon|link|field|menu|tab|option|setting|toggle|checkbox|panel)\b/i;

const HOW_TO_PATTERN = /\bhow (do|can) i\b/i;

/**
 * Computer use is intentionally narrower than the existing desktop mode.
 * "Where is Save?" should keep using the non-invasive pointing companion;
 * only a direct request to operate the desktop can enter the approval loop.
 */
const COMPUTER_USE_VERBS =
  /\b(click|open|launch|start|close|type|fill in|write|paste|select|choose|pick|navigate|go to|switch to|focus|scroll|drag|press|hit|tap|enter|toggle|check|uncheck|expand|collapse|minimize|maximize|save|download|upload)\b/i;

export function classifyIntent(transcript: string): ActiveSpecialist {
  const text = transcript.trim();
  if (!text) return 'conversation';
  if (ACTION_VERBS.test(text) || LOCATION_QUESTIONS.test(text) || HOW_TO_PATTERN.test(text)) {
    return 'desktop';
  }
  return 'conversation';
}

/**
 * A second, stricter heuristic on top of classifyIntent: does this
 * request need to actually SEE the result of one action before deciding
 * the next ("check my mail and reply to the newest one"), rather than a
 * single guessable action from one screenshot ("click the save button")?
 * The former needs the real multi-step computer-use agent loop
 * (computer-use-agent.ts); the latter is well served by the existing
 * one-shot [POINT:...]/[CLICK:...] tags and shouldn't pay for a slower,
 * more expensive multi-round-trip loop it doesn't need.
 *
 * Heuristic, not a model call, for the same reason classifyIntent is:
 * a false negative just falls back to the cheaper single-shot path
 * (still useful), and a false positive costs one extra confirmation
 * round trip at worst — neither failure mode is silent or damaging.
 */
const SEQUENCE_WORDS = /\b(then|after that|once (you|that)|next,|and then)\b/i;
const APP_OR_SITE_MENTION =
  /\b(gmail|outlook|inbox|mail|email|chrome|firefox|edge|browser|website|webpage|google|youtube|amazon|maps|calendar|slack|notion|spotify)\b/i;
const MULTI_STEP_VERBS =
  /\b(search|navigate|go to|log ?in|sign ?in|browse|book|order|buy|watch|play|download|compose|reply|forward|fill out|fill in the form|check my|look up|find (a|some|the)\b.*\bon\b)\b/gi;

export function isComplexDesktopTask(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return false;
  const verbMatches = text.match(MULTI_STEP_VERBS) ?? [];
  const hasSequencing = SEQUENCE_WORDS.test(text);
  const mentionsAppOrSite = APP_OR_SITE_MENTION.test(text);
  // Needs at least one multi-step-flavored verb, plus a second signal
  // (sequencing language, a named app/site, or a second verb) so a
  // simple "search for the settings icon" doesn't trigger the full loop.
  return verbMatches.length >= 2 || (verbMatches.length >= 1 && (hasSequencing || mentionsAppOrSite));
}

/** A direct request to operate the desktop enters the dedicated tool loop. */
export function isComputerUseIntent(transcript: string): boolean {
  return COMPUTER_USE_VERBS.test(transcript.trim());
}
