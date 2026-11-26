// frontend/src/demo/demo.js — offline demo: answers GET requests from recorded sample data.
// Saving is switched off; the user gets a clear message instead.
// The data file (demo-data.json) is generated from the sample seed and shipped beside the page.
let data = {};
let loaded;
const load = () => (loaded ||= fetch(`${import.meta.env.BASE_URL}demo-data.json`).then(r => r.json()).then(d => { data = d; }));

const DEMO_USER = { id: 'demo', name: 'Farouk Hassan', email: 'farouk@sakanly.com', role: 'ADMIN', org: { name: 'Sakanly Stay Holiday Homes', currency: 'AED' } };
const FILTERABLE = ['mode', 'unitId', 'spaceId', 'direction', 'status', 'type', 'category', 'buildingId', 'leaseId', 'landlordId'];

function parse(path) {
  const [pathname, query = ''] = path.split('?');
  return { pathname, params: Object.fromEntries(new URLSearchParams(query)) };
}

// Pick the best recorded answer for a request we did not record exactly
function fallback(pathname, params) {
  const candidates = Object.keys(data).filter(k => k.split('?')[0] === pathname);
  if (candidates.length) {
    // prefer same month, then the fewest extra filters
    const score = k => {
      const p = parse(k).params;
      let s = 0;
      for (const [key, v] of Object.entries(params)) if (p[key] === v) s += key === 'month' || key === 'from' ? 10 : 3;
      return s - Object.keys(p).length;
    };
    const best = candidates.sort((a, b) => score(b) - score(a))[0];
    let out = data[best];
    if (Array.isArray(out)) {
      const bp = parse(best).params;
      for (const f of FILTERABLE) {
        if (params[f] && bp[f] !== params[f]) out = out.filter(x => x[f] === undefined || x[f] === params[f]);
      }
      if (params.q) { const q = params.q.toLowerCase(); out = out.filter(x => JSON.stringify(x).toLowerCase().includes(q)); }
    }
    return out;
  }
  // a single record by id: look it up in the list
  const m = pathname.match(/^\/(\w+)\/([0-9a-f-]{36})$/);
  if (m) {
    const list = data[`/${m[1]}`];
    const row = Array.isArray(list) && list.find(x => x.id === m[2]);
    if (row) return { leases: [], bookings: [], cheques: [], transactions: [], spaces: [], ...row };
  }
  return Array.isArray(data[pathname]) ? [] : null;
}

export class DemoSaveError extends Error {}

export async function demoRequest(method, path) {
  await load();
  if (path === '/auth/login') return { token: 'demo', user: DEMO_USER };
  if (path === '/auth/me') return DEMO_USER;
  if (method !== 'GET') throw new DemoSaveError('This is a demo with sample data, so changes are not saved. In the live system this would be saved.');
  const { pathname, params } = parse(path);
  return path in data ? data[path] : fallback(pathname, params);
}
