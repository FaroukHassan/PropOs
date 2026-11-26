// frontend/src/lib/format.js — numbers, dates and labels
import { t, isAr, locale } from './i18n';
const aed = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 });
const aed2 = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n, { decimals = false, sign = false } = {}) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const hasCents = Math.round(v * 100) % 100 !== 0;
  const s = (decimals || hasCents ? aed2 : aed).format(Math.abs(v));
  const signStr = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return isAr ? `${signStr}${s} د.إ` : `${signStr}AED ${s}`;
};
export const num = n => (n === null || n === undefined ? '—' : aed.format(n));
export const pct = (n, digits = 0) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`);

// Dates come from the API as ISO strings at UTC midnight; show them as calendar dates
export const date = d => {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const shortDate = d => (d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—');
export const isoDay = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const today = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
};
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthLabel = key => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
export const shiftMonth = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const daysUntil = d => Math.round((new Date(d) - new Date(today())) / 86400000);
export const initials = name => (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ─── Labels for every enum the API uses ─────────────────────────────────────
export const L = {
  mode: { PARTITIONS: 'Partitions / beds', HOLIDAY: 'Holiday home', LONG_TERM: 'Long-term' },
  arrangement: { MASTER_LEASE: 'Leased from landlord', MANAGEMENT: 'Managed for owner', OWNED: 'Owned' },
  occupancy: { MIX: 'Mixed', LADIES: 'Ladies only', MEN: 'Men only', FAMILY: 'Family' },
  spaceKind: { PARTITION: 'Partition', BED: 'Bed', ROOM: 'Room', STUDIO: 'Studio' },
  spaceStatus: { AVAILABLE: 'Available', RESERVED: 'Reserved', OCCUPIED: 'Occupied', NOT_READY: 'Not ready' },
  leaseStatus: { ACTIVE: 'Active', NOTICE: 'Leaving (notice)', ENDED: 'Ended' },
  rentPeriod: { MONTHLY: 'Per month', YEARLY: 'Per year' },
  channel: { AIRBNB: 'Airbnb', BOOKING: 'Booking.com', DIRECT: 'Direct', OTHER: 'Other' },
  bookingStatus: { INQUIRY: 'Inquiry', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled' },
  txType: { INCOME: 'Income', EXPENSE: 'Expense' },
  category: {
    RENT: 'Rent', DEPOSIT: 'Deposit received', BOOKING: 'Holiday booking', LEASING_COMMISSION: 'Leasing commission', OTHER_INCOME: 'Other income',
    RENT_PAID: 'Rent paid to landlord', DEWA: 'DEWA', INTERNET: 'Internet & telecom', MAINTENANCE: 'Maintenance',
    CLEANING: 'Cleaning', SALARIES: 'Salaries', COMMISSION: 'Commission', DEPOSIT_REFUND: 'Deposit refund',
    LICENSE: 'Licence & fees', ADMIN: 'Admin', SECURITY: 'Security', FURNITURE: 'Furniture & setup',
    OWNER_PAYOUT: 'Owner payout', OTHER_EXPENSE: 'Other expense',
  },
  method: { CASH: 'Cash', BANK: 'Bank transfer', CARD: 'Card', CHEQUE: 'Cheque', ONLINE: 'Online / channel' },
  chequeDir: { IN: 'Received (from tenant)', OUT: 'Issued (to landlord)' },
  chequeStatus: { PENDING: 'Pending', POSTPONED: 'Postponed', DEPOSITED: 'Deposited', CLEARED: 'Paid', BOUNCED: 'Bounced', REPLACED: 'Replaced', CANCELLED: 'Cancelled' },
  priority: { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' },
  maintStatus: { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' },
  maintCategory: { AC: 'AC', PLUMBING: 'Plumbing', ELECTRICAL: 'Electrical', APPLIANCE: 'Appliance', CLEANING: 'Cleaning', PEST: 'Pest control', GENERAL: 'General' },
  role: { ADMIN: 'Admin', MANAGER: 'Manager', VIEWER: 'Read-only' },
  rentStatus: { PAID: 'Paid', PARTIAL: 'Part paid', DUE: 'Due', OVERDUE: 'Overdue' },
};
// Show every label in the chosen language
for (const group of Object.values(L)) for (const k of Object.keys(group)) group[k] = t(group[k]);

export const INCOME_CATS = ['RENT', 'DEPOSIT', 'BOOKING', 'LEASING_COMMISSION', 'OTHER_INCOME'];
export const EXPENSE_CATS = Object.keys(L.category).filter(c => !INCOME_CATS.includes(c));

export const TONE = {
  AVAILABLE: 'green', OCCUPIED: 'navy', RESERVED: 'amber', NOT_READY: '',
  ACTIVE: 'green', NOTICE: 'amber', ENDED: '',
  INQUIRY: '', CONFIRMED: 'blue', CHECKED_IN: 'green', CHECKED_OUT: '', CANCELLED: 'red',
  PENDING: 'pending', POSTPONED: 'postponed', DEPOSITED: 'blue', CLEARED: 'paid', BOUNCED: 'red', REPLACED: 'violet',
  PAID: 'green', PARTIAL: 'amber', DUE: 'blue', OVERDUE: 'red',
  OPEN: 'amber', IN_PROGRESS: 'blue', RESOLVED: 'green',
  LOW: '', NORMAL: 'blue', HIGH: 'amber', URGENT: 'red',
  INCOME: 'green', EXPENSE: 'red',
};

export const options = map => Object.entries(map).map(([value, label]) => ({ value, label }));

// CSV export of rows for Excel / Google Sheets
export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const unitName = u => (u ? `${u.building?.name ? `${u.building.name} · ` : ''}${u.number}` : '—');
