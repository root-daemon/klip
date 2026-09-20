import { describe, expect, test } from 'bun:test';
import {
  ComputerUseController,
  type ComputerActionPlanner,
  type DesktopAdapter,
  type DesktopObservation,
} from '../src/main/services/computer-use';

const observation: DesktopObservation = {
  id: 'observation-1',
  capturedAt: 1_000,
  screens: [{
    displayId: 1,
    imageWidth: 1000,
    imageHeight: 800,
    displayBounds: { x: 0, y: 0, width: 1000, height: 800 },
  }],
};

function createDesktop(): DesktopAdapter & { clicks: Array<{ x: number; y: number }> } {
  const desktop: DesktopAdapter & { clicks: Array<{ x: number; y: number }> } = {
    clicks: [],
    observe: async () => observation,
    click: async (point) => {
      desktop.clicks.push(point);
    },
    move: async () => undefined,
    type: async () => undefined,
    key: async () => undefined,
    scroll: async () => undefined,
    drag: async () => undefined,
  };
  return desktop;
}

describe('ComputerUseController', () => {
  test('proposes a click without interacting with the desktop until the user approves it', async () => {
    const desktop = createDesktop();
    const planner: ComputerActionPlanner = {
      decide: async () => ({
        type: 'click',
        screenIndex: 0,
        x: 500,
        y: 250,
        description: 'Open settings',
      }),
    };
    const controller = new ComputerUseController({
      desktop,
      planner,
      now: () => 1_000,
    });

    const state = await controller.start('Open settings');

    expect(state.status).toBe('awaiting-approval');
    expect(state.proposal).toMatchObject({
      action: { type: 'click', description: 'Open settings' },
      observationId: 'observation-1',
      target: { x: 500, y: 200 },
    });
    expect(desktop.clicks).toEqual([]);
  });

  test('executes a direct computer-use request automatically when the host enables it', async () => {
    const desktop = createDesktop();
    let decisions = 0;
    const stateChanges: string[] = [];
    const planner: ComputerActionPlanner = {
      decide: async () => {
        decisions += 1;
        return decisions === 1
          ? { type: 'click', screenIndex: 0, x: 500, y: 250, description: 'Open settings' }
          : { type: 'finish', description: 'Settings opened', summary: 'Opened settings.' };
      },
    };
    const controller = new ComputerUseController({
      desktop,
      planner,
      autoApprove: true,
      onStateChange: (state) => stateChanges.push(state.status),
    });

    const state = await controller.start('Open settings');

    expect(desktop.clicks).toEqual([{ x: 500, y: 200 }]);
    expect(state).toMatchObject({ status: 'completed', summary: 'Opened settings.', completedActions: 1 });
    expect(stateChanges).toEqual(['planning', 'executing', 'planning', 'completed']);
  });

  test('prefers an accessibility element over visual coordinates and re-observes after approval', async () => {
    const desktop = createDesktop();
    desktop.observe = async () => ({
      ...observation,
      id: desktop.clicks.length === 0 ? 'before-click' : 'after-click',
      screens: [{
        ...observation.screens[0],
        elements: [{
          id: 'save-button',
          role: 'AXButton',
          label: 'Save',
          bounds: { x: 300, y: 400, width: 80, height: 40 },
        }],
      }],
    });
    let decisions = 0;
    const planner: ComputerActionPlanner = {
      decide: async () => {
        decisions += 1;
        return decisions === 1
          ? {
              type: 'click',
              elementId: 'save-button',
              // These stale visual coordinates must not win over the AX target.
              screenIndex: 0,
              x: 0,
              y: 0,
              description: 'Save the document',
            }
          : { type: 'finish', description: 'The save completed', summary: 'Saved.' };
      },
    };
    const controller = new ComputerUseController({ desktop, planner, now: () => 1_000 });

    const pending = await controller.start('Save this document');
    const state = await controller.approve(pending.proposal!.id);

    expect(desktop.clicks).toEqual([{ x: 340, y: 420 }]);
    expect(decisions).toBe(2);
    expect(state).toMatchObject({ status: 'completed', summary: 'Saved.', completedActions: 1 });
  });

  test('blocks approval when the foreground window changed after the proposal', async () => {
    const desktop = createDesktop();
    let observations = 0;
    desktop.observe = async () => ({
      ...observation,
      id: `observation-${observations++}`,
      foregroundWindow: { id: observations === 1 ? 'com.example.editor:document' : 'com.example.chat:message' },
    });
    const planner: ComputerActionPlanner = {
      decide: async () => ({ type: 'click', screenIndex: 0, x: 500, y: 500, description: 'Save the document' }),
    };
    const controller = new ComputerUseController({ desktop, planner, now: () => 1_000 });

    const pending = await controller.start('Save this document');
    const state = await controller.approve(pending.proposal!.id);

    expect(state.status).toBe('blocked');
    expect(state.error).toContain('foreground window changed');
    expect(desktop.clicks).toEqual([]);
  });

  test('rejects only the pending proposal and never sends desktop input', async () => {
    const desktop = createDesktop();
    const planner: ComputerActionPlanner = {
      decide: async () => ({ type: 'click', screenIndex: 0, x: 500, y: 500, description: 'Open settings' }),
    };
    const controller = new ComputerUseController({ desktop, planner, now: () => 1_000 });

    const pending = await controller.start('Open settings');
    const state = controller.reject(pending.proposal!.id);

    expect(state.status).toBe('cancelled');
    expect(desktop.clicks).toEqual([]);
  });
});
