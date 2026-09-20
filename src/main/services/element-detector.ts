import type { ScreenCapture, DetectedElement, Walkthrough, WalkthroughStep } from '../../shared/types';

/** Regex used to find every [TYPE:...] tag in a model response. */
const TYPE_TAG_REGEX = /\[TYPE:((?:[^\]\\]|\\.)+)\]/g;

/** [EXCEL:filename.xlsx|csv rows] and [PDF:filename.pdf|body text] — see
 *  document-generator.ts for how the body is turned into a real file. */
const EXCEL_TAG_REGEX = /\[EXCEL:([^|\]]+)\|((?:[^\]\\]|\\.)+)\]/g;
const PDF_TAG_REGEX = /\[PDF:([^|\]]+)\|((?:[^\]\\]|\\.)+)\]/g;

/** [SCROLL:up|down:amount] — scrolls at wherever the OS cursor currently
 *  is (typically wherever a preceding [CLICK:...] just landed it). */
const SCROLL_TAG_REGEX = /\[SCROLL:(up|down):(\d+)\]/gi;

/** Regex that matches every tag type, used to strip them from text we
 *  feed to TTS / chat history / display. */
export const TAG_STRIP_REGEX = /\[(?:POINT|CLICK|TYPE):[^\]]+\]|\[SCROLL:[^\]]+\]|\[(?:EXCEL|PDF):[^|\]]+\|(?:[^\]\\]|\\.)+\]/g;

export interface ScrollRequest {
  direction: 'up' | 'down';
  amount: number;
}

/** Parses every [SCROLL:...] tag, in the order they appeared. */
export function parseScrollTags(responseText: string): ScrollRequest[] {
  SCROLL_TAG_REGEX.lastIndex = 0;
  const out: ScrollRequest[] = [];
  let m: RegExpExecArray | null;
  while ((m = SCROLL_TAG_REGEX.exec(responseText)) !== null) {
    out.push({ direction: m[1].toLowerCase() as 'up' | 'down', amount: parseInt(m[2], 10) });
  }
  return out;
}

/**
 * The model is told never to use markdown, but sometimes slips into
 * bold/italic emphasis markup anyway. The chat/stream UI now renders
 * that properly (see renderInlineMarkdown), but TTS should speak the
 * words, not "asterisk asterisk" — this is speech-only; chat history
 * keeps the original text so the UI still has something to render.
 */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');
}

export interface DocumentRequest {
  kind: 'excel' | 'pdf';
  filename: string;
  body: string;
}

/** Parses every [EXCEL:...] / [PDF:...] tag in a model response, in the
 *  order they appeared. */
export function parseDocumentTags(responseText: string): DocumentRequest[] {
  const out: DocumentRequest[] = [];
  for (const [regex, kind] of [[EXCEL_TAG_REGEX, 'excel'], [PDF_TAG_REGEX, 'pdf']] as const) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(responseText)) !== null) {
      out.push({ kind, filename: m[1].trim(), body: m[2].replace(/\\(.)/g, '$1') });
    }
  }
  return out;
}

/**
 * Parse [TYPE:text] tags. Backslashes inside the text escape the next
 * character (so the model can include a literal `]` if it must), e.g.
 * [TYPE:hello\] world] → "hello] world".
 */
export function parseTypeTags(responseText: string): string[] {
  TYPE_TAG_REGEX.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TYPE_TAG_REGEX.exec(responseText)) !== null) {
    out.push(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

/**
 * Parse [POINT:x,y:label:screenN] and [CLICK:x,y:label:screenN] tags
 * from an LLM response, in the order they appeared, so a walkthrough
 * can interleave "look here" and "click here" steps correctly.
 *
 * Pixel coordinates inside the screenshot are mapped back to the
 * corresponding display's logical coordinate space using each capture's
 * recorded bounds, so points line up regardless of display scaling.
 */

const POINT_LIKE_TAG_REGEX = /\[(POINT|CLICK):(\d+),(\d+):([^:]+):screen(\d+)\]/g;

function pointToElement(
  match: RegExpExecArray,
  screenshots: ScreenCapture[],
): DetectedElement | null {
  const isClick = match[1] === 'CLICK';
  const pixelX = parseInt(match[2], 10);
  const pixelY = parseInt(match[3], 10);
  const label = match[4];
  const screenIndex = parseInt(match[5], 10);

  const screenshot = screenshots[screenIndex];
  if (!screenshot) return null;

  const scaleX = screenshot.displayBounds.width / screenshot.imageWidth;
  const scaleY = screenshot.displayBounds.height / screenshot.imageHeight;

  return {
    x: screenshot.displayBounds.x + pixelX * scaleX,
    y: screenshot.displayBounds.y + pixelY * scaleY,
    label,
    screenIndex,
    click: isClick,
  };
}

export function parseAllPointTags(
  responseText: string,
  screenshots: ScreenCapture[],
): Walkthrough | null {
  POINT_LIKE_TAG_REGEX.lastIndex = 0;
  const elements: DetectedElement[] = [];
  let match: RegExpExecArray | null;
  while ((match = POINT_LIKE_TAG_REGEX.exec(responseText)) !== null) {
    const el = pointToElement(match, screenshots);
    if (el) elements.push(el);
  }
  if (elements.length === 0) return null;

  const total = elements.length;
  const steps: WalkthroughStep[] = elements.map((el, i) => ({
    ...el,
    step: i + 1,
    total,
  }));
  return { steps };
}
