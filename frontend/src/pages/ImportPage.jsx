// frontend/src/pages/ImportPage.jsx — paste rows straight from Google Sheets, preview, then import
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L } from '../lib/format';
import { Tabs, Badge, useToast } from '../components/ui';

const KINDS = {
  spaces: {
    label: 'Partitions availability',
    help: 'From "Sakanly – Partitions Availability" or the monthly availability sheet. Needs BUILDING, FLAT NO., PARTITION NUMBER and PRICE columns. Creates any missing buildings and flats; running it again updates prices and statuses.',
  },
  transactions: {
    label: 'Income & expenses',
    help: 'From a Transaction Log or bank sheet. Needs Date, Type (INCOME / EXPENSE), Amount, and ideally Category, Description, Apartment and Partition. Rent is linked to the tenant when the partition matches.',
  },
  cheques: {
    label: 'Cheques',
    help: 'Needs Cheque No, Date and Amount, plus Apartment, Bank and Status. Status words follow your colours: Paid (yellow), Postponed (green, add a "New Date" column), Pending (white / blank). Cheques already in the system are skipped.',
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
      else { toast(`Imported ${r.created + r.updated} rows`); setPreview({ ...r, done: true }); setText(''); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const onFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { setError('Excel files: open the sheet, select the table and paste it below, or use File → Download → CSV.'); return; }
    const r = new FileReader();
    r.onload = () => { setText(String(r.result)); setPreview(null); };
    r.readAsText(f);
  };

  if (!can.write) return <div className="alert alert-info">Your account is read-only.</div>;
  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <div className="card">
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <Tabs value={kind} onChange={k => { setKind(k); setPreview(null); }} items={Object.entries(KINDS).map(([k, v]) => [k, v.label])} />
          {kind === 'cheques' && (
            <select className="input input-sm" value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="OUT">Issued to landlords</option><option value="IN">Received from tenants</option>
            </select>
          )}
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>{KINDS[kind].help}</p>
        <ol className="small" style={{ paddingLeft: 18, marginBottom: 12, color: 'var(--text-2)' }}>
          <li>In Google Sheets, select the table <b>including the header row</b> and copy it (Ctrl/Cmd + C).</li>
          <li>Paste it in the box below, or upload a CSV.</li>
          <li>Check the preview, then import.</li>
        </ol>
        <textarea className="input" rows={8} placeholder="Paste here…" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
        <div className="row-between" style={{ marginTop: 10 }}>
          <label className="btn btn-sm">Upload CSV<input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={onFile} hidden /></label>
          <div className="row">
            <span className="small muted">{rows.length ? `${rows.length} rows · columns: ${Object.keys(rows[0]).slice(0, 6).join(', ')}${Object.keys(rows[0]).length > 6 ? '…' : ''}` : 'No rows yet'}</span>
            <button className="btn" disabled={!rows.length || busy} onClick={() => run(true)}>Preview</button>
            <button className="btn btn-primary" disabled={!preview || preview.done || busy} onClick={() => run(false)}>{busy ? 'Working…' : 'Import'}</button>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {preview && (
        <div className="card card-flush">
          <div className="card-head">
            <div className="card-title">{preview.done ? 'Imported' : 'Preview'} · {preview.created} new{preview.updated ? ` · ${preview.updated} updated` : ''}{preview.skipped.length ? ` · ${preview.skipped.length} skipped` : ''}</div>
          </div>
          {preview.skipped.length > 0 && (
            <div className="alert alert-info" style={{ margin: '0 18px 12px' }}>
              {preview.skipped.slice(0, 8).map(s => <div key={s.row}>Row {s.row}: {s.reason}</div>)}
              {preview.skipped.length > 8 && <div>…and {preview.skipped.length - 8} more</div>}
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table className="table">
              {kind === 'spaces' && <>
                <thead><tr><th>Building</th><th>Flat</th><th>Code</th><th className="num">Rent</th><th>Status</th><th>Features</th><th></th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td>{p.building}</td><td>{p.unit}</td><td className="bold">{p.code}</td><td className="num">{money(p.monthlyRate)}</td><td>{p.status ? <Badge value={p.status} map={L.spaceStatus} /> : '—'}</td><td className="small">{p.amenities}</td><td><Badge tone={p.action === 'create' ? 'green' : 'blue'}>{p.action}</Badge></td></tr>)}</tbody>
              </>}
              {kind === 'transactions' && <>
                <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Apartment</th><th className="num">Amount</th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td className="small">{date(p.date)}</td><td><Badge value={p.type} map={L.txType} /></td><td className="small">{L.category[p.category]}</td><td className="small">{p.description}</td><td className="small">{p.unit}{p.space ? ` · ${p.space}` : ''}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody>
              </>}
              {kind === 'cheques' && <>
                <thead><tr><th>Date</th><th>No.</th><th>Apartment</th><th>Name</th><th>Bank</th><th className="num">Amount</th><th>Status</th></tr></thead>
                <tbody>{preview.preview.map((p, i) => <tr key={i}><td className="small">{date(p.dueDate)}</td><td>{p.number}</td><td className="small">{p.unit}</td><td className="small">{p.party}</td><td className="small">{p.bank}</td><td className="num">{money(p.amount)}</td><td><Badge value={p.status} map={L.chequeStatus} /></td></tr>)}</tbody>
              </>}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
