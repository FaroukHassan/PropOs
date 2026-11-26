// backend/test/api.test.js — end-to-end API checks against a database seeded with SEED_DEMO=1.
// Run: DATABASE_URL=... SEED_PASSWORD=testpass123 npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/index');
const prisma = require('../src/db');

let server, base, token, viewerToken;
const call = async (method, path, body, tk = token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await call('POST', '/api/auth/login', { email: 'farouk@sakanly.com', password: process.env.SEED_PASSWORD || 'testpass123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  token = r.body.token;
});
after(async () => { server.close(); await prisma.$disconnect(); });

test('auth: wrong password and missing token are rejected', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: 'farouk@sakanly.com', password: 'nope' })).status, 401);
  assert.equal((await call('GET', '/api/units', null, null)).status, 401);
  const me = await call('GET', '/api/auth/me');
  assert.equal(me.body.org.currency, 'AED');
});

test('team: admin can add a read-only user who cannot write', async () => {
  const email = `viewer${Date.now()}@sakanly.com`;
  const u = await call('POST', '/api/auth/users', { name: 'Viewer', email, password: 'viewerpass1', role: 'VIEWER' });
  assert.equal(u.status, 201);
  viewerToken = (await call('POST', '/api/auth/login', { email, password: 'viewerpass1' })).body.token;
  assert.equal((await call('GET', '/api/units', null, viewerToken)).status, 200);
  assert.equal((await call('POST', '/api/buildings', { name: 'X' }, viewerToken)).status, 403);
  assert.equal((await call('DELETE', `/api/auth/users/${u.body.id}`)).status, 204);
  assert.equal((await call('GET', '/api/units', null, viewerToken)).status, 401, 'removed account loses access at once');
});

test('bad enum values give a clear 422, not a crash', async () => {
  const b = (await call('GET', '/api/buildings')).body[0];
  const r = await call('POST', '/api/units', { buildingId: b.id, number: 'X1', mode: 'NONSENSE' });
  assert.equal(r.status, 422);
  assert.equal((await call('POST', '/api/auth/users', { name: 'x', email: 'x@x.com', password: 'longenough', role: 'GOD' })).status, 422);
});

test('dashboard returns sensible numbers', async () => {
  const { status, body } = await call('GET', '/api/dashboard');
  assert.equal(status, 200);
  assert.ok(body.partitions.total > 0);
  assert.ok(body.partitions.occupied > 0 && body.partitions.occupied <= body.partitions.total);
  assert.ok(body.rent.due > 0);
  assert.ok(body.rent.collected <= body.rent.due);
  assert.equal(body.trend.length, 6);
  assert.ok(body.holiday.units === 2);
  assert.ok(body.holiday.occupancy >= 0 && body.holiday.occupancy <= 1);
});

test('partition board groups by building and matches statuses', async () => {
  const { body } = await call('GET', '/api/spaces/board');
  assert.deepEqual(body.buildings.map(b => b.name).sort(), ['Al Fahd 2', 'Sheikha Noura']);
  const spaces = body.buildings.flatMap(b => b.units.flatMap(u => u.spaces));
  for (const s of spaces) {
    if (s.status === 'OCCUPIED') assert.ok(s.lease, `${s.code} occupied without tenant`);
  }
});

let unitId, spaceId, tenantId, leaseId;
test('lease lifecycle keeps the partition status in sync', async () => {
  const board = (await call('GET', '/api/spaces/board')).body;
  const unit = board.buildings[0].units[0];
  const free = unit.spaces.find(s => s.status === 'AVAILABLE');
  assert.ok(free, 'need an available space in sample data');
  unitId = unit.id; spaceId = free.id;

  tenantId = (await call('POST', '/api/tenants', { name: 'Test Tenant', phone: '+971 50 123 4567' })).body.id;
  const lease = await call('POST', '/api/leases', { tenantId, unitId, spaceId, startDate: '2026-11-01', rent: 1800, deposit: 400, depositPaid: 400 });
  assert.equal(lease.status, 201, JSON.stringify(lease.body));
  leaseId = lease.body.id;
  assert.equal((await call('GET', `/api/spaces/${spaceId}`)).body.status, 'OCCUPIED');

  // A second tenant cannot take the same partition
  const t2 = (await call('POST', '/api/tenants', { name: 'Second Tenant' })).body.id;
  const clash = await call('POST', '/api/leases', { tenantId: t2, unitId, spaceId, startDate: '2026-11-05', rent: 1800 });
  assert.equal(clash.status, 409);

  // Space from another apartment is refused
  const other = board.buildings[1].units[0].spaces[0];
  assert.equal((await call('POST', '/api/leases', { tenantId: t2, unitId, spaceId: other.id, startDate: '2026-11-05', rent: 1 })).status, 422);
});

test('rent payment shows up in rent collection as partial then paid', async () => {
  const month = new Date().toISOString().slice(0, 7);
  const pay = await call('POST', '/api/transactions', { date: `${month}-02`, type: 'INCOME', category: 'RENT', description: 'Rent', amount: 800, leaseId });
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  assert.equal(pay.body.unitId, unitId, 'unit is filled in from the lease');
  assert.equal(pay.body.periodMonth, month);
  let row = (await call('GET', `/api/reports/rent-collection?month=${month}`)).body.rows.find(r => r.leaseId === leaseId);
  assert.equal(row.status, 'PARTIAL');
  assert.equal(row.balance, 1000);
  await call('POST', '/api/transactions', { date: `${month}-03`, type: 'INCOME', category: 'RENT', description: 'Rest', amount: 1000, leaseId });
  row = (await call('GET', `/api/reports/rent-collection?month=${month}`)).body.rows.find(r => r.leaseId === leaseId);
  assert.equal(row.status, 'PAID');
});

test('ledger validation', async () => {
  const bad = await call('POST', '/api/transactions', { date: '2026-11-02', type: 'INCOME', category: 'DEWA', description: 'x', amount: 5 });
  assert.equal(bad.status, 422);
  assert.equal((await call('POST', '/api/transactions', { date: '2026-11-02', type: 'EXPENSE', category: 'DEWA', description: 'x', amount: -5 })).status, 422);
  assert.equal((await call('POST', '/api/transactions', { date: 'not a date', type: 'EXPENSE', category: 'DEWA', description: 'x', amount: 5 })).status, 422);
});

test('ending a lease frees the space and books the deposit refund', async () => {
  const r = await call('POST', `/api/leases/${leaseId}/end`, { endDate: '2026-11-30', refund: 400 });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', `/api/spaces/${spaceId}`)).body.status, 'AVAILABLE');
  const refunds = (await call('GET', `/api/transactions?leaseId=${leaseId}&category=DEPOSIT_REFUND`)).body;
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, 400);
});

test('holiday bookings reject overlaps and non-holiday units', async () => {
  const units = (await call('GET', '/api/units?mode=HOLIDAY')).body;
  const hh = units[0];
  const ok = await call('POST', '/api/bookings', { unitId: hh.id, guestName: 'Overlap Test', checkIn: '2027-03-01', checkOut: '2027-03-05', totalAmount: 2000, channel: 'AIRBNB', channelFee: 300 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const clash = await call('POST', '/api/bookings', { unitId: hh.id, guestName: 'Clash', checkIn: '2027-03-04', checkOut: '2027-03-06', totalAmount: 900 });
  assert.equal(clash.status, 409);
  const touching = await call('POST', '/api/bookings', { unitId: hh.id, guestName: 'Back to back', checkIn: '2027-03-05', checkOut: '2027-03-07', totalAmount: 900 });
  assert.equal(touching.status, 201, 'check-out day can be the next check-in');
  assert.equal((await call('POST', '/api/bookings', { unitId, guestName: 'x', checkIn: '2027-03-01', checkOut: '2027-03-02', totalAmount: 1 })).status, 422);
  assert.equal((await call('POST', '/api/bookings', { unitId: hh.id, guestName: 'x', checkIn: '2027-04-05', checkOut: '2027-04-01', totalAmount: 1 })).status, 422);
  const list = (await call('GET', `/api/bookings?unitId=${hh.id}&from=2027-03-01&to=2027-03-31`)).body;
  assert.equal(list.length, 2);
  assert.equal(list[0].nights, 4);
  assert.equal(list[0].net, 1700);
});

test('a single partition can be booked as a holiday stay', async () => {
  const board = (await call('GET', '/api/spaces/board')).body;
  const unit = board.buildings[0].units[0];
  const occupied = unit.spaces.find(s => s.status === 'OCCUPIED');
  const free = unit.spaces.find(s => s.status !== 'OCCUPIED');
  const a = await call('POST', '/api/bookings', { unitId: unit.id, spaceId: occupied.id, guestName: 'x', checkIn: '2027-05-01', checkOut: '2027-05-03', totalAmount: 400 });
  assert.equal(a.status, 409, 'cannot book a partition with a monthly tenant');
  const b = await call('POST', '/api/bookings', { unitId: unit.id, spaceId: free.id, guestName: 'Partition guest', checkIn: '2027-05-01', checkOut: '2027-05-03', totalAmount: 400 });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  const other = unit.spaces.find(s => s.id !== free.id && s.status !== 'OCCUPIED');
  if (other) {
    const c = await call('POST', '/api/bookings', { unitId: unit.id, spaceId: other.id, guestName: 'Same dates other partition', checkIn: '2027-05-01', checkOut: '2027-05-03', totalAmount: 400 });
    assert.equal(c.status, 201, 'different partitions can be booked on the same dates');
  }
  const d = await call('POST', '/api/bookings', { unitId: unit.id, spaceId: free.id, guestName: 'clash', checkIn: '2027-05-02', checkOut: '2027-05-04', totalAmount: 400 });
  assert.equal(d.status, 409);
});

test('leasing commission is an income category', async () => {
  const r = await call('POST', '/api/transactions', { date: '2026-11-05', type: 'INCOME', category: 'LEASING_COMMISSION', description: 'Deal no. 12 commission', amount: 2500 });
  assert.equal(r.status, 201);
  assert.equal((await call('POST', '/api/transactions', { date: '2026-11-05', type: 'EXPENSE', category: 'LEASING_COMMISSION', description: 'x', amount: 1 })).status, 422);
});

test('cheques: series, postpone, clear posts once to ledger', async () => {
  const s = await call('POST', '/api/cheques/series', { direction: 'IN', count: 4, everyMonths: 3, amount: 10000, firstDate: '2027-01-10', firstNumber: '000120', bank: 'ENBD', unitId });
  assert.equal(s.status, 201);
  const list = (await call('GET', `/api/cheques?unitId=${unitId}&direction=IN`)).body.filter(c => c.bank === 'ENBD');
  assert.deepEqual(list.map(c => c.number), ['000120', '000121', '000122', '000123']);
  assert.deepEqual(list.map(c => c.dueDate.slice(0, 10)), ['2027-01-10', '2027-04-10', '2027-07-10', '2027-10-10']);

  const [c1, c2] = list;
  assert.equal((await call('PATCH', `/api/cheques/${c1.id}`, { status: 'POSTPONED', postponedTo: '2027-01-01' })).status, 422, 'new date must be later');
  const pp = await call('PATCH', `/api/cheques/${c1.id}`, { status: 'POSTPONED', postponedTo: '2027-02-10' });
  assert.equal(pp.status, 200);
  assert.equal(pp.body.postponedTo.slice(0, 10), '2027-02-10');

  await call('PATCH', `/api/cheques/${c2.id}`, { status: 'CLEARED' });
  await call('PATCH', `/api/cheques/${c2.id}`, { notes: 'edited after clearing' });
  const posted = (await call('GET', '/api/transactions?method=CHEQUE')).body.filter(t => t.chequeId === c2.id);
  assert.equal(posted.length, 1, 'cleared cheque is in the ledger exactly once');
  assert.equal(posted[0].type, 'INCOME');
  assert.equal((await call('PATCH', `/api/cheques/${c2.id}`, { status: 'PENDING' })).status, 422);
});

test('reports: P&L, per-unit and owner statement agree', async () => {
  const month = new Date().toISOString().slice(0, 7);
  const pnl = (await call('GET', `/api/reports/pnl?month=${month}`)).body;
  const units = (await call('GET', `/api/reports/units?month=${month}`)).body;
  const unitIncome = units.rows.reduce((s, r) => s + r.income, 0) + units.overheads.income;
  const unitExp = units.rows.reduce((s, r) => s + r.expenses, 0) + units.overheads.expenses;
  assert.ok(Math.abs(unitIncome - pnl.totalIncome) < 0.01, 'unit report income adds up to P&L');
  assert.ok(Math.abs(unitExp - pnl.totalExpenses) < 0.01, 'unit report expenses add up to P&L');
  assert.ok(Math.abs(units.totals.companyNet - pnl.net) < 0.01);

  const landlords = (await call('GET', '/api/landlords')).body;
  const owner = landlords.find(l => l.name === 'Layla Haddad');
  const st = (await call('GET', `/api/reports/owner-statement?landlordId=${owner.id}&month=${month}`)).body;
  for (const u of st.units.filter(u => u.arrangement === 'MANAGEMENT')) {
    assert.ok(Math.abs(u.fee - (u.income * u.feePct) / 100) < 0.01);
    assert.ok(Math.abs(u.ownerShare - (u.income - u.expenses - u.fee)) < 0.01);
  }
});

test('import: availability sheet rows create buildings, units and spaces without duplicates', async () => {
  const rows = [
    { DATE: '1st of DEC', PRICE: '1750-1900', BUILDING: 'SHEIKHA NOURA', AMINITEIS: 'BIG SPACE WITH WINDOW - PRIVATE FRIDGE', TYPE: 'MIX', 'FLAT NO.': '1904', 'PARTITION NUMBER': 'P9' },
    { DATE: 'READY TO MOVE', PRICE: '2000-2100', BUILDING: 'ALFAHD 2', AMINITEIS: 'ONLY 6 LADIES', TYPE: 'LADIES ONLY', 'FLAT NO.': 'F2202', 'PARTITION NUMBER': 'P4' },
    { 'Partation / Room No.': 'Bed 2', 'Apartment No. ': '811', 'Building Name': 'Elfahd 2', Status: 'not ready ', Price: '2100', 'Security Deposit': '300' },
    { BUILDING: '', PRICE: '1000' },
  ];
  const dry = (await call('POST', '/api/import', { kind: 'spaces', rows, dryRun: true })).body;
  assert.equal(dry.created + dry.updated, 3);
  assert.equal(dry.skipped.length, 1);
  const before = (await call('GET', '/api/buildings')).body.length;
  const real = (await call('POST', '/api/import', { kind: 'spaces', rows })).body;
  assert.equal(real.created + real.updated, 3);
  const bs = (await call('GET', '/api/buildings')).body;
  assert.equal(bs.length, before, '"SHEIKHA NOURA" and "Elfahd 2" match existing buildings');
  const again = (await call('POST', '/api/import', { kind: 'spaces', rows })).body;
  assert.equal(again.created, 0, 'running the same import twice only updates');
  const units = (await call('GET', '/api/units?mode=PARTITIONS')).body;
  const f2202 = units.find(u => u.number === '2202');
  assert.equal(f2202.building.name, 'Al Fahd 2');
  assert.equal(f2202.occupancy, 'LADIES');
  assert.equal(f2202.spaces[0].monthlyRate, 2000);
  const bed = units.find(u => u.number === '811').spaces.find(s => s.code === 'Bed 2');
  assert.equal(bed.kind, 'BED');
  assert.equal(bed.status, 'NOT_READY');
});

test('import: transaction log and cheques with colour statuses', async () => {
  const tx = (await call('POST', '/api/import', {
    kind: 'transactions',
    rows: [
      { Date: '01-Jun-2026', Type: 'INCOME', Category: 'RENT', Description: 'Rent collection', Apartment: '2803', Partition: 'Pt2', 'Amount (AED)': '1,300.00' },
      { Date: '03-Jun-2026', Type: 'EXPENSE', Category: 'DEWA', Description: 'DEWA - Apt 2803', Apartment: '2803', 'Amount (AED)': '1,900.00' },
      { Date: '07-Jun-2026', Type: 'EXPENSE', Category: 'MAINTENANCE', Description: 'AC', 'Amount (AED)': '500.00', Notes: 'part payment - estimated' },
    ],
  })).body;
  assert.equal(tx.created, 3);
  const june = (await call('GET', '/api/transactions?month=2026-06')).body;
  assert.equal(june.find(t => t.category === 'DEWA').unit.number, '2803');
  assert.equal(june.find(t => t.category === 'RENT').space.code, 'P2');
  assert.equal(june.find(t => t.category === 'MAINTENANCE').estimated, true);

  const ch = (await call('POST', '/api/import', {
    kind: 'cheques', direction: 'OUT',
    rows: [
      { 'Cheque No': '900001', Date: '15/01/2027', Amount: '30,000', Bank: 'Wio', Apartment: '706', Status: 'Paid', Name: 'Landlord' },
      { 'Cheque No': '900002', Date: '15/04/2027', Amount: '30,000', Bank: 'Wio', Apartment: '706', Status: 'Postponed', 'New Date': '15/05/2027' },
      { 'Cheque No': '900003', Date: '15/07/2027', Amount: '30,000', Bank: 'Wio', Apartment: '706', Status: '' },
    ],
  })).body;
  assert.equal(ch.created, 3);
  assert.deepEqual(ch.preview.map(p => p.status), ['CLEARED', 'POSTPONED', 'PENDING']);
  const again = (await call('POST', '/api/import', { kind: 'cheques', direction: 'OUT', rows: [{ 'Cheque No': '900001', Date: '15/01/2027', Amount: '30,000' }] })).body;
  assert.equal(again.created, 0);
  const pp = (await call('GET', '/api/cheques?status=POSTPONED')).body.find(c => c.number === '900002');
  assert.equal(pp.postponedTo.slice(0, 10), '2027-05-15');
});

test('other org data is invisible', async () => {
  const org = await prisma.org.create({ data: { name: 'Other Co', slug: `other-${Date.now()}` } });
  const b = await prisma.building.create({ data: { orgId: org.id, name: 'Secret Tower' } });
  assert.equal((await call('GET', `/api/buildings/${b.id}`)).status, 404);
  assert.equal((await call('PATCH', `/api/buildings/${b.id}`, { name: 'Hacked' })).status, 404);
  assert.equal((await call('POST', '/api/units', { buildingId: b.id, number: '1' })).status, 422);
  await prisma.building.delete({ where: { id: b.id } });
  await prisma.org.delete({ where: { id: org.id } });
});

test('apartment filter narrows lists, dashboard and reports to one flat or building', async () => {
  const units = (await call('GET', '/api/units')).body;
  const flat = units.find(u => u.mode === 'PARTITIONS' && u.spaces.length);
  const other = units.filter(u => u.buildingId !== flat.buildingId);

  const board = (await call('GET', `/api/spaces/board?unitId=${flat.id}`)).body;
  assert.equal(board.buildings.length, 1);
  assert.deepEqual(board.buildings[0].units.map(u => u.id), [flat.id]);

  const scopedUnits = (await call('GET', `/api/units?buildingId=${flat.buildingId}`)).body;
  assert.ok(scopedUnits.length && scopedUnits.every(u => u.buildingId === flat.buildingId));
  if (other.length) assert.ok(!scopedUnits.some(u => u.id === other[0].id));

  const rent = (await call('GET', `/api/reports/rent-collection?unitId=${flat.id}`)).body;
  assert.ok(rent.rows.every(r => r.unitId === flat.id));
  const tx = (await call('GET', `/api/transactions?buildingId=${flat.buildingId}`)).body;
  assert.ok(tx.every(t => t.unit?.buildingId === flat.buildingId));
  const tenants = (await call('GET', `/api/tenants?unitId=${flat.id}`)).body;
  assert.ok(tenants.every(t => t.leases.some(l => l.unitId === flat.id)));
  for (const p of ['/api/cheques', '/api/bookings', '/api/maintenance', '/api/leases']) {
    const rows = (await call('GET', `${p}?unitId=${flat.id}`)).body;
    assert.ok(rows.every(r => r.unitId === flat.id), p);
  }

  const all = (await call('GET', '/api/dashboard')).body;
  const one = (await call('GET', `/api/dashboard?unitId=${flat.id}`)).body;
  assert.equal(one.partitions.total, flat.spaces.length);
  assert.ok(one.partitions.total <= all.partitions.total);
  assert.ok(one.rent.due <= all.rent.due);

  const per = (await call('GET', `/api/reports/units?unitId=${flat.id}`)).body;
  assert.deepEqual(per.rows.map(r => r.unitId), [flat.id]);
  assert.equal(per.overheads.expenses, 0, 'company overheads are left out when one flat is chosen');
});

test('rent collection over a date range lists each month due in it', async () => {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const iso = d => d.toISOString().slice(0, 10);
  const from = iso(new Date(Date.UTC(y, m - 1, 1))), to = iso(new Date(Date.UTC(y, m + 1, 0)));
  const r = (await call('GET', `/api/reports/rent-collection?from=${from}&to=${to}`)).body;
  const months = new Set(r.rows.map(x => x.month));
  const thisMonth = (await call('GET', '/api/reports/rent-collection')).body;
  assert.ok(months.size >= 1 && months.size <= 2);
  assert.ok(r.rows.every(x => iso(new Date(x.dueDate)) >= from && iso(new Date(x.dueDate)) <= to));
  assert.ok(r.rows.length >= thisMonth.rows.filter(x => iso(new Date(x.dueDate)) <= to).length);
  assert.equal((await call('GET', `/api/reports/rent-collection?from=${to}&to=${from}`)).status, 422);
});
