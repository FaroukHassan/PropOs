// frontend/src/lib/period.jsx — the app-wide date filter.
// One period is shared by the dashboard, rent collection, income & expenses, reports, bookings,
// owner statements and apartment pages. Presets ("This month", "Last quarter"…) roll forward on
// their own; ‹ › step to the previous/next period; "Custom" takes any two dates.
import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { useSticky } from './hooks';

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const parse = s => { const [y, m, d] = s.split('-').map(Number); return utc(y, m - 1, d); };
const todayUtc = () => { const n = new Date(); return utc(n.getFullYear(), n.getMonth(), n.getDate()); };
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

// Weeks run Monday–Sunday (UAE working week)
export const PRESETS = [
  ['Days', [['today', 'Today'], ['yesterday', 'Yesterday'], ['last_7', 'Last 7 days'], ['last_30', 'Last 30 days'], ['last_90', 'Last 90 days']]],
  ['Weeks & months', [['this_week', 'This week'], ['last_week', 'Last week'], ['this_month', 'This month'], ['last_month', 'Last month'], ['next_month', 'Next month']]],
  ['Quarters & years', [['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['ytd', 'Year to date'], ['this_year', 'This year'], ['last_year', 'Last year'], ['last_12m', 'Last 12 months']]],
];
const PRESET_LABEL = Object.fromEntries(PRESETS.flatMap(([, items]) => items));

export function presetRange(key, now = todayUtc()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), q = Math.floor(m / 3) * 3;
  const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
  switch (key) {
    case 'today': return [now, now];
    case 'yesterday': return [addDays(now, -1), addDays(now, -1)];
    case 'last_7': return [addDays(now, -6), now];
    case 'last_30': return [addDays(now, -29), now];
    case 'last_90': return [addDays(now, -89), now];
    case 'this_week': return [addDays(now, -dow), addDays(now, 6 - dow)];
    case 'last_week': return [addDays(now, -dow - 7), addDays(now, -dow - 1)];
    case 'last_month': return [utc(y, m - 1, 1), utc(y, m, 0)];
    case 'next_month': return [utc(y, m + 1, 1), utc(y, m + 2, 0)];
    case 'this_quarter': return [utc(y, q, 1), utc(y, q + 3, 0)];
    case 'last_quarter': return [utc(y, q - 3, 1), utc(y, q, 0)];
    case 'ytd': return [utc(y, 0, 1), now];
    case 'this_year': return [utc(y, 0, 1), utc(y, 11, 31)];
    case 'last_year': return [utc(y - 1, 0, 1), utc(y - 1, 11, 31)];
    case 'last_12m': return [utc(y, m - 11, 1), utc(y, m + 1, 0)];
    case 'this_month': default: return [utc(y, m, 1), utc(y, m + 1, 0)];
  }
}

const fmt = (d, opts) => d.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
const isMonthStart = d => d.getUTCDate() === 1;
const isMonthEnd = d => addDays(d, 1).getUTCDate() === 1;
const monthsSpan = (a, b) => (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;

// "November 2026", "Q4 2026", "2026", "Sep – Nov 2026" or "3 – 19 Nov 2026"
export function describe(from, to) {
  const a = parse(from), b = parse(to);
  if (from === to) return fmt(a, { day: 'numeric', month: 'short', year: 'numeric' });
  if (isMonthStart(a) && isMonthEnd(b)) {
    const n = monthsSpan(a, b);
    if (n === 1) return fmt(a, { month: 'long', year: 'numeric' });
    if (n === 3 && a.getUTCMonth() % 3 === 0) return `Q${a.getUTCMonth() / 3 + 1} ${a.getUTCFullYear()}`;
    if (n === 12 && a.getUTCMonth() === 0) return String(a.getUTCFullYear());
    return a.getUTCFullYear() === b.getUTCFullYear()
      ? `${fmt(a, { month: 'short' })} – ${fmt(b, { month: 'short', year: 'numeric' })}`
      : `${fmt(a, { month: 'short', year: 'numeric' })} – ${fmt(b, { month: 'short', year: 'numeric' })}`;
  }
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  return `${fmt(a, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Step a range back or forward by its own length (whole months by months, otherwise by days)
export function stepRange(from, to, dir) {
  const a = parse(from), b = parse(to);
  if (isMonthStart(a) && isMonthEnd(b)) {
    const n = monthsSpan(a, b) * dir;
    return [iso(utc(a.getUTCFullYear(), a.getUTCMonth() + n, 1)), iso(utc(b.getUTCFullYear(), b.getUTCMonth() + n + 1, 0))];
  }
  const len = Math.round((b - a) / DAY) + 1;
  return [iso(addDays(a, len * dir)), iso(addDays(b, len * dir))];
}

const Ctx = createContext(null);

export function PeriodProvider({ children }) {
  const [state, setState] = useSticky('period', { preset: 'this_month' });
  const value = useMemo(() => {
    let from, to;
    if (state.preset === 'custom' && state.from && state.to) ({ from, to } = state);
    else [from, to] = presetRange(state.preset).map(iso);
    const a = parse(from), b = parse(to);
    const singleMonth = isMonthStart(a) && isMonthEnd(b) && monthsSpan(a, b) === 1;
    return {
      preset: state.preset, from, to,
      days: Math.round((b - a) / DAY) + 1,
      // set when the period is exactly one calendar month (some screens show monthly figures)
      month: singleMonth ? from.slice(0, 7) : null,
      label: describe(from, to),
      presetLabel: state.preset === 'custom' ? 'Custom' : PRESET_LABEL[state.preset],
      params: { from, to },
      setPreset: preset => setState({ preset }),
      setCustom: (f, t) => setState({ preset: 'custom', from: f <= t ? f : t, to: f <= t ? t : f }),
      step: dir => { const [f, t] = stepRange(from, to, dir); setState({ preset: 'custom', from: f, to: t }); },
    };
  }, [state, setState]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePeriod = () => useContext(Ctx);

// The date filter control: ‹ [ This month · November 2026 ▾ ] ›
export function PeriodPicker() {
  const p = usePeriod();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(p.from);
  const [to, setTo] = useState(p.to);
  const ref = useRef(null);
  useEffect(() => { if (open) { setFrom(p.from); setTo(p.to); } }, [open, p.from, p.to]);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="period" ref={ref}>
      <button className="btn btn-sm btn-icon" onClick={() => p.step(-1)} aria-label="Previous period">‹</button>
      <button className={`btn btn-sm period-btn ${open ? 'on' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="period-cal" aria-hidden>▦</span>
        <span className="period-text"><span className="period-preset">{p.preset === 'custom' ? '' : `${p.presetLabel} · `}</span><b>{p.label}</b></span>
        <span className="period-caret" aria-hidden>▾</span>
      </button>
      <button className="btn btn-sm btn-icon" onClick={() => p.step(1)} aria-label="Next period">›</button>
      {open && <>
        <div className="period-backdrop" onClick={() => setOpen(false)} />
        <div className="period-pop" role="dialog" aria-label="Choose dates">
          <div className="period-pop-head"><b>Date range</b><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
          <div className="period-presets">
            {PRESETS.map(([group, items]) => (
              <div key={group}>
                <div className="period-group">{group}</div>
                {items.map(([k, label]) => (
                  <button key={k} className={p.preset === k ? 'on' : ''} onClick={() => { p.setPreset(k); setOpen(false); }}>
                    <span>{label}</span><span className="faint tiny">{describe(...presetRange(k).map(iso))}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <form className="period-custom" onSubmit={e => { e.preventDefault(); if (from && to) { p.setCustom(from, to); setOpen(false); } }}>
            <div className="period-group">Custom range</div>
            <div className="row">
              <label className="grow"><span className="tiny faint">From</span><input className="input input-sm" type="date" value={from} onChange={e => setFrom(e.target.value)} required /></label>
              <label className="grow"><span className="tiny faint">To</span><input className="input input-sm" type="date" value={to} onChange={e => setTo(e.target.value)} required /></label>
            </div>
            <button className="btn btn-primary btn-sm" type="submit">Apply</button>
          </form>
        </div>
      </>}
    </div>
  );
}
