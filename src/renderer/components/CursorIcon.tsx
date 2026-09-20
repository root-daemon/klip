import { KlipPet } from './KlipPet';

interface CursorIconProps {
  size?: number;
  className?: string;
}

/**
 * The KLIP companion, as a standalone branding icon (sidebar logo,
 * onboarding hero, etc). Thin wrapper around KlipPet at rest — kept as
 * its own component so call sites don't need to know about `mood`.
 */
export function CursorIcon({ size = 40, className }: CursorIconProps) {
  return <KlipPet mood="idle" size={size} className={className} />;
}
