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

test('date periods: quarter and year work across dashboard, ledger and reports', async () => {
  const y = new Date().getUTCFullYear();
  const year = `from=${y}-01-01&to=${y}-12-31`;
  const d = (await call('GET', `/api/dashboard?${year}`)).body;
  assert.equal(d.trend.length, 12, 'a year shows its 12 months');
  assert.equal(d.days, 365 + (y % 4 === 0 ? 1 : 0));
  assert.ok('previous' in d && d.previous.from.startsWith(`${y - 1}-01-01`));
  const pnlYear = (await call('GET', `/api/reports/pnl?${year}`)).body;
  const sum = (await call('GET', `/api/transactions/summary?${year}`)).body;
  assert.equal(Math.round(pnlYear.totalIncome), Math.round(sum.income), 'P&L and ledger agree for the same period');
  // a day range includes its last day
  const tx = (await call('GET', '/api/transactions')).body[0];
  const day = tx.date.slice(0, 10);
  const one = (await call('GET', `/api/transactions?from=${day}&to=${day}`)).body;
  assert.ok(one.some(t => t.id === tx.id));
  assert.equal((await call('GET', `/api/reports/pnl?from=${y}-05-01&to=${y}-04-01`)).status, 422);
});

test('leasing: a deal moves through the pipeline and its money adds up', async () => {
  const d = (await call('POST', '/api/leasing', {
    clientName: 'Test Client', clientPhone: '+971500000000', contractType: 'YEARLY', property: 'Marina Gate', unitNo: '1204',
    rent: 120000, cheques: 4, fee: 6000, agent: 'Ahmed Fawzy', agentCommission: 1500, brokerName: 'Outside Co', brokerCommission: 1000,
  })).body;
  assert.ok(d.number >= 1 && d.status === 'LEAD');
  const second = (await call('POST', '/api/leasing', { clientName: 'Second', contractType: 'SHORT_TERM', months: 3, rent: 5000, fee: 1000 })).body;
  assert.equal(second.number, d.number + 1, 'deal numbers count up');
  assert.equal((await call('POST', '/api/leasing', { contractType: 'YEARLY' })).status, 422, 'client name is required');

  let u = (await call('PATCH', `/api/leasing/${d.id}`, { status: 'SIGNED' })).body;
  assert.ok(u.signedAt && u.closedAt);
  for (const [kind, amount] of [['fee', 4000], ['client_in', 30000], ['client_out', 30000], ['commission', 1500]]) {
    assert.equal((await call('POST', `/api/leasing/${d.id}/payments`, { kind, amount, date: new Date().toISOString().slice(0, 10) })).status, 201, kind);
  }
  u = (await call('GET', `/api/leasing/${d.id}`)).body;
  assert.equal(u.money.feeCollected, 4000);
  assert.equal(u.money.feeOutstanding, 2000);
  assert.equal(u.money.heldForLandlord, 0);
  assert.equal(u.money.commissionOwed, 1000);
  assert.equal(u.money.net, 2500);
  assert.equal(u.transactions.length, 4);

  const s = (await call('GET', '/api/leasing/summary')).body;
  assert.ok(s.signed >= 1 && s.fees >= 6000 && s.feesCollected >= 4000);
  assert.ok(s.byAgent.some(a => a.agent === 'Ahmed Fawzy'));
  assert.ok(s.open.LEAD >= 1);
  const list = (await call('GET', '/api/leasing?status=LEAD,VIEWING,RESERVED')).body;
  assert.ok(list.some(x => x.id === second.id) && !list.some(x => x.id === d.id));
  assert.ok((await call('GET', '/api/leasing?q=Marina')).body.some(x => x.id === d.id));
  // the fee shows in the ledger and P&L as leasing commission
  const ledger = (await call('GET', `/api/transactions?dealId=${d.id}`)).body;
  assert.equal(ledger.length, 4);
  assert.equal((await call('DELETE', `/api/leasing/${d.id}`)).status, 409, 'deals with payments are cancelled, not deleted');
  assert.equal((await call('PATCH', `/api/leasing/${second.id}`, { status: 'CANCELLED', lostReason: 'Chose another flat' })).body.status, 'CANCELLED');
  assert.equal((await call('DELETE', `/api/leasing/${second.id}`)).status, 204);
});

test('permissions: super admin decides what each team member can see and change', async () => {
  const email = `agent${Date.now()}@sakanly.com`;
  const created = await call('POST', '/api/auth/users', {
    name: 'Leasing Agent', email, password: 'agentpass1', role: 'MANAGER',
    permissions: { dashboard: 'none', ledger: 'none', reports: 'none', cheques: 'view', leasing: 'edit', bogus: 'edit', rent: 'nonsense' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.access.ledger, 'none');
  assert.equal(created.body.access.cheques, 'view');
  assert.equal(created.body.access.rent, 'edit', 'unknown values fall back to the role default');
  assert.ok(!('bogus' in created.body.access));
  const tk = (await call('POST', '/api/auth/login', { email, password: 'agentpass1' })).body.token;
  const me = (await call('GET', '/api/auth/me', null, tk)).body;
  assert.equal(me.access.leasing, 'edit');

  assert.equal((await call('GET', '/api/dashboard', null, tk)).status, 403);
  assert.equal((await call('GET', '/api/transactions', null, tk)).status, 403);
  assert.equal((await call('GET', '/api/reports/pnl', null, tk)).status, 403);
  assert.equal((await call('GET', '/api/cheques', null, tk)).status, 200);
  assert.equal((await call('POST', '/api/cheques', { direction: 'OUT', amount: 10, dueDate: '2027-01-01', number: 'X1' }, tk)).status, 403, 'view only');
  assert.equal((await call('GET', '/api/units', null, tk)).status, 200, 'lists used by forms stay readable');
  const deal = await call('POST', '/api/leasing', { clientName: 'Agent Client' }, tk);
  assert.equal(deal.status, 201);
  // rent page can record rent without full ledger access
  const lease = (await call('GET', '/api/leases?active=1')).body[0];
  assert.equal((await call('POST', '/api/transactions', { date: '2026-11-01', type: 'INCOME', category: 'RENT', description: 'Rent', amount: 10, leaseId: lease.id }, tk)).status, 201);
  assert.equal((await call('POST', '/api/transactions', { date: '2026-11-01', type: 'EXPENSE', category: 'ADMIN', description: 'x', amount: 10 }, tk)).status, 403);

  // the admin changes access and it applies straight away
  await call('PATCH', `/api/auth/users/${created.body.id}`, { permissions: { ...created.body.access, ledger: 'view' } });
  assert.equal((await call('GET', '/api/transactions', null, tk)).status, 200);
  // only super admins manage the team
  assert.equal((await call('POST', '/api/auth/users', { name: 'x', email: 'x2@x.com', password: 'longenough' }, tk)).status, 403);
  // back to role defaults
  const reset = (await call('PATCH', `/api/auth/users/${created.body.id}`, { permissions: null })).body;
  assert.equal(reset.access.dashboard, 'edit');
  await call('DELETE', `/api/auth/users/${created.body.id}`);
});

test('tenant file: extra contact details, ID and passport uploads', async () => {
  const lease = (await call('GET', '/api/leases?active=1')).body.find(l => l.spaceId);
  const p = await call('PATCH', `/api/tenants/${lease.tenantId}`, { secondPhone: '+971 55 111 2222', emergencyName: 'Sara', emergencyPhone: '+971 50 999 8888', emergencyRelation: 'Sister', email: 'tenant@example.com' });
  assert.equal(p.status, 200);
  assert.equal(p.body.emergencyRelation, 'Sister');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const up = await call('POST', '/api/tenant-documents', { tenantId: lease.tenantId, kind: 'PASSPORT', fileName: 'passport.png', data: png, number: 'A1234567', expiresAt: '2030-01-01' });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.equal(up.body.mime, 'image/png');
  assert.ok(!('data' in up.body));
  assert.equal((await call('POST', '/api/tenant-documents', { tenantId: lease.tenantId, kind: 'PASSPORT', data: Buffer.from('hello').toString('base64') })).status, 422, 'only photos and PDFs');
  const list = (await call('GET', `/api/tenant-documents?tenantId=${lease.tenantId}`)).body;
  assert.equal(list.length, 1);
  const file = await fetch(`${base}/api/tenant-documents/${up.body.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(file.headers.get('content-type'), 'image/png');
  assert.equal((await call('DELETE', `/api/tenant-documents/${up.body.id}`)).status, 204);
});

test('contracts: draw up, sign in the office and online, download, lock after signing', async () => {
  const lease = (await call('GET', '/api/leases?active=1')).body.find(l => l.spaceId);
  const c = await call('POST', '/api/contracts', { leaseId: lease.id, noticeDays: 30, specialTerms: 'Parking not included.' });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.match(c.body.number, /^SL-\d{4}-\d{4}$/);
  assert.equal(c.body.status, 'DRAFT');
  assert.equal(c.body.terms.premises.space, lease.space.code);
  const c2 = await call('POST', '/api/contracts', { leaseId: lease.id });
  assert.notEqual(c2.body.number, c.body.number);
  assert.equal((await call('DELETE', `/api/contracts/${c2.body.id}`)).status, 204);

  // terms can change before signing
  const e = await call('PATCH', `/api/contracts/${c.body.id}`, { rent: 1999, noticeDays: 15 });
  assert.equal(e.body.terms.rent, 1999);

  const pdf = await fetch(`${base}/api/contracts/${c.body.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');

  const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  assert.equal((await call('POST', `/api/contracts/${c.body.id}/sign-company`, { signature: 'nope' })).status, 422);
  const s1 = await call('POST', `/api/contracts/${c.body.id}/sign-company`, { signature: sig });
  assert.equal(s1.body.companySigned, true);
  assert.equal(s1.body.status, 'DRAFT');
  assert.equal((await call('PATCH', `/api/contracts/${c.body.id}`, { rent: 1 })).status, 409, 'locked once signed');

  // tenant signs through the public link, no login
  const tok = s1.body.signToken;
  const view = await call('GET', `/api/public/sign/${tok}`, null, null);
  assert.equal(view.status, 200);
  assert.equal(view.body.companySigned, true);
  assert.ok(!('companySignature' in view.body));
  assert.equal((await call('GET', '/api/public/sign/not-a-real-token-at-all', null, null)).status, 404);
  assert.equal((await call('POST', `/api/public/sign/${tok}`, { name: 'Tenant', signature: sig }, null)).status, 422, 'must agree');
  const signed = await call('POST', `/api/public/sign/${tok}`, { name: 'Test Tenant', signature: sig, agree: true }, null);
  assert.equal(signed.body.status, 'SIGNED');
  assert.equal((await call('POST', `/api/public/sign/${tok}`, { name: 'Again', signature: sig, agree: true }, null)).status, 409);
  const after = (await call('GET', `/api/contracts?tenantId=${lease.tenantId}`)).body.find(x => x.id === c.body.id);
  assert.equal(after.tenantSigned, true);
  assert.equal((await call('DELETE', `/api/contracts/${c.body.id}`)).status, 409);

  // a paper copy can be uploaded and downloaded as-is
  const c3 = (await call('POST', '/api/contracts', { leaseId: lease.id })).body;
  assert.equal((await call('POST', `/api/contracts/${c3.id}/upload`, { data: Buffer.from('not a pdf').toString('base64') })).status, 422);
  const scan = Buffer.from('%PDF-1.4\n% scanned\n%%EOF');
  const u = await call('POST', `/api/contracts/${c3.id}/upload`, { fileName: 'signed.pdf', data: scan.toString('base64') });
  assert.equal(u.body.status, 'SIGNED');
  const orig = await fetch(`${base}/api/contracts/${c3.id}/pdf?original=1`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(Buffer.from(await orig.arrayBuffer()).toString(), scan.toString());
  assert.equal((await call('POST', `/api/contracts/${c3.id}/void`)).body.status, 'VOID');
  // read-only users can see but not sign
  assert.equal((await call('GET', `/api/contracts?tenantId=${lease.tenantId}`, null, viewerToken)).status, 401, 'removed earlier');
});

test('leasing import: past deals link to ledger lines without duplicating them', async () => {
  const tx = (await call('POST', '/api/transactions', { date: '2026-10-07', type: 'INCOME', category: 'LEASING_COMMISSION', description: 'OCTOBER DEALS', amount: 1500 })).body;
  const before = (await call('GET', '/api/transactions?from=2026-10-01&to=2026-10-31')).body.length;
  const payload = { deals: [{ number: 1005, clientName: 'October deal 5', status: 'SIGNED', contractType: 'SHORT_TERM', fee: 1500, signedAt: '2026-10-07', closedAt: '2026-10-07',
    payments: [{ date: '2026-10-07', amount: 1500, type: 'INCOME', description: 'OCTOBER DEALS' }, { date: '2026-10-09', amount: 77, type: 'INCOME', description: 'missing' }] }] };
  const r = await call('POST', '/api/leasing/import', payload);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, 1);
  assert.equal(r.body.linked, 1);
  assert.equal(r.body.unmatched.length, 1);
  const again = (await call('POST', '/api/leasing/import', payload)).body;
  assert.equal(again.updated, 1);
  assert.equal(again.alreadyLinked, 1);
  assert.equal((await call('GET', '/api/transactions?from=2026-10-01&to=2026-10-31')).body.length, before, 'nothing duplicated');
  const deal = (await call('GET', '/api/leasing?q=1005')).body.find(d => d.number === 1005);
  assert.ok(deal);
  const full = (await call('GET', `/api/leasing/${deal.id}`)).body;
  assert.equal(full.transactions[0].id, tx.id);
  const sum = (await call('GET', '/api/leasing/summary?from=2026-10-01&to=2026-10-31')).body;
  assert.ok(sum.signed >= 1);
});

test('invoices: VAT, numbering, payments into the ledger, bills from suppliers', async () => {
  assert.equal((await call('PATCH', '/api/invoices/settings', { trn: '123' })).status, 422);
  assert.equal((await call('PATCH', '/api/invoices/settings', { trn: '100123456700003' })).body.trn, '100123456700003');
  const inv = await call('POST', '/api/invoices', {
    kind: 'SALES', partyType: 'COMPANY', partyName: 'Yalla Suite Hotel', partyTrn: '100999888700003', issueDate: '2026-11-20', dueDate: '2026-11-25',
    vatRate: 5, category: 'LEASING_COMMISSION', lines: [{ description: 'Agency fee — Deal 18', qty: 1, unitPrice: 1500 }, { description: 'Admin fee (no VAT)', qty: 2, unitPrice: 50, vat: false }],
  });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  assert.match(inv.body.number, /^INV-2026-\d{4}$/);
  assert.equal(inv.body.subtotal, 1600);
  assert.equal(inv.body.vat, 75);
  assert.equal(inv.body.total, 1675);
  assert.equal(inv.body.state, 'OVERDUE');
  assert.equal((await call('POST', '/api/invoices', { partyName: 'X', lines: [] })).status, 422);
  assert.equal((await call('POST', '/api/invoices', { partyName: 'X', vatRate: 7, lines: [{ description: 'a', unitPrice: 1 }] })).status, 422);

  const pdf = await fetch(`${base}/api/invoices/${inv.body.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

  assert.equal((await call('POST', `/api/invoices/${inv.body.id}/payments`, { amount: 5000 })).status, 422, 'not more than due');
  const p1 = await call('POST', `/api/invoices/${inv.body.id}/payments`, { amount: 1000, date: '2026-11-21', method: 'BANK' });
  assert.equal(p1.body.state, 'OVERDUE');
  assert.equal(p1.body.balance, 675);
  const p2 = await call('POST', `/api/invoices/${inv.body.id}/payments`, { amount: 675, date: '2026-11-22' });
  assert.equal(p2.body.state, 'PAID');
  const ledger = (await call('GET', '/api/transactions?from=2026-11-21&to=2026-11-22')).body.filter(t => t.invoiceId === inv.body.id);
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].category, 'LEASING_COMMISSION');
  assert.equal((await call('PATCH', `/api/invoices/${inv.body.id}`, { lines: [{ description: 'x', unitPrice: 1 }] })).status, 409);
  assert.equal((await call('POST', `/api/invoices/${inv.body.id}/void`)).status, 409);

  const bill = await call('POST', '/api/invoices', { kind: 'PURCHASE', partyType: 'SUPPLIER', partyName: 'Cool AC Services', supplierRef: 'AC-778', issueDate: '2026-11-10', category: 'MAINTENANCE', lines: [{ description: 'AC service', qty: 3, unitPrice: 100 }] });
  assert.match(bill.body.number, /^BILL-2026-/);
  assert.equal(bill.body.total, 315);
  const scan = Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
  assert.equal((await call('POST', `/api/invoices/${bill.body.id}/scan`, { fileName: 'ac.pdf', data: scan })).status, 200);
  const bp = await call('POST', `/api/invoices/${bill.body.id}/payments`, { amount: 315, date: '2026-11-12', method: 'CASH' });
  assert.equal(bp.body.state, 'PAID');
  const t = (await call('GET', '/api/transactions?from=2026-11-12&to=2026-11-12')).body.find(x => x.invoiceId === bill.body.id);
  assert.equal(t.type, 'EXPENSE');

  const s = (await call('GET', '/api/invoices/summary?kind=SALES&from=2026-11-01&to=2026-11-30')).body;
  assert.ok(s.total >= 1675 && s.vat >= 75);
  const d = await call('POST', '/api/invoices', { partyName: 'Draft Co', status: 'DRAFT', lines: [{ description: 'x', unitPrice: 10 }] });
  assert.equal(d.body.state, 'DRAFT');
  assert.equal((await call('DELETE', `/api/invoices/${d.body.id}`)).status, 204);
});

test('website: public rooms and homes without tenant data, enquiries become leads', async () => {
  const rooms = await call('GET', '/api/public/site/rooms', null, null);
  assert.equal(rooms.status, 200);
  assert.ok(rooms.body.length > 0);
  const r = rooms.body[0];
  assert.ok(r.price > 0 && r.building && r.buildingSlug);
  assert.ok(!('tenant' in r) && !('leases' in r));
  const homes = await call('GET', '/api/public/site/homes', null, null);
  assert.equal(homes.status, 200);
  assert.equal((await call('POST', '/api/public/site/leads', { type: 'shared', name: 'A' }, null)).status, 422);
  const ok = await call('POST', '/api/public/site/leads', { type: 'shared', name: 'Mona Website', phone: '+971 50 123 4567', details: { building: 'Al Fahd 2', room: 'P3', moveIn: '2026-12-01' }, page: '/shared-living', lang: 'ar' }, null);
  assert.equal(ok.status, 201);
  const lead = (await call('GET', '/api/leasing?q=Mona')).body.find(d => d.clientName === 'Mona Website');
  assert.equal(lead.status, 'LEAD');
  assert.equal(lead.source, 'Website');
  assert.match(lead.notes, /Shared living/);
  assert.equal((await call('POST', '/api/public/site/leads', { name: 'Bot', phone: '000000000', website: 'spam' }, null)).status, 200, 'honeypot is ignored quietly');
});

test('photos: upload to an apartment or a room, cover, public file, shown on the website', async () => {
  const board = (await call('GET', '/api/spaces/board')).body;
  const unit = board.buildings[0].units[0];
  const free = unit.spaces.find(s => s.status === 'AVAILABLE') || unit.spaces[0];
  // a tiny real JPEG
  const jpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  assert.equal((await call('POST', '/api/photos', { unitId: unit.id, data: Buffer.from('nope').toString('base64') })).status, 422);
  const a = await call('POST', '/api/photos', { unitId: unit.id, data: jpeg, thumb: jpeg, width: 1, height: 1 });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.cover, true, 'first photo becomes the cover');
  const b = await call('POST', '/api/photos', { unitId: unit.id, spaceId: free.id, data: jpeg, thumb: jpeg });
  assert.equal(b.body.cover, false);
  assert.equal((await call('PATCH', `/api/photos/${b.body.id}`, { cover: true })).body.cover, true);
  const list = (await call('GET', `/api/photos?unitId=${unit.id}`)).body;
  assert.equal(list.filter(p => p.cover).length, 1);
  const file = await fetch(`${base}/api/public/photo/${a.body.id}?size=thumb`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/jpeg');
  assert.equal((await fetch(`${base}/api/public/photo/not-a-uuid`)).status, 404);
  const onBoard = (await call('GET', '/api/spaces/board')).body.buildings[0].units[0];
  assert.equal(onBoard.photos.length, 2);
  if (free.status === 'AVAILABLE') {
    const room = (await call('GET', '/api/public/site/rooms', null, null)).body.find(r => r.id === free.id);
    assert.equal(room.photos[0], b.body.id, "the room's own photo comes first");
  }
  assert.equal((await call('DELETE', `/api/photos/${b.body.id}`)).status, 204);
  assert.equal((await call('GET', `/api/photos?unitId=${unit.id}`)).body.find(p => p.id === a.body.id).cover, true, 'cover moves on when the cover is deleted');
  assert.equal((await call('POST', '/api/photos', { unitId: unit.id, data: jpeg }, viewerToken)).status, 401);
});

test('marketing: videos (file and link), streaming in pieces, library and access', async () => {
  const lib = (await call('GET', '/api/marketing/library')).body;
  assert.ok(lib.units.length && lib.totals.rooms > 0);
  const unit = lib.units.find(u => u.spaces.length);
  const room = unit.spaces[0];
  // a tiny MP4 header is enough for the type check
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(200, 7)]);
  const v = await call('POST', '/api/photos', { unitId: unit.id, spaceId: room.id, kind: 'VIDEO', duration: 12.4 });
  assert.equal(v.status, 201, JSON.stringify(v.body));
  assert.equal(v.body.kind, 'VIDEO');
  assert.equal(v.body.cover, false, 'a video never becomes the cover');
  assert.equal((await fetch(`${base}/api/public/photo/${v.body.id}`)).status, 404, 'still uploading');
  const bad = await fetch(`${base}/api/photos/${v.body.id}/file`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4' }, body: Buffer.from('not a video') });
  assert.equal(bad.status, 422);
  const put = await fetch(`${base}/api/photos/${v.body.id}/file`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4' }, body: mp4 });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).size, mp4.length);
  const part = await fetch(`${base}/api/public/photo/${v.body.id}`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 0-9/${mp4.length}`);
  assert.equal((await part.arrayBuffer()).byteLength, 10);
  const dl = await fetch(`${base}/api/public/photo/${v.body.id}?download=Flat%201`);
  assert.match(dl.headers.get('content-disposition'), /Flat 1\.mp4/);
  assert.equal((await call('PATCH', `/api/photos/${v.body.id}`, { cover: true })).status, 422);
  assert.equal((await call('POST', '/api/photos', { unitId: unit.id, kind: 'VIDEO', url: 'javascript:alert(1)' })).status, 422);
  const link = await call('POST', '/api/photos', { unitId: unit.id, kind: 'VIDEO', url: 'https://youtu.be/abc123' });
  assert.equal(link.status, 201);
  const r = await fetch(`${base}/api/public/photo/${link.body.id}`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://youtu.be/abc123');
  const after = (await call('GET', '/api/marketing/library')).body;
  assert.equal(after.totals.videos, lib.totals.videos + 2);
  // videos stay off the website
  const site = (await call('GET', '/api/public/site/rooms', null, null)).body;
  for (const s of site) assert.ok(!s.photos.includes(v.body.id));
  // access: a marketing-only user can manage media; someone set up before the section existed can't see it
  const perm = require('../src/lib/permissions');
  const mkt = { role: 'MANAGER', permissions: { marketing: 'edit', partitions: 'none', apartments: 'none' } };
  assert.equal(perm.effective(mkt).marketing, 'edit');
  assert.deepEqual(perm.required('POST', '/photos', {}, {}).any.includes('marketing'), true);
  assert.equal(perm.required('GET', '/marketing/library').any[0], 'marketing');
  assert.equal(perm.effective({ role: 'MANAGER', permissions: { leasing: 'edit' } }).marketing, 'none');
});

test('leasing availability: free windows for a move-in date and 1–12 month stays', async () => {
  const one = await call('GET', '/api/leasing/availability?months=1');
  assert.equal(one.status, 200);
  assert.ok(one.body.items.length > 0);
  const year = (await call('GET', '/api/leasing/availability?months=12')).body;
  assert.equal(year.months, 12);
  assert.equal((await call('GET', '/api/leasing/availability?months=99')).body.months, 12, 'capped at a year');
  // anything free for a year is also free for a month from the same day
  const freeMonth = new Set(one.body.items.filter(i => i.freeForPeriod).map(i => i.id));
  for (const i of year.items.filter(i => i.freeForPeriod)) assert.ok(freeMonth.has(i.id), i.id);
  // an occupied room with an open-ended tenancy is never free
  const busy = one.body.items.find(i => i.busy.some(b => b.kind === 'lease' && !b.end));
  if (busy) { assert.equal(busy.freeForPeriod, false); assert.equal(busy.freeFrom, null); }
  // a room that frees up later shows that date, and is free for a stay that starts then
  const later = one.body.items.find(i => !i.freeForPeriod && i.freeFrom);
  if (later) {
    const from = later.freeFrom.slice(0, 10);
    const r = (await call('GET', `/api/leasing/availability?months=1&from=${from}`)).body.items.find(i => i.id === later.id);
    assert.ok(r.freeForPeriod || r.freeUntil, 'free from its free date');
  }
});

test('tenancy rent change applies from a chosen month; earlier months keep the old rent', async () => {
  const leases = (await call('GET', '/api/leases')).body.filter(l => l.status === 'ACTIVE' && l.rentPeriod === 'MONTHLY' && l.spaceId);
  const l = leases.find(x => new Date(x.startDate) < new Date(Date.now() - 62 * 86400000)) || leases[0];
  const now = new Date();
  const key = m => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const old = l.rent;
  assert.equal((await call('PATCH', `/api/leases/${l.id}`, { rent: -5 })).status, 422);
  assert.equal((await call('PATCH', `/api/leases/${l.id}`, { rent: old + 100, rentFrom: 'soon' })).status, 422);
  const r = await call('PATCH', `/api/leases/${l.id}`, { rent: old + 100, rentFrom: key(0), dueDay: 3 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.rent, old + 100);
  assert.equal(r.body.dueDay, 3);
  const row = async m => (await call('GET', `/api/reports/rent-collection?month=${key(m)}`)).body.rows?.find(x => x.leaseId === l.id)
    || (await call('GET', `/api/reports/rent-collection?month=${key(m)}`)).body.find?.(x => x.leaseId === l.id);
  const thisMonth = await row(0), lastMonth = await row(-1);
  assert.equal(thisMonth.due, old + 100, 'new rent from the chosen month');
  if (lastMonth) assert.equal(lastMonth.due, old, 'the month before keeps the old rent');
  // a second change next month stacks on top
  await call('PATCH', `/api/leases/${l.id}`, { rent: old + 250, rentFrom: key(1) });
  assert.equal((await row(1)).due, old + 250);
  assert.equal((await row(0)).due, old + 100);
  if (lastMonth) assert.equal((await row(-1)).due, old);
});
