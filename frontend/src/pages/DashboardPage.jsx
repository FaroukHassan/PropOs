// frontend/src/pages/DashboardPage.jsx
import { t, locale } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useScope } from '../lib/scope';
import { useApi, useSticky } from '../lib/hooks';
import { money, pct, shortDate, monthKey, monthLabel, daysUntil, L, unitName, num } from '../lib/format';
import { Stat, Spinner, ErrorBox, Badge } from '../components/ui';
import { usePeriod, PeriodPicker } from '../lib/period';

export default function DashboardPage() {
  const period = usePeriod();
  const { scoped } = useScope();
  const { data: d, loading, error, refetch } = useApi(scoped('/dashboard', period.params));
  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !d) return <Spinner />;

  const years = new Set(d.trend.map(tx => tx.month.slice(0, 4))).size > 1;
  const trend = d.trend.map(x => ({ ...x, label: new Date(`${x.month}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', ...(years ? { year: '2-digit' } : {}), timeZone: 'UTC' }) }));
  const change = (now, before) => (before ? (now - before) / Math.abs(before) : null);
  const netChange = change(d.money.net, d.previous.net);
  const vsPrev = netChange === null ? '' : ` · ${netChange >= 0 ? '▲' : '▼'} ${t('{0} vs previous', [pct(Math.abs(netChange))])}`;
  return (
    <div className="stack">
      <div className="row-between wrap">
        <PeriodPicker />
        <div className="row small muted">
          {d.cheques.bounced > 0 && <Badge tone="red">{d.cheques.bounced} {t("bounced cheque")}{d.cheques.bounced > 1 ? 's' : ''}</Badge>}
          {d.cheques.postponed > 0 && <Badge tone="postponed">{d.cheques.postponed} {t("postponed")}</Badge>}
        </div>
      </div>

      <div className="grid g4">
        <Stat accent label={t("Net profit · {0}", [period.label])} value={money(d.money.net)} sub={t("{0} in · {1} out{2}", [money(d.money.income), money(d.money.expenses), vsPrev])} />
        <Stat label={t("Rent collected")} value={pct(d.rent.rate)} sub={t("{0} of {1}", [money(d.rent.collected), money(d.rent.due)])} progress={d.rent.rate} />
        <Stat label={t("Partitions occupied")} value={`${d.partitions.occupied} / ${d.partitions.total}`}
          sub={t("{0} available · {1} not ready", [d.partitions.available, d.partitions.notReady])} progress={d.partitions.occupancy} />
        <Stat label={t("Holiday homes")} value={pct(d.holiday.occupancy)}
          sub={d.holiday.units ? t("{0} nights · ADR {1}", [d.holiday.bookedNights, money(d.holiday.adr)]) : t("No holiday homes yet")} progress={d.holiday.occupancy} />
      </div>

      <div className="grid g-2-1">
        <div className="card">
          <div className="card-head"><div className="card-title">{d.trend.length === 6 && period.days < 70 ? t("Last 6 months") : t("Month by month · {0}", [period.label])}</div><Link to="/reports" className="btn btn-sm">{t("Reports")}</Link></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#eceae4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={12} width={40} />
                <Tooltip formatter={v => money(v)} cursor={{ fill: '#f6f5f2' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name={t("Income")} fill="#101e37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={t("Expenses")} fill="#c9a46a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">{t("Rent still to collect")}</div><Link to="/rent" className="btn btn-sm">{t("All")}</Link></div>
          {d.rent.unpaid.length === 0 ? <p className="muted small">{t("Everyone has paid for")} {period.label}. 🎉</p> :
            d.rent.unpaid.map(r => (
              <div key={`${r.leaseId}-${r.month}`} className="list-item">
                <div className="grow"><div className="bold">{r.tenant}</div><div className="tiny faint">{r.building} {r.unit}{r.space ? ` · ${r.space}` : ''}{period.month ? '' : ` · ${monthLabel(r.month)}`}</div></div>
                <div className="right"><div className="num bold">{money(r.balance)}</div><Badge value={r.status} map={L.rentStatus} /></div>
              </div>
            ))}
          {d.rent.outstanding > 0 && <div className="small muted" style={{ marginTop: 8 }}>{t("Total outstanding:")} <b>{money(d.rent.outstanding)}</b></div>}
        </div>
      </div>

      <div className="grid g3">
        <div className="card">
          <div className="card-head"><div className="card-title">{t("Cheques in the next 14 days")}</div><Link to="/cheques" className="btn btn-sm">{t("All")}</Link></div>
          {d.cheques.dueSoon.length === 0 ? <p className="muted small">{t("Nothing due.")}</p> : d.cheques.dueSoon.map(c => {
            const when = c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate;
            const days = daysUntil(when);
            return (
              <div key={c.id} className="list-item">
                <div className="grow">
                  <div className="bold">{c.direction === 'OUT' ? t("Pay") : t("Deposit")} {money(c.amount)}</div>
                  <div className="tiny faint">{c.unit ? unitName(c.unit) : c.partyName} · #{c.number}</div>
                </div>
                <div className="right">
                  <div className="small">{shortDate(when)}</div>
                  <Badge tone={days < 0 ? 'red' : days <= 3 ? 'amber' : c.status === 'POSTPONED' ? 'postponed' : 'pending'}>{days < 0 ? t("{0}d late", [-days]) : days === 0 ? t("Today") : t("in {0}d", [days])}</Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">{t("Guests this week")}</div><Link to="/bookings" className="btn btn-sm">{t("Calendar")}</Link></div>
          {d.arrivals.length + d.departures.length === 0 ? <p className="muted small">{t("No arrivals or departures in the next 7 days.")}</p> : <>
            {d.arrivals.map(b => (
              <div key={`a${b.id}`} className="list-item"><div><Badge tone="green">{t("In")}</Badge> <b>{b.guestName}</b><div className="tiny faint">{unitName(b.unit)} · {L.channel[b.channel]}</div></div><span className="small">{shortDate(b.checkIn)}</span></div>
            ))}
            {d.departures.map(b => (
              <div key={`d${b.id}`} className="list-item"><div><Badge tone="amber">{t("Out")}</Badge> <b>{b.guestName}</b><div className="tiny faint">{unitName(b.unit)} {t("· cleaning needed")}</div></div><span className="small">{shortDate(b.checkOut)}</span></div>
            ))}
          </>}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">{t("Open maintenance")}</div><Link to="/maintenance" className="btn btn-sm">{t("All")}</Link></div>
          {d.maintenance.length === 0 ? <p className="muted small">{t("Nothing open.")}</p> : d.maintenance.map(m => (
            <div key={m.id} className="list-item">
              <div className="grow"><div className="bold">{m.title}</div><div className="tiny faint">{unitName(m.unit)}{m.spaceCode ? ` · ${m.spaceCode}` : ''}{m.assignedTo ? ` · ${m.assignedTo}` : ''}</div></div>
              <Badge value={m.priority} map={L.priority} />
            </div>
          ))}
        </div>
      </div>

      {d.holiday.units > 0 && (
        <div className="grid g4">
          <Stat label={t("Holiday bookings")} value={num(d.holiday.bookings)} sub={period.label} />
          <Stat label={t("Nights booked")} value={`${d.holiday.bookedNights} / ${d.holiday.availableNights}`} />
          <Stat label={t("Average nightly rate (net)")} value={money(d.holiday.adr)} />
          <Stat label={t("Holiday net revenue")} value={money(d.holiday.netRevenue)} sub={t("After channel fees, spread by night")} />
        </div>
      )}
    </div>
  );
}
