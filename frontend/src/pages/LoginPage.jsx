// frontend/src/pages/LoginPage.jsx
import { t, isAr } from '../lib/i18n';
import LangSwitch from '../components/LangSwitch';
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
        <div className="row-between"><div className="brand-lockup"><img className="brand-logo lg" src={`${import.meta.env.BASE_URL}brand/logo-white.png`} alt={t('Sakanly Real Estate')} /><span className="brand-tag">{t('Real Estate')}</span></div><LangSwitch dark /></div>
        <div>
          <h1>{t("Every partition, booking and cheque.")} <em>{t("One place.")}</em></h1>
          <p className="login-blurb" style={{ color: '#aab4c9', marginTop: 14, maxWidth: 420 }}>
            {t("The operating system for Sakanly Real Estate: partitions board, rent collection, holiday bookings, cheques and owner statements.")}
          </p>
          <p className="slogan" style={{ color: 'var(--sand)', marginTop: 18, fontSize: 20, fontWeight: 600 }}>{t('Your home, evolved.')}</p>
          <p className="ar" dir={isAr ? 'ltr' : 'rtl'} style={{ color: '#8d99b3', marginTop: 4, fontSize: 14 }}>{isAr ? 'Sakanly Real Estate · Your home, evolved.' : 'سكنلي للعقارات · بيتك… بمفهوم متطوّر.'}</p>
        </div>
        <div className="small login-address" style={{ color: '#6f7c98' }}>{t("Office 301, Warsan Building, Barsha Heights · Dubai")}</div>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{t("Sign in")}</h2>
          <p className="muted small" style={{ marginBottom: 22 }}>{import.meta.env.VITE_DEMO ? t("Demo: any email and password will work.") : t("For the Sakanly team. Ask an admin for an account.")}</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label htmlFor="email">{t("Email")}</label><input id="email" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
          <div className="field"><label htmlFor="pw">{t("Password")}</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10 }} disabled={busy}>{busy ? t("Signing in…") : t("Sign in")}</button>
        </form>
      </div>
    </div>
  );
}
