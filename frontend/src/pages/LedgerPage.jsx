// frontend/src/pages/LedgerPage.jsx — every dirham in and out (replaces the Transaction Log / BANK sheet)
import { useState } from 'react';
import { useScope } from '../lib/scope';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, isoDay, downloadCsv, unitName } from '../lib/format';
import { transactionFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Stat, Tabs, useToast } from '../components/ui';

export default function LedgerPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useSticky('ledger_month', monthKey());
  const [type, setType] = useSticky('ledger_type', '');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const units = useApi('/units');
  const { params: scope } = useScope();
  const params = qs({ month, type, category, q, ...scope });
  const { data, loading, error, refetch } = useApi(`/transactions${params}`);
  const summary = useApi(`/transactions/summary${params}`);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = data || [];
  const reload = () => { refetch(); summary.refetch(); };

  return (
    <>
      <div className="toolbar">
        <MonthPicker value={month} onChange={setMonth} />
        <Tabs value={type} onChange={t => { setType(t); setCategory(''); }} items={[['', 'All'], ['INCOME', 'Income'], ['EXPENSE', 'Expenses']]} />
        <select className="input input-sm" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(L.category).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input input-sm" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} style={{ width: 150 }} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`ledger-${month}.csv`, rows.map(t => ({
          Date: isoDay(t.date), Type: t.type, Category: L.category[t.category], Description: t.description, Apartment: t.unit ? unitName(t.unit) : '', Partition: t.space?.code || '',
          Tenant: t.lease?.tenant?.name || '', Amount: t.amount, Method: L.method[t.method], Estimated: t.estimated ? 'yes' : '', Notes: t.notes || '',
        })))}>Export</button>
        {can.write && <>
          <button className="btn" onClick={() => setModal({ preset: { type: 'EXPENSE', category: 'DEWA' } })}>+ Expense</button>
          <button className="btn btn-primary" onClick={() => setModal({ preset: { type: 'INCOME', category: 'RENT' } })}>+ Income</button>
        </>}
      </div>

      {summary.data && (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          <Stat label="Income" value={money(summary.data.income)} />
          <Stat label="Expenses" value={money(summary.data.expenses)} />
          <Stat accent label="Net" value={money(summary.data.net)} sub={summary.data.income ? `Margin ${Math.round((summary.data.net / summary.data.income) * 100)}%` : undefined} />
        </div>
      )}

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="≡" title="Nothing recorded">Record rent, DEWA, salaries and every other payment here, or import your bank sheet.</Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Apartment</th><th>Method</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id} className={can.write ? 'clickable' : ''} onClick={() => can.write && setModal({ tx: t })}>
                    <td className="small nowrap">{date(t.date)}</td>
                    <td>{t.description}{t.estimated && <> <Badge tone="amber">estimated</Badge></>}
                      {(t.lease?.tenant || t.notes) && <div className="tiny faint">{[t.lease?.tenant?.name, t.notes].filter(Boolean).join(' · ')}</div>}</td>
                    <td><Badge tone={t.type === 'INCOME' ? 'green' : ''}>{L.category[t.category]}</Badge></td>
                    <td className="small">{t.unit ? `${t.unit.number}${t.space ? ` · ${t.space.code}` : ''}` : <span className="faint">Company</span>}</td>
                    <td className="small">{L.method[t.method]}</td>
                    <td className="num bold" style={{ color: t.type === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>{t.type === 'INCOME' ? '+' : '−'}{money(t.amount).replace('AED ', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <FormModal title={modal.tx ? 'Edit entry' : modal.preset.type === 'INCOME' ? 'Record income' : 'Record expense'} wide
          fields={transactionFields({ units: units.data, preset: modal.preset || {} })}
          initial={modal.tx ? { ...modal.tx, date: isoDay(modal.tx.date) } : {}}
          intro={modal.tx?.chequeId && <div className="alert alert-info">Created automatically when a cheque was marked paid.</div>}
          onClose={() => setModal(null)}
          onDelete={modal.tx ? async () => { await api.del(`/transactions/${modal.tx.id}`); toast('Deleted'); setModal(null); reload(); } : undefined}
          onSubmit={async v => {
            if (modal.tx) await api.patch(`/transactions/${modal.tx.id}`, v); else await api.post('/transactions', v);
            toast('Saved'); setModal(null); reload();
          }} />
      )}
    </>
  );
}
