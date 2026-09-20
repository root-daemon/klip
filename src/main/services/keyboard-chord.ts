/**
 * Execute an atomic key chord through nut.js.
 *
 * nut.js already reverses its argument list internally to distinguish the
 * final key from its modifiers. Callers must pass the chord in the same order
 * for both phases; reversing the release arguments a second time turns the
 * actual key into a modifier on macOS (for example `Space` in `Command+Space`).
 */
export async function pressAndReleaseChord(
  keyboard: {
    pressKey(...keys: unknown[]): Promise<void>;
    releaseKey(...keys: unknown[]): Promise<void>;
  },
  keys: unknown[],
): Promise<void> {
  await keyboard.pressKey(...keys);
  await keyboard.releaseKey(...keys);
}
