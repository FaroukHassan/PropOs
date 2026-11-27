// frontend/src/lib/access.js — which section of the system each screen belongs to.
// Matches backend/src/lib/permissions.js: super admins see everything; other users get
// none / view / edit per section, set by a super admin under Settings → Team.
export const SECTIONS = ['dashboard', 'partitions', 'apartments', 'bookings', 'leasing', 'tenants', 'landlords', 'rent', 'ledger', 'invoices', 'cheques', 'reports', 'maintenance', 'marketing', 'import'];
export const SECTION_LABEL = {
  dashboard: 'Dashboard', partitions: 'Rooms board', apartments: 'Apartments', bookings: 'Holiday bookings',
  leasing: 'Leasing deals', tenants: 'Tenants', landlords: 'Landlords & owners', rent: 'Rent collection',
  ledger: 'Income & expenses', invoices: 'Invoices', cheques: 'Cheques', reports: 'Reports', maintenance: 'Maintenance', marketing: 'Marketing', import: 'Import from sheets',
};
const PATHS = {
  '/dashboard': 'dashboard', '/partitions': 'partitions', '/units': 'apartments', '/bookings': 'bookings', '/leasing': 'leasing',
  '/tenants': 'tenants', '/landlords': 'landlords', '/rent': 'rent', '/ledger': 'ledger', '/invoices': 'invoices', '/cheques': 'cheques',
  '/reports': 'reports', '/maintenance': 'maintenance', '/marketing': 'marketing', '/import': 'import',
};
export const sectionOf = path => PATHS[path] || (path.startsWith('/units/') ? 'apartments' : null);
export const pathOf = section => Object.keys(PATHS).find(p => PATHS[p] === section);

// Ready-made sets a super admin can start from
export const PRESETS = {
  full: Object.fromEntries(SECTIONS.map(s => [s, 'edit'])),
  readonly: Object.fromEntries(SECTIONS.map(s => [s, 'view'])),
  operations: { dashboard: 'none', partitions: 'edit', apartments: 'view', bookings: 'edit', leasing: 'none', tenants: 'edit', landlords: 'none', rent: 'edit', ledger: 'none', invoices: 'none', cheques: 'none', reports: 'none', maintenance: 'edit', marketing: 'view', import: 'none' },
  leasing: { dashboard: 'none', partitions: 'view', apartments: 'none', bookings: 'none', leasing: 'edit', tenants: 'none', landlords: 'none', rent: 'none', ledger: 'none', invoices: 'none', cheques: 'none', reports: 'none', maintenance: 'none', marketing: 'view', import: 'none' },
  marketing: { dashboard: 'none', partitions: 'view', apartments: 'view', bookings: 'none', leasing: 'none', tenants: 'none', landlords: 'none', rent: 'none', ledger: 'none', invoices: 'none', cheques: 'none', reports: 'none', maintenance: 'none', marketing: 'edit', import: 'none' },
  accounts: { dashboard: 'view', partitions: 'view', apartments: 'view', bookings: 'view', leasing: 'view', tenants: 'view', landlords: 'edit', rent: 'edit', ledger: 'edit', invoices: 'edit', cheques: 'edit', reports: 'view', maintenance: 'view', marketing: 'none', import: 'edit' },
};
