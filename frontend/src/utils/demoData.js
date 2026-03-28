// frontend/src/utils/demoData.js
// Mock data for demo mode (no backend required)

export const DEMO_USER = {
  id: 1,
  name: 'Farouk Hassan',
  email: 'farouk@propos.io',
  role: 'Admin',
};

export const DEMO_TOKEN = 'demo-token-propos';

const properties = [
  { id: 1, name: 'Sunset Apartments',  address: '120 Sunset Blvd, LA',    type: 'RESIDENTIAL', totalUnits: 24, occupiedUnits: 22, monthlyRevenue: 48000 },
  { id: 2, name: 'Downtown Office Hub', address: '88 Main St, NYC',        type: 'COMMERCIAL',  totalUnits: 12, occupiedUnits: 10, monthlyRevenue: 36000 },
  { id: 3, name: 'Lakeside Villas',     address: '45 Lakeview Dr, Chicago', type: 'RESIDENTIAL', totalUnits: 8,  occupiedUnits: 8,  monthlyRevenue: 22000 },
  { id: 4, name: 'The Gateway',         address: '200 Park Ave, Boston',    type: 'MIXED',       totalUnits: 16, occupiedUnits: 13, monthlyRevenue: 41000 },
];

const tenants = [
  { id: 1, name: 'Sarah Mitchell',  email: 'sarah@email.com',  phone: '555-0101', status: 'ACTIVE', property: properties[0], leaseEnd: '2026-09-30' },
  { id: 2, name: 'James Cooper',    email: 'james@email.com',  phone: '555-0102', status: 'ACTIVE', property: properties[0], leaseEnd: '2026-12-15' },
  { id: 3, name: 'Acme Corp',       email: 'lease@acme.co',    phone: '555-0201', status: 'ACTIVE', property: properties[1], leaseEnd: '2027-03-01' },
  { id: 4, name: 'Lisa Park',       email: 'lisa@email.com',   phone: '555-0301', status: 'ACTIVE', property: properties[2], leaseEnd: '2026-06-30' },
  { id: 5, name: 'David Kim',       email: 'david@email.com',  phone: '555-0103', status: 'ACTIVE', property: properties[0], leaseEnd: '2026-11-01' },
  { id: 6, name: 'TechStart Inc',   email: 'ops@techstart.io', phone: '555-0202', status: 'ACTIVE', property: properties[1], leaseEnd: '2027-06-01' },
  { id: 7, name: 'Maria Santos',    email: 'maria@email.com',  phone: '555-0302', status: 'ACTIVE', property: properties[2], leaseEnd: '2026-08-15' },
  { id: 8, name: 'Robert Chen',     email: 'robert@email.com', phone: '555-0401', status: 'ACTIVE', property: properties[3], leaseEnd: '2026-10-01' },
];

const leases = tenants.map((t, i) => ({
  id: i + 1,
  tenant: t,
  property: t.property,
  unit: { number: `${(i % 6) + 1}0${i + 1}`, property: t.property },
  startDate: '2025-' + String((i % 12) + 1).padStart(2, '0') + '-01',
  endDate: t.leaseEnd,
  monthlyRent: 1800 + i * 400,
  status: t.leaseEnd < '2026-06-01' ? 'EXPIRING' : 'ACTIVE',
  deposit: (1800 + i * 400) * 2,
}));

const now = new Date();
const payments = tenants.slice(0, 6).map((t, i) => ({
  id: i + 1,
  lease: { tenant: t },
  amount: 1800 + i * 400,
  dueDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
  paidDate: i < 4 ? new Date(now.getFullYear(), now.getMonth(), 1 + i).toISOString() : null,
  status: i < 4 ? 'PAID' : i === 4 ? 'PENDING' : 'OVERDUE',
  method: i < 4 ? 'STRIPE' : null,
}));

const maintenance = [
  { id: 1, title: 'Leaking faucet in kitchen',     category: 'PLUMBING',    priority: 'HIGH',   status: 'OPEN',        unit: { number: '101', property: properties[0] }, createdAt: new Date(now - 2 * 86400000).toISOString() },
  { id: 2, title: 'AC not cooling properly',        category: 'HVAC',        priority: 'URGENT', status: 'IN_PROGRESS', unit: { number: '305', property: properties[0] }, createdAt: new Date(now - 1 * 86400000).toISOString() },
  { id: 3, title: 'Broken light fixture in lobby',  category: 'ELECTRICAL',  priority: 'NORMAL', status: 'OPEN',        unit: { number: '201', property: properties[1] }, createdAt: new Date(now - 3 * 86400000).toISOString() },
  { id: 4, title: 'Dishwasher not draining',        category: 'APPLIANCE',   priority: 'NORMAL', status: 'OPEN',        unit: { number: '102', property: properties[2] }, createdAt: new Date(now - 5 * 86400000).toISOString() },
  { id: 5, title: 'Window seal cracked',            category: 'STRUCTURAL',  priority: 'LOW',    status: 'RESOLVED',    unit: { number: '404', property: properties[3] }, createdAt: new Date(now - 10 * 86400000).toISOString() },
];

const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const revenueTrend = months.map((m, i) => ({
  month: m,
  revenue: 140000 + Math.round(Math.random() * 15000),
  expenses: 55000 + Math.round(Math.random() * 10000),
}));

const financeSummary = {
  totalRevenue: 147000,
  totalExpenses: 58200,
  noi: 88800,
  collectionRate: 93.5,
  outstandingBalance: 9600,
};

const transactions = payments.map((p, i) => ({
  id: i + 1,
  type: 'INCOME',
  category: 'RENT',
  amount: p.amount,
  date: p.paidDate || p.dueDate,
  description: `Rent - ${p.lease.tenant.name}`,
  status: p.status,
}));

// Route handler map
const routes = {
  '/auth/login':    () => ({ token: DEMO_TOKEN, user: DEMO_USER }),
  '/auth/register': () => ({ token: DEMO_TOKEN, user: DEMO_USER }),
  '/auth/me':       () => DEMO_USER,
  '/properties':    () => properties,
  '/tenants':       () => tenants,
  '/leases':        () => leases,
  '/maintenance':   () => maintenance,
  '/payments':      () => payments,
  '/finance/summary':       () => financeSummary,
  '/finance/revenue-trend': () => revenueTrend,
  '/finance/transactions':  () => transactions,
  '/dashboard/summary':     () => financeSummary,
};

export function demoRequest(method, path) {
  // Strip query params for matching
  const cleanPath = path.split('?')[0];

  // Match exact routes
  if (routes[cleanPath]) return Promise.resolve(routes[cleanPath]());

  // POST/PATCH/DELETE for CRUD - return success
  if (method === 'POST')   return Promise.resolve({ id: Date.now(), success: true });
  if (method === 'PATCH')  return Promise.resolve({ success: true });
  if (method === 'DELETE') return Promise.resolve(null);

  // Fallback
  return Promise.resolve([]);
}
