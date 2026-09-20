import type { ReactNode } from 'react';

/**
 * Klip's system prompt tells the model never to use markdown, but voice
 * models slip into bold/italic emphasis markup anyway. Rather than
 * fight that, render the common inline forms properly instead of
 * showing the literal asterisks/backticks — full markdown (lists,
 * links, headers) isn't needed for short spoken replies, so a small
 * hand-rolled inline parser is enough and avoids pulling in a markdown
 * dependency.
 */
const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

export function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
