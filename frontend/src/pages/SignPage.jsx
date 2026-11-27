// frontend/src/pages/SignPage.jsx — public page a tenant opens from WhatsApp to read and sign their contract
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '../lib/i18n';
import { API_BASE, openFile } from '../lib/api';
import { money, date } from '../lib/format';
import SignaturePad from '../components/SignaturePad';
import LangSwitch from '../components/LangSwitch';

const KIND = { PARTITION: 'Private room', ROOM: 'Room', BED: 'Bed space', STUDIO: 'Studio' };

export default function SignPage() {
  const { token } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/sign/${token}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t('This signing link is not valid'));
      setC(d); setName(d.terms.tenant.name || '');
    }).catch(e => setError(e.message));
  }, [token]);

  const submit = async () => {
    setError(null);
    if (!agree) return setError(t('Please confirm that you have read and agree to the contract'));
    if (!sig) return setError(t('Please sign in the box'));
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/public/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, signature: sig, agree: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t('Could not sign, please try again'));
      setDone(true);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const tm = c?.terms;
  const p = tm?.premises;
  return (
    <div className="sign-page">
      <header className="sign-head">
        <img src="brand/logo-white.png" alt="Sakanly" height="30" />
        <LangSwitch dark />
      </header>
      <main className="sign-card">
        {!c && !error && <p className="muted">{t('Loading…')}</p>}
        {error && !c && <div className="alert alert-error">{error}</div>}
        {c && (
          <>
            <h1 className="page-title">{t('Sub-lease agreement')}</h1>
            <p className="small muted"><bdi dir="ltr">{c.number}</bdi> · Sakanly Stay Vacation Homes Rental L.L.C</p>
            <dl className="kv" style={{ margin: '14px 0' }}>
              <dt>{t('Tenant')}</dt><dd>{tm.tenant.name}</dd>
              <dt>{t('Home')}</dt><dd>{p.whole ? `${t('Apartment')} ${p.unit}` : `${t(KIND[p.kind] || 'Room')} ${p.space} · ${t('Apartment')} ${p.unit}`}, {p.building}{p.area ? `, ${p.area}` : ''}</dd>
              <dt>{t('Start')}</dt><dd>{date(tm.startDate)}{tm.endDate ? ` — ${date(tm.endDate)}` : ` · ${t('month to month')}`}</dd>
              <dt>{t('Rent')}</dt><dd>{money(tm.rent)} {tm.rentPeriod === 'YEARLY' ? t('per year') : t('per month')}</dd>
              <dt>{t('Deposit')}</dt><dd>{money(tm.deposit)}</dd>
              <dt>{t('Notice')}</dt><dd>{tm.noticeDays} {t('days')}</dd>
            </dl>
            <button className="btn" onClick={() => openFile(`/public/sign/${token}/pdf`, `${c.number}.pdf`, { auth: false }).catch(e => setError(e.message))}>{t('Read the full contract (PDF)')}</button>

            {c.status === 'VOID' ? <div className="alert alert-error" style={{ marginTop: 16 }}>{t('This contract has been cancelled. Please contact Sakanly.')}</div>
              : done || c.tenantSigned ? (
                <div className="sign-done">
                  <div className="sign-tick">✓</div>
                  <h2>{t('Signed. Thank you!')}</h2>
                  <p className="small muted">{t('Sakanly has your signed contract. You can download a copy any time from this link.')}</p>
                  <button className="btn btn-primary" onClick={() => openFile(`/public/sign/${token}/pdf`, `${c.number}.pdf`, { download: true, auth: false })}>{t('Download my copy')}</button>
                </div>
              ) : (
                <div style={{ marginTop: 20 }}>
                  {error && <div className="alert alert-error">{error}</div>}
                  <div className="field"><label>{t('Your full name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
                  <label className="check" style={{ margin: '12px 0' }}>
                    <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> {t('I have read the contract and agree to all its terms.')}
                  </label>
                  <SignaturePad onChange={setSig} />
                  <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>{busy ? t('Signing…') : t('Sign the contract')}</button>
                  <p className="tiny faint" style={{ marginTop: 10 }}>{t('Your signature, the time and your internet address are saved with the contract.')}</p>
                </div>
              )}
          </>
        )}
      </main>
      <footer className="sign-foot tiny">Sakanly Real Estate · +971 56 591 3200 · info@sakanly.com</footer>
    </div>
  );
}
