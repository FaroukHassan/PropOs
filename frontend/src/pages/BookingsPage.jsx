// frontend/src/pages/BookingsPage.jsx — holiday-home calendar and bookings
import { t, locale } from '../lib/i18n';
import { useState, useMemo } from 'react';
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
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
  const period = usePeriod();
  const [chosenView, setView] = useSticky('book_view', 'calendar');
  const from = period.from;
  // the calendar shows up to ~2 months of days; longer periods use the list
  const longPeriod = period.days > 62;
  const view = longPeriod ? 'list' : chosenView;
  const endIso = new Date(new Date(`${period.to}T00:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);
  const units = useApi('/units');
  const { scoped, inScope } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/bookings', period.params));
  const [modal, setModal] = useState(null);

  const days = useMemo(() => {
    const start = new Date(`${from}T00:00:00Z`), end = new Date(`${endIso}T00:00:00Z`);
    const out = [];
    for (let tx = start.getTime(); tx < end.getTime(); tx += DAY) out.push(new Date(tx));
    return out;
  }, [from, endIso]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if ((loading && !data) || !units.data) return <Spinner />;
  // Bookable units: holiday flats (one row, or one row per partition) and partitions reserved for holiday use elsewhere
  const homes = units.data.filter(inScope).filter(u => u.mode === 'HOLIDAY' || u.spaces.some(s => s.status === 'RESERVED') || (data || []).some(b => b.unitId === u.id));
  const rowsFor = h => {
    const spaces = h.mode === 'HOLIDAY' ? h.spaces : h.spaces.filter(s => s.status === 'RESERVED' || (data || []).some(b => b.spaceId === s.id));
    return spaces.length ? spaces.map(s => ({ key: s.id, label: `${h.building.name} ${h.number} · ${s.code}`, unit: h, space: s })) : [{ key: h.id, label: `${h.building.name} ${h.number}`, unit: h }];
  };
  const calRows = homes.flatMap(rowsFor);
  const bookings = (data || []).filter(b => b.status !== 'CANCELLED');
  const monthStart = new Date(`${from}T00:00:00Z`).getTime();
  const monthEnd = new Date(`${endIso}T00:00:00Z`).getTime();
  const nightsIn = b => Math.max(0, Math.round((Math.min(new Date(b.checkOut).getTime(), monthEnd) - Math.max(new Date(b.checkIn).getTime(), monthStart)) / DAY));
  const booked = bookings.filter(b => b.status !== 'INQUIRY').reduce((s, b) => s + nightsIn(b), 0);
  const avail = calRows.length * days.length;
  const net = bookings.filter(b => b.status !== 'INQUIRY').reduce((s, b) => s + (b.net * nightsIn(b)) / Math.max(1, b.nights), 0);

  const save = async (v, existing) => {
    if (existing) await api.patch(`/bookings/${existing.id}`, v); else await api.post('/bookings', v);
    toast(existing ? t("Booking updated") : t("Booking added")); setModal(null); refetch();
  };

  return (
    <>
      <div className="toolbar">
        <PeriodPicker />
        {longPeriod ? <span className="small muted">{t("List view for periods over 2 months")}</span>
          : <Tabs value={view} onChange={setView} items={[['calendar', t("Calendar")], ['list', t("List")]]} />}
        <div className="grow" />
        {can.write && <button className="btn btn-primary" disabled={!homes.length} onClick={() => setModal({})}>{t("+ Booking")}</button>}
      </div>

      {homes.length === 0 ? (
        <Empty icon="☾" title={t("No holiday homes yet")}>{t("Add an apartment and set \"How it is rented\" to Holiday home, or mark a partition as Reserved to let it nightly.")}</Empty>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat label={t("Occupancy")} value={avail ? `${Math.round((booked / avail) * 100)}%` : '—'} progress={avail ? booked / avail : 0} />
            <Stat label={t("Nights booked")} value={`${booked} / ${avail}`} />
            <Stat label={t("Average nightly rate (net)")} value={booked ? money(net / booked) : '—'} />
            <Stat accent label={t("Net revenue")} value={money(net)} sub={t("{0} · after channel commission", [period.label])} />
          </div>

          {view === 'calendar' ? (
            <div className="card card-flush cal">
              <div className="cal-grid" style={{ gridTemplateColumns: `170px repeat(${days.length}, 40px)` }}>
                <div className="cal-cell cal-head cal-unit">{t("Home")}</div>
                {days.map(d => {
                  const iso = d.toISOString().slice(0, 10);
                  const wd = d.getUTCDay();
                  return <div key={iso} className={`cal-cell cal-head ${iso === today() ? 'today' : ''} ${wd === 5 || wd === 6 ? 'weekend' : ''}`}>
                    <span>{d.toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' })}</span><b>{d.getUTCDate()}</b></div>;
                })}
                {calRows.map(r => (
                  <Row key={r.key} label={r.label} days={days} monthStart={monthStart}
                    bookings={bookings.filter(b => b.unitId === r.unit.id && (r.space ? b.spaceId === r.space.id || !b.spaceId : true))}
                    onPick={b => can.write && setModal({ booking: b })}
                    onEmpty={d => can.write && setModal({ preset: { unitId: r.unit.id, spaceId: r.space?.id || '', checkIn: d, checkOut: isoDay(new Date(new Date(d).getTime() + DAY)), totalAmount: r.unit.nightlyRate || '' } })} />
                ))}
              </div>
              <div className="legend" style={{ padding: '10px 14px' }}>
                {Object.entries(L.channel).map(([k, v]) => <span key={k}><i className={`ch-${k}`} />{v}</span>)}
                <span className="faint">{t("Click an empty day to add a booking")}</span>
              </div>
            </div>
          ) : (
            <div className="card card-flush">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t("Guest")}</th><th>{t("Home")}</th><th>{t("Channel")}</th><th>{t("Check-in")}</th><th>{t("Check-out")}</th><th className="num">{t("Nights")}</th><th className="num">{t("Total")}</th><th className="num">{t("Net")}</th><th>{t("Status")}</th></tr></thead>
                  <tbody>
                    {(data || []).length === 0 && <tr><td colSpan={9} className="muted">{t("No bookings in this period.")}</td></tr>}
                    {(data || []).map(b => (
                      <tr key={b.id} className="clickable" onClick={() => can.write && setModal({ booking: b })}>
                        <td className="bold">{b.guestName}<div className="tiny faint">{b.guestPhone}</div></td>
                        <td>{b.unit.building.name} {b.unit.number}{b.space ? ` · ${b.space.code}` : ''}</td>
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
        <FormModal title={modal.booking ? t("Booking — {0}", [modal.booking.guestName]) : t("New booking")} wide
          fields={bookingFields({ units: homes })}
          initial={modal.booking ? { ...modal.booking, checkIn: isoDay(modal.booking.checkIn), checkOut: isoDay(modal.booking.checkOut) } : modal.preset}
          intro={modal.booking && <p className="small muted" style={{ marginBottom: 12 }}>{t("When the payout arrives, record it under Income & expenses as a Holiday booking.")}</p>}
          onClose={() => setModal(null)}
          onDelete={modal.booking ? async () => { await api.del(`/bookings/${modal.booking.id}`); toast(t("Booking deleted")); setModal(null); refetch(); } : undefined}
          onSubmit={v => save(v, modal.booking)} />
      )}
    </>
  );
}

function Row({ label, days, bookings, monthStart, onPick, onEmpty }) {
  const taken = new Set();
  for (const b of bookings) {
    for (let tx = new Date(b.checkIn).getTime(); tx < new Date(b.checkOut).getTime(); tx += DAY) taken.add(new Date(tx).toISOString().slice(0, 10));
  }
  return (
    <>
      <div className="cal-cell cal-unit">{label}</div>
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
                <div key={b.id} className={`cal-bar ch-${b.channel}`} title={t("{0} · {1} nights · {2}", [b.guestName, b.nights, money(b.totalAmount)])}
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
