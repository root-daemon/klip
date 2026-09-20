import { useEffect, useRef, useState } from 'react';
import { KlipPet } from '../KlipPet';
import { AGENT_ROSTER } from '../../data/agents';
import { randomAgentLine } from '../../data/agent-chatter';

interface ChatMessage {
  id: number;
  agentId: string;
  text: string;
}

const MAX_MESSAGES = 40;
let nextMsgId = 1;

export function AgentsTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const lastSpeakerRef = useRef<string | null>(null);

  // Ambient, fully local chatter — no IPC, no model calls. Just cycles
  // the phrase banks in agent-chatter.ts on a timer so the crew always
  // looks alive without costing a single token.
  useEffect(() => {
    let speakTimer: ReturnType<typeof setTimeout>;
    const speak = () => {
      const pool = AGENT_ROSTER.filter((a) => a.id !== lastSpeakerRef.current);
      const speaker = pool[Math.floor(Math.random() * pool.length)] ?? AGENT_ROSTER[0];
      lastSpeakerRef.current = speaker.id;

      setMessages((prev) => {
        const next = [...prev, { id: nextMsgId++, agentId: speaker.id, text: randomAgentLine(speaker.id) }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });

      setActiveSpeaker(speaker.id);
      setTimeout(() => setActiveSpeaker((cur) => (cur === speaker.id ? null : cur)), 1400);

      speakTimer = setTimeout(speak, 2600 + Math.random() * 1600);
    };
    speakTimer = setTimeout(speak, 500);
    return () => clearTimeout(speakTimer);
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <>
      <h1 className="main-h1">
        Agents<em>.</em>
      </h1>
      <p className="main-lead">
        The crew behind klip, each focused on one job. Their chatter below is purely
        cosmetic — cycled from a local phrase bank, not the model — so it never costs
        you a token.
      </p>

      <div className="agent-grid">
        {AGENT_ROSTER.map((agent, i) => (
          <div key={agent.id} className="agent-card">
            <span className="agent-card-idx">[ {String(i + 1).padStart(2, '0')} ]</span>
            <KlipPet
              mood={activeSpeaker === agent.id ? 'responding' : 'idle'}
              size={52}
              accentColor={agent.accentColor}
              accentGlowSoft={agent.accentGlowSoft}
            />
            <div className="agent-card-body">
              <div className="agent-card-name">{agent.name}</div>
              <div className="agent-card-role">{agent.role}</div>
              <div className="agent-card-blurb">{agent.blurb}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 12 }}>Crew chat</div>
        <div className="agent-feed" ref={feedRef}>
          {messages.length === 0 && <div className="agent-feed-empty">warming up the crew…</div>}
          {messages.map((m) => {
            const agent = AGENT_ROSTER.find((a) => a.id === m.agentId);
            if (!agent) return null;
            return (
              <div key={m.id} className="agent-bubble-row">
                <span className="agent-bubble-dot" style={{ background: agent.accentColor }} />
                <span className="agent-bubble-name">{agent.name}</span>
                <span className="agent-bubble-text">{m.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
