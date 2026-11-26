// frontend/src/pages/LedgerPage.jsx — every dirham in and out (replaces the Transaction Log / BANK sheet)
import { t } from '../lib/i18n';
import { useState } from 'react';
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, isoDay, downloadCsv, unitName } from '../lib/format';
import { transactionFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Stat, Tabs, useToast } from '../components/ui';

export default function LedgerPage() {
  const { can } = useAuth();
  const toast = useToast();
  const period = usePeriod();
  const [type, setType] = useSticky('ledger_type', '');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const units = useApi('/units');
  const { params: scope } = useScope();
  const params = qs({ ...period.params, type, category, q, ...scope });
  const { data, loading, error, refetch } = useApi(`/transactions${params}`);
  const summary = useApi(`/transactions/summary${params}`);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = data || [];
  const reload = () => { refetch(); summary.refetch(); };

  return (
    <>
      <div className="toolbar">
        <PeriodPicker />
        <Tabs value={type} onChange={tx => { setType(tx); setCategory(''); }} items={[['', t("All")], ['INCOME', t("Income")], ['EXPENSE', t("Expenses")]]} />
        <select className="input input-sm" value={category} onChange={e => setCategory(e.target.value)} aria-label={t("Category")}>
          <option value="">{t("All categories")}</option>
          {Object.entries(L.category).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input input-sm" placeholder={t("Search")} value={q} onChange={e => setQ(e.target.value)} style={{ width: 150 }} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`ledger-${period.month || `${period.from}_to_${period.to}`}.csv`, rows.map(tx => ({
          Date: isoDay(tx.date), Type: tx.type, Category: L.category[tx.category], Description: tx.description, Apartment: tx.unit ? unitName(tx.unit) : '', Partition: tx.space?.code || '',
          Tenant: tx.lease?.tenant?.name || '', Amount: tx.amount, Method: L.method[tx.method], Estimated: tx.estimated ? 'yes' : '', Notes: tx.notes || '',
        })))}>{t("Export")}</button>
        {can.write && <>
          <button className="btn" onClick={() => setModal({ preset: { type: 'EXPENSE', category: 'DEWA' } })}>{t("+ Expense")}</button>
          <button className="btn btn-primary" onClick={() => setModal({ preset: { type: 'INCOME', category: 'RENT' } })}>{t("+ Income")}</button>
        </>}
      </div>

      {summary.data && (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          <Stat label={t("Income")} value={money(summary.data.income)} />
          <Stat label={t("Expenses")} value={money(summary.data.expenses)} />
          <Stat accent label={t("Net")} value={money(summary.data.net)} sub={summary.data.income ? t("Margin {0}%", [Math.round((summary.data.net / summary.data.income) * 100)]) : undefined} />
        </div>
      )}

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="≡" title={t("Nothing recorded")}>{t("Record rent, DEWA, salaries and every other payment here, or import your bank sheet.")}</Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("Date")}</th><th>{t("Description")}</th><th>{t("Category")}</th><th>{t("Apartment")}</th><th>{t("Method")}</th><th className="num">{t("Amount")}</th></tr></thead>
              <tbody>
                {rows.map(tx => (
                  <tr key={tx.id} className={can.write ? 'clickable' : ''} onClick={() => can.write && setModal({ tx: tx })}>
                    <td className="small nowrap">{date(tx.date)}</td>
                    <td>{tx.description}{tx.estimated && <> <Badge tone="amber">{t("estimated")}</Badge></>}
                      {(tx.lease?.tenant || tx.notes) && <div className="tiny faint">{[tx.lease?.tenant?.name, tx.notes].filter(Boolean).join(' · ')}</div>}</td>
                    <td><Badge tone={tx.type === 'INCOME' ? 'green' : ''}>{L.category[tx.category]}</Badge></td>
                    <td className="small">{tx.unit ? `${tx.unit.number}${tx.space ? ` · ${tx.space.code}` : ''}` : <span className="faint">{t("Company")}</span>}</td>
                    <td className="small">{L.method[tx.method]}</td>
                    <td className="num bold" style={{ color: tx.type === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>{tx.type === 'INCOME' ? '+' : '−'}{money(tx.amount).replace('AED ', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <FormModal title={modal.tx ? t("Edit entry") : modal.preset.type === 'INCOME' ? t("Record income") : t("Record expense")} wide
          fields={transactionFields({ units: units.data, preset: modal.preset || {} })}
          initial={modal.tx ? { ...modal.tx, date: isoDay(modal.tx.date) } : {}}
          intro={modal.tx?.chequeId && <div className="alert alert-info">{t("Created automatically when a cheque was marked paid.")}</div>}
          onClose={() => setModal(null)}
          onDelete={modal.tx ? async () => { await api.del(`/transactions/${modal.tx.id}`); toast(t("Deleted")); setModal(null); reload(); } : undefined}
          onSubmit={async v => {
            if (modal.tx) await api.patch(`/transactions/${modal.tx.id}`, v); else await api.post('/transactions', v);
            toast(t("Saved")); setModal(null); reload();
          }} />
      )}
    </>
  );
}
