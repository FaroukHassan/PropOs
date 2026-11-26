// frontend/src/pages/ReportsPage.jsx — monthly P&L and profit per apartment
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { money, pct, L, monthKey, monthLabel, downloadCsv } from '../lib/format';
import { Spinner, ErrorBox, MonthPicker, Stat, Tabs, Badge } from '../components/ui';

export default function ReportsPage() {
  const period = usePeriod();
  const [tab, setTab] = useSticky('rep_tab', 'pnl');
  const { scoped } = useScope();
  const pnl = useApi(scoped('/reports/pnl', period.params));
  const units = useApi(scoped('/reports/units', period.params));
  const err = pnl.error || units.error;
  if (err) return <ErrorBox error={err} retry={() => { pnl.refetch(); units.refetch(); }} />;

  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <PeriodPicker />
        <Tabs value={tab} onChange={setTab} items={[['pnl', 'Profit & loss'], ['units', 'By apartment']]} />
        <div className="grow" />
        <button className="btn" onClick={() => window.print()}>Print / PDF</button>
      </div>
      <div className="print-only"><b>Sakanly Stay Holiday Homes</b> · {tab === 'pnl' ? 'Profit & loss' : 'Profit by apartment'} · {period.label}</div>

      {tab === 'pnl' ? (!pnl.data ? <Spinner /> : (
        <>
          <div className="grid g4">
            <Stat label="Revenue" value={money(pnl.data.totalIncome)} />
            <Stat label="Expenses" value={money(pnl.data.totalExpenses)} />
            <Stat accent label="Net profit" value={money(pnl.data.net)} />
            <Stat label="Net margin" value={pnl.data.margin === null ? '—' : pct(pnl.data.margin, 1)} />
          </div>
          <div className="grid g2">
            <Breakdown title="Revenue" rows={pnl.data.income} total={pnl.data.totalIncome} />
            <Breakdown title="Expenses" rows={pnl.data.expenses} total={pnl.data.totalExpenses} />
          </div>
        </>
      )) : (!units.data ? <Spinner /> : (
        <>
          <div className="grid g3">
            <Stat label="Apartments' profit" value={money(units.data.totals.unitsNet)} sub="Income minus that apartment's own costs" />
            <Stat label="Company overheads" value={money(units.data.overheads.expenses)} sub="Salaries, licence, internet… not tied to one flat" />
            <Stat accent label="Company net" value={money(units.data.totals.companyNet)} />
          </div>
          <div className="card card-flush">
            <div className="card-head">
              <div className="card-title">Profit by apartment · {period.label}</div>
              <button className="btn btn-sm no-print" onClick={() => downloadCsv(`apartments-${period.month || `${period.from}_to_${period.to}`}.csv`, units.data.rows.map(r => ({
                Building: r.building, Apartment: r.unit, Type: L.mode[r.mode], Income: r.income, 'Landlord rent': r.landlordRent, DEWA: r.dewa, Other: r.otherExpenses, Net: r.net,
              })))}>Export</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Apartment</th><th>Type</th><th className="num">Income</th><th className="num">Landlord rent</th><th className="num">DEWA</th><th className="num">Other costs</th><th className="num">Net</th></tr></thead>
                <tbody>
                  {units.data.rows.map(r => (
                    <tr key={r.unitId}>
                      <td className="bold">{r.building} {r.unit}{r.landlord && <div className="tiny faint">{r.landlord}</div>}</td>
                      <td><Badge tone="sand">{L.mode[r.mode]}</Badge></td>
                      <td className="num">{money(r.income)}</td><td className="num">{money(r.landlordRent)}</td><td className="num">{money(r.dewa)}</td><td className="num">{money(r.otherExpenses)}</td>
                      <td className="num bold" style={{ color: r.net < 0 ? 'var(--red)' : 'var(--green)' }}>{money(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={6}>All apartments</td><td className="num">{money(units.data.totals.unitsNet)}</td></tr>
                  <tr><td colSpan={6}>Company overheads{units.data.overheads.income ? ' (net of other income)' : ''}</td><td className="num">{money(units.data.overheads.income - units.data.overheads.expenses)}</td></tr>
                  <tr><td colSpan={6}>Company net</td><td className="num">{money(units.data.totals.companyNet)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="small muted">Landlord rent shows in the month the cheque was paid. Quarterly cheques therefore make one month look low and the next two look high. Compare apartments over a full quarter.</p>
        </>
      ))}
    </div>
  );
}

function Breakdown({ title, rows, total }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 10 }}>{title}</div>
      {rows.length === 0 && <p className="small muted">Nothing recorded.</p>}
      {rows.map(r => (
        <div key={r.category} style={{ marginBottom: 10 }}>
          <div className="row-between small"><span>{L.category[r.category]}</span><span className="num bold">{money(r.total)}</span></div>
          <div className="bar" style={{ marginTop: 4 }}><div style={{ width: `${total ? (r.total / total) * 100 : 0}%` }} /></div>
        </div>
      ))}
      <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 6 }}><b>Total</b><b className="num">{money(total)}</b></div>
    </div>
  );
}
