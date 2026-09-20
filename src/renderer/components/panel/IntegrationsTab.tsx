import { KlipPet, type PetMood } from '../KlipPet';

interface Integration {
  id: string;
  name: string;
  status: 'live' | 'needs-setup';
  mood: PetMood;
  accentColor?: string;
  accentGlowSoft?: string;
  blurb: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'excel',
    name: 'Spreadsheets (.xlsx)',
    status: 'live',
    mood: 'writing',
    blurb: 'Ask for a spreadsheet — expenses, a comparison table, anything tabular — and klip writes a real .xlsx to disk and opens it.',
  },
  {
    id: 'pdf',
    name: 'PDF documents',
    status: 'live',
    mood: 'writing',
    blurb: "Ask for a write-up, a report, or notes saved as a document, and klip creates a real .pdf and opens it — not a description of one.",
  },
  {
    id: 'computer-use',
    name: 'Multi-step computer use',
    status: 'live',
    mood: 'reading',
    accentColor: 'var(--pet-glow-desktop)',
    accentGlowSoft: 'var(--pet-glow-desktop-soft)',
    blurb: 'For real multi-step tasks ("check my mail and reply to the latest one"), klip drives the mouse and keyboard directly, watching the result of each step before deciding the next. Needs a Claude key and "allow klip to click" turned on.',
  },
  {
    id: 'click',
    name: 'Click & scroll',
    status: 'live',
    mood: 'responding',
    accentColor: 'var(--pet-glow-desktop)',
    accentGlowSoft: 'var(--pet-glow-desktop-soft)',
    blurb: 'For a single, specific action ("click the save button"), klip points and clicks directly — no multi-step loop needed.',
  },
  {
    id: 'type',
    name: 'Typing & autofill',
    status: 'live',
    mood: 'writing',
    blurb: "Drafts and fills in text for you — typed directly into the focused field, or copied to your clipboard if auto-type is off.",
  },
  {
    id: 'point',
    name: 'Screen pointing',
    status: 'live',
    mood: 'idle',
    blurb: "Shows you exactly where something is on screen — walks through multi-step instructions one highlighted spot at a time.",
  },
  {
    id: 'voice',
    name: 'Voice in & out',
    status: 'live',
    mood: 'listening',
    blurb: 'Push-to-talk in, spoken replies out — choose ElevenLabs or Sarvam for voice, Groq or Sarvam for transcription.',
  },
  {
    id: 'mind',
    name: 'Any reasoning model',
    status: 'live',
    mood: 'processing',
    blurb: "Claude, GPT, Gemini, or a fully local Ollama model — swap the model doing the thinking any time in Mind.",
  },
  {
    id: 'cloud',
    name: 'Cloud account sync',
    status: 'needs-setup',
    mood: 'idle',
    blurb: "Syncs preferences across machines via an AWS backend — the code is in place, but needs to actually be deployed (see docs/aws-backend.md) before sign-in does anything.",
  },
];

export function IntegrationsTab() {
  return (
    <>
      <h1 className="main-h1">
        MCP Integrations<em>.</em>
      </h1>
      <p className="main-lead">
        Everything klip can actually do beyond replying — what's live today, and what still needs setup.
      </p>

      <div className="tour-grid">
        {INTEGRATIONS.map((it, i) => (
          <div key={it.id} className="tour-card">
            <span className="tour-card-idx">[ {String(i + 1).padStart(2, '0')} ]</span>
            <div className="tour-card-pet">
              <KlipPet mood={it.mood} size={44} accentColor={it.accentColor} accentGlowSoft={it.accentGlowSoft} />
            </div>
            <h3 className="tour-card-title">{it.name}</h3>
            <p className="tour-card-body">{it.blurb}</p>
            <span className={`integration-status ${it.status}`}>
              {it.status === 'live' ? 'Live' : 'Needs setup'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
