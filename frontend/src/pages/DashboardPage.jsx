// frontend/src/pages/DashboardPage.jsx
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useScope } from '../lib/scope';
import { useApi, useSticky } from '../lib/hooks';
import { money, pct, shortDate, monthKey, monthLabel, daysUntil, L, unitName, num } from '../lib/format';
import { Stat, Spinner, ErrorBox, MonthPicker, Badge } from '../components/ui';

export default function DashboardPage() {
  const [month, setMonth] = useSticky('dash_month', monthKey());
  const { scoped } = useScope();
  const { data: d, loading, error, refetch } = useApi(scoped('/dashboard', { month }));
  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !d) return <Spinner />;

  const trend = d.trend.map(t => ({ ...t, label: monthLabel(t.month).split(' ')[0].slice(0, 3) }));
  return (
    <div className="stack">
      <div className="row-between wrap">
        <MonthPicker value={month} onChange={setMonth} />
        <div className="row small muted">
          {d.cheques.bounced > 0 && <Badge tone="red">{d.cheques.bounced} bounced cheque{d.cheques.bounced > 1 ? 's' : ''}</Badge>}
          {d.cheques.postponed > 0 && <Badge tone="postponed">{d.cheques.postponed} postponed</Badge>}
        </div>
      </div>

      <div className="grid g4">
        <Stat accent label="Net this month" value={money(d.money.net)} sub={`${money(d.money.income)} in · ${money(d.money.expenses)} out`} />
        <Stat label="Rent collected" value={pct(d.rent.rate)} sub={`${money(d.rent.collected)} of ${money(d.rent.due)}`} progress={d.rent.rate} />
        <Stat label="Partitions occupied" value={`${d.partitions.occupied} / ${d.partitions.total}`}
          sub={`${d.partitions.available} available · ${d.partitions.notReady} not ready`} progress={d.partitions.occupancy} />
        <Stat label="Holiday homes" value={pct(d.holiday.occupancy)}
          sub={d.holiday.units ? `${d.holiday.bookedNights} nights · ADR ${money(d.holiday.adr)}` : 'No holiday homes yet'} progress={d.holiday.occupancy} />
      </div>

      <div className="grid g-2-1">
        <div className="card">
          <div className="card-head"><div className="card-title">Last 6 months</div><Link to="/reports" className="btn btn-sm">Reports</Link></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#eceae4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={12} width={40} />
                <Tooltip formatter={v => money(v)} cursor={{ fill: '#f6f5f2' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#101e37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#c9a46a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Rent still to collect</div><Link to="/rent" className="btn btn-sm">All</Link></div>
          {d.rent.unpaid.length === 0 ? <p className="muted small">Everyone has paid for {monthLabel(month)}. 🎉</p> :
            d.rent.unpaid.map(r => (
              <div key={r.leaseId} className="list-item">
                <div className="grow"><div className="bold">{r.tenant}</div><div className="tiny faint">{r.building} {r.unit}{r.space ? ` · ${r.space}` : ''}</div></div>
                <div className="right"><div className="num bold">{money(r.balance)}</div><Badge value={r.status} map={L.rentStatus} /></div>
              </div>
            ))}
          {d.rent.outstanding > 0 && <div className="small muted" style={{ marginTop: 8 }}>Total outstanding: <b>{money(d.rent.outstanding)}</b></div>}
        </div>
      </div>

      <div className="grid g3">
        <div className="card">
          <div className="card-head"><div className="card-title">Cheques in the next 14 days</div><Link to="/cheques" className="btn btn-sm">All</Link></div>
          {d.cheques.dueSoon.length === 0 ? <p className="muted small">Nothing due.</p> : d.cheques.dueSoon.map(c => {
            const when = c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate;
            const days = daysUntil(when);
            return (
              <div key={c.id} className="list-item">
                <div className="grow">
                  <div className="bold">{c.direction === 'OUT' ? 'Pay' : 'Deposit'} {money(c.amount)}</div>
                  <div className="tiny faint">{c.unit ? unitName(c.unit) : c.partyName} · #{c.number}</div>
                </div>
                <div className="right">
                  <div className="small">{shortDate(when)}</div>
                  <Badge tone={days < 0 ? 'red' : days <= 3 ? 'amber' : c.status === 'POSTPONED' ? 'postponed' : 'pending'}>{days < 0 ? `${-days}d late` : days === 0 ? 'Today' : `in ${days}d`}</Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Guests this week</div><Link to="/bookings" className="btn btn-sm">Calendar</Link></div>
          {d.arrivals.length + d.departures.length === 0 ? <p className="muted small">No arrivals or departures in the next 7 days.</p> : <>
            {d.arrivals.map(b => (
              <div key={`a${b.id}`} className="list-item"><div><Badge tone="green">In</Badge> <b>{b.guestName}</b><div className="tiny faint">{unitName(b.unit)} · {L.channel[b.channel]}</div></div><span className="small">{shortDate(b.checkIn)}</span></div>
            ))}
            {d.departures.map(b => (
              <div key={`d${b.id}`} className="list-item"><div><Badge tone="amber">Out</Badge> <b>{b.guestName}</b><div className="tiny faint">{unitName(b.unit)} · cleaning needed</div></div><span className="small">{shortDate(b.checkOut)}</span></div>
            ))}
          </>}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Open maintenance</div><Link to="/maintenance" className="btn btn-sm">All</Link></div>
          {d.maintenance.length === 0 ? <p className="muted small">Nothing open.</p> : d.maintenance.map(m => (
            <div key={m.id} className="list-item">
              <div className="grow"><div className="bold">{m.title}</div><div className="tiny faint">{unitName(m.unit)}{m.spaceCode ? ` · ${m.spaceCode}` : ''}{m.assignedTo ? ` · ${m.assignedTo}` : ''}</div></div>
              <Badge value={m.priority} map={L.priority} />
            </div>
          ))}
        </div>
      </div>

      {d.holiday.units > 0 && (
        <div className="grid g4">
          <Stat label="Holiday bookings this month" value={num(d.holiday.bookings)} />
          <Stat label="Nights booked" value={`${d.holiday.bookedNights} / ${d.holiday.availableNights}`} />
          <Stat label="Average nightly rate (net)" value={money(d.holiday.adr)} />
          <Stat label="Holiday net revenue" value={money(d.holiday.netRevenue)} sub="After channel fees, spread by night" />
        </div>
      )}
    </div>
  );
}
