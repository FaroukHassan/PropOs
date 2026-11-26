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

module.exports = router;
