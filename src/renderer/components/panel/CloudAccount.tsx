import { useEffect, useRef, useState } from 'react';
import type { CloudAction, CloudAuthInput, CloudAuthStep, CloudStatus } from '../../../shared/cloud';

const labels: Record<CloudAuthStep, string> = {
  'sign-in': 'Sign in', 'sign-up': 'Create account', 'confirm-sign-up': 'Verify email',
  mfa: 'Verify authenticator code', 'forgot-password': 'Send reset code', 'reset-password': 'Reset password',
};

export function CloudAccount({ onStatusChange }: { onStatusChange?: (status: CloudStatus | null) => void } = {}) {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [busy, setBusy] = useState<CloudAction | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [step, setStep] = useState<CloudAuthStep>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const active = useRef(false);
  const pending = useRef(false);
  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);
  useEffect(() => {
    active.current = true;
    window.klip.cloudAccount('status').then(result => {
      if (!active.current) return;
      setStatus(result.status);
      if (!result.ok) { setNotice(result.error); setError(true); }
    }).catch(() => { if (active.current) { setNotice('Could not load cloud account status.'); setError(true); } });
    return () => {
      active.current = false;
      void window.klip.cloudAccount('cancel').catch(() => {});
    };
  }, []);

  const changeStep = (next: CloudAuthStep) => {
    setStep(next); setPassword(''); setCode(''); setNotice(''); setError(false);
    void window.klip.cloudAccount('cancel').catch(() => {});
  };
  const run = async (action: CloudAction, input?: CloudAuthInput) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(action); setNotice(''); setError(false);
    // Clear password fields immediately after handing the request to the main process.
    const request = window.klip.cloudAccount(action, input);
    setPassword('');
    try {
      const result = await request;
      if (!active.current) return;
      setStatus(result.status); setError(!result.ok);
      setNotice(result.ok ? result.message ?? '' : result.error);
      if (result.ok && result.nextStep) { setStep(result.nextStep); setCode(''); }
      if (result.status.signedIn) setCode('');
    } catch {
      if (active.current) { setError(true); setNotice('Could not complete this request. Please try again.'); }
    } finally {
      pending.current = false;
      if (active.current) setBusy(null);
    }
  };
  const needsPassword = step === 'sign-in' || step === 'sign-up' || step === 'reset-password';
  const needsCode = step === 'confirm-sign-up' || step === 'reset-password' || step === 'mfa';

  return <div className="section">
    <div className="section-title">Account &amp; preferences</div>
    <p className="section-hint" style={{ margin: '6px 0 14px' }}>
      Bring your preferences to another computer. API keys, chat history, and device permissions stay local.
      Save and restore only when you choose.
    </p>
    {!status ? <p className="row-s">{error ? 'Account status unavailable. Reopen this step to try again.' : 'Loading account…'}</p> : !status.configured ?
      <p className="row-s">Cloud accounts aren’t configured in this installation. You can keep using KLIP locally.</p> :
      status.signedIn ? <>
        <p className="row-s">Signed in as {status.email}</p>
        <div className="cloud-auth-actions">
          <button className="btn xs" disabled={!!busy} onClick={() => void run('save')}>Save to cloud</button>
          <button className="btn xs" disabled={!!busy} onClick={() => void run('restore')}>Restore from cloud</button>
          <button className="btn xs subtle" disabled={!!busy} onClick={() => void run('sign-out')}>Sign out</button>
        </div>
      </> : <form className="cloud-auth-form" onSubmit={event => {
        event.preventDefault();
        void run(step, { email: email.trim(), ...(needsPassword ? { password } : {}), ...(needsCode ? { code } : {}) });
      }}>
        {(step === 'sign-in' || step === 'sign-up') && <div className="seg" aria-label="Account action">
          <button type="button" className={step === 'sign-in' ? 'on' : ''} disabled={!!busy} onClick={() => changeStep('sign-in')}>Sign in</button>
          <button type="button" className={step === 'sign-up' ? 'on' : ''} disabled={!!busy} onClick={() => changeStep('sign-up')}>Create account</button>
        </div>}
        {step !== 'mfa' && <label className="cloud-auth-field">Email
          <input type="email" autoComplete="username" required maxLength={320} value={email} disabled={!!busy || needsCode}
            onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>}
        {needsCode && <label className="cloud-auth-field">{step === 'mfa' ? 'Authenticator code' : 'Email verification code'}
          <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code}
            disabled={!!busy} onChange={event => setCode(event.target.value)} placeholder="6-digit code" />
        </label>}
        {needsPassword && <label className="cloud-auth-field">{step === 'reset-password' ? 'New password' : 'Password'}
          <input type="password" autoComplete={step === 'sign-in' ? 'current-password' : 'new-password'} required
            minLength={step === 'sign-in' ? 1 : 12} maxLength={256} value={password} disabled={!!busy}
            onChange={event => setPassword(event.target.value)} />
        </label>}
        {(step === 'sign-up' || step === 'reset-password') && <p className="row-s">At least 12 characters, with uppercase, lowercase, a number, and a symbol.</p>}
        {step === 'confirm-sign-up' && <p className="row-s">Enter the code sent to your email. Check your spam folder if it hasn’t arrived.</p>}
        <div className="cloud-auth-actions">
          <button type="submit" className="btn primary" disabled={!!busy}>{busy ? 'Please wait…' : labels[step]}</button>
          {step === 'sign-in' && <button type="button" className="btn subtle" disabled={!!busy} onClick={() => changeStep('forgot-password')}>Forgot password?</button>}
          {step === 'confirm-sign-up' && <button type="button" className="btn subtle" disabled={!!busy} onClick={() => void run('resend-code', { email })}>Resend code</button>}
          {step !== 'sign-in' && step !== 'sign-up' && <button type="button" className="btn subtle" disabled={!!busy} onClick={() => changeStep('sign-in')}>Back to sign in</button>}
        </div>
        <p className="row-s">Your password isn’t saved on this computer. Sign in again after restarting KLIP.</p>
      </form>}
    {busy && <p className="row-s" role="status">Working…</p>}
    {notice && <p className="row-s" role={error ? 'alert' : 'status'} style={{ color: error ? 'var(--fl-danger)' : undefined }}>{notice}</p>}
  </div>;
}
