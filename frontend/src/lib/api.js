// frontend/src/lib/api.js — talks to the PropOS API
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const tokenStore = {
  get: () => { try { return localStorage.getItem('propos_token'); } catch { return null; } },
  set: tx => { try { tx ? localStorage.setItem('propos_token', tx) : localStorage.removeItem('propos_token'); } catch { /* storage blocked */ } },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

async function request(method, path, body) {
  if (import.meta.env.VITE_DEMO) {
    const { demoRequest } = await import('../demo/demo.js');
    return demoRequest(method, path, body);
  }
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

// Fetch a file (PDF, photo) with the login token and open or save it
async function fetchFile(path, auth = true) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, { headers: auth && token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.blob();
}

export async function openFile(path, fileName, { download = false, auth = true } = {}) {
  // open the tab first so pop-up blockers allow it, then point it at the file
  const win = download ? null : window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await fetchFile(path, auth));
    if (win) { win.location.href = url; } else {
      const a = document.createElement('a');
      a.href = url; a.download = fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { if (win) win.close(); throw e; }
}

export const fileToBase64 = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('Could not read the file'));
  r.readAsDataURL(file);
});

export const API_BASE = BASE;

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
