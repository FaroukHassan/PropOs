// frontend/src/lib/api.js — talks to the PropOS API
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const tokenStore = {
  get: () => { try { return localStorage.getItem('propos_token'); } catch { return null; } },
  set: t => { try { t ? localStorage.setItem('propos_token', t) : localStorage.removeItem('propos_token'); } catch { /* storage blocked */ } },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

async function request(method, path, body) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body),
  del: path => request('DELETE', path),
};

// Build a query string, skipping empty values
export const qs = params => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p).toString()}` : '';
};
