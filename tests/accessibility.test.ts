import { describe, expect, test } from 'bun:test';
import { parseAccessibilitySnapshot } from '../src/main/services/accessibility';

describe('accessibility snapshot parsing', () => {
  test('retains only usable semantic targets and never exposes an element value', () => {
    const snapshot = parseAccessibilitySnapshot(JSON.stringify({
      foregroundWindow: {
        id: 'com.example.editor:proposal',
        title: 'Proposal',
        owner: 'Editor',
        bounds: { x: 20, y: 40, width: 900, height: 600 },
      },
      elements: [
        {
          id: 'save',
          role: 'AXButton',
          label: 'Save',
          enabled: true,
          value: 'this must not be surfaced',
          bounds: { x: 400, y: 500, width: 80, height: 30 },
        },
        { id: 'bad', role: 'AXButton', label: 'Invisible', bounds: { x: 1, y: 1, width: 0, height: 0 } },
      ],
    }));

    expect(snapshot.foregroundWindow).toMatchObject({ id: 'com.example.editor:proposal', owner: 'Editor' });
    expect(snapshot.elements).toEqual([{
      id: 'save',
      role: 'AXButton',
      label: 'Save',
      enabled: true,
      bounds: { x: 400, y: 500, width: 80, height: 30 },
    }]);
  });
});
