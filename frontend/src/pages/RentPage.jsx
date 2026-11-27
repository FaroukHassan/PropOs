// frontend/src/pages/RentPage.jsx — who has paid this month (replaces "Rent by Partition")
import { t } from '../lib/i18n';
import { useState, useMemo } from 'react';
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, monthLabel, today, options, downloadCsv, shiftMonth } from '../lib/format';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Stat, Tabs, useToast } from '../components/ui';

export default function RentPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { scoped, short } = useScope();
  const period = usePeriod();
  const [show, setShow] = useSticky('rent_show', 'unpaid');
  const [q, setQ] = useState('');
  const range = !period.month; // more than one month → show which month each line is for
  const { data, loading, error, refetch } = useApi(scoped('/reports/rent-collection', period.params));
  const [pay, setPay] = useState(null);

  const all = data?.rows || [];
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(r =>
      (show === 'all' || (show === 'unpaid' ? r.status !== 'PAID' : r.status === show))
      && (!needle || [r.tenant, r.phone, r.space, r.unit].some(x => String(x || '').toLowerCase().includes(needle))));
  }, [all, show, q]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !data) return <Spinner />;
  const groups = {};
  for (const r of rows) (groups[`${r.building} · ${t('Flat')} ${r.unit}`] ||= []).push(r);
  const paidCount = all.filter(r => r.status === 'PAID').length;
  const overdue = all.filter(r => r.status === 'OVERDUE');
  const periodText = period.label;
  const fileTag = `${period.month || `${period.from}_to_${period.to}`}${short ? `-${short.replace(/\s+/g, '-')}` : ''}`;

  const reminder = r => {
    const m = monthLabel(r.month);
    const msg = `Hi ${r.tenant}, a friendly reminder from Sakanly: rent for ${m} (Flat ${r.unit}${r.space ? ` ${r.space}` : ''}) has AED ${r.balance.toLocaleString()} outstanding. Thank you!\nمرحباً ${r.tenant}، تذكير من سكنلي بأن المتبقي من إيجار ${m} هو ${r.balance.toLocaleString()} درهم. شكراً لك!`;
    return `https://wa.me/${(r.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <>
      <div className="toolbar">
        <PeriodPicker />
      </div>
      <div className="toolbar">
        <Tabs value={show} onChange={setShow} items={[['unpaid', t("Not fully paid")], ['OVERDUE', t("Overdue{0}", [overdue.length ? ` (${overdue.length})` : ''])], ['PAID', t("Paid")], ['all', t("Everyone")]]} />
        <input className="input input-sm" placeholder={t("Search tenant, phone, room")} value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`rent-collection-${fileTag}.csv`, rows.map(r => ({
          Month: r.month, 'Due date': r.dueDate?.slice(0, 10), Building: r.building, Flat: r.unit, Room: r.space || '', Tenant: r.tenant, Phone: r.phone || '', Due: r.due, Collected: r.collected, Balance: r.balance, Status: L.rentStatus[r.status],
        })))}>{t("Export")}</button>
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={t("Rent due")} value={money(data.totals.due)} sub={range ? t("{0} instalments · {1}", [all.length, periodText]) : t("{0} monthly tenancies · {1}", [all.length, periodText])} />
        <Stat label={t("Collected")} value={money(data.totals.collected)} progress={data.totals.due ? data.totals.collected / data.totals.due : 0} />
        <Stat accent label={t("Outstanding")} value={money(data.totals.outstanding)} />
        <Stat label={t("Fully paid")} value={`${paidCount} / ${all.length}`} sub={overdue.length ? t("{0} overdue", [overdue.length]) : undefined} />
      </div>

      {rows.length === 0 ? (q ? <Empty icon="🔍" title={t("No matches")}>{t("Nothing matches “")}{q}”.</Empty>
        : <Empty icon="✓" title={show === 'unpaid' || show === 'OVERDUE' ? t("Nothing outstanding") : t("Nothing to show")}>{show === 'unpaid' || show === 'OVERDUE' ? t("All rent for {0} is collected.", [periodText]) : t("No rent {0} for {1}.", [show === 'PAID' ? 'fully paid' : 'due', periodText])}</Empty>) :
        Object.entries(groups).map(([g, list]) => (
          <div key={g} className="card card-flush" style={{ marginBottom: 14 }}>
            <div className="card-head"><div className="card-title">{g}</div><span className="small muted">{money(list.reduce((s, r) => s + r.balance, 0))} {t("outstanding")}</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t("Room")}</th><th>{t("Tenant")}</th>{range && <th>{t("Month")}</th>}<th>{t("Due date")}</th><th className="num">{t("Rent")}</th><th className="num">{t("Paid")}</th><th className="num">{t("Balance")}</th><th>{t("Status")}</th><th></th></tr></thead>
                <tbody>
                  {list.map(r => (
                    <tr key={`${r.leaseId}-${r.month}`}>
                      <td className="bold">{r.space || t("Whole flat")}</td>
                      <td>{r.tenant}<div className="tiny faint"><bdi dir="ltr">{r.phone}</bdi></div></td>
                      {range && <td className="small nowrap">{monthLabel(r.month)}</td>}
                      <td className="small">{date(r.dueDate)}</td>
                      <td className="num">{money(r.due)}</td><td className="num">{money(r.collected)}</td>
                      <td className="num bold">{r.balance ? money(r.balance) : '—'}</td>
                      <td><Badge value={r.status} map={L.rentStatus} /></td>
                      <td className="right nowrap">
                        {r.balance > 0 && r.phone && <a className="btn btn-sm" href={reminder(r)} target="_blank" rel="noreferrer">{t("Remind")}</a>}{' '}
                        {can.write && r.balance > 0 && <button className="btn btn-sm btn-primary" onClick={() => setPay(r)}>{t("Record")}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {pay && (
        <FormModal title={t("Rent from {0}", [pay.tenant])}
          intro={<p className="small muted" style={{ marginBottom: 12 }}>{pay.building} {t("Flat")} {pay.unit}{pay.space ? ` · ${pay.space}` : ''} {t("— rent for")} {monthLabel(pay.month)}</p>}
          fields={[
            { name: 'amount', label: t("Amount (AED)"), type: 'number', required: true, default: pay.balance },
            { name: 'date', label: t("Date received"), type: 'date', required: true, default: today() },
            { name: 'method', label: t("Paid by"), type: 'select', required: true, options: options(L.method), default: 'CASH' },
            { name: 'notes', label: t("Notes"), type: 'textarea' },
          ]}
          onClose={() => setPay(null)}
          onSubmit={async v => {
            await api.post('/transactions', { ...v, type: 'INCOME', category: 'RENT', description: v.amount < pay.balance ? 'Rent (part payment)' : 'Rent collection', leaseId: pay.leaseId, periodMonth: pay.month });
            toast(t("Payment recorded")); setPay(null); refetch();
          }} />
      )}
    </>
  );
}
