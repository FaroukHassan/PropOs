// frontend/src/pages/LoginPage.jsx
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-side">
        <div className="brand-name" style={{ fontSize: 22 }}>Sakanly <span>PropOS</span></div>
        <div>
          <h1>Every partition, booking and cheque. <em>One place.</em></h1>
          <p style={{ color: '#aab4c9', marginTop: 14, maxWidth: 420 }}>
            The operating system for Sakanly Stay Holiday Homes: partitions board, rent collection, holiday bookings, cheques and owner statements.
          </p>
          <p className="ar" dir="rtl" style={{ color: 'var(--sand)', marginTop: 18, fontSize: 18 }}>سكنلي — كأنك في بيتك</p>
        </div>
        <div className="small" style={{ color: '#6f7c98' }}>Office 301, Warsan Building, Barsha Heights · Dubai</div>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Sign in</h2>
          <p className="muted small" style={{ marginBottom: 22 }}>For the Sakanly team. Ask an admin for an account.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
          <div className="field"><label htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
