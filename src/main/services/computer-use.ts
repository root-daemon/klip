import { randomUUID } from 'crypto';

/**
 * The screen-aware action core intentionally has no Electron or model-provider
 * dependency. That makes this the one public seam for both real desktop
 * adapters and the fake adapter used by its tests.
 */

export interface DesktopPoint {
  x: number;
  y: number;
}

export interface DesktopBounds extends DesktopPoint {
  width: number;
  height: number;
}

/** An element supplied by a platform accessibility adapter. */
export interface AccessibleElement {
  /** Stable only for the observation that returned it. */
  id: string;
  role: string;
  label: string;
  bounds: DesktopBounds;
  enabled?: boolean;
}

export interface DesktopScreen {
  displayId: number;
  imageWidth: number;
  imageHeight: number;
  displayBounds: DesktopBounds;
  /** Base64 JPEG sent to the planner. Deliberately omitted in unit tests. */
  dataBase64?: string;
  elements?: AccessibleElement[];
}

export interface ForegroundWindow {
  /** Platform-specific identity, when the adapter can obtain one. */
  id: string;
  title?: string;
  owner?: string;
  bounds?: DesktopBounds;
}

export interface DesktopObservation {
  id: string;
  capturedAt: number;
  screens: DesktopScreen[];
  foregroundWindow?: ForegroundWindow;
}

/**
 * Coordinates are normalized to the image the model received: 0..1000 on
 * each axis. The controller, not a model, performs the final DPI conversion.
 */
export type NormalizedCoordinate = number;
export type DesktopMouseButton = 'left' | 'right' | 'middle';

export type ComputerAction =
  | {
      type: 'click' | 'double_click';
      button?: DesktopMouseButton;
      screenIndex?: number;
      x?: NormalizedCoordinate;
      y?: NormalizedCoordinate;
      /** Modifiers held only while the pointer action runs. */
      keys?: string[];
      /** Preferred hybrid target. Resolved against the current observation. */
      elementId?: string;
      description: string;
      expected?: string;
    }
  | {
      type: 'type';
      text: string;
      description: string;
      expected?: string;
    }
  | {
      type: 'key';
      keys: string[];
      description: string;
      expected?: string;
    }
  | {
      type: 'scroll';
      screenIndex?: number;
      x?: NormalizedCoordinate;
      y?: NormalizedCoordinate;
      keys?: string[];
      deltaX?: number;
      deltaY: number;
      description: string;
      expected?: string;
    }
  | {
      type: 'drag';
      screenIndex?: number;
      x?: NormalizedCoordinate;
      y?: NormalizedCoordinate;
      toX: NormalizedCoordinate;
      toY: NormalizedCoordinate;
      elementId?: string;
      keys?: string[];
      description: string;
      expected?: string;
    }
  | {
      type: 'move';
      screenIndex: number;
      x: NormalizedCoordinate;
      y: NormalizedCoordinate;
      keys?: string[];
      description: string;
      expected?: string;
    }
  | {
      type: 'wait';
      milliseconds: number;
      description: string;
      expected?: string;
    }
  | {
      type: 'finish';
      summary: string;
      description: string;
    };

export interface DesktopAdapter {
  observe(): Promise<DesktopObservation>;
  click(point: DesktopPoint, options?: { doubleClick?: boolean; button?: DesktopMouseButton; keys?: string[] }): Promise<void>;
  move(point: DesktopPoint, options?: { keys?: string[] }): Promise<void>;
  type(text: string): Promise<void>;
  key(keys: string[]): Promise<void>;
  scroll(deltaY: number, at?: DesktopPoint, options?: { keys?: string[]; deltaX?: number }): Promise<void>;
  drag(from: DesktopPoint, to: DesktopPoint, options?: { keys?: string[] }): Promise<void>;
}

export interface ComputerActionPlannerInput {
  instruction: string;
  observation: DesktopObservation;
  previousActions: ReadonlyArray<ComputerActionRecord>;
}

/** A provider adapter returns exactly one structured next action. */
export interface ComputerActionPlanner {
  decide(input: ComputerActionPlannerInput): Promise<ComputerAction>;
  /** Discard model-side session state when the person stops a desktop run. */
  reset?(): void;
}

export interface ComputerActionRecord {
  action: ComputerAction;
  observationId: string;
  completedAt: number;
}

export type ComputerUseStatus =
  | 'idle'
  | 'planning'
  | 'awaiting-approval'
  | 'executing'
  | 'completed'
  | 'cancelled'
  | 'blocked'
  | 'error';

export interface ComputerActionProposal {
  id: string;
  observationId: string;
  action: Exclude<ComputerAction, { type: 'finish' }>;
  /** Where the companion and OS cursor will travel for pointer actions. */
  target?: DesktopPoint;
  /** A concise warning visible in the approval UI. */
  approvalMessage: string;
  expiresAt: number;
}

export interface ComputerUseState {
  status: ComputerUseStatus;
  instruction?: string;
  proposal?: ComputerActionProposal;
  summary?: string;
  error?: string;
  completedActions: number;
}

export interface ComputerUsePolicyDecision {
  allowed: boolean;
  reason?: string;
  /** All desktop input actions currently need an explicit confirmation. */
  requiresApproval: boolean;
}

const MAX_ACTIONS = 15;
const MAX_ACTION_AGE_MS = 20_000;
const MAX_TYPE_CHARS = 4_000;

/**
 * This is deliberately conservative. A screenshot cannot prove that a click
 * is harmless, so every input action has a human approval gate. The policy
 * also rejects malformed or unsafe-shaped actions before the desktop adapter
 * ever sees them.
 */
export function evaluateComputerAction(
  action: ComputerAction,
  observation: DesktopObservation,
): ComputerUsePolicyDecision {
  if (action.type === 'finish') return { allowed: true, requiresApproval: false };

  if (!action.description.trim() || action.description.length > 160) {
    return { allowed: false, requiresApproval: false, reason: 'Action needs a short, human-readable description.' };
  }

  if (action.type === 'type') {
    if (!action.text || action.text.length > MAX_TYPE_CHARS) {
      return { allowed: false, requiresApproval: false, reason: 'Typed text must be between 1 and 4,000 characters.' };
    }
    return { allowed: true, requiresApproval: true };
  }

  if (action.type === 'key') {
    if (!validKeys(action.keys)) {
      return { allowed: false, requiresApproval: false, reason: 'Keyboard action contains unsupported keys.' };
    }
    return { allowed: true, requiresApproval: true };
  }

  if (action.type === 'wait') {
    if (!Number.isInteger(action.milliseconds) || action.milliseconds < 50 || action.milliseconds > 10_000) {
      return { allowed: false, requiresApproval: false, reason: 'Wait must be between 50ms and 10 seconds.' };
    }
    return { allowed: true, requiresApproval: true };
  }

  if (action.type === 'scroll' && (
    !Number.isInteger(action.deltaY)
    || !Number.isInteger(action.deltaX ?? 0)
    || (action.deltaY === 0 && (action.deltaX ?? 0) === 0)
    || Math.abs(action.deltaY) > 5_000
    || Math.abs(action.deltaX ?? 0) > 5_000
  )) {
    return { allowed: false, requiresApproval: false, reason: 'Scroll amount is outside the safe range.' };
  }

  if ('keys' in action && action.keys && !validKeys(action.keys)) {
    return { allowed: false, requiresApproval: false, reason: 'Pointer action contains unsupported modifier keys.' };
  }

  if ((action.type === 'click' || action.type === 'double_click') && action.button && !['left', 'right', 'middle'].includes(action.button)) {
    return { allowed: false, requiresApproval: false, reason: 'Mouse action contains an unsupported button.' };
  }

  const target = resolveActionPoint(action, observation);
  if (!target) {
    return { allowed: false, requiresApproval: false, reason: 'Action target is not present in the current screen observation.' };
  }

  if (action.type === 'drag') {
    const to = resolveNormalizedPoint(action.screenIndex, action.toX, action.toY, observation);
    if (!to) return { allowed: false, requiresApproval: false, reason: 'Drag destination is outside the current screen observation.' };
  }

  return { allowed: true, requiresApproval: true };
}

/** Public because provider adapters must reject malformed tool arguments. */
export function parseComputerAction(value: unknown): ComputerAction {
  if (!isRecord(value) || typeof value.type !== 'string') throw new Error('Computer action must include a type.');
  const description = string(value.description, 'description');
  const expected = optionalString(value.expected, 'expected');

  switch (value.type) {
    case 'click':
    case 'double_click':
      return {
        type: value.type,
        ...parseTarget(value),
        ...parsePointerOptions(value),
        description,
        ...(expected ? { expected } : {}),
      };
    case 'type':
      return { type: 'type', text: string(value.text, 'text'), description, ...(expected ? { expected } : {}) };
    case 'key':
      if (!Array.isArray(value.keys) || !value.keys.every((key) => typeof key === 'string')) {
        throw new Error('Keyboard action must include keys.');
      }
      return { type: 'key', keys: value.keys, description, ...(expected ? { expected } : {}) };
    case 'scroll':
      return {
        type: 'scroll',
        ...parseOptionalTarget(value),
        ...parsePointerOptions(value),
        ...(value.deltaX === undefined ? {} : { deltaX: integer(value.deltaX, 'deltaX') }),
        deltaY: integer(value.deltaY, 'deltaY'),
        description,
        ...(expected ? { expected } : {}),
      };
    case 'drag':
      return {
        type: 'drag',
        ...parseTarget(value),
        toX: coordinate(value.toX, 'toX'),
        toY: coordinate(value.toY, 'toY'),
        ...parsePointerOptions(value),
        description,
        ...(expected ? { expected } : {}),
      };
    case 'wait':
      return { type: 'wait', milliseconds: integer(value.milliseconds, 'milliseconds'), description, ...(expected ? { expected } : {}) };
    case 'move':
      return {
        type: 'move',
        screenIndex: integer(value.screenIndex, 'screenIndex'),
        x: coordinate(value.x, 'x'),
        y: coordinate(value.y, 'y'),
        ...parsePointerOptions(value),
        description,
        ...(expected ? { expected } : {}),
      };
    case 'finish':
      return { type: 'finish', summary: string(value.summary, 'summary'), description };
    default:
      throw new Error(`Unsupported computer action: ${value.type}`);
  }
}

interface Session {
  id: string;
  instruction: string;
  completed: ComputerActionRecord[];
  observation: DesktopObservation;
  proposal?: ComputerActionProposal;
}

export class ComputerUseController {
  private session: Session | null = null;
  private state: ComputerUseState = { status: 'idle', completedActions: 0 };
  private readonly now: () => number;

  constructor(
    private readonly dependencies: {
      desktop: DesktopAdapter;
      planner: ComputerActionPlanner;
      /**
       * A computer-use request is an explicit instruction to operate the
       * desktop. When enabled, execute the model's bounded, validated action
       * sequence without opening a native confirmation dialog for every
       * single click. The usual observation, foreground-window, action-cap,
       * and permission checks still apply.
       */
      autoApprove?: boolean;
      /** Let the on-screen companion visibly arrive before real pointer input. */
      autoApprovalPreviewMs?: number;
      now?: () => number;
      onStateChange?: (state: ComputerUseState) => void;
    },
  ) {
    this.now = dependencies.now ?? Date.now;
  }

  getState(): ComputerUseState {
    return this.state;
  }

  async start(instruction: string): Promise<ComputerUseState> {
    if (!instruction.trim()) return this.setState({ status: 'error', error: 'Tell KLIP what to do first.', completedActions: 0 });
    const observation = await this.dependencies.desktop.observe();
    this.session = { id: randomUUID(), instruction, completed: [], observation };
    return this.planNext();
  }

  async approve(proposalId: string, previewMs = 0): Promise<ComputerUseState> {
    const session = this.session;
    const proposal = session?.proposal;
    if (!session || !proposal || proposal.id !== proposalId) {
      return this.setState({ status: 'blocked', error: 'That computer action is no longer pending.', completedActions: session?.completed.length ?? 0 });
    }
    if (this.now() > proposal.expiresAt) {
      session.proposal = undefined;
      return this.setState({ status: 'blocked', error: 'That screen observation is stale. Ask KLIP to inspect the screen again.', completedActions: session.completed.length });
    }

    // The confirmation dialog itself can give the user enough time to switch
    // apps. Re-observe immediately before input and never send a click or
    // keystroke to a different foreground window than the one we showed in
    // the proposal.
    let currentObservation: DesktopObservation;
    try {
      currentObservation = await this.dependencies.desktop.observe();
    } catch (err) {
      session.proposal = undefined;
      return this.setState({
        status: 'blocked',
        error: `Could not re-check the desktop before acting: ${err instanceof Error ? err.message : String(err)}`,
        completedActions: session.completed.length,
      });
    }
    const proposedWindow = session.observation.foregroundWindow?.id;
    const currentWindow = currentObservation.foregroundWindow?.id;
    if (proposedWindow && proposedWindow !== currentWindow) {
      session.proposal = undefined;
      return this.setState({
        status: 'blocked',
        error: 'The foreground window changed after approval was requested. Inspect the screen again before continuing.',
        completedActions: session.completed.length,
      });
    }

    const decision = evaluateComputerAction(proposal.action, currentObservation);
    if (!decision.allowed) {
      session.proposal = undefined;
      return this.setState({ status: 'blocked', error: decision.reason, completedActions: session.completed.length });
    }

    this.setState({ status: 'executing', instruction: session.instruction, proposal, completedActions: session.completed.length });
    try {
      if (previewMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, previewMs));
        // Starting a new voice turn or disabling Computer Use cancels the
        // controller while the companion is travelling. Never let an
        // already-scheduled action reach the desktop after that cancellation.
        if (this.session !== session || session.proposal?.id !== proposal.id) return this.state;
      }
      await this.execute(proposal.action, currentObservation);
      session.completed.push({ action: proposal.action, observationId: currentObservation.id, completedAt: this.now() });
      session.proposal = undefined;
      if (session.completed.length >= MAX_ACTIONS) {
        return this.setState({ status: 'blocked', error: `Stopped after ${MAX_ACTIONS} actions. Review the screen and continue with a new request.`, completedActions: session.completed.length });
      }
      session.observation = await this.dependencies.desktop.observe();
      return this.planNext();
    } catch (err) {
      session.proposal = undefined;
      return this.setState({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        completedActions: session.completed.length,
      });
    }
  }

  cancel(): ComputerUseState {
    const completedActions = this.session?.completed.length ?? 0;
    this.session = null;
    this.dependencies.planner.reset?.();
    return this.setState({ status: 'cancelled', completedActions });
  }

  /** Reject a specific approval card. A stale dialog cannot cancel a newer run. */
  reject(proposalId: string): ComputerUseState {
    const session = this.session;
    if (!session?.proposal || session.proposal.id !== proposalId) {
      return this.setState({ status: 'blocked', error: 'That computer action is no longer pending.', completedActions: session?.completed.length ?? 0 });
    }
    const completedActions = session.completed.length;
    this.session = null;
    this.dependencies.planner.reset?.();
    return this.setState({ status: 'cancelled', completedActions });
  }

  private async planNext(): Promise<ComputerUseState> {
    const session = this.session;
    if (!session) return this.setState({ status: 'cancelled', completedActions: 0 });
    this.setState({ status: 'planning', instruction: session.instruction, completedActions: session.completed.length });

    try {
      const rawAction = await this.dependencies.planner.decide({
        instruction: session.instruction,
        observation: session.observation,
        previousActions: session.completed,
      });
      const action = parseComputerAction(rawAction);
      const decision = evaluateComputerAction(action, session.observation);
      if (!decision.allowed) {
        return this.setState({ status: 'blocked', error: decision.reason, completedActions: session.completed.length });
      }
      if (action.type === 'finish') {
        return this.setState({ status: 'completed', instruction: session.instruction, summary: action.summary, completedActions: session.completed.length });
      }

      const target = resolveActionPoint(action, session.observation);
      const proposal: ComputerActionProposal = {
        id: randomUUID(),
        observationId: session.observation.id,
        action,
        ...(target ? { target } : {}),
        approvalMessage: approvalMessage(action),
        expiresAt: this.now() + MAX_ACTION_AGE_MS,
      };
      session.proposal = proposal;
      if (this.dependencies.autoApprove) {
        // Do not emit an `awaiting-approval` state here: index.ts maps that
        // state to Electron's blocking native dialog. The request came from
        // the user's own direct voice command, so the enabled Computer Use
        // setting is the consent boundary; the controller still validates,
        // re-observes the foreground app, and limits every run to 15 steps.
        return this.approve(proposal.id, this.dependencies.autoApprovalPreviewMs ?? 0);
      }
      return this.setState({ status: 'awaiting-approval', instruction: session.instruction, proposal, completedActions: session.completed.length });
    } catch (err) {
      return this.setState({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        completedActions: session.completed.length,
      });
    }
  }

  private async execute(action: Exclude<ComputerAction, { type: 'finish' }>, observation: DesktopObservation): Promise<void> {
    switch (action.type) {
      case 'click':
      case 'double_click': {
        const point = requiredPoint(action, observation);
        await this.dependencies.desktop.click(point, {
          doubleClick: action.type === 'double_click',
          ...(action.button ? { button: action.button } : {}),
          ...(action.keys ? { keys: action.keys } : {}),
        });
        return;
      }
      case 'move': {
        const point = requiredPoint(action, observation);
        await this.dependencies.desktop.move(point, action.keys ? { keys: action.keys } : undefined);
        return;
      }
      case 'type':
        await this.dependencies.desktop.type(action.text);
        return;
      case 'key':
        await this.dependencies.desktop.key(action.keys);
        return;
      case 'scroll':
        await this.dependencies.desktop.scroll(
          action.deltaY,
          resolveActionPoint(action, observation) ?? undefined,
          action.keys || action.deltaX ? { ...(action.keys ? { keys: action.keys } : {}), ...(action.deltaX ? { deltaX: action.deltaX } : {}) } : undefined,
        );
        return;
      case 'drag': {
        const from = requiredPoint(action, observation);
        const to = resolveNormalizedPoint(action.screenIndex, action.toX, action.toY, observation);
        if (!to) throw new Error('Drag destination is no longer available.');
        await this.dependencies.desktop.drag(from, to, action.keys ? { keys: action.keys } : undefined);
        return;
      }
      case 'wait':
        await new Promise<void>((resolve) => setTimeout(resolve, action.milliseconds));
        return;
    }
  }

  private setState(state: ComputerUseState): ComputerUseState {
    this.state = state;
    this.dependencies.onStateChange?.(state);
    return state;
  }
}

function approvalMessage(action: Exclude<ComputerAction, { type: 'finish' }>): string {
  switch (action.type) {
    case 'type':
      return `Type ${action.text.length} character${action.text.length === 1 ? '' : 's'} into the focused field`;
    case 'key':
      return `Press ${action.keys.join(' + ')}`;
    case 'scroll':
      return `Scroll ${action.deltaY > 0 ? 'down' : 'up'}`;
    case 'drag':
      return 'Drag the selected item';
    case 'move':
      return 'Move the cursor to the highlighted target';
    case 'wait':
      return `Wait ${action.milliseconds}ms`;
    default:
      return action.type === 'double_click' ? 'Double-click the highlighted target' : 'Click the highlighted target';
  }
}

function requiredPoint(action: ComputerAction, observation: DesktopObservation): DesktopPoint {
  const point = resolveActionPoint(action, observation);
  if (!point) throw new Error('Action target is no longer available.');
  return point;
}

/** Prefer the semantic element supplied by the accessibility adapter. */
function resolveActionPoint(action: ComputerAction, observation: DesktopObservation): DesktopPoint | null {
  if ('elementId' in action && action.elementId) {
    for (const screen of observation.screens) {
      const element = screen.elements?.find((candidate) => candidate.id === action.elementId);
      if (element && element.enabled !== false) {
        return {
          x: element.bounds.x + element.bounds.width / 2,
          y: element.bounds.y + element.bounds.height / 2,
        };
      }
    }
  }
  if ('x' in action && 'y' in action && action.x !== undefined && action.y !== undefined) {
    return resolveNormalizedPoint(action.screenIndex, action.x, action.y, observation);
  }
  return null;
}

function resolveNormalizedPoint(
  screenIndex: number | undefined,
  x: number,
  y: number,
  observation: DesktopObservation,
): DesktopPoint | null {
  if (typeof screenIndex !== 'number' || !Number.isInteger(screenIndex) || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || x > 1000 || y < 0 || y > 1000) return null;
  const screen = observation.screens[screenIndex];
  if (!screen || screen.imageWidth <= 0 || screen.imageHeight <= 0) return null;
  return {
    x: screen.displayBounds.x + (x / 1000) * screen.displayBounds.width,
    y: screen.displayBounds.y + (y / 1000) * screen.displayBounds.height,
  };
}

function parseTarget(value: Record<string, unknown>): Pick<Extract<ComputerAction, { type: 'click' | 'double_click' | 'drag' }>, 'screenIndex' | 'x' | 'y' | 'elementId'> {
  const target = parseOptionalTarget(value);
  if (target.elementId || (target.screenIndex !== undefined && target.x !== undefined && target.y !== undefined)) return target;
  throw new Error('Pointer action must include an accessibility element or normalized x/y coordinates.');
}

function parseOptionalTarget(value: Record<string, unknown>): { screenIndex?: number; x?: number; y?: number; elementId?: string } {
  const elementId = optionalString(value.elementId, 'elementId');
  const hasCoordinates = value.screenIndex !== undefined || value.x !== undefined || value.y !== undefined;
  if (!hasCoordinates) return elementId ? { elementId } : {};
  return {
    ...(elementId ? { elementId } : {}),
    screenIndex: integer(value.screenIndex, 'screenIndex'),
    x: coordinate(value.x, 'x'),
    y: coordinate(value.y, 'y'),
  };
}

function parsePointerOptions(value: Record<string, unknown>): { button?: DesktopMouseButton; keys?: string[] } {
  const button = value.button;
  if (button !== undefined && button !== 'left' && button !== 'right' && button !== 'middle') {
    throw new Error('Pointer action has an unsupported mouse button.');
  }
  if (value.keys === undefined) return button ? { button } : {};
  if (!Array.isArray(value.keys) || !value.keys.every((key) => typeof key === 'string')) {
    throw new Error('Pointer action keys must be strings.');
  }
  return { ...(button ? { button } : {}), keys: value.keys };
}

function validKeys(keys: string[]): boolean {
  return keys.length > 0 && keys.length <= 4 && keys.every((key) => /^[A-Z0-9_+-]+$/i.test(key));
}

function coordinate(value: unknown, name: string): number {
  const parsed = integer(value, name);
  if (parsed < 0 || parsed > 1000) throw new Error(`${name} must be between 0 and 1000.`);
  return parsed;
}

function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function string(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be non-empty text.`);
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be non-empty text when provided.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
