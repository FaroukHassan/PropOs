// frontend/src/pages/BookingsPage.jsx — holiday-home calendar and bookings
import { useState, useMemo } from 'react';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, isoDay, today, shiftMonth } from '../lib/format';
import { bookingFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Stat, Tabs, useToast } from '../components/ui';

const DAY = 86400000;

export default function BookingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useSticky('book_month', monthKey());
  const [view, setView] = useSticky('book_view', 'calendar');
  const from = `${month}-01`;
  const to = `${shiftMonth(month, 1)}-01`;
  const units = useApi('/units?mode=HOLIDAY');
  const { data, loading, error, refetch } = useApi(`/bookings${qs({ from, to })}`);
  const [modal, setModal] = useState(null);

  const days = useMemo(() => {
    const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`);
    const out = [];
    for (let t = start.getTime(); t < end.getTime(); t += DAY) out.push(new Date(t));
    return out;
  }, [from, to]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if ((loading && !data) || !units.data) return <Spinner />;
  const homes = units.data;
  const bookings = (data || []).filter(b => b.status !== 'CANCELLED');
  const monthStart = new Date(`${from}T00:00:00Z`).getTime();
  const monthEnd = new Date(`${to}T00:00:00Z`).getTime();
  const nightsIn = b => Math.max(0, Math.round((Math.min(new Date(b.checkOut).getTime(), monthEnd) - Math.max(new Date(b.checkIn).getTime(), monthStart)) / DAY));
  const booked = bookings.filter(b => b.status !== 'INQUIRY').reduce((s, b) => s + nightsIn(b), 0);
  const avail = homes.length * days.length;
  const net = bookings.filter(b => b.status !== 'INQUIRY').reduce((s, b) => s + (b.net * nightsIn(b)) / Math.max(1, b.nights), 0);

  const save = async (v, existing) => {
    if (existing) await api.patch(`/bookings/${existing.id}`, v); else await api.post('/bookings', v);
    toast(existing ? 'Booking updated' : 'Booking added'); setModal(null); refetch();
  };

  return (
    <>
      <div className="toolbar">
        <MonthPicker value={month} onChange={setMonth} />
        <Tabs value={view} onChange={setView} items={[['calendar', 'Calendar'], ['list', 'List']]} />
        <div className="grow" />
        {can.write && <button className="btn btn-primary" disabled={!homes.length} onClick={() => setModal({})}>+ Booking</button>}
      </div>

      {homes.length === 0 ? (
        <Empty icon="☾" title="No holiday homes yet">Add an apartment and set "How it is rented" to Holiday home.</Empty>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat label="Occupancy" value={avail ? `${Math.round((booked / avail) * 100)}%` : '—'} progress={avail ? booked / avail : 0} />
            <Stat label="Nights booked" value={`${booked} / ${avail}`} />
            <Stat label="Average nightly rate (net)" value={booked ? money(net / booked) : '—'} />
            <Stat accent label="Net revenue this month" value={money(net)} sub="After channel commission" />
          </div>

          {view === 'calendar' ? (
            <div className="card card-flush cal">
              <div className="cal-grid" style={{ gridTemplateColumns: `170px repeat(${days.length}, 40px)` }}>
                <div className="cal-cell cal-head cal-unit">Home</div>
                {days.map(d => {
                  const iso = d.toISOString().slice(0, 10);
                  const wd = d.getUTCDay();
                  return <div key={iso} className={`cal-cell cal-head ${iso === today() ? 'today' : ''} ${wd === 5 || wd === 6 ? 'weekend' : ''}`}>
                    <span>{d.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</span><b>{d.getUTCDate()}</b></div>;
                })}
                {homes.map(h => (
                  <Row key={h.id} home={h} days={days} bookings={bookings.filter(b => b.unitId === h.id)} monthStart={monthStart}
                    onPick={b => can.write && setModal({ booking: b })}
                    onEmpty={d => can.write && setModal({ preset: { unitId: h.id, checkIn: d, checkOut: isoDay(new Date(new Date(d).getTime() + DAY)), totalAmount: h.nightlyRate || '' } })} />
                ))}
              </div>
              <div className="legend" style={{ padding: '10px 14px' }}>
                {Object.entries(L.channel).map(([k, v]) => <span key={k}><i className={`ch-${k}`} />{v}</span>)}
                <span className="faint">Click an empty day to add a booking</span>
              </div>
            </div>
          ) : (
            <div className="card card-flush">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Guest</th><th>Home</th><th>Channel</th><th>Check-in</th><th>Check-out</th><th className="num">Nights</th><th className="num">Total</th><th className="num">Net</th><th>Status</th></tr></thead>
                  <tbody>
                    {(data || []).length === 0 && <tr><td colSpan={9} className="muted">No bookings this month.</td></tr>}
                    {(data || []).map(b => (
                      <tr key={b.id} className="clickable" onClick={() => can.write && setModal({ booking: b })}>
                        <td className="bold">{b.guestName}<div className="tiny faint">{b.guestPhone}</div></td>
                        <td>{b.unit.building.name} {b.unit.number}</td>
                        <td><span className={`badge ch-${b.channel}`}>{L.channel[b.channel]}</span></td>
                        <td>{date(b.checkIn)}</td><td>{date(b.checkOut)}</td>
                        <td className="num">{b.nights}</td><td className="num">{money(b.totalAmount)}</td><td className="num">{money(b.net)}</td>
                        <td><Badge value={b.status} map={L.bookingStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <FormModal title={modal.booking ? `Booking — ${modal.booking.guestName}` : 'New booking'} wide
          fields={bookingFields({ units: homes })}
          initial={modal.booking ? { ...modal.booking, checkIn: isoDay(modal.booking.checkIn), checkOut: isoDay(modal.booking.checkOut) } : modal.preset}
          intro={modal.booking && <p className="small muted" style={{ marginBottom: 12 }}>When the payout arrives, record it under Income & expenses as a Holiday booking.</p>}
          onClose={() => setModal(null)}
          onDelete={modal.booking ? async () => { await api.del(`/bookings/${modal.booking.id}`); toast('Booking deleted'); setModal(null); refetch(); } : undefined}
          onSubmit={v => save(v, modal.booking)} />
      )}
    </>
  );
}

function Row({ home, days, bookings, monthStart, onPick, onEmpty }) {
  const taken = new Set();
  for (const b of bookings) {
    for (let t = new Date(b.checkIn).getTime(); t < new Date(b.checkOut).getTime(); t += DAY) taken.add(new Date(t).toISOString().slice(0, 10));
  }
  return (
    <>
      <div className="cal-cell cal-unit">{home.building.name} {home.number}</div>
      {days.map((d, i) => {
        const iso = d.toISOString().slice(0, 10);
        const starting = bookings.filter(b => {
          const s = Math.max(new Date(b.checkIn).getTime(), monthStart);
          return new Date(s).toISOString().slice(0, 10) === iso;
        });
        return (
          <div key={iso} className="cal-cell" style={{ position: 'relative', cursor: taken.has(iso) ? 'default' : 'pointer' }}
            onClick={() => !taken.has(iso) && onEmpty(iso)}>
            {starting.map(b => {
              const startT = Math.max(new Date(b.checkIn).getTime(), monthStart);
              const span = Math.min(Math.round((new Date(b.checkOut).getTime() - startT) / DAY), days.length - i);
              return (
                <div key={b.id} className={`cal-bar ch-${b.channel}`} title={`${b.guestName} · ${b.nights} nights · ${money(b.totalAmount)}`}
                  style={{ position: 'absolute', left: 2, top: 0, width: span * 40 - 4, opacity: b.status === 'INQUIRY' ? 0.5 : 1 }}
                  onClick={e => { e.stopPropagation(); onPick(b); }}>
                  {b.guestName}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
