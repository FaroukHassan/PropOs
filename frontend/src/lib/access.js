// frontend/src/lib/access.js — which section of the system each screen belongs to.
// Matches backend/src/lib/permissions.js: super admins see everything; other users get
// none / view / edit per section, set by a super admin under Settings → Team.
export const SECTIONS = ['dashboard', 'partitions', 'apartments', 'bookings', 'leasing', 'tenants', 'landlords', 'rent', 'ledger', 'cheques', 'reports', 'maintenance', 'import'];
export const SECTION_LABEL = {
  dashboard: 'Dashboard', partitions: 'Partitions board', apartments: 'Apartments', bookings: 'Holiday bookings',
  leasing: 'Leasing deals', tenants: 'Tenants', landlords: 'Landlords & owners', rent: 'Rent collection',
  ledger: 'Income & expenses', cheques: 'Cheques', reports: 'Reports', maintenance: 'Maintenance', import: 'Import from sheets',
};
const PATHS = {
  '/dashboard': 'dashboard', '/partitions': 'partitions', '/units': 'apartments', '/bookings': 'bookings', '/leasing': 'leasing',
  '/tenants': 'tenants', '/landlords': 'landlords', '/rent': 'rent', '/ledger': 'ledger', '/cheques': 'cheques',
  '/reports': 'reports', '/maintenance': 'maintenance', '/import': 'import',
};
export const sectionOf = path => PATHS[path] || (path.startsWith('/units/') ? 'apartments' : null);
export const pathOf = section => Object.keys(PATHS).find(p => PATHS[p] === section);

// Ready-made sets a super admin can start from
export const PRESETS = {
  full: Object.fromEntries(SECTIONS.map(s => [s, 'edit'])),
  readonly: Object.fromEntries(SECTIONS.map(s => [s, 'view'])),
  operations: { dashboard: 'none', partitions: 'edit', apartments: 'view', bookings: 'edit', leasing: 'none', tenants: 'edit', landlords: 'none', rent: 'edit', ledger: 'none', cheques: 'none', reports: 'none', maintenance: 'edit', import: 'none' },
  leasing: { dashboard: 'none', partitions: 'view', apartments: 'none', bookings: 'none', leasing: 'edit', tenants: 'none', landlords: 'none', rent: 'none', ledger: 'none', cheques: 'none', reports: 'none', maintenance: 'none', import: 'none' },
  accounts: { dashboard: 'view', partitions: 'view', apartments: 'view', bookings: 'view', leasing: 'view', tenants: 'view', landlords: 'edit', rent: 'edit', ledger: 'edit', cheques: 'edit', reports: 'view', maintenance: 'view', import: 'edit' },
};
