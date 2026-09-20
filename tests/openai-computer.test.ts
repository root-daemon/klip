import { describe, expect, test } from 'bun:test';
import {
  OpenAIComputerPlanner,
  OPENAI_COMPUTER_MODEL,
  type OpenAIFetch,
} from '../src/main/services/openai-computer';
import type { ComputerActionPlannerInput } from '../src/main/services/computer-use';

const screenInput: ComputerActionPlannerInput = {
  instruction: 'Search for penguin',
  observation: {
    id: 'desktop-1',
    capturedAt: 1_000,
    screens: [{
      displayId: 1,
      imageWidth: 800,
      imageHeight: 600,
      displayBounds: { x: 0, y: 0, width: 1600, height: 1200 },
      dataBase64: 'encoded-screen',
    }],
  },
  previousActions: [],
};

function response(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenAIComputerPlanner', () => {
  test('uses the cost-optimized native Computer Use model', () => {
    expect(OPENAI_COMPUTER_MODEL).toBe('gpt-5.6-luna');
  });

  test('returns OpenAI computer actions in order and refreshes the model with a screenshot after a batch', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const responses = [
      response({
        id: 'resp_initial',
        output: [{
          type: 'computer_call',
          call_id: 'call_screenshot',
          actions: [{ type: 'screenshot' }],
          status: 'completed',
        }],
      }),
      response({
        id: 'resp_actions',
        output: [{
          type: 'computer_call',
          call_id: 'call_actions',
          actions: [
            { type: 'click', button: 'left', x: 400, y: 160 },
            { type: 'type', text: 'penguin' },
          ],
          status: 'completed',
        }],
      }),
      response({ id: 'resp_done', output_text: 'Search complete.', output: [] }),
    ];
    const fetch: OpenAIFetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const next = responses.shift();
      if (!next) throw new Error('Unexpected Responses API request');
      return next;
    };
    const planner = new OpenAIComputerPlanner({ getApiKey: () => 'test-key', fetch });

    const first = await planner.decide(screenInput);
    expect(first).toEqual({
      type: 'click',
      button: 'left',
      screenIndex: 0,
      x: 500,
      y: 267,
      description: 'Click at 400, 160',
    });

    const second = await planner.decide({
      ...screenInput,
      previousActions: [{ action: first, observationId: 'desktop-2', completedAt: 1_100 }],
    });
    expect(second).toEqual({ type: 'type', text: 'penguin', description: 'Type 7 characters' });

    const finished = await planner.decide({
      ...screenInput,
      previousActions: [
        { action: first, observationId: 'desktop-2', completedAt: 1_100 },
        { action: second, observationId: 'desktop-3', completedAt: 1_200 },
      ],
    });
    expect(finished).toEqual({
      type: 'finish',
      description: 'OpenAI computer task finished',
      summary: 'Search complete.',
    });

    expect(requests[0]).toMatchObject({
      model: OPENAI_COMPUTER_MODEL,
      tools: [{ type: 'computer' }],
    });
    expect(requests[1]).toMatchObject({
      model: OPENAI_COMPUTER_MODEL,
      previous_response_id: 'resp_initial',
      input: [{
        type: 'computer_call_output',
        call_id: 'call_screenshot',
        output: {
          type: 'computer_screenshot',
          image_url: 'data:image/jpeg;base64,encoded-screen',
          detail: 'original',
        },
      }],
    });
    expect(requests[2]).toMatchObject({
      previous_response_id: 'resp_actions',
      input: [{ type: 'computer_call_output', call_id: 'call_actions' }],
    });
  });

  test('maps OpenAI keypresses and explicit cursor moves to local actions', async () => {
    const fetch: OpenAIFetch = async () => response({
      id: 'resp_actions',
      output: [{
        type: 'computer_call',
        call_id: 'call_actions',
        actions: [
          { type: 'keypress', keys: ['META', 'L'] },
          { type: 'move', x: 80, y: 300 },
        ],
      }],
    });
    const planner = new OpenAIComputerPlanner({ getApiKey: () => 'test-key', fetch });

    await expect(planner.decide(screenInput)).resolves.toEqual({
      type: 'key',
      keys: ['META', 'L'],
      description: 'Press META + L',
    });
    await expect(planner.decide({
      ...screenInput,
      previousActions: [{
        action: { type: 'key', keys: ['META', 'L'], description: 'Press META + L' },
        observationId: 'desktop-2',
        completedAt: 1_100,
      }],
    })).resolves.toEqual({
      type: 'move',
      screenIndex: 0,
      x: 100,
      y: 500,
      description: 'Move to 80, 300',
    });
  });
});
