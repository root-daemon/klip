import { useEffect, useState } from 'react';
import type { CloudAction, CloudStatus } from '../../../shared/cloud';

export function CloudAccount() {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [busy, setBusy] = useState<CloudAction | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    window.klip.cloudAccount('status').then(result => {
      if (!active) return;
      setStatus(result.status);
      if (!result.ok) { setNotice(result.error); setError(true); }
    }).catch(() => { if (active) { setNotice('Could not load cloud account status.'); setError(true); } });
    return () => {
      active = false;
      void window.klip.cloudAccount('cancel').catch(() => {});
    };
  }, []);

  const run = async (action: CloudAction) => {
    setBusy(action); setNotice(''); setError(false);
    try {
      const result = await window.klip.cloudAccount(action);
      setStatus(result.status);
      setError(!result.ok);
      setNotice(result.ok ? result.message ?? '' : result.error);
    } catch {
      setError(true); setNotice('Could not complete the cloud action. Please try again.');
    } finally { setBusy(null); }
  };

  return <div className="section">
    <div className="section-title">Account &amp; preferences</div>
    <p className="section-hint" style={{ margin: '6px 0 14px' }}>
      Save reply tone, reasoning depth, voice speed and stability, spoken replies, and cursor visibility across devices.
      API keys, chat history, and device permissions stay on this computer. Sync happens only when you choose Save or Restore.
    </p>
    {!status ? <p className="row-s">Loading account…</p> : !status.configured ?
      <p className="row-s">Cloud accounts aren’t configured in this installation. You can keep using KLIP locally.</p> :
      <>
        <p className="row-s">{status.signedIn ? `Signed in as ${status.email}` : 'Sign in or create an account in your browser. Sign in again after restarting KLIP.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {status.signedIn ? <>
            <button className="btn xs" disabled={!!busy} onClick={() => void run('save')}>Save to cloud</button>
            <button className="btn xs" disabled={!!busy} onClick={() => void run('restore')}>Restore from cloud</button>
            <button className="btn xs subtle" disabled={!!busy} onClick={() => void run('sign-out')}>Sign out</button>
          </> : <button className="btn xs" disabled={!!busy} onClick={() => void run('sign-in')}>Sign in / create account</button>}
          {busy === 'sign-in' && <button className="btn xs subtle" onClick={() => {
            void window.klip.cloudAccount('cancel').catch(() => {});
          }}>Cancel sign-in</button>}
        </div>
        {busy && <p className="row-s" role="status">{busy === 'sign-in' ? 'Complete sign-in in your browser…' : 'Working…'}</p>}
      </>}
    {notice && <p className="row-s" role={error ? 'alert' : 'status'} style={{ color: error ? 'var(--fl-danger)' : undefined }}>{notice}</p>}
  </div>;
}
