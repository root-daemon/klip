import { useState, useEffect, useCallback } from 'react';
import type { LocalConnection } from '../../../shared/types';
import { ConnectionRow } from './ConnectionRow';
import { AddConnectionModal } from './AddConnectionModal';
import { OllamaManageModal } from './OllamaManageModal';

interface OllamaSectionProps {
  ollamaEnabled: boolean;
  onToggleOllama: (enabled: boolean) => void;
}

type QuickConnectState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; model: string; modelCount: number }
  | { kind: 'error'; message: string };

export function OllamaSection({ ollamaEnabled, onToggleOllama }: OllamaSectionProps) {
  const [connections, setConnections] = useState<LocalConnection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LocalConnection | undefined>(undefined);
  const [managing, setManaging] = useState<LocalConnection | undefined>(undefined);
  const [quickConnect, setQuickConnect] = useState<QuickConnectState>({ kind: 'idle' });

  const reload = useCallback(async () => {
    const conns = await window.klip.getLocalConnections();
    setConnections(conns);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleQuickConnect = async () => {
    setQuickConnect({ kind: 'pending' });
    try {
      const res = await window.klip.quickConnectOllama();
      if (res.ok && res.selectedModel && res.models) {
        setQuickConnect({ kind: 'ok', model: res.selectedModel, modelCount: res.models.length });
        await reload();
      } else {
        setQuickConnect({ kind: 'error', message: res.error ?? 'Could not connect to Ollama.' });
      }
    } catch (err) {
      setQuickConnect({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not connect to Ollama.',
      });
    }
  };

  const handleSave = async (conn: LocalConnection) => {
    setShowModal(false);
    setEditing(undefined);
    await reload();
    // If this is the first connection, switch model provider to ollama
    const all = await window.klip.getLocalConnections();
    if (all.length === 1) {
      window.klip.setMindProvider('ollama');
    }
  };

  const handleManage = (conn: LocalConnection) => {
    setManaging(conn);
  };

  const handleConfigure = (conn: LocalConnection) => {
    setEditing(conn);
    setShowModal(true);
  };

  const handleModelSelected = async (connId: string, modelId: string) => {
    await window.klip.updateLocalConnection(connId, { activeModelId: modelId || undefined });
    await reload();
    // Reflect updated conn in the manage modal
    const updated = (await window.klip.getLocalConnections()).find((c) => c.id === connId);
    if (updated) setManaging(updated);
  };

  const handleToggle = async (conn: LocalConnection) => {
    await window.klip.updateLocalConnection(conn.id, { enabled: !conn.enabled });
    await reload();
  };

  const handleDelete = async (conn: LocalConnection) => {
    await window.klip.deleteLocalConnection(conn.id);
    setShowModal(false);
    setEditing(undefined);
    await reload();
  };

  return (
    <>
      <div className="section">
        <div className="section-row">
          <div className="section-title">Ollama API</div>
          <button
            className={`toggle-pill ${ollamaEnabled ? 'on' : ''}`}
            onClick={() => onToggleOllama(!ollamaEnabled)}
          />
        </div>

        <div className="quick-connect">
          <div className="quick-connect-main">
            <div className="quick-connect-title">Ollama running on this machine?</div>
            <div className="quick-connect-sub">
              One click — detects it at localhost:11434, lists your installed models, and picks one.
              No URLs or model names to type.
            </div>
          </div>
          <button
            className="btn xs primary"
            onClick={handleQuickConnect}
            disabled={quickConnect.kind === 'pending'}
          >
            {quickConnect.kind === 'pending' && <span className="spinner-sm" />}
            {quickConnect.kind === 'pending' ? 'Connecting…' : 'Quick connect'}
          </button>
        </div>
        {quickConnect.kind === 'ok' && (
          <div className="quick-connect-status ok">
            Connected — using <b>{quickConnect.model}</b> ({quickConnect.modelCount} model
            {quickConnect.modelCount === 1 ? '' : 's'} found). Switch models any time from
            &quot;Manage&quot; below.
          </div>
        )}
        {quickConnect.kind === 'error' && (
          <div className="quick-connect-status err">{quickConnect.message}</div>
        )}

        <div className="section-row" style={{ marginTop: 16 }}>
          <div className="section-sub">Or configure manually (LM Studio, vLLM, a remote router, …)</div>
          <button
            className="btn xs add"
            onClick={() => { setEditing(undefined); setShowModal(true); }}
          >
            + Add Connection
          </button>
        </div>

        {connections.length === 0 ? (
          <div className="empty-state">
            No connections yet. Add one to get started.
          </div>
        ) : (
          <div className="conn-list">
            {connections.map((c) => (
              <ConnectionRow
                key={c.id}
                conn={c}
                onManage={handleManage}
                onConfigure={handleConfigure}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}

        <p className="section-hint">
          Connect to any OpenAI-compatible local endpoint. Ollama, LM Studio, and vLLM are all
          supported.
        </p>
      </div>

      {showModal && (
        <AddConnectionModal
          existing={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onDelete={editing ? handleDelete : undefined}
        />
      )}

      {managing && (
        <OllamaManageModal
          conn={managing}
          onClose={() => setManaging(undefined)}
          onModelSelected={(modelId) => void handleModelSelected(managing.id, modelId)}
        />
      )}
    </>
  );
}
