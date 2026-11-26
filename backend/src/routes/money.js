// backend/src/routes/money.js — the ledger (transactions), cheques and maintenance
const express = require('express');
const prisma = require('../db');
const { crudRouter, findOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');
const { monthRange, startOfDay, addDays, monthKey } = require('../lib/dates');

const INCOME_CATS = ['RENT', 'DEPOSIT', 'BOOKING', 'OTHER_INCOME'];

// ─── Transactions ────────────────────────────────────────────────────────────
const transactions = express.Router();

function txWhere(req) {
  const where = { orgId: req.user.orgId };
  for (const f of ['type', 'category', 'unitId', 'spaceId', 'leaseId', 'bookingId', 'landlordId', 'method']) {
    if (req.query[f]) where[f] = req.query[f];
  }
  if (req.query.month) {
    const { start, end } = monthRange(req.query.month);
    where.date = { gte: start, lt: end };
  } else if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = new Date(req.query.from);
    if (req.query.to) where.date.lt = new Date(req.query.to);
  }
  if (req.query.q) {
    where.OR = ['description', 'notes'].map(f => ({ [f]: { contains: req.query.q, mode: 'insensitive' } }));
  }
  return where;
}

transactions.get('/', ah(async (req, res) => {
  res.json(await prisma.transaction.findMany({
    where: txWhere(req),
    include: { unit: { include: { building: true } }, space: true, lease: { include: { tenant: true } }, landlord: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(Number(req.query.limit) || 500, 2000),
  }));
}));

transactions.get('/summary', ah(async (req, res) => {
  const rows = await prisma.transaction.groupBy({
    by: ['type', 'category'], where: txWhere(req), _sum: { amount: true }, _count: true,
  });
  const income = rows.filter(r => r.type === 'INCOME').reduce((s, r) => s + r._sum.amount, 0);
  const expenses = rows.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + r._sum.amount, 0);
  res.json({
    income, expenses, net: income - expenses,
    byCategory: rows.map(r => ({ type: r.type, category: r.category, total: r._sum.amount, count: r._count })),
  });
}));

crudRouter({
  router: transactions,
  model: 'transaction',
  spec: {
    date: { type: 'date', required: true }, type: { type: 'enum', required: true },
    category: { type: 'enum', required: true }, description: { type: 'string', required: true },
    amount: { type: 'number', required: true }, method: 'enum',
    unitId: 'id', spaceId: 'id', leaseId: 'id', bookingId: 'id', landlordId: 'id',
    periodMonth: 'string', estimated: 'bool', notes: 'string',
  },
  include: { unit: { include: { building: true } }, space: true, lease: { include: { tenant: true } }, landlord: true },
  beforeSave: async (data, req, existing) => {
    const type = data.type || existing?.type;
    const category = data.category || existing?.category;
    if (data.amount !== undefined && data.amount <= 0) throw new HttpError(422, 'Amount must be more than zero');
    if (type && category && (type === 'INCOME') !== INCOME_CATS.includes(category)) {
      throw new HttpError(422, `${category} is not an ${type.toLowerCase()} category`);
    }
    if (data.periodMonth && !/^\d{4}-\d{2}$/.test(data.periodMonth)) throw new HttpError(422, 'Period must look like 2026-06');
    // Fill unit/space from the lease so reports group correctly
    const leaseId = data.leaseId || existing?.leaseId;
    if (data.leaseId) {
      const lease = await prisma.lease.findUnique({ where: { id: data.leaseId } });
      data.unitId = data.unitId || lease.unitId;
      data.spaceId = data.spaceId || lease.spaceId;
    }
    if (data.spaceId && !data.unitId && !existing?.unitId) {
      const space = await prisma.space.findUnique({ where: { id: data.spaceId } });
      data.unitId = space.unitId;
    }
    if (data.bookingId && !data.unitId) {
      const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
      data.unitId = booking.unitId;
    }
    // Rent against a lease defaults to the month it was paid in
    if (!existing && leaseId && category === 'RENT' && !data.periodMonth) data.periodMonth = monthKey(data.date);
    if (!existing) data.createdBy = req.user.id;
    return data;
  },
});

// ─── Cheques ─────────────────────────────────────────────────────────────────
const cheques = express.Router();

cheques.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  for (const f of ['direction', 'status', 'unitId', 'leaseId', 'landlordId']) if (req.query[f]) where[f] = req.query[f];
  if (req.query.dueWithin) {
    const by = addDays(startOfDay(), Number(req.query.dueWithin));
    where.OR = [
      { status: 'PENDING', dueDate: { lte: by } },
      { status: 'POSTPONED', OR: [{ postponedTo: { lte: by } }, { postponedTo: null, dueDate: { lte: by } }] },
    ];
  }
  res.json(await prisma.cheque.findMany({
    where,
    include: { unit: { include: { building: true } }, lease: { include: { tenant: true } }, landlord: true, transaction: true },
    orderBy: { dueDate: 'asc' },
  }));
}));

// Record a cleared cheque in the ledger exactly once
async function postClearedCheque(cheque, userId) {
  if (cheque.status !== 'CLEARED') return;
  const exists = await prisma.transaction.findUnique({ where: { chequeId: cheque.id } });
  if (exists) return;
  const isIn = cheque.direction === 'IN';
  await prisma.transaction.create({
    data: {
      orgId: cheque.orgId, date: startOfDay(), type: isIn ? 'INCOME' : 'EXPENSE',
      category: isIn ? 'RENT' : 'RENT_PAID',
      description: `Cheque ${cheque.number}${cheque.partyName ? ` — ${cheque.partyName}` : ''}`,
      amount: cheque.amount, method: 'CHEQUE', chequeId: cheque.id,
      unitId: cheque.unitId, leaseId: cheque.leaseId, landlordId: cheque.landlordId,
      periodMonth: isIn && cheque.leaseId ? monthKey(cheque.dueDate) : null,
      createdBy: userId,
    },
  });
}

crudRouter({
  router: cheques,
  model: 'cheque',
  spec: {
    direction: { type: 'enum', required: true }, number: { type: 'string', required: true },
    bank: 'string', amount: { type: 'number', required: true }, dueDate: { type: 'date', required: true },
    status: 'enum', postponedTo: 'date', partyName: 'string', unitId: 'id', leaseId: 'id', landlordId: 'id', notes: 'string',
  },
  include: { unit: { include: { building: true } }, lease: { include: { tenant: true } }, landlord: true, transaction: true },
  beforeSave: async (data, req, existing) => {
    if (data.leaseId && !data.unitId) {
      const lease = await prisma.lease.findUnique({ where: { id: data.leaseId }, include: { tenant: true } });
      data.unitId = lease.unitId;
      if (!data.partyName && !existing?.partyName) data.partyName = lease.tenant.name;
    }
    if (data.landlordId && !data.partyName && !existing?.partyName) {
      const l = await prisma.landlord.findUnique({ where: { id: data.landlordId } });
      data.partyName = l.name;
    }
    const status = data.status || existing?.status;
    if (status !== 'POSTPONED' && data.status) data.postponedTo = null;
    if (status === 'POSTPONED') {
      const newDate = data.postponedTo !== undefined ? data.postponedTo : existing?.postponedTo;
      const due = data.dueDate || existing?.dueDate;
      if (newDate && due && newDate <= due) throw new HttpError(422, 'The new date must be after the original cheque date');
    }
    if (existing?.status === 'CLEARED' && data.status && data.status !== 'CLEARED') {
      throw new HttpError(422, 'This cheque is already cleared and recorded in the ledger. Delete that ledger entry first.');
    }
    return data;
  },
  afterSave: (row, req) => postClearedCheque(row, req.user.id),
});

// Add a whole series of post-dated cheques at once (e.g. 4 or 12 cheques for a year)
cheques.post('/series', ah(async (req, res) => {
  const { direction, bank, partyName, unitId, leaseId, landlordId, notes } = req.body;
  const count = Number(req.body.count);
  const amount = Number(req.body.amount);
  const everyMonths = Number(req.body.everyMonths || 1);
  const firstNumber = String(req.body.firstNumber || '').trim();
  const first = new Date(req.body.firstDate);
  if (!['IN', 'OUT'].includes(direction)) throw new HttpError(422, 'Choose received or issued');
  if (!(count >= 1 && count <= 24)) throw new HttpError(422, 'Number of cheques must be 1 to 24');
  if (!(amount > 0)) throw new HttpError(422, 'Amount must be more than zero');
  if (Number.isNaN(first.getTime())) throw new HttpError(422, 'First cheque date is required');
  for (const [m, id] of [['unit', unitId], ['lease', leaseId], ['landlord', landlordId]]) {
    if (id) await findOwned(m, id, req.user.orgId);
  }
  const num = /^\d+$/.test(firstNumber) ? BigInt(firstNumber) : null;
  const rows = Array.from({ length: count }, (_, i) => ({
    orgId: req.user.orgId, direction, bank: bank || null, amount, partyName: partyName || null,
    unitId: unitId || null, leaseId: leaseId || null, landlordId: landlordId || null, notes: notes || null,
    number: num !== null ? String(num + BigInt(i)).padStart(firstNumber.length, '0') : `${firstNumber || 'CHQ'}-${i + 1}`,
    dueDate: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i * everyMonths, first.getUTCDate())),
  }));
  await prisma.cheque.createMany({ data: rows });
  res.status(201).json({ created: rows.length });
}));

// ─── Maintenance ─────────────────────────────────────────────────────────────
const maintenance = crudRouter({
  model: 'maintenanceRequest',
  spec: {
    unitId: { type: 'id', required: true }, spaceCode: 'string', title: { type: 'string', required: true },
    description: 'string', category: 'enum', priority: 'enum', status: 'enum',
    assignedTo: 'string', cost: 'number',
  },
  include: { unit: { include: { building: true } } },
  filters: ['unitId', 'status', 'priority'],
  beforeSave: async (data, req, existing) => {
    if (data.status === 'RESOLVED' && existing?.status !== 'RESOLVED') data.resolvedAt = new Date();
    if (data.status && data.status !== 'RESOLVED') data.resolvedAt = null;
    return data;
  },
});

module.exports = { transactions, cheques, maintenance, INCOME_CATS };
