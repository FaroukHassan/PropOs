// frontend/src/pages/InvoicesPage.jsx — invoices Sakanly issues and bills from suppliers, with 5% VAT
import { useState, useMemo } from 'react';
import { t } from '../lib/i18n';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs, openFile, fileToBase64 } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, today, INCOME_CATS, EXPENSE_CATS, downloadCsv } from '../lib/format';
import { Spinner, ErrorBox, Empty, Badge, Stat, Tabs, Modal, Drawer, Field, FormModal, useToast } from '../components/ui';

const round = n => Math.round(n * 100) / 100;
const plusDays = (iso, n) => new Date(new Date(iso).getTime() + n * 864e5).toISOString().slice(0, 10);

export default function InvoicesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const period = usePeriod();
  const [kind, setKind] = useSticky('inv_kind', 'SALES');
  const [state, setState] = useState('');
  const [q, setQ] = useState('');
  const params = { kind, ...period.params, q };
  const { data, loading, error, refetch } = useApi(`/invoices${qs(params)}`);
  const summary = useApi(`/invoices/summary${qs({ kind, ...period.params })}`);
  const settings = useApi('/invoices/settings');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const reload = () => { refetch(); summary.refetch(); };

  const rows = useMemo(() => (data || []).filter(r => !state || r.state === state || (state === 'OPEN' && ['UNPAID', 'PARTLY_PAID', 'OVERDUE'].includes(r.state))), [data, state]);
  if (error) return <ErrorBox error={error} retry={refetch} />;
  const s = summary.data;
  const sales = kind === 'SALES';

  return (
    <>
      <div className="toolbar">
        <Tabs value={kind} onChange={v => { setKind(v); setState(''); }} items={[['SALES', t('Invoices we issue')], ['PURCHASE', t('Supplier bills')]]} />
        <PeriodPicker />
        <input className="input" style={{ maxWidth: 220 }} placeholder={t('Search name or number')} value={q} onChange={e => setQ(e.target.value)} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`${sales ? 'invoices' : 'bills'}-${period.from}-${period.to}.csv`,
          [['Number', 'Date', 'Due', 'Party', 'TRN', 'Subtotal', 'VAT', 'Total', 'Paid', 'Balance', 'Status'],
            ...rows.map(r => [r.number, r.issueDate.slice(0, 10), r.dueDate ? r.dueDate.slice(0, 10) : '', r.partyName, r.partyTrn || '', r.subtotal, r.vat, r.total, r.paid, r.balance, r.state])])}>{t('Export')}</button>
        {can.write && <button className="btn btn-primary" onClick={() => setEditing({ kind })}>{sales ? t('+ New invoice') : t('+ Record a bill')}</button>}
      </div>

      {sales && settings.data && !settings.data.trn && (
        <div className="alert">{t('Add your VAT number (TRN) so it prints on tax invoices.')} {can.admin && <button className="btn btn-sm" onClick={() => setEditing({ settings: true })}>{t('Add TRN')}</button>}</div>
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat accent label={sales ? t('Invoiced') : t('Billed to us')} value={money(s?.total)} sub={t('{0} invoices · VAT {1}', [s?.count ?? 0, money(s?.vat)])} />
        <Stat label={sales ? t('Received') : t('Paid out')} value={money(s?.paid)} onClick={() => setState(v => (v === 'PAID' ? '' : 'PAID'))} active={state === 'PAID'} />
        <Stat label={sales ? t('Still to collect') : t('Still to pay')} value={money(s?.outstanding)} onClick={() => setState(v => (v === 'OPEN' ? '' : 'OPEN'))} active={state === 'OPEN'} />
        <Stat label={t('Overdue')} value={money(s?.overdue)} sub={t('{0} invoices', [s?.overdueCount ?? 0])} onClick={() => setState(v => (v === 'OVERDUE' ? '' : 'OVERDUE'))} active={state === 'OVERDUE'} />
      </div>

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="🧾" title={sales ? t('No invoices in this period') : t('No supplier bills in this period')}
          action={can.write && <button className="btn btn-primary" onClick={() => setEditing({ kind })}>{sales ? t('+ New invoice') : t('+ Record a bill')}</button>}>
          {sales ? t('Invoice a company, a tenant, a guest or an owner. VAT is added for you.') : t('Keep the bills you receive, with the file attached, and record when you pay them.')}
        </Empty>
      ) : (
        <div className="card card-flush"><div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('Number')}</th><th>{sales ? t('Bill to') : t('Supplier')}</th><th>{t('Date')}</th><th>{t('Due')}</th><th className="num">{t('Total')}</th><th className="num">{t('Balance')}</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r.id)}>
                  <td className="bold"><bdi dir="ltr">{r.number}</bdi>{r.supplierRef && <div className="tiny faint">{t('Ref.')} {r.supplierRef}</div>}</td>
                  <td>{r.partyName}<div className="tiny faint">{L.party[r.partyType]}</div></td>
                  <td className="small">{date(r.issueDate)}</td>
                  <td className="small">{r.dueDate ? date(r.dueDate) : '—'}</td>
                  <td className="num">{money(r.total)}</td>
                  <td className="num">{r.balance > 0 && r.state !== 'VOID' ? money(r.balance) : '—'}</td>
                  <td><Badge value={r.state} map={L.invState} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {open && <InvoiceDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} onEdit={inv => setEditing({ invoice: inv })} />}
      {editing?.settings && (
        <FormModal title={t('VAT number (TRN)')} fields={[{ name: 'trn', label: t('TRN (15 digits)'), required: true }]} initial={settings.data}
          onClose={() => setEditing(null)} onSubmit={async v => { await api.patch('/invoices/settings', v); toast(t('Saved')); setEditing(null); settings.refetch(); }} />
      )}
      {editing && !editing.settings && <InvoiceEditor kind={editing.invoice?.kind || editing.kind} invoice={editing.invoice}
        onClose={() => setEditing(null)} onSaved={inv => { setEditing(null); reload(); setOpen(inv.id); }} />}
    </>
  );
}

function InvoiceEditor({ kind, invoice, onClose, onSaved }) {
  const toast = useToast();
  const sales = kind === 'SALES';
  const tenants = useApi('/tenants');
  const landlords = useApi('/landlords');
  const [v, setV] = useState(() => invoice ? {
    ...invoice, issueDate: invoice.issueDate.slice(0, 10), dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : '',
    lines: invoice.lines.map(l => ({ ...l })),
  } : {
    kind, partyType: sales ? 'COMPANY' : 'SUPPLIER', partyName: '', partyTrn: '', partyAddress: '', partyEmail: '', partyPhone: '',
    issueDate: today(), dueDate: plusDays(today(), sales ? 7 : 30), vatRate: 5, category: sales ? 'LEASING_COMMISSION' : 'MAINTENANCE',
    supplierRef: '', notes: '', status: 'ISSUED', lines: [{ description: '', qty: 1, unitPrice: '', vat: true }],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, val) => setV(x => ({ ...x, [k]: val }));
  const setLine = (i, k, val) => setV(x => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: val } : l)) }));
  const paidAlready = invoice && invoice.paid > 0;

  const t0 = v.lines.reduce((a, l) => {
    const amt = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    return { sub: a.sub + amt, vat: a.vat + (l.vat ? amt * v.vatRate / 100 : 0) };
  }, { sub: 0, vat: 0 });

  const pickParty = (type, id) => {
    if (type === 'TENANT') {
      const x = (tenants.data || []).find(r => r.id === id);
      if (x) setV(p => ({ ...p, tenantId: x.id, landlordId: null, partyName: x.name, partyPhone: x.phone || '', partyEmail: x.email || '' }));
    } else if (type === 'LANDLORD') {
      const x = (landlords.data || []).find(r => r.id === id);
      if (x) setV(p => ({ ...p, landlordId: x.id, tenantId: null, partyName: x.name, partyPhone: x.phone || '', partyEmail: x.email || '' }));
    }
  };

  const save = async status => {
    setBusy(true); setError(null);
    try {
      const body = {
        ...v, status: status || v.status, dueDate: v.dueDate || null,
        lines: v.lines.filter(l => l.description || l.unitPrice).map(l => ({ ...l, qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || 0 })),
      };
      for (const k of ['id', 'number', 'paid', 'balance', 'state', 'transactions', 'subtotal', 'vat', 'total', 'hasScan', 'createdAt', 'updatedAt', 'orgId', 'createdBy', 'scanName', 'scanMime']) delete body[k];
      if (paidAlready) { delete body.lines; delete body.vatRate; }
      const inv = invoice ? await api.patch(`/invoices/${invoice.id}`, body) : await api.post('/invoices', body);
      toast(t('Saved')); onSaved(inv);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const cats = sales ? INCOME_CATS : EXPENSE_CATS;
  return (
    <Modal wide title={invoice ? t('Edit {0}', [invoice.number]) : sales ? t('New invoice') : t('Record a supplier bill')} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{t('Cancel')}</button>
        {sales && !invoice && <button className="btn" disabled={busy} onClick={() => save('DRAFT')}>{t('Save as draft')}</button>}
        <button className="btn btn-primary" disabled={busy} onClick={() => save(invoice?.status === 'DRAFT' || !invoice ? 'ISSUED' : undefined)}>{busy ? t('Saving…') : sales ? t('Issue invoice') : t('Save bill')}</button>
      </>}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field-grid">
        <Field label={sales ? t('Bill to') : t('Supplier type')}>
          <select className="input" value={v.partyType} onChange={e => set('partyType', e.target.value)}>
            {Object.entries(L.party).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        {v.partyType === 'TENANT' && <Field label={t('Tenant')}>
          <select className="input" value={v.tenantId || ''} onChange={e => pickParty('TENANT', e.target.value)}>
            <option value="">{t('Choose…')}</option>{(tenants.data || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select></Field>}
        {v.partyType === 'LANDLORD' && <Field label={t('Landlord / owner')}>
          <select className="input" value={v.landlordId || ''} onChange={e => pickParty('LANDLORD', e.target.value)}>
            <option value="">{t('Choose…')}</option>{(landlords.data || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select></Field>}
        <Field label={t('Name')}><input className="input" value={v.partyName} onChange={e => set('partyName', e.target.value)} required /></Field>
        <Field label={t('TRN (if VAT registered)')}><input className="input" dir="ltr" value={v.partyTrn || ''} onChange={e => set('partyTrn', e.target.value)} /></Field>
        <Field label={t('Address')}><input className="input" value={v.partyAddress || ''} onChange={e => set('partyAddress', e.target.value)} /></Field>
        <Field label={t('Email')}><input className="input" type="email" value={v.partyEmail || ''} onChange={e => set('partyEmail', e.target.value)} /></Field>
        <Field label={t('Phone')}><input className="input" dir="ltr" value={v.partyPhone || ''} onChange={e => set('partyPhone', e.target.value)} /></Field>
        {!sales && <Field label={t("Supplier's invoice no.")}><input className="input" dir="ltr" value={v.supplierRef || ''} onChange={e => set('supplierRef', e.target.value)} /></Field>}
        <Field label={t('Invoice date')}><input className="input" type="date" value={v.issueDate} onChange={e => set('issueDate', e.target.value)} /></Field>
        <Field label={t('Due date')}><input className="input" type="date" value={v.dueDate || ''} onChange={e => set('dueDate', e.target.value)} /></Field>
        <Field label={t('VAT')}>
          <select className="input" value={v.vatRate} disabled={paidAlready} onChange={e => set('vatRate', Number(e.target.value))}>
            <option value={5}>{t('5% VAT')}</option><option value={0}>{t('No VAT')}</option>
          </select>
        </Field>
        <Field label={t('Ledger category for payments')}>
          <select className="input" value={v.category || ''} onChange={e => set('category', e.target.value)}>
            {cats.map(c => <option key={c} value={c}>{L.category[c]}</option>)}
          </select>
        </Field>
      </div>

      <div className="section-title">{t('Lines')}</div>
      <div className="inv-lines">
        {v.lines.map((l, i) => (
          <div key={i} className="inv-line">
            <input className="input" placeholder={t('Description')} value={l.description} disabled={paidAlready} onChange={e => setLine(i, 'description', e.target.value)} />
            <input className="input num" type="number" step="any" min="0" placeholder={t('Qty')} value={l.qty} disabled={paidAlready} onChange={e => setLine(i, 'qty', e.target.value)} />
            <input className="input num" type="number" step="any" min="0" placeholder={t('Price')} value={l.unitPrice} disabled={paidAlready} onChange={e => setLine(i, 'unitPrice', e.target.value)} />
            <label className="check tiny" title={t('Charge VAT on this line')}><input type="checkbox" checked={l.vat} disabled={paidAlready || !v.vatRate} onChange={e => setLine(i, 'vat', e.target.checked)} /> {t('VAT')}</label>
            <div className="num small">{money(round((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)))}</div>
            {!paidAlready && v.lines.length > 1 ? <button className="btn btn-ghost btn-icon" aria-label={t('Remove line')} onClick={() => setV(x => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))}>✕</button> : <span />}
          </div>
        ))}
        {!paidAlready && <button className="btn btn-sm" onClick={() => setV(x => ({ ...x, lines: [...x.lines, { description: '', qty: 1, unitPrice: '', vat: true }] }))}>{t('+ Add line')}</button>}
      </div>
      <div className="inv-totals">
        <div><span>{t('Subtotal')}</span><b>{money(round(t0.sub))}</b></div>
        <div><span>{t('VAT {0}%', [v.vatRate])}</span><b>{money(round(t0.vat))}</b></div>
        <div className="inv-total"><span>{t('Total')}</span><b>{money(round(t0.sub + t0.vat))}</b></div>
      </div>
      <Field label={t('Notes (printed on the invoice, e.g. bank details)')}><textarea className="input" value={v.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
    </Modal>
  );
}

function InvoiceDrawer({ id, onClose, onChanged, onEdit }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: inv, refetch } = useApi(`/invoices/${id}`);
  const [paying, setPaying] = useState(false);
  if (!inv) return <Drawer title="…" onClose={onClose}><Spinner /></Drawer>;
  const sales = inv.kind === 'SALES';
  const fail = e => toast(e.message, 'error');
  const changed = () => { refetch(); onChanged(); };

  return (
    <Drawer title={<bdi dir="ltr">{inv.number}</bdi>} subtitle={`${inv.partyName} · ${money(inv.total)}`} onClose={onClose}
      actions={can.write && inv.state !== 'VOID' && <button className="btn btn-sm" onClick={() => onEdit(inv)}>{t('Edit')}</button>}>
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        <Badge value={inv.state} map={L.invState} />
        <button className="btn btn-sm" onClick={() => openFile(`/invoices/${inv.id}/pdf`, `${inv.number}.pdf`).catch(fail)}>{t('PDF')}</button>
        <button className="btn btn-sm" onClick={() => openFile(`/invoices/${inv.id}/pdf`, `${inv.number}.pdf`, { download: true }).catch(fail)}>{t('Download')}</button>
        {inv.hasScan && <button className="btn btn-sm" onClick={() => openFile(`/invoices/${inv.id}/scan`, inv.scanName || 'bill').catch(fail)}>{t("Supplier's file")}</button>}
        {can.write && inv.balance > 0 && inv.state !== 'VOID' && <button className="btn btn-sm btn-primary" onClick={() => setPaying(true)}>{sales ? t('Record payment') : t('Pay bill')}</button>}
        {can.write && !sales && <label className="btn btn-sm">{inv.hasScan ? t('Replace file') : t('Attach bill')}
          <input type="file" hidden accept="image/*,application/pdf" onChange={async e => {
            const f = e.target.files[0]; e.target.value = ''; if (!f) return;
            try { await api.post(`/invoices/${inv.id}/scan`, { fileName: f.name, data: await fileToBase64(f) }); toast(t('Uploaded')); changed(); } catch (err) { fail(err); }
          }} /></label>}
        {can.write && inv.partyEmail && sales && <a className="btn btn-sm" href={`mailto:${inv.partyEmail}?subject=${encodeURIComponent(`Invoice ${inv.number} — Sakanly`)}&body=${encodeURIComponent(`Dear ${inv.partyName},\n\nPlease find invoice ${inv.number} for AED ${inv.total.toLocaleString('en-US')}, due ${inv.dueDate ? inv.dueDate.slice(0, 10) : 'on receipt'}. The PDF is attached.\n\nThank you,\nSakanly`)}`}>{t('Email')}</a>}
        {can.write && inv.state === 'DRAFT' && inv.paid === 0 && <button className="btn btn-sm btn-ghost" onClick={async () => { if (!confirm(t('Delete this draft?'))) return; await api.del(`/invoices/${inv.id}`).catch(fail); onChanged(); onClose(); }}>{t('Delete')}</button>}
        {can.write && inv.state !== 'VOID' && inv.state !== 'DRAFT' && inv.paid === 0 && <button className="btn btn-sm btn-ghost" onClick={async () => { if (!confirm(t('Void this invoice? It stays on record marked VOID.'))) return; await api.post(`/invoices/${inv.id}/void`).catch(fail); changed(); }}>{t('Void')}</button>}
      </div>
      <dl className="kv">
        <dt>{t('Type')}</dt><dd>{L.party[inv.partyType]}</dd>
        {inv.partyTrn && <><dt>{t('TRN')}</dt><dd dir="ltr">{inv.partyTrn}</dd></>}
        {inv.supplierRef && <><dt>{t("Supplier's no.")}</dt><dd>{inv.supplierRef}</dd></>}
        <dt>{t('Date')}</dt><dd>{date(inv.issueDate)}</dd>
        <dt>{t('Due')}</dt><dd>{inv.dueDate ? date(inv.dueDate) : '—'}</dd>
        <dt>{t('Ledger')}</dt><dd>{inv.category ? L.category[inv.category] : '—'}</dd>
      </dl>
      <div className="section-title">{t('Lines')}</div>
      {inv.lines.map((l, i) => (
        <div key={i} className="list-item"><div>{l.description}<div className="tiny faint">{l.qty} × {money(l.unitPrice)}{l.vat && inv.vatRate ? '' : ` · ${t('no VAT')}`}</div></div><div className="num">{money(l.qty * l.unitPrice)}</div></div>
      ))}
      <div className="inv-totals">
        <div><span>{t('Subtotal')}</span><b>{money(inv.subtotal)}</b></div>
        <div><span>{t('VAT {0}%', [inv.vatRate])}</span><b>{money(inv.vat)}</b></div>
        <div className="inv-total"><span>{t('Total')}</span><b>{money(inv.total)}</b></div>
        <div><span>{sales ? t('Received') : t('Paid')}</span><b>{money(inv.paid)}</b></div>
        <div><span>{t('Balance')}</span><b>{money(inv.balance)}</b></div>
      </div>
      <div className="section-title">{t('Payments')}</div>
      {inv.transactions.length === 0 && <p className="small muted">{t('None yet.')}</p>}
      {inv.transactions.map(tx => (
        <div key={tx.id} className="list-item"><div>{date(tx.date)}<div className="tiny faint">{L.method[tx.method]} · {L.category[tx.category]}</div></div><div className="num">{money(tx.amount)}</div></div>
      ))}
      {inv.notes && <><div className="section-title">{t('Notes')}</div><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{inv.notes}</p></>}

      {paying && <FormModal title={sales ? t('Record payment') : t('Pay bill')}
        fields={[
          { name: 'amount', label: t('Amount (AED)'), type: 'number', required: true, default: inv.balance },
          { name: 'date', label: t('Date'), type: 'date', required: true, default: today() },
          { name: 'method', label: t('Method'), type: 'select', required: true, default: 'BANK', options: Object.entries(L.method).map(([value, label]) => ({ value, label })) },
          { name: 'notes', label: t('Notes'), type: 'textarea' },
        ]}
        intro={<p className="small muted">{t('This adds the payment to Income & expenses as well.')}</p>}
        onClose={() => setPaying(false)}
        onSubmit={async v => { await api.post(`/invoices/${inv.id}/payments`, v); toast(t('Payment recorded')); setPaying(false); changed(); }} />}
    </Drawer>
  );
}
