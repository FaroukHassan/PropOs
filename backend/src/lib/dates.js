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
