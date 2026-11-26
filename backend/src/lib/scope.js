// backend/src/lib/scope.js — the app-wide apartment filter.
// Any list or report can be narrowed with ?unitId=<apartment> or ?buildingId=<building>.

// For records that belong to an apartment (transactions, cheques, leases, bookings, maintenance…)
function unitScope(q = {}) {
  if (q.unitId) return { unitId: String(q.unitId) };
  if (q.buildingId) return { unit: { is: { buildingId: String(q.buildingId) } } };
  return {};
}

// For the apartments themselves
function unitWhere(q = {}) {
  if (q.unitId) return { id: String(q.unitId) };
  if (q.buildingId) return { buildingId: String(q.buildingId) };
  return {};
}

const isScoped = (q = {}) => !!(q.unitId || q.buildingId);

module.exports = { unitScope, unitWhere, isScoped };
