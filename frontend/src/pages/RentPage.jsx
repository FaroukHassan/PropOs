// frontend/src/pages/RentPage.jsx — who has paid this month (replaces "Rent by Partition")
import { useState } from 'react';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, monthLabel, today, options, downloadCsv } from '../lib/format';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Stat, Tabs, useToast } from '../components/ui';

export default function RentPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useSticky('rent_month', monthKey());
  const [show, setShow] = useSticky('rent_show', 'unpaid');
  const { data, loading, error, refetch } = useApi(`/reports/rent-collection?month=${month}`);
  const [pay, setPay] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !data) return <Spinner />;
  const rows = data.rows.filter(r => show === 'all' || r.status !== 'PAID');
  const groups = {};
  for (const r of rows) (groups[`${r.building} · Flat ${r.unit}`] ||= []).push(r);
  const paidCount = data.rows.filter(r => r.status === 'PAID').length;

  const reminder = r => {
    const msg = `Hi ${r.tenant}, a friendly reminder from Sakanly: rent for ${monthLabel(month)} (Flat ${r.unit}${r.space ? ` ${r.space}` : ''}) has AED ${r.balance.toLocaleString()} outstanding. Thank you!\nمرحباً ${r.tenant}، تذكير من سكنلي بأن المتبقي من إيجار ${monthLabel(month)} هو ${r.balance.toLocaleString()} درهم. شكراً لك!`;
    return `https://wa.me/${(r.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <>
      <div className="toolbar">
        <MonthPicker value={month} onChange={setMonth} />
        <Tabs value={show} onChange={setShow} items={[['unpaid', 'Not fully paid'], ['all', 'Everyone']]} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`rent-collection-${month}.csv`, data.rows.map(r => ({
          Building: r.building, Flat: r.unit, Partition: r.space || '', Tenant: r.tenant, Phone: r.phone || '', Due: r.due, Collected: r.collected, Balance: r.balance, Status: L.rentStatus[r.status],
        })))}>Export</button>
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Rent due" value={money(data.totals.due)} sub={`${data.rows.length} monthly tenancies`} />
        <Stat label="Collected" value={money(data.totals.collected)} progress={data.totals.due ? data.totals.collected / data.totals.due : 0} />
        <Stat accent label="Outstanding" value={money(data.totals.outstanding)} />
        <Stat label="Fully paid" value={`${paidCount} / ${data.rows.length}`} />
      </div>

      {rows.length === 0 ? <Empty icon="✓" title={show === 'unpaid' ? 'Everyone has paid' : 'No monthly tenancies'}>{show === 'unpaid' ? `All rent for ${monthLabel(month)} is collected.` : ''}</Empty> :
        Object.entries(groups).map(([g, list]) => (
          <div key={g} className="card card-flush" style={{ marginBottom: 14 }}>
            <div className="card-head"><div className="card-title">{g}</div><span className="small muted">{money(list.reduce((s, r) => s + r.balance, 0))} outstanding</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Partition</th><th>Tenant</th><th>Due date</th><th className="num">Rent</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.leaseId}>
                      <td className="bold">{r.space || 'Whole flat'}</td>
                      <td>{r.tenant}<div className="tiny faint">{r.phone}</div></td>
                      <td className="small">{date(r.dueDate)}</td>
                      <td className="num">{money(r.due)}</td><td className="num">{money(r.collected)}</td>
                      <td className="num bold">{r.balance ? money(r.balance) : '—'}</td>
                      <td><Badge value={r.status} map={L.rentStatus} /></td>
                      <td className="right nowrap">
                        {r.balance > 0 && r.phone && <a className="btn btn-sm" href={reminder(r)} target="_blank" rel="noreferrer">Remind</a>}{' '}
                        {can.write && r.balance > 0 && <button className="btn btn-sm btn-primary" onClick={() => setPay(r)}>Record</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {pay && (
        <FormModal title={`Rent from ${pay.tenant}`}
          intro={<p className="small muted" style={{ marginBottom: 12 }}>{pay.building} Flat {pay.unit}{pay.space ? ` · ${pay.space}` : ''} — {monthLabel(month)}</p>}
          fields={[
            { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, default: pay.balance },
            { name: 'date', label: 'Date received', type: 'date', required: true, default: today() },
            { name: 'method', label: 'Paid by', type: 'select', required: true, options: options(L.method), default: 'CASH' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          onClose={() => setPay(null)}
          onSubmit={async v => {
            await api.post('/transactions', { ...v, type: 'INCOME', category: 'RENT', description: v.amount < pay.balance ? 'Rent (part payment)' : 'Rent collection', leaseId: pay.leaseId, periodMonth: month });
            toast('Payment recorded'); setPay(null); refetch();
          }} />
      )}
    </>
  );
}
