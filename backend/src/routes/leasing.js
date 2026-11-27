// backend/src/routes/leasing.js — the leasing department: brokerage deals for short-term
// (1–11 month) and yearly contracts, tracked from first enquiry to signed contract.
const express = require('express');
const prisma = require('../db');
const { pick, findOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');
const { periodFrom } = require('../lib/dates');

const router = express.Router();
const STATUSES = ['LEAD', 'VIEWING', 'RESERVED', 'SIGNED', 'CANCELLED'];
const OPEN = ['LEAD', 'VIEWING', 'RESERVED'];
const round = n => Math.round((n || 0) * 100) / 100;

const SPEC = {
  status: 'enum', contractType: 'enum',
  clientName: { type: 'string', required: true }, clientPhone: 'string', clientEmail: 'string', clientNationality: 'string', source: 'string',
  property: 'string', unitNo: 'string', area: 'string', unitType: 'string', landlordName: 'string', landlordPhone: 'string',
  moveIn: 'date', months: 'int', rent: 'number', cheques: 'int', deposit: 'number', fee: 'number',
  agent: 'string', agentCommission: 'number', brokerName: 'string', brokerCommission: 'number',
  viewingAt: 'date', followUpAt: 'date', signedAt: 'date', lostReason: 'string', notes: 'string',
};

// Money on a deal, from its ledger lines
function money(deal) {
  const tx = deal.transactions || [];
  const s = (cat, type) => tx.filter(t => t.category === cat && (!type || t.type === type)).reduce((a, t) => a + t.amount, 0);
  const feeCollected = s('LEASING_COMMISSION');
  const clientIn = s('DEAL_FUNDS_IN'), clientOut = s('DEAL_FUNDS_OUT');
  const commissionPaid = s('COMMISSION', 'EXPENSE');
  return {
    feeCollected: round(feeCollected), feeOutstanding: round(Math.max((deal.fee || 0) - feeCollected, 0)),
    clientIn: round(clientIn), clientOut: round(clientOut), heldForLandlord: round(clientIn - clientOut),
    commissionPaid: round(commissionPaid),
    commissionOwed: round(Math.max((deal.agentCommission || 0) + (deal.brokerCommission || 0) - commissionPaid, 0)),
    net: round(feeCollected - commissionPaid),
  };
}
const withMoney = d => ({ ...d, money: money(d), endDate: endDate(d) });
const endDate = d => (d.moveIn && d.months ? new Date(Date.UTC(d.moveIn.getUTCFullYear(), d.moveIn.getUTCMonth() + d.months, d.moveIn.getUTCDate() - 1)) : null);

// keep signed/closed dates in step with the status
function stamp(data, existing) {
  const status = data.status || existing?.status || 'LEAD';
  if (data.status && data.status !== existing?.status) {
    if (status === 'SIGNED') { data.signedAt = data.signedAt || existing?.signedAt || new Date(); data.closedAt = data.signedAt; }
    else if (status === 'CANCELLED') { data.closedAt = new Date(); }
    else { data.closedAt = null; if (existing?.status === 'SIGNED') data.signedAt = null; }
  }
  if (status === 'SIGNED' && data.signedAt) data.closedAt = data.signedAt;
  for (const f of ['rent', 'fee', 'deposit', 'agentCommission', 'brokerCommission']) if (data[f] != null && data[f] < 0) throw new HttpError(422, `${f} can't be negative`);
  if (data.months != null && (data.months < 1 || data.months > 120)) throw new HttpError(422, 'Months must be between 1 and 120');
  return data;
}

function listWhere(req) {
  const q = req.query;
  const where = { orgId: req.user.orgId };
  if (q.status) where.status = { in: String(q.status).split(',').filter(s => STATUSES.includes(s)) };
  if (q.contractType) where.contractType = q.contractType;
  if (q.agent) where.agent = q.agent;
  if (q.q) {
    where.OR = ['clientName', 'clientPhone', 'property', 'unitNo', 'landlordName', 'area', 'notes'].map(f => ({ [f]: { contains: String(q.q), mode: 'insensitive' } }));
    if (/^\d+$/.test(q.q)) where.OR.push({ number: Number(q.q) });
  }
  // a period shows every open deal plus deals signed or cancelled inside it
  if (q.from || q.to) {
    const { start, end } = periodFrom(q, HttpError);
    where.AND = [{ OR: [{ status: { in: OPEN } }, { closedAt: { gte: start, lt: end } }] }];
  }
  return where;
}

router.get('/', ah(async (req, res) => {
  const rows = await prisma.leasingDeal.findMany({
    where: listWhere(req), include: { transactions: { select: { type: true, category: true, amount: true } } },
    orderBy: [{ number: 'desc' }],
  });
  res.json(rows.map(d => { const out = withMoney(d); delete out.transactions; return out; }));
}));

// Leasing figures for a period: deals signed, fees, conversion, by agent, by contract type
router.get('/summary', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const { start, end } = periodFrom(req.query, HttpError);
  const [signed, cancelled, open, created, feeTx, commTx, fundsTx] = await Promise.all([
    prisma.leasingDeal.findMany({ where: { orgId, status: 'SIGNED', closedAt: { gte: start, lt: end } } }),
    prisma.leasingDeal.count({ where: { orgId, status: 'CANCELLED', closedAt: { gte: start, lt: end } } }),
    prisma.leasingDeal.groupBy({ by: ['status'], where: { orgId, status: { in: OPEN } }, _count: true }),
    prisma.leasingDeal.count({ where: { orgId, createdAt: { gte: start, lt: end } } }),
    prisma.transaction.aggregate({ where: { orgId, category: 'LEASING_COMMISSION', date: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { orgId, category: 'COMMISSION', dealId: { not: null }, date: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ['category'], where: { orgId, category: { in: ['DEAL_FUNDS_IN', 'DEAL_FUNDS_OUT'] } }, _sum: { amount: true } }),
  ]);
  const allSigned = await prisma.leasingDeal.findMany({ where: { orgId, status: 'SIGNED' }, include: { transactions: { select: { type: true, category: true, amount: true } } } });
  const outstanding = allSigned.reduce((a, d) => a + money(d).feeOutstanding, 0);
  const byAgent = {};
  for (const d of signed) {
    const k = d.agent || '—';
    const a = byAgent[k] ||= { agent: k, deals: 0, fees: 0, commission: 0 };
    a.deals++; a.fees += d.fee || 0; a.commission += d.agentCommission || 0;
  }
  const type = t => signed.filter(d => d.contractType === t);
  const fin = Object.fromEntries(fundsTx.map(f => [f.category, f._sum.amount || 0]));
  const closed = signed.length + cancelled;
  res.json({
    from: start, signed: signed.length, cancelled, created,
    conversion: closed ? signed.length / closed : null,
    open: Object.fromEntries(OPEN.map(s => [s, open.find(o => o.status === s)?._count || 0])),
    fees: round(signed.reduce((a, d) => a + (d.fee || 0), 0)),
    feesCollected: round(feeTx._sum.amount), commissionPaid: round(commTx._sum.amount),
    feesOutstanding: round(outstanding),
    heldForLandlords: round((fin.DEAL_FUNDS_IN || 0) - (fin.DEAL_FUNDS_OUT || 0)),
    byType: {
      SHORT_TERM: { deals: type('SHORT_TERM').length, fees: round(type('SHORT_TERM').reduce((a, d) => a + (d.fee || 0), 0)) },
      YEARLY: { deals: type('YEARLY').length, fees: round(type('YEARLY').reduce((a, d) => a + (d.fee || 0), 0)) },
    },
    byAgent: Object.values(byAgent).map(a => ({ ...a, fees: round(a.fees), commission: round(a.commission) })).sort((a, b) => b.fees - a.fees),
  });
}));

// names already used, for the agent / source pickers
router.get('/options', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const [agents, sources] = await Promise.all([
    prisma.leasingDeal.findMany({ where: { orgId, agent: { not: null } }, distinct: ['agent'], select: { agent: true } }),
    prisma.leasingDeal.findMany({ where: { orgId, source: { not: null } }, distinct: ['source'], select: { source: true } }),
  ]);
  res.json({ agents: agents.map(a => a.agent).sort(), sources: sources.map(s => s.source).sort() });
}));


// ─── Availability for leasing ────────────────────────────────────────────────
// Every room, bed and whole flat with what keeps it busy over the next 12 months, and whether it is
// free for the stay the client wants (move-in date + 1 to 12 months).
const DAY = 86400000;
const startOfDay = d => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const FAR = new Date('2100-01-01T00:00:00Z');

// Merge busy spans, then find when the place is next free and until when
function freeWindow(busy, from) {
  const spans = busy.map(b => [new Date(b.start).getTime(), new Date(b.end || FAR).getTime()]).sort((a, b) => a[0] - b[0]);
  let at = from.getTime();
  for (const [s, e] of spans) if (s <= at && e > at) at = e; // walk past spans covering "at" (sorted)
  // a later span may now cover the new start
  let moved = true;
  while (moved) { moved = false; for (const [s, e] of spans) if (s <= at && e > at) { at = e; moved = true; } }
  const next = spans.filter(([s]) => s > at).map(([s]) => s).sort((a, b) => a - b)[0];
  return { freeFrom: at >= FAR.getTime() ? null : new Date(at), freeUntil: next ? new Date(next) : null };
}
const overlaps = (busy, a, b) => busy.some(x => new Date(x.start) < b && new Date(x.end || FAR) > a);

router.get('/availability', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const now = startOfDay(new Date());
  const from = req.query.from && !isNaN(new Date(req.query.from)) ? startOfDay(req.query.from) : now;
  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 1));
  const to = addMonths(from, months);
  const horizonStart = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const horizonEnd = addMonths(horizonStart, 12);

  const units = await prisma.unit.findMany({
    where: { orgId, active: true },
    include: {
      building: { select: { id: true, name: true, area: true } },
      spaces: true,
      leases: { where: { status: { in: ['ACTIVE', 'NOTICE'] } }, select: { spaceId: true, startDate: true, endDate: true, status: true, rent: true, rentPeriod: true } },
      bookings: { where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkOut: { gt: now } }, select: { spaceId: true, checkIn: true, checkOut: true } },
      photos: { select: { id: true, spaceId: true, kind: true }, orderBy: [{ cover: 'desc' }, { sort: 'asc' }] },
    },
  });

  const items = [];
  const push = (u, s, busy, extra) => {
    const clip = busy.filter(b => new Date(b.end || FAR) > horizonStart && new Date(b.start) < horizonEnd);
    const { freeFrom, freeUntil } = freeWindow(busy, from > now ? now : from);
    const win = freeWindow(busy, from);
    const pics = u.photos.filter(p => p.kind === 'PHOTO' && (!s || p.spaceId === s.id || !p.spaceId));
    items.push({
      id: s ? s.id : u.id, unitId: u.id, spaceId: s?.id || null,
      building: u.building, unit: { number: u.number, mode: u.mode, occupancy: u.occupancy, bedrooms: u.bedrooms, bathrooms: u.bathrooms },
      code: s?.code || null, amenities: s?.amenities || u.amenities || null,
      status: s?.status || null,
      freeFrom, freeUntil, // from today
      freeForPeriod: !overlaps(busy, from, to),
      freeInPeriodFrom: win.freeFrom && win.freeFrom < to ? win.freeFrom : null, // first day free on or after the move-in date, inside the stay
      busy: clip.map(b => ({ start: b.start, end: b.end, kind: b.kind })),
      photos: pics.length, cover: pics[0]?.id || null,
      ...extra,
    });
  };

  for (const u of units) {
    const leaseSpan = l => ({ start: l.startDate, end: l.endDate, kind: l.status === 'NOTICE' ? 'notice' : 'lease' });
    const bookSpan = b => ({ start: b.checkIn, end: b.checkOut, kind: 'booking' });
    if (u.mode === 'PARTITIONS') {
      for (const s of u.spaces) {
        const busy = [
          ...u.leases.filter(l => l.spaceId === s.id).map(leaseSpan),
          ...u.bookings.filter(b => b.spaceId === s.id || !b.spaceId).map(bookSpan),
        ];
        const hasLease = busy.some(b => b.kind !== 'booking');
        if (s.status === 'NOT_READY') busy.push({ start: now, end: s.availableFrom && s.availableFrom > now ? s.availableFrom : null, kind: 'preparing' });
        else if (s.status === 'RESERVED' && !hasLease) busy.push({ start: now, end: s.availableFrom && s.availableFrom > now ? s.availableFrom : addMonths(now, 1), kind: 'reserved' });
        else if (s.status === 'OCCUPIED' && !hasLease) busy.push({ start: now, end: s.availableFrom && s.availableFrom > now ? s.availableFrom : null, kind: 'lease' });
        else if (s.availableFrom && s.availableFrom > now) busy.push({ start: now, end: s.availableFrom, kind: 'preparing' });
        push(u, s, busy, { kind: s.kind === 'BED' ? 'BED' : s.kind === 'STUDIO' ? 'STUDIO' : 'ROOM', price: s.monthlyRate, deposit: s.deposit, priceUnit: 'month' });
      }
    } else {
      const busy = [...u.leases.filter(l => !l.spaceId).map(leaseSpan), ...u.bookings.filter(b => !b.spaceId).map(bookSpan)];
      const holiday = u.mode === 'HOLIDAY';
      const lease = u.leases.find(l => !l.spaceId);
      const monthly = u.monthlyRent || (lease ? (lease.rentPeriod === 'YEARLY' || lease.rent > 30000 ? lease.rent / 12 : lease.rent) : null);
      push(u, null, busy, { kind: holiday ? 'HOLIDAY' : 'FLAT', price: holiday ? u.monthlyRent || null : monthly, nightly: u.nightlyRate || null, deposit: null, priceUnit: 'month' });
    }
  }
  items.sort((a, b) => a.building.name.localeCompare(b.building.name) || a.unit.number.localeCompare(b.unit.number, undefined, { numeric: true }) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
  res.json({ from, to, months, horizonStart, horizonEnd, items });
}));

router.get('/:id', ah(async (req, res) => {
  const d = await findOwned('leasingDeal', req.params.id, req.user.orgId, { transactions: { orderBy: { date: 'desc' } } });
  res.json(withMoney(d));
}));

router.post('/', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const data = stamp(await pick(SPEC, req.body, orgId), null);
  // next deal number; retry once if two people add a deal at the same moment
  for (let attempt = 0; ; attempt++) {
    const last = await prisma.leasingDeal.findFirst({ where: { orgId }, orderBy: { number: 'desc' }, select: { number: true } });
    const number = req.body.number && attempt === 0 ? Number(req.body.number) : (last?.number || 0) + 1;
    try {
      const d = await prisma.leasingDeal.create({ data: { ...data, number, orgId }, include: { transactions: true } });
      return res.status(201).json(withMoney(d));
    } catch (e) {
      if (e.code === 'P2002' && attempt < 2 && !req.body.number) continue;
      if (e.code === 'P2002') throw new HttpError(409, `Deal #${number} already exists`);
      throw e;
    }
  }
}));

router.patch('/:id', ah(async (req, res) => {
  const existing = await findOwned('leasingDeal', req.params.id, req.user.orgId);
  const data = stamp(await pick(SPEC, req.body, req.user.orgId, { partial: true }), existing);
  const d = await prisma.leasingDeal.update({ where: { id: existing.id }, data, include: { transactions: { orderBy: { date: 'desc' } } } });
  res.json(withMoney(d));
}));

router.delete('/:id', ah(async (req, res) => {
  const existing = await findOwned('leasingDeal', req.params.id, req.user.orgId);
  const paid = await prisma.transaction.count({ where: { dealId: existing.id } });
  if (paid) throw new HttpError(409, 'This deal has payments in the ledger. Cancel it instead, or delete the payments first.');
  await prisma.leasingDeal.delete({ where: { id: existing.id } });
  res.status(204).end();
}));

// Record money for a deal. kind: fee | client_in | client_out | commission
const KINDS = {
  fee: { type: 'INCOME', category: 'LEASING_COMMISSION', label: 'Agency fee' },
  client_in: { type: 'INCOME', category: 'DEAL_FUNDS_IN', label: 'Received from client for landlord' },
  client_out: { type: 'EXPENSE', category: 'DEAL_FUNDS_OUT', label: 'Paid to landlord' },
  commission: { type: 'EXPENSE', category: 'COMMISSION', label: 'Commission paid' },
};
router.post('/:id/payments', ah(async (req, res) => {
  const deal = await findOwned('leasingDeal', req.params.id, req.user.orgId);
  const k = KINDS[req.body.kind];
  if (!k) throw new HttpError(422, 'Choose what this payment is for');
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw new HttpError(422, 'Amount must be more than zero');
  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(422, 'Choose a valid date');
  const tx = await prisma.transaction.create({
    data: {
      orgId: req.user.orgId, dealId: deal.id, type: k.type, category: k.category, amount, date,
      method: req.body.method || 'CASH',
      description: `${k.label} — Deal #${deal.number} · ${deal.clientName}${req.body.kind === 'commission' && req.body.paidTo ? ` · ${req.body.paidTo}` : ''}`,
      notes: req.body.notes || null, createdBy: req.user.id,
    },
  });
  res.status(201).json(tx);
}));

// Bulk-load past deals (super admin). Each deal's payments are matched to lines already in the
// ledger (same day, amount, direction and description) and linked, never duplicated.
// Running it again updates the same deal numbers.
router.post('/import', ah(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Only a super admin can import deals');
  const list = Array.isArray(req.body.deals) ? req.body.deals : [];
  if (!list.length || list.length > 500) throw new HttpError(422, 'Send between 1 and 500 deals');
  const orgId = req.user.orgId;
  const report = { created: 0, updated: 0, linked: 0, alreadyLinked: 0, unmatched: [] };
  for (const raw of list) {
    const number = Number(raw.number);
    if (!Number.isInteger(number) || number < 1) throw new HttpError(422, `Bad deal number ${raw.number}`);
    const data = await pick(SPEC, { ...raw, clientName: raw.clientName || `Deal ${number}` }, orgId);
    for (const f of ['signedAt', 'closedAt']) data[f] = raw[f] ? new Date(raw[f]) : null;
    const existing = await prisma.leasingDeal.findFirst({ where: { orgId, number }, select: { id: true } });
    const deal = existing
      ? await prisma.leasingDeal.update({ where: { id: existing.id }, data })
      : await prisma.leasingDeal.create({ data: { ...data, number, orgId } });
    report[existing ? 'updated' : 'created']++;
    const used = [];
    for (const p of raw.payments || []) {
      const day = new Date(`${String(p.date).slice(0, 10)}T00:00:00.000Z`);
      const next = new Date(day.getTime() + 864e5);
      const amount = Number(p.amount);
      const base = { orgId, type: p.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME', date: { gte: day, lt: next }, amount: { gte: amount - 0.01, lte: amount + 0.01 } };
      const fresh = { id: { notIn: used } };
      const already = await prisma.transaction.findFirst({ where: { ...base, ...fresh, dealId: deal.id }, select: { id: true } });
      if (already) { used.push(already.id); report.alreadyLinked++; continue; }
      const match = await prisma.transaction.findFirst({ where: { ...base, ...fresh, dealId: null, description: { startsWith: String(p.description || '').slice(0, 40).trim() } }, orderBy: { createdAt: 'asc' }, select: { id: true } })
        || await prisma.transaction.findFirst({ where: { ...base, ...fresh, dealId: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (match) { used.push(match.id); await prisma.transaction.update({ where: { id: match.id }, data: { dealId: deal.id } }); report.linked++; }
      else report.unmatched.push({ deal: number, ...p });
    }
  }
  res.json(report);
}));

module.exports = router;
