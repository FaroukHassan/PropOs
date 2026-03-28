// frontend/src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DEMO_USER, DEMO_TOKEN } from '../utils/demoData';

const CARD = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:16, padding:36, width:380, maxWidth:'94vw', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' };

export default function LoginPage() {
  const { login, loginDemo } = useAuth();
  const navigate      = useNavigate();
  const [form, set]   = useState({ email: '', password: '' });
  const [error, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setErr(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-2)' }}>
      <div style={CARD}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>PropOS</div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>Sign in to your account</div>
        </div>

        {error && <div style={{ background:'var(--red-bg)', color:'var(--red)', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}

        <form onSubmit={handle}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set(p => ({...p, email: e.target.value}))} required placeholder="you@company.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password} onChange={e => set(p => ({...p, password: e.target.value}))} required placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width:'100%', padding:'9px 0', fontSize:14 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ position:'relative', margin:'20px 0 12px', textAlign:'center' }}>
          <div style={{ borderTop:'1px solid var(--border)', position:'absolute', top:'50%', left:0, right:0 }}></div>
          <span style={{ position:'relative', background:'var(--bg)', padding:'0 12px', fontSize:12, color:'var(--text-3)' }}>or</span>
        </div>

        <button
          className="btn"
          onClick={() => { loginDemo(); navigate('/dashboard'); }}
          style={{ width:'100%', padding:'9px 0', fontSize:14, background:'var(--bg-3)', border:'1px solid var(--border)', cursor:'pointer' }}
        >
          Try Demo Mode
        </button>

        <div style={{ marginTop:16, textAlign:'center', fontSize:13, color:'var(--text-2)' }}>
          No account? <Link to="/register" style={{ color:'var(--blue)' }}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
