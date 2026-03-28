// frontend/src/utils/api.js
import { demoRequest, DEMO_TOKEN } from './demoData';

const BASE = import.meta.env.VITE_API_URL || '/api';

// Demo mode: enabled when no VITE_API_URL is set or token is demo token
function isDemoMode() {
  return !import.meta.env.VITE_API_URL || localStorage.getItem('token') === DEMO_TOKEN;
}

async function request(method, path, body) {
  // In demo mode, return mock data
  if (isDemoMode()) {
    // Small delay to simulate network
    await new Promise(r => setTimeout(r, 200));
    return demoRequest(method, path, body);
  }

  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
};

export const fmt = {
  currency: (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0),
  pct:      (n) => `${(n ?? 0).toFixed(1)}%`,
  date:     (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  dateShort:(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  initials: (name) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??',
  avatarColor: (name) => {
    const colors = ['avatar-blue', 'avatar-green', 'avatar-amber', 'avatar-red'];
    return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  },
};

export const PRIORITY_BADGE = { URGENT:'badge-danger', HIGH:'badge-warning', NORMAL:'badge-neutral', LOW:'badge-neutral' };
export const STATUS_BADGE   = { ACTIVE:'badge-success', PAID:'badge-success', RESOLVED:'badge-success', PENDING:'badge-info', IN_PROGRESS:'badge-info', NEW:'badge-info', LATE:'badge-warning', EXPIRING:'badge-warning', OVERDUE:'badge-danger', TERMINATED:'badge-danger', OPEN:'badge-neutral', EXPIRED:'badge-neutral', CLOSED:'badge-neutral' };
