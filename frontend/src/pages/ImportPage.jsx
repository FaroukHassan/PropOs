// frontend/src/pages/ImportPage.jsx — paste rows straight from Google Sheets, preview, then import
import { t } from '../lib/i18n';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L } from '../lib/format';
import { Tabs, Badge, useToast } from '../components/ui';

const KINDS = {
  spaces: {
    label: t("Partitions availability"),
    help: t("From \"Sakanly – Partitions Availability\" or the monthly availability sheet. Needs BUILDING, FLAT NO., PARTITION NUMBER and PRICE columns. Creates any missing buildings and flats; running it again updates prices and statuses."),
  },
  transactions: {
    label: t("Income & expenses"),
    help: t("From a Transaction Log or bank sheet. Needs Date, Type (INCOME / EXPENSE), Amount, and ideally Category, Description, Apartment and Partition. Rent is linked to the tenant when the partition matches."),
  },
  cheques: {
    label: t("Cheques"),
    help: t("Needs Cheque No, Date and Amount, plus Apartment, Bank and Status. Status words follow your colours: Paid (yellow), Postponed (green, add a \"New Date\" column), Pending (white / blank). Cheques already in the system are skipped."),
  },
};

// Parse what Google Sheets puts on the clipboard (tab-separated) or a CSV file
function parseTable(text) {
  const delim = text.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim() !== ''));
  if (clean.length < 2) return [];
  const headers = clean[0].map(h => h.trim());
  return clean.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h || `col${i + 1}`, (r[i] ?? '').trim()])));
}

export default function ImportPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState('spaces');
  const [direction, setDirection] = useState('OUT');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const rows = parseTable(text);

  const run = async dryRun => {
    setBusy(true); setError(null);
    try {
      const r = await api.post('/import', { kind, rows, dryRun, direction });
      if (dryRun) setPreview(r);
      else { toast(t("Imported {0} rows", [r.created + r.updated])); setPreview({ ...r, done: true }); setText(''); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const onFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { setError(t('Excel files: open the sheet, select the table and paste it below, or use File → Download → CSV.')); return; }
    const r = new FileReader();
    r.onload = () => { setText(String(r.result)); setPreview(null); };
    r.readAsText(f);
  };

  if (!can.write) return <div className="alert alert-info">{t("Your account is read-only.")}</div>;
  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <div className="card">
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <Tabs value={kind} onChange={k => { setKind(k); setPreview(null); }} items={Object.entries(KINDS).map(([k, v]) => [k, v.label])} />
          {kind === 'cheques' && (
            <select className="input input-sm" value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="OUT">{t("Issued to landlords")}</option><option value="IN">{t("Received from tenants")}</option>
            </select>
          )}
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>{KINDS[kind].help}</p>
        <ol className="small" style={{ paddingInlineStart: 18, marginBottom: 12, color: 'var(--text-2)' }}>
          <li>{t("In Google Sheets, select the table")} <b>{t("including the header row")}</b> {t("and copy it (Ctrl/Cmd + C).")}</li>
          <li>{t("Paste it in the box below, or upload a CSV.")}</li>
          <li>{t("Check the preview, then import.")}</li>
        </ol>
        <textarea className="input" rows={8} placeholder={t("Paste here…")} value={text} onChange={e => { setText(e.target.value); setPreview(null); }} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
        <div className="row-between" style={{ marginTop: 10 }}>
          <label className="btn btn-sm">{t("Upload CSV")}<input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={onFile} hidden /></label>
          <div className="row">
            <span className="small muted">{rows.length ? t("{0} rows · columns: {1}{2}", [rows.length, Object.keys(rows[0]).slice(0, 6).join(', '), Object.keys(rows[0]).length > 6 ? '…' : '']) : t("No rows yet")}</span>
            <button className="btn" disabled={!rows.length || busy} onClick={() => run(true)}>{t("Preview")}</button>
            <button className="btn btn-primary" disabled={!preview || preview.done || busy} onClick={() => run(false)}>{busy ? t("Working…") : t("Import")}</button>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {preview && (
        <div className="card card-flush">
          <div className="card-head">
            <div className="card-title">{preview.done ? t("Imported") : t("Preview")} · {preview.created} {t("new")}{preview.updated ? t(" · {0} updated", [preview.updated]) : ''}{preview.skipped.length ? t(" · {0} skipped", [preview.skipped.length]) : ''}</div>
          </div>
          {preview.skipped.length > 0 && (
            <div className="alert alert-info" style={{ margin: '0 18px 12px' }}>
              {preview.skipped.slice(0, 8).map(s => <div key={s.row}>{t("Row")} {s.row}: {s.reason}</div>)}
              {preview.skipped.length > 8 && <div>{t("…and")} {preview.skipped.length - 8} {t("more")}</div>}
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table className="table">
              {kind === 'spaces' && <>
                <thead><tr><th>{t("Building")}</th><th>{t("Flat")}</th><th>{t("Code")}</th><th className="num">{t("Rent")}</th><th>{t("Status")}</th><th>{t("Features")}</th><th></th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td>{p.building}</td><td>{p.unit}</td><td className="bold">{p.code}</td><td className="num">{money(p.monthlyRate)}</td><td>{p.status ? <Badge value={p.status} map={L.spaceStatus} /> : '—'}</td><td className="small">{p.amenities}</td><td><Badge tone={p.action === 'create' ? 'green' : 'blue'}>{p.action}</Badge></td></tr>)}</tbody>
              </>}
              {kind === 'transactions' && <>
                <thead><tr><th>{t("Date")}</th><th>{t("Type")}</th><th>{t("Category")}</th><th>{t("Description")}</th><th>{t("Apartment")}</th><th className="num">{t("Amount")}</th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td className="small">{date(p.date)}</td><td><Badge value={p.type} map={L.txType} /></td><td className="small">{L.category[p.category]}</td><td className="small">{p.description}</td><td className="small">{p.unit}{p.space ? ` · ${p.space}` : ''}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody>
              </>}
              {kind === 'cheques' && <>
                <thead><tr><th>{t("Date")}</th><th>{t("No.")}</th><th>{t("Apartment")}</th><th>{t("Name")}</th><th>{t("Bank")}</th><th className="num">{t("Amount")}</th><th>{t("Status")}</th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td className="small">{date(p.dueDate)}</td><td>{p.number}</td><td className="small">{p.unit}</td><td className="small">{p.party}</td><td className="small">{p.bank}</td><td className="num">{money(p.amount)}</td><td><Badge value={p.status} map={L.chequeStatus} /></td></tr>)}</tbody>
              </>}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
