// backend/src/lib/dates.js — month helpers. All dates are stored as UTC.

const pad = n => String(n).padStart(2, '0');

// "2026-06" for a date
const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

// { start, end } for "2026-06": start inclusive, end exclusive
function monthRange(key = monthKey()) {
  if (!/^\d{4}-\d{2}$/.test(key)) key = monthKey();
  const [y, m] = key.split('-').map(Number);
  return { key, start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

// The previous n month keys ending with `key`, oldest first
function lastMonths(n, key = monthKey()) {
  const { start } = monthRange(key);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1))));
  }
  return out;
}

const DAY = 86400000;
const startOfDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

// Nights of [checkIn, checkOut) that fall inside [start, end)
function nightsWithin(checkIn, checkOut, start, end) {
  const a = Math.max(checkIn.getTime(), start.getTime());
  const b = Math.min(checkOut.getTime(), end.getTime());
  return b > a ? Math.round((b - a) / DAY) : 0;
}

const nights = (checkIn, checkOut) => Math.max(0, Math.round((checkOut - checkIn) / DAY));

module.exports = { monthKey, monthRange, lastMonths, startOfDay, addDays, nightsWithin, nights, DAY };

// ─── Reporting periods ──────────────────────────────────────────────────────
// Every report takes either ?month=2026-11 or ?from=2026-10-01&to=2026-12-31 (both dates included).
// Returns { start, end } with end exclusive, plus the month keys the period touches.
function periodFrom(q = {}, HttpError = Error) {
  let start, end;
  if (q.from || q.to) {
    const f = new Date(q.from || q.to), t = new Date(q.to || q.from);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) throw new HttpError(422, 'Choose valid dates');
    start = startOfDay(f); end = addDays(startOfDay(t), 1);
    if (start >= end) throw new HttpError(422, 'The start date must be on or before the end date');
    if (end - start > 3700 * DAY) throw new HttpError(422, 'Choose a period of ten years or less');
  } else {
    ({ start, end } = monthRange(q.month || monthKey()));
  }
  return { start, end, keys: monthKeysBetween(start, end), days: Math.round((end - start) / DAY) };
}

// Month keys touched by [start, end)
function monthKeysBetween(start, end) {
  const out = [];
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d < end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) out.push(monthKey(d));
  return out;
}

// The period just before: whole calendar months step back by the same number of months, otherwise by the same number of days
function previousPeriod({ start, end }) {
  const wholeMonths = start.getUTCDate() === 1 && end.getUTCDate() === 1;
  if (wholeMonths) {
    const n = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    return { start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - n, 1)), end: start };
  }
  return { start: new Date(start.getTime() - (end - start)), end: start };
}

module.exports.periodFrom = periodFrom;
module.exports.monthKeysBetween = monthKeysBetween;
module.exports.previousPeriod = previousPeriod;
