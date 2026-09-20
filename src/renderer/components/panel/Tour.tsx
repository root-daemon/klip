import { motion } from 'framer-motion';
import { KlipPet, type PetMood } from '../KlipPet';

interface TourProps {
  shortcut: string;
  onNavigate: (tab: 'chats' | 'mind' | 'voice' | 'ear' | 'general' | 'agents' | 'settings') => void;
}

interface Feature {
  id: string;
  title: string;
  body: string;
  mood: PetMood;
  accentColor?: string;
  accentGlowSoft?: string;
  cta?: { label: string; tab: 'chats' | 'mind' | 'voice' | 'ear' | 'general' | 'agents' | 'settings' };
}

const cardIn = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Tour({ shortcut, onNavigate }: TourProps) {
  const keys = shortcut.split('+').filter(Boolean);

  const features: Feature[] = [
    {
      id: 'ptt',
      title: 'Hold the shortcut, ask anything.',
      body: `Hold ${keys.join('+')} from anywhere and speak. Release when you're done — klip takes it from there.`,
      mood: 'listening',
    },
    {
      id: 'vision',
      title: 'Klip sees your screen.',
      body: 'Ask about what\'s in front of you — "what does this error mean", "where\'s the checkout button". A screenshot is captured with every turn.',
      mood: 'processing',
    },
    {
      id: 'point',
      title: 'Klip points things out.',
      body: 'When klip wants to show you where something is, it glides to that exact spot and hovers there while the answer plays.',
      mood: 'responding',
      accentColor: 'var(--pet-glow-desktop)',
      accentGlowSoft: 'var(--pet-glow-desktop-soft)',
    },
    {
      id: 'type',
      title: 'Fills in fields for you.',
      body: 'Ask klip to draft a reply or fill in text, and it\'s typed directly or copied to your clipboard, ready to paste.',
      mood: 'success',
    },
    {
      id: 'docs',
      title: 'Creates real files.',
      body: 'Ask for a spreadsheet or a pdf and klip writes an actual .xlsx or .pdf to disk and opens it — not a description of one.',
      mood: 'success',
      accentColor: 'var(--pet-glow-desktop)',
      accentGlowSoft: 'var(--pet-glow-desktop-soft)',
    },
    {
      id: 'crew',
      title: 'A crew, not one generalist.',
      body: 'Conversation and desktop-action requests are routed to different specialists under the hood, each with its own focus.',
      mood: 'idle',
      cta: { label: 'Meet the crew', tab: 'agents' },
    },
    {
      id: 'providers',
      title: 'Bring your own providers.',
      body: 'Claude, GPT, Gemini, or a fully local Ollama model for reasoning — ElevenLabs or Sarvam for voice. Swap any of it, any time.',
      mood: 'idle',
      cta: { label: 'Open Mind', tab: 'mind' },
    },
    {
      id: 'local',
      title: 'Everything stays local.',
      body: 'Chats, keys, and settings are stored on your machine — never uploaded to our servers unless you turn on cloud sync yourself.',
      mood: 'idle',
      cta: { label: 'Open Chats', tab: 'chats' },
    },
  ];

  return (
    <section className="tour">
      <header className="tour-head">
        <div>
          <h2 className="tour-heading">How klip works<em>.</em></h2>
          <p className="tour-sub">Every feature, shown rather than explained.</p>
        </div>
      </header>

      <div className="tour-grid">
        {features.map((f, i) => (
          <motion.div
            key={f.id}
            className="tour-card"
            custom={i}
            initial="hidden"
            animate="show"
            variants={cardIn}
          >
            <span className="tour-card-idx">[ {String(i + 1).padStart(2, '0')} ]</span>
            <div className="tour-card-pet">
              <KlipPet
                mood={f.mood}
                size={44}
                accentColor={f.accentColor}
                accentGlowSoft={f.accentGlowSoft}
              />
            </div>
            <h3 className="tour-card-title">{f.title}</h3>
            <p className="tour-card-body">{f.body}</p>
            {f.cta && (
              <button className="link tour-card-link" onClick={() => onNavigate(f.cta!.tab)}>
                {f.cta.label} →
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
