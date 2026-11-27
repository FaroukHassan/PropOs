// frontend/src/components/TenantFile.jsx — documents (ID, passport…) and sub-lease contracts in a tenant's file
import { useState } from 'react';
import { t } from '../lib/i18n';
import { useApi } from '../lib/hooks';
import { api, openFile, fileToBase64 } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, L } from '../lib/format';
import { contractFields } from '../lib/forms';
import { Badge, Modal, FormModal, Field, useToast } from './ui';
import SignaturePad from './SignaturePad';

const kb = n => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function TenantDocuments({ tenant, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: docs, refetch } = useApi(`/tenant-documents?tenantId=${tenant.id}`);
  const [adding, setAdding] = useState(false);
  const soon = d => d.expiresAt && new Date(d.expiresAt) < new Date(Date.now() + 30 * 864e5);

  return (
    <>
      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>{t("ID and documents")}</span>
        {can.write && <button className="btn btn-sm" onClick={() => setAdding(true)}>{t("+ Upload")}</button>}
      </div>
      {docs && docs.length === 0 && <p className="small muted">{t("No ID or passport uploaded yet.")}</p>}
      {(docs || []).map(d => (
        <div key={d.id} className="list-item">
          <div>
            <div className="bold">{L.docKind[d.kind]}{d.number && <span className="muted"> · <bdi dir="ltr">{d.number}</bdi></span>}</div>
            <div className="tiny faint">{d.fileName} · {kb(d.size)}{d.expiresAt && <> · <span className={soon(d) ? 'text-red' : ''}>{t("expires")} {date(d.expiresAt)}</span></>}</div>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => openFile(`/tenant-documents/${d.id}/file`, d.fileName).catch(e => toast(e.message, 'error'))}>{t("View")}</button>
            {can.write && <button className="btn btn-sm btn-ghost" aria-label={t("Delete")} onClick={async () => {
              if (!confirm(t("Delete this document?"))) return;
              await api.del(`/tenant-documents/${d.id}`); refetch();
            }}>✕</button>}
          </div>
        </div>
      ))}
      {adding && <UploadDocModal tenant={tenant} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refetch(); onChanged?.(); toast(t("Uploaded")); }} />}
    </>
  );
}

function UploadDocModal({ tenant, onClose, onDone }) {
  const [kind, setKind] = useState('EMIRATES_ID');
  const [file, setFile] = useState(null);
  const [number, setNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    if (!file) return setError(t("Choose a photo or PDF"));
    if (file.size > 8 * 1024 * 1024) return setError(t("The file is larger than 8 MB"));
    setBusy(true); setError(null);
    try {
      await api.post('/tenant-documents', { tenantId: tenant.id, kind, fileName: file.name, data: await fileToBase64(file), number: number || null, expiresAt: expiresAt || null });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={t("Upload ID or passport")} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t("Cancel")}</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? t("Uploading…") : t("Upload")}</button></>}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field-grid">
        <Field label={t("Document")}>
          <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
            {Object.entries(L.docKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={t("File (photo or PDF)")}>
          <input className="input" type="file" accept="image/*,application/pdf" capture="environment" onChange={e => setFile(e.target.files[0] || null)} />
        </Field>
        <Field label={t("Document number")}><input className="input" value={number} onChange={e => setNumber(e.target.value)} dir="ltr" /></Field>
        <Field label={t("Expiry date")}><input className="input" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></Field>
      </div>
      <p className="tiny faint">{t("Photos from the phone camera work. Max 8 MB.")}</p>
    </Modal>
  );
}

export function TenantContracts({ tenant }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const { data: contracts, refetch } = useApi(`/contracts?tenantId=${tenant.id}`);
  const [drawing, setDrawing] = useState(null);   // new / edit
  const [signing, setSigning] = useState(null);   // { contract, who }
  const [uploading, setUploading] = useState(null);
  const leases = tenant.leases || [];
  const link = c => `${window.location.origin}${window.location.pathname}#/sign/${c.signToken}`;
  const fail = e => toast(e.message, 'error');

  const share = async c => {
    const url = link(c);
    const text = `${t("Hello")} ${tenant.name}, ${t("please read and sign your Sakanly sub-lease contract here:")} ${url}`;
    try { await navigator.clipboard.writeText(url); toast(t("Signing link copied")); } catch { /* clipboard blocked */ }
    if (tenant.phone) window.open(`https://wa.me/${tenant.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>{t("Contracts")}</span>
        {can.write && leases.length > 0 && <button className="btn btn-sm" onClick={() => setDrawing({})}>{t("+ Sub-lease contract")}</button>}
      </div>
      {contracts && contracts.length === 0 && <p className="small muted">{leases.length ? t("No contract yet. Draw one up from the tenancy, sign it, and send the tenant a link to sign.") : t("Add a tenancy first.")}</p>}
      {(contracts || []).map(c => (
        <div key={c.id} className="contract-card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="bold"><bdi dir="ltr">{c.number}</bdi></div>
              <div className="tiny faint">{c.terms.premises.building} {c.terms.premises.unit}{c.terms.premises.space ? ` · ${c.terms.premises.space}` : ''} · {t("from")} {date(c.terms.startDate)}</div>
            </div>
            <Badge value={c.status} map={L.contractStatus} />
          </div>
          <div className="contract-steps">
            <span className={c.companySigned ? 'done' : ''}>{c.companySigned ? '✓' : '○'} {t("Sakanly")}{c.companySignedBy ? ` (${c.companySignedBy})` : ''}</span>
            <span className={c.tenantSigned ? 'done' : ''}>{c.tenantSigned ? '✓' : '○'} {t("Tenant")}{c.tenantSignedIp ? ` · ${t("online")}` : ''}</span>
            {c.hasScan && <span className="done">✓ {t("Signed copy uploaded")}</span>}
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => openFile(`/contracts/${c.id}/pdf`, `${c.number}.pdf`).catch(fail)}>{t("PDF")}</button>
            <button className="btn btn-sm" onClick={() => openFile(`/contracts/${c.id}/pdf`, `${c.number}.pdf`, { download: true }).catch(fail)}>{t("Download")}</button>
            {c.hasScan && <button className="btn btn-sm" onClick={() => openFile(`/contracts/${c.id}/pdf?original=1`, `${c.number}-signed.pdf`).catch(fail)}>{t("Signed copy")}</button>}
            {can.write && c.status !== 'VOID' && <>
              {!c.companySigned && <button className="btn btn-sm btn-primary" onClick={() => setSigning({ contract: c, who: 'company' })}>{t("Sign for Sakanly")}</button>}
              {!c.tenantSigned && <button className="btn btn-sm" onClick={() => setSigning({ contract: c, who: 'tenant' })}>{t("Tenant signs here")}</button>}
              {!c.tenantSigned && <button className="btn btn-sm" onClick={() => share(c)}>{t("Send signing link")}</button>}
              {!c.hasScan && <button className="btn btn-sm" onClick={() => setUploading(c)}>{t("Upload signed copy")}</button>}
              {!c.companySigned && !c.tenantSigned && !c.hasScan && <button className="btn btn-sm btn-ghost" onClick={() => setDrawing({ contract: c })}>{t("Edit terms")}</button>}
              <button className="btn btn-sm btn-ghost" onClick={async () => {
                if (!confirm(t("Void this contract? It stays in the file marked VOID."))) return;
                await api.post(`/contracts/${c.id}/void`).catch(fail); refetch();
              }}>{t("Void")}</button>
            </>}
          </div>
        </div>
      ))}

      {drawing && (
        <FormModal wide title={drawing.contract ? t("Edit contract terms") : t("New sub-lease contract")}
          fields={drawing.contract ? contractFields(leases).slice(1) : contractFields(leases)}
          initial={drawing.contract ? { ...drawing.contract.terms, specialTerms: drawing.contract.terms.specialTerms || '', specialTermsAr: drawing.contract.terms.specialTermsAr || '' } : { leaseId: (leases.find(l => l.status !== 'ENDED') || leases[0])?.id, noticeDays: 30 }}
          intro={<p className="small muted">{t("Sakanly Stay Holiday Homes LLC and the tenant. The contract is in English and Arabic; parties, apartment and money come from the tenancy and the tenant's details.")}</p>}
          submitLabel={drawing.contract ? t("Save") : t("Draw up contract")}
          onClose={() => setDrawing(null)}
          onSubmit={async v => {
            if (drawing.contract) await api.patch(`/contracts/${drawing.contract.id}`, v);
            else await api.post('/contracts', v);
            toast(t("Saved")); setDrawing(null); refetch();
          }} />
      )}
      {signing && <SignModal {...signing} defaultName={signing.who === 'company' ? user.name : tenant.name}
        onClose={() => setSigning(null)} onDone={() => { setSigning(null); refetch(); toast(t("Signed")); }} />}
      {uploading && <UploadScanModal contract={uploading} onClose={() => setUploading(null)} onDone={() => { setUploading(null); refetch(); toast(t("Uploaded")); }} />}
    </>
  );
}

function SignModal({ contract, who, defaultName, onClose, onDone }) {
  const [sig, setSig] = useState(null);
  const [name, setName] = useState(defaultName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    if (!sig) return setError(t("Please sign first"));
    setBusy(true);
    try { await api.post(`/contracts/${contract.id}/sign-${who}`, { signature: sig, name }); onDone(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={who === 'company' ? t("Sign for Sakanly") : t("Tenant signature")} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t("Cancel")}</button><button className="btn btn-primary" disabled={busy} onClick={save}>{t("Sign")}</button></>}>
      {error && <div className="alert alert-error">{error}</div>}
      <p className="small muted">{who === 'tenant' ? t("Hand the screen to the tenant. By signing they agree to all the terms of contract") : t("You are signing contract")} <bdi dir="ltr">{contract.number}</bdi>.</p>
      <Field label={t("Full name")}><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <SignaturePad onChange={setSig} />
    </Modal>
  );
}

function UploadScanModal({ contract, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    if (!file) return setError(t("Choose the signed PDF"));
    setBusy(true);
    try { await api.post(`/contracts/${contract.id}/upload`, { fileName: file.name, data: await fileToBase64(file) }); onDone(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={t("Upload signed copy")} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t("Cancel")}</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? t("Uploading…") : t("Upload")}</button></>}>
      {error && <div className="alert alert-error">{error}</div>}
      <p className="small muted">{t("Printed, signed by both sides and scanned? Upload it here as a PDF (max 10 MB). It is kept with the contract and marks it as signed.")}</p>
      <input className="input" type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0] || null)} />
    </Modal>
  );
}
