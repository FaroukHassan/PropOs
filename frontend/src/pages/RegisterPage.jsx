// frontend/src/pages/RegisterPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CARD = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:16, padding:36, width:420, maxWidth:'94vw', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' };

export default function RegisterPage() {
  const { register }  = useAuth();
  const navigate      = useNavigate();
  const [form, set]   = useState({ name:'', email:'', password:'', orgName:'' });
  const [error, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setErr(err.message);
    } finally { setBusy(false); }
  };

  const field = (key, label, type='text', placeholder='') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[key]} onChange={e => set(p => ({...p, [key]: e.target.value}))} required placeholder={placeholder} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-2)' }}>
      <div style={CARD}>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>PropOS</div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>Create your organization account</div>
        </div>

        {error && <div style={{ background:'var(--red-bg)', color:'var(--red)', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}

        <form onSubmit={handle}>
          {field('orgName',  'Organization name', 'text', 'Acme Properties LLC')}
          {field('name',     'Your full name',    'text', 'Jane Smith')}
          {field('email',    'Email',             'email','you@company.com')}
          {field('password', 'Password',          'password','Min. 8 characters')}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width:'100%', padding:'9px 0', fontSize:14 }}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop:20, textAlign:'center', fontSize:13, color:'var(--text-2)' }}>
          Already have an account? <Link to="/login" style={{ color:'var(--blue)' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
