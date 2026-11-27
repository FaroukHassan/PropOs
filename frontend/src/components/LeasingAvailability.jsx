// frontend/src/components/LeasingAvailability.jsx — what the leasing team can offer: every room, bed and
// flat on a 12-month timeline, checked against the client's move-in date and stay (1 to 12 months),
// with advanced filters.
import { useMemo, useState } from 'react';
import { t, locale } from '../lib/i18n';
import { useApi, useSticky } from '../lib/hooks';
import { qs } from '../lib/api';
import { money, date, isoDay, today, L, roomName } from '../lib/format';
import { photoUrl } from '../lib/photos';
import { Spinner, ErrorBox, Empty, Badge, Stat, Tabs, useToast } from './ui';

const KINDS = ['ROOM', 'BED', 'STUDIO', 'FLAT', 'HOLIDAY'];
const KIND_LABEL = { ROOM: 'Room', BED: 'Bed', STUDIO: 'Studio', FLAT: 'Whole flat', HOLIDAY: 'Holiday home' };
const BUSY_LABEL = { lease: 'Leased', notice: 'Leaving (notice given)', booking: 'Holiday booking', reserved: 'Reserved', preparing: 'Being prepared' };
const EMPTY = { kinds: [], building: '', area: '', occupancy: '', min: '', max: '', bedrooms: '', photos: false, readyNow: false, amenities: '', sort: 'soonest' };
const DAY = 86400000;
const nameOf = i => (i.code ? `${t('Flat')} ${i.unit.number} · ${roomName(i.code)}` : `${t('Flat')} ${i.unit.number}`);

export default function LeasingAvailability({ onNewDeal }) {
  const toast = useToast();
  const [from, setFrom] = useSticky('avail_from', today());
  const [months, setMonths] = useSticky('avail_months', 1);
  const [show, setShow] = useSticky('avail_show', 'whole');
  const [saved, setF] = useSticky('avail_filters', EMPTY);
  const f = { ...EMPTY, ...saved };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const moveIn = from < today() ? today() : from;
  const { data, loading, error, refetch } = useApi(`/leasing/availability${qs({ from: moveIn, months })}`);
  const set = (k, v) => setF({ ...f, [k]: v });
  const active = Object.entries(f).filter(([k, v]) => k !== 'sort' && (Array.isArray(v) ? v.length : v)).length;

  const all = data?.items || [];
  const buildings = [...new Set(all.map(i => i.building.name))].sort();
  const areas = [...new Set(all.map(i => i.building.area).filter(Boolean))].sort();

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const todayIso = today();
    const list = all.filter(i => {
      if (show === 'whole' && !i.freeForPeriod) return false;
      if (show === 'part' && !i.freeForPeriod && !i.freeInPeriodFrom) return false;
      if (f.kinds.length && !f.kinds.includes(i.kind)) return false;
      if (f.building && i.building.name !== f.building) return false;
      if (f.area && i.building.area !== f.area) return false;
      if (f.occupancy && i.unit.occupancy !== f.occupancy) return false;
      if (f.min && !(i.price >= Number(f.min))) return false;
      if (f.max && !(i.price && i.price <= Number(f.max))) return false;
      if (f.bedrooms && !((i.unit.bedrooms ?? 0) >= Number(f.bedrooms))) return false;
      if (f.photos && !i.photos) return false;
      if (f.readyNow && !(i.freeFrom && isoDay(i.freeFrom) <= todayIso)) return false;
      if (f.amenities && !String(i.amenities || '').toLowerCase().includes(f.amenities.toLowerCase())) return false;
      if (n && ![i.building.name, i.building.area, i.unit.number, i.code, roomName(i.code)].some(x => String(x || '').toLowerCase().includes(n))) return false;
      return true;
    });
    const soon = i => (i.freeForPeriod ? 0 : i.freeFrom ? new Date(i.freeFrom).getTime() : Infinity);
    const sorters = {
      soonest: (a, b) => soon(a) - soon(b),
      priceUp: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
      priceDown: (a, b) => (b.price ?? -1) - (a.price ?? -1),
      building: () => 0,
    };
    return [...list].sort(sorters[f.sort] || sorters.soonest);
  }, [all, f, show, q]);

  if (error) return <ErrorBox error={error} retry={refetch} />;

  const priced = rows.filter(r => r.price);
  const avg = priced.length ? Math.round(priced.reduce((s, r) => s + r.price, 0) / priced.length) : 0;
  const freeNow = all.filter(i => i.freeFrom && isoDay(i.freeFrom) <= today()).length;

  const copyList = async () => {
    const lines = [`🏠 *Sakanly — ${t('available for {0}', [stayText(months)])}* (${t('move-in')} ${date(moveIn)})`, ''];
    for (const i of rows) {
      lines.push(`• ${i.building.name}${i.building.area ? `, ${i.building.area}` : ''} — ${nameOf(i)} · ${t(KIND_LABEL[i.kind])}${i.price ? ` · ${money(i.price)}/${t('month')}` : ''}${i.unit.occupancy && i.code ? ` · ${L.occupancy[i.unit.occupancy]}` : ''} · ${availText(i, moveIn)}`);
    }
    lines.push('', '📞 +971 56 591 3200');
    try { await navigator.clipboard.writeText(lines.join('\n')); toast(t('List copied, paste it into WhatsApp')); } catch { toast(lines.join('\n')); }
  };

  return (
    <>
      <div className="card avail-search">
        <div className="avail-controls">
          <label className="avail-field">
            <span>{t('Move-in date')}</span>
            <input className="input" type="date" min={today()} value={moveIn} onChange={e => setFrom(e.target.value || today())} />
          </label>
          <div className="avail-field avail-stay">
            <span>{t('Stay')} · <b>{stayText(months)}</b></span>
            <div className="stay-chips" role="radiogroup" aria-label={t('Stay')}>
              {Array.from({ length: 12 }, (_, k) => k + 1).map(m => (
                <button key={m} role="radio" aria-checked={months === m} className={months === m ? 'on' : ''} onClick={() => setMonths(m)}>{m === 12 ? t('1 yr') : m}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="toolbar" style={{ margin: '14px 0 0' }}>
          <Tabs value={show} onChange={setShow} items={[['whole', t('Free for the whole stay')], ['part', t('Free for part of it')], ['all', t('Everything')]]} />
          <input className="input input-sm" placeholder={t('Search building, flat or room')} value={q} onChange={e => setQ(e.target.value)} style={{ width: 210 }} />
          <button className={`btn btn-sm ${open || active ? 'btn-primary' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
            ⚲ {t('Advanced filters')}{active ? ` · ${active}` : ''}
          </button>
          <div className="grow" />
          <button className="btn btn-sm" onClick={copyList} disabled={!rows.length}>{t('Copy list for WhatsApp')}</button>
        </div>

        {open && (
          <div className="adv-filters">
            <div className="adv-group adv-wide">
              <span>{t('Type')}</span>
              <div className="chip-set">
                {KINDS.map(k => (
                  <button key={k} className={f.kinds.includes(k) ? 'on' : ''} onClick={() => set('kinds', f.kinds.includes(k) ? f.kinds.filter(x => x !== k) : [...f.kinds, k])}>{t(KIND_LABEL[k])}</button>
                ))}
              </div>
            </div>
            <label className="adv-group"><span>{t('Building')}</span>
              <select className="input input-sm" value={f.building} onChange={e => set('building', e.target.value)}>
                <option value="">{t('Any')}</option>{buildings.map(b => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="adv-group"><span>{t('Area')}</span>
              <select className="input input-sm" value={f.area} onChange={e => set('area', e.target.value)}>
                <option value="">{t('Any')}</option>{areas.map(a => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="adv-group"><span>{t('Who for')}</span>
              <select className="input input-sm" value={f.occupancy} onChange={e => set('occupancy', e.target.value)}>
                <option value="">{t('Any')}</option>{Object.entries(L.occupancy).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="adv-group"><span>{t('Monthly rent (AED)')}</span>
              <div className="adv-range">
                <input className="input input-sm" type="number" min="0" placeholder={t('Min')} value={f.min} onChange={e => set('min', e.target.value)} />
                <input className="input input-sm" type="number" min="0" placeholder={t('Max')} value={f.max} onChange={e => set('max', e.target.value)} />
              </div>
            </div>
            <label className="adv-group"><span>{t('Bedrooms (whole flats)')}</span>
              <select className="input input-sm" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)}>
                <option value="">{t('Any')}</option>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 0 ? t('Studio +') : `${n}+`}</option>)}
              </select>
            </label>
            <label className="adv-group"><span>{t('Amenities')}</span>
              <input className="input input-sm" placeholder={t('balcony, attached bath…')} value={f.amenities} onChange={e => set('amenities', e.target.value)} />
            </label>
            <label className="adv-group"><span>{t('Sort by')}</span>
              <select className="input input-sm" value={f.sort} onChange={e => set('sort', e.target.value)}>
                <option value="soonest">{t('Free soonest')}</option><option value="priceUp">{t('Price: low to high')}</option>
                <option value="priceDown">{t('Price: high to low')}</option><option value="building">{t('Building')}</option>
              </select>
            </label>
            <div className="adv-group adv-checks">
              <label><input type="checkbox" checked={f.readyNow} onChange={e => set('readyNow', e.target.checked)} /> {t('Ready to move in today')}</label>
              <label><input type="checkbox" checked={f.photos} onChange={e => set('photos', e.target.checked)} /> {t('Has photos')}</label>
            </div>
            <div className="adv-group adv-reset">
              <button className="btn btn-sm btn-ghost" onClick={() => setF(EMPTY)} disabled={!active}>{t('Clear filters')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid g4" style={{ margin: '16px 0' }}>
        <Stat accent label={t('Match your search')} value={rows.length} sub={`${stayText(months)} · ${t('from')} ${date(moveIn)}`} />
        <Stat label={t('Free today')} value={freeNow} sub={t('of {0} places', [all.length])} />
        <Stat label={t('Average rent')} value={avg ? money(avg) : '—'} sub={t('per month, matching places')} />
        <Stat label={t('Cost of the stay')} value={avg ? money(avg * months) : '—'} sub={t('average, {0}', [stayText(months)])} />
      </div>

      {loading && !data ? <Spinner /> : !rows.length ? (
        <Empty icon="◆" title={t('Nothing free for this stay')}>{t('Try a later move-in date, a shorter stay, or “Free for part of it”.')}</Empty>
      ) : (
        <div className="card avail-table">
          <div className="avail-head">
            <div className="ai-info">{t('Place')}</div>
            <Months start={data.horizonStart} />
            <div className="ai-side">{t('Availability')}</div>
          </div>
          {rows.map(i => <Row key={i.id} i={i} data={data} moveIn={moveIn} months={months} onNewDeal={onNewDeal} />)}
          <div className="avail-legend">
            <span><i className="seg-free" />{t('Free')}</span><span><i className="seg-lease" />{t('Leased')}</span><span><i className="seg-notice" />{t('Leaving')}</span>
            <span><i className="seg-booking" />{t('Holiday booking')}</span><span><i className="seg-reserved" />{t('Reserved / being prepared')}</span>
            <span><i className="seg-window" />{t('Requested stay')}</span>
          </div>
        </div>
      )}
    </>
  );
}

const stayText = m => (m === 12 ? t('1 year') : m === 1 ? t('1 month') : t('{0} months', [m]));

function availText(i, moveIn) {
  if (i.freeForPeriod) return i.freeUntil ? t('free until {0}', [date(i.freeUntil)]) : t('free, no end date');
  if (i.freeInPeriodFrom) return t('free from {0}', [date(i.freeInPeriodFrom)]);
  if (i.freeFrom) return t('free from {0}', [date(i.freeFrom)]);
  return t('no end date on the current tenancy');
}

function Months({ start }) {
  const s = new Date(start);
  return (
    <div className="ai-track ai-months">
      {Array.from({ length: 12 }, (_, k) => {
        const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + k, 1));
        return <span key={k}>{d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}{d.getUTCMonth() === 0 || k === 0 ? <small> {String(d.getUTCFullYear()).slice(2)}</small> : null}</span>;
      })}
    </div>
  );
}

function Row({ i, data, moveIn, months, onNewDeal }) {
  const h0 = new Date(data.horizonStart).getTime(), h1 = new Date(data.horizonEnd).getTime();
  const pos = d => Math.min(100, Math.max(0, ((new Date(d || h1).getTime() - h0) / (h1 - h0)) * 100));
  const w0 = pos(data.from), w1 = pos(data.to);
  const nowPos = pos(new Date());
  const status = i.freeForPeriod ? 'ok' : i.freeInPeriodFrom ? 'part' : 'busy';
  return (
    <div className={`avail-row st-${status}`}>
      <div className="ai-info">
        {i.cover ? <img className="ai-pic" src={photoUrl(i.cover, true)} alt="" loading="lazy" /> : <span className="ai-pic none">{i.kind === 'FLAT' || i.kind === 'HOLIDAY' ? '⌂' : '▭'}</span>}
        <div style={{ minWidth: 0 }}>
          <div className="ai-name">{nameOf(i)}</div>
          <div className="tiny muted ai-where">{i.building.name}{i.building.area ? ` · ${i.building.area}` : ''}</div>
          <div className="ai-tags">
            <Badge>{t(KIND_LABEL[i.kind])}</Badge>
            {i.code && <Badge tone={i.unit.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[i.unit.occupancy]}</Badge>}
            {!i.code && i.unit.bedrooms != null && <Badge>{i.unit.bedrooms ? `${i.unit.bedrooms} BR` : t('Studio')}</Badge>}
          </div>
        </div>
      </div>
      <div className="ai-track" title={i.busy.map(b => `${t(BUSY_LABEL[b.kind])}: ${date(b.start)} → ${b.end ? date(b.end) : t('no end date')}`).join('\n')}>
        <div className="seg-free-bg" />
        {i.busy.map((b, k) => {
          const a = pos(b.start), z = pos(b.end);
          return z > a ? <div key={k} className={`seg seg-${b.kind}`} style={{ insetInlineStart: `${a}%`, width: `${z - a}%` }} /> : null;
        })}
        <div className="seg-window" style={{ insetInlineStart: `${w0}%`, width: `${Math.max(0.8, w1 - w0)}%` }} />
        <div className="seg-now" style={{ insetInlineStart: `${nowPos}%` }} />
      </div>
      <div className="ai-side">
        <div className="ai-price">{i.price ? <>{money(i.price)}<small>/{t('mo')}</small></> : i.nightly ? <>{money(i.nightly)}<small>/{t('night')}</small></> : <span className="muted small">{t('Ask')}</span>}</div>
        <div className={`ai-avail ${status}`}>{status === 'ok' ? `✓ ${t('Free for the stay')}` : availText(i, moveIn)}</div>
        {i.price && status === 'ok' ? <div className="tiny muted">{t('{0} for {1}', [money(i.price * months), stayText(months)])}</div> : null}
        {onNewDeal && status !== 'busy' && (
          <button className="btn btn-sm" onClick={() => onNewDeal({
            contractType: months >= 12 ? 'YEARLY' : 'SHORT_TERM', status: 'LEAD',
            property: i.building.name, unitNo: i.code ? `${i.unit.number} ${i.code}` : i.unit.number, area: i.building.area || '',
            unitType: i.code ? t(KIND_LABEL[i.kind]) : (i.unit.bedrooms ? `${i.unit.bedrooms}BR` : ''),
            moveIn: isoDay(i.freeForPeriod ? moveIn : i.freeInPeriodFrom || i.freeFrom), months, rent: i.price ? (months >= 12 ? i.price * 12 : i.price) : undefined,
          })}>{t('+ Deal')}</button>
        )}
      </div>
    </div>
  );
}
