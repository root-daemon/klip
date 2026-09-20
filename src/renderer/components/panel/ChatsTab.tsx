import { useEffect, useRef, useState } from 'react';
import type { ChatEntry } from '../../../shared/types';
import { KlipPet } from '../KlipPet';
import { renderInlineMarkdown } from '../../utils/inline-markdown';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday · ${time}`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

export function ChatsTab() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [streamingUser, setStreamingUser] = useState<string | null>(null);
  const [streamingAssistant, setStreamingAssistant] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.klip
      .getChatHistory()
      .then(setEntries)
      .catch((err) => console.error('[KLIP] load chat history failed:', err));

    const unsubs = [
      window.klip.onChatEntryAdded((entry) => {
        setEntries((prev) => [...prev, entry]);
        setStreamingUser(null);
        setStreamingAssistant('');
      }),
      window.klip.onTranscriptUpdate((t) => {
        if (t.text) setStreamingUser(t.text);
      }),
      window.klip.onAiResponseChunk((chunk) => {
        setStreamingAssistant((prev) => prev + chunk);
      }),
      // Wipe any orphan streaming state when a session ends without
      // producing an entry (e.g., transcription returned empty or
      // the LLM call errored). A fresh session landing on 'listening'
      // clears the previous turn's scaffolding.
      window.klip.onVoiceStateChanged((state) => {
        if (state === 'listening') {
          setStreamingUser(null);
          setStreamingAssistant('');
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, streamingUser, streamingAssistant]);

  const clearAll = () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;
    window.klip.clearChatHistory();
    setEntries([]);
  };

  const hasAny = entries.length > 0 || streamingUser || streamingAssistant;
  const isThinking = streamingUser !== null && streamingAssistant === '';

  return (
    <>
      <div className="chats-head">
        <div>
          <h1 className="main-h1">
            Chats<em>.</em>
          </h1>
          <p className="main-lead" style={{ marginBottom: 0 }}>
            Everything you and klip have said. All stored locally on your machine.
          </p>
        </div>
        <button className="btn xs" onClick={clearAll} disabled={!entries.length}>
          Clear history
        </button>
      </div>

      <div className="chat-log" ref={scrollRef}>
        {!hasAny && (
          <div className="chat-empty">
            <KlipPet mood="idle" size={56} />
            <div className="chat-empty-t">No chats yet</div>
            <div className="chat-empty-s">
              Hold the push-to-talk shortcut from anywhere on your machine to start a conversation.
            </div>
          </div>
        )}

        {entries.map((e) => (
          <ChatPair key={e.id} user={e.userText} assistant={e.assistantText} ts={e.timestamp} />
        ))}

        {(streamingUser || streamingAssistant) && (
          <ChatPair
            user={streamingUser ?? ''}
            assistant={streamingAssistant}
            ts={Date.now()}
            live
            thinking={isThinking}
          />
        )}
      </div>
    </>
  );
}

function ChatPair({
  user,
  assistant,
  ts,
  live,
  thinking,
}: {
  user: string;
  assistant: string;
  ts: number;
  live?: boolean;
  thinking?: boolean;
}) {
  return (
    <div className={`chat-pair ${live ? 'live' : ''}`}>
      <div className="chat-time">
        {live && <span className="chat-time-dot" />}
        {formatTime(ts)}
        {live ? ' · live' : ''}
      </div>
      {user && (
        <div className="chat-turn user">
          <div className="chat-bubble user">{user}</div>
        </div>
      )}
      {(assistant || thinking) && (
        <div className="chat-turn assistant">
          <div className="chat-avatar-wrap">
            <KlipPet mood={thinking ? 'processing' : live ? 'responding' : 'idle'} size={28} />
          </div>
          <div className="chat-text">
            {thinking ? (
              <span className="chat-thinking">
                <span /><span /><span />
              </span>
            ) : (
              <>
                {renderInlineMarkdown(assistant)}
                {live && <span className="caret" />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
