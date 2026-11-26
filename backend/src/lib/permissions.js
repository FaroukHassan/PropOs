// backend/src/lib/permissions.js — who can see and change what.
// Super admins (role ADMIN) have full access and manage the team. Everyone else gets a
// level per section of the system: none (hidden), view (read only) or edit.
const MODULES = ['dashboard', 'partitions', 'apartments', 'bookings', 'leasing', 'tenants', 'landlords', 'rent', 'ledger', 'cheques', 'reports', 'maintenance', 'import'];
const LEVELS = ['none', 'view', 'edit'];
const RANK = { none: 0, view: 1, edit: 2 };
const all = level => Object.fromEntries(MODULES.map(m => [m, level]));

function effective(user) {
  if (!user) return all('none');
  if (user.role === 'ADMIN') return all('edit');
  const base = user.role === 'VIEWER' ? all('view') : all('edit');
  const custom = user.permissions && typeof user.permissions === 'object' ? user.permissions : {};
  const out = { ...base };
  for (const m of MODULES) if (LEVELS.includes(custom[m])) out[m] = custom[m];
  if (user.role === 'VIEWER') for (const m of MODULES) if (out[m] === 'edit') out[m] = 'view';
  return out;
}

// Only keep known sections and levels from what the admin sent
function clean(perms) {
  if (perms === null) return null;
  if (!perms || typeof perms !== 'object') return undefined;
  const out = {};
  for (const m of MODULES) if (LEVELS.includes(perms[m])) out[m] = perms[m];
  return out;
}

// Which sections give access to an API call. The user needs the level on ANY of them.
// Reads of shared lists (apartments, tenants, landlords…) are open to every signed-in user
// because forms across the system use them to fill their drop-downs.
function required(method, path, query = {}, body = {}) {
  const read = method === 'GET';
  const need = read ? 'view' : 'edit';
  const is = re => re.test(path);
  if (is(/^\/dashboard/)) return { need, any: ['dashboard'] };
  if (is(/^\/reports\/rent-collection/)) return { need, any: ['rent', 'dashboard'] };
  if (is(/^\/reports\/owner-statement/)) return { need, any: ['landlords'] };
  if (is(/^\/reports\//)) return { need, any: ['reports'] };
  if (is(/^\/leasing/)) return { need, any: ['leasing'] };
  if (is(/^\/import/)) return { need: 'edit', any: ['import'] };
  if (is(/^\/bookings/)) return { need, any: ['bookings', 'dashboard'] };
  if (is(/^\/maintenance/)) return { need, any: ['maintenance'] };
  if (is(/^\/cheques/)) return { need, any: read ? ['cheques', 'landlords', 'apartments'] : ['cheques'] };
  if (is(/^\/transactions/)) {
    if (read) {
      if (query.dealId) return { need, any: ['leasing', 'ledger'] };
      if (query.unitId) return { need, any: ['apartments', 'ledger'] };
      return { need, any: ['ledger'] };
    }
    if (method === 'POST' && body.category === 'RENT') return { need, any: ['ledger', 'rent'] };
    if (method === 'POST' && body.category === 'MAINTENANCE') return { need, any: ['ledger', 'maintenance'] };
    return { need, any: ['ledger'] };
  }
  if (is(/^\/spaces\/board/)) return { need, any: ['partitions'] };
  if (read) return null; // shared lookups
  if (is(/^\/spaces/)) return { need, any: ['partitions', 'apartments'] };
  if (is(/^\/(units|buildings)/)) return { need, any: ['apartments'] };
  if (is(/^\/landlords/)) return { need, any: ['landlords', 'apartments'] };
  if (is(/^\/(tenants|leases)/)) return { need, any: ['tenants', 'partitions', 'apartments'] };
  return { need, any: MODULES };
}

function authorize(req, res, next) {
  if (req.user.role === 'ADMIN') return next();
  const rule = required(req.method, req.path, req.query, req.body || {});
  if (!rule) return next();
  const perms = effective(req.user);
  if (rule.any.some(m => RANK[perms[m]] >= RANK[rule.need])) return next();
  res.status(403).json({ error: rule.need === 'edit' ? 'You can view this but not change it. Ask a super admin for access.' : 'You don\'t have access to this. Ask a super admin.' });
}

module.exports = { MODULES, LEVELS, effective, clean, authorize, required };
