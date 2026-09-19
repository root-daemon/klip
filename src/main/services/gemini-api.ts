import type {
  ConversationTurn,
  ScreenCapture,
  GeminiModel,
  ReasoningDepth,
  ReplyTone,
} from '../../shared/types';
import { getApiKey } from './key-store';
import { buildSystemPrompt } from './prompts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini 2.5's "thinking budget", in tokens. 0 disables thinking on
 *  Flash; Pro always thinks at least a little regardless of budget. */
const THINKING_BUDGETS: Record<ReasoningDepth, number> = {
  off: 0,
  medium: 4000,
  deep: 16000,
};

export interface GeminiStreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string, usage?: { inputTokens: number; outputTokens: number }) => void;
  onError: (error: Error) => void;
}

export interface GeminiChatOptions {
  reasoningDepth: ReasoningDepth;
  replyTone: ReplyTone;
  signal?: AbortSignal;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export class GeminiAPI {
  async streamChat(
    prompt: string,
    screenshots: ScreenCapture[],
    history: ConversationTurn[],
    model: GeminiModel,
    options: GeminiChatOptions,
    callbacks: GeminiStreamCallbacks,
  ): Promise<void> {
    const apiKey = getApiKey('gemini');
    if (!apiKey) {
      callbacks.onError(new Error('Gemini API key not configured. Add it in the KLIP panel.'));
      return;
    }

    const systemPrompt = buildSystemPrompt(options.replyTone, { hasWebSearch: true });

    const imageParts: GeminiPart[] = [];
    screenshots.forEach((sc, i) => {
      imageParts.push({
        text: `[screen${i}] image is ${sc.imageWidth}x${sc.imageHeight} pixels. top-left is (0,0), bottom-right is (${sc.imageWidth},${sc.imageHeight}). use these pixel coordinates for POINT tags.${sc.isCursorScreen ? ' (this is the active screen — user cursor is here)' : ''}`,
      });
      imageParts.push({ inline_data: { mime_type: 'image/jpeg', data: sc.dataBase64 } });
    });

    const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
    for (const turn of history) {
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      });
    }
    contents.push({ role: 'user', parts: [...imageParts, { text: prompt }] });

    const thinkingBudget = THINKING_BUDGETS[options.reasoningDepth];
    const requestBody: Record<string, unknown> = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: thinkingBudget > 0 ? thinkingBudget + 1024 : 1024,
        ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}),
      },
      // Grounding with Google Search — Gemini's equivalent of Claude's
      // web_search tool. The model decides when to invoke it.
      tools: [{ google_search: {} }],
    };

    const url = `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const parts = event?.candidates?.[0]?.content?.parts as GeminiPart[] | undefined;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  fullText += part.text;
                  callbacks.onChunk(part.text);
                }
              }
            }
            if (event?.usageMetadata) {
              inputTokens = event.usageMetadata.promptTokenCount ?? inputTokens;
              outputTokens = event.usageMetadata.candidatesTokenCount ?? outputTokens;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      callbacks.onComplete(fullText, { inputTokens, outputTokens });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || options.signal?.aborted)) {
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
