/** The crew shown on the Agents screen — each one maps to a real facet
 *  of the companion (routing, memory, transcription, screen capture)
 *  rather than a fictional capability, so the roster stays honest about
 *  what klip actually does. */
export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  accentColor: string;
  accentGlowSoft: string;
  blurb: string;
}

export const AGENT_ROSTER: AgentPersona[] = [
  {
    id: 'conversation',
    name: 'Chatter',
    role: 'Conversation',
    accentColor: 'var(--pet-glow)',
    accentGlowSoft: 'var(--pet-glow-soft)',
    blurb: 'Handles free-form chat, questions, and explaining things.',
  },
  {
    id: 'desktop',
    name: 'Pointer',
    role: 'Desktop actions',
    accentColor: 'var(--pet-glow-desktop)',
    accentGlowSoft: 'var(--pet-glow-desktop-soft)',
    blurb: 'Clicks, types, and finds things on your screen.',
  },
  {
    id: 'memory',
    name: 'Keeper',
    role: 'Memory',
    accentColor: '#7dd3fc',
    accentGlowSoft: 'rgba(125, 211, 252, 0.38)',
    blurb: "Remembers what you talked about and compacts the old stuff.",
  },
  {
    id: 'ear',
    name: 'Listener',
    role: 'Voice input',
    accentColor: '#c4b5fd',
    accentGlowSoft: 'rgba(196, 181, 253, 0.38)',
    blurb: 'Turns your voice into text klip can read.',
  },
  {
    id: 'vision',
    name: 'Watcher',
    role: 'Screen vision',
    accentColor: '#86efac',
    accentGlowSoft: 'rgba(134, 239, 172, 0.38)',
    blurb: "Reads your screen to know what you're looking at.",
  },
];
