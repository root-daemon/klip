/** Map model-facing key names to the native nut.js key enum on each OS. */
export function nativeKeyName(raw: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = raw.trim().toUpperCase();
  const command = platform === 'darwin' ? 'LeftCmd' : 'LeftSuper';
  const aliases: Record<string, string> = {
    CTRL: 'LeftControl',
    CONTROL: 'LeftControl',
    CMD: command,
    COMMAND: command,
    // OpenAI's computer tool uses META for the macOS command modifier.
    // LeftSuper exists in nut.js' enum but is not a valid Quartz flag.
    META: command,
    SUPER: 'LeftSuper',
    ALT: 'LeftAlt',
    OPTION: 'LeftAlt',
    SHIFT: 'LeftShift',
    ENTER: 'Enter',
    RETURN: 'Enter',
    ESC: 'Escape',
    ESCAPE: 'Escape',
    SPACE: 'Space',
    TAB: 'Tab',
    BACKSPACE: 'Backspace',
    DELETE: 'Delete',
    UP: 'Up',
    DOWN: 'Down',
    LEFT: 'Left',
    RIGHT: 'Right',
  };
  return aliases[normalized] ?? normalized;
}
