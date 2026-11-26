// backend/src/routes/reports.js — dashboard and monthly reports
const express = require('express');
const prisma = require('../db');
const { ah, HttpError } = require('../middleware/errorHandler');
const { monthRange, lastMonths, startOfDay, addDays, nightsWithin, monthKey } = require('../lib/dates');
const { unitScope, unitWhere, isScoped } = require('../lib/scope');

const sum = (rows, f = r => r.amount) => rows.reduce((s, r) => s + (f(r) || 0), 0);
const round = n => Math.round(n * 100) / 100;

// Monthly leases that owe rent for the month, with what has been collected against them
async function rentCollection(orgId, key, q = {}) {
  const { start, end } = monthRange(key);
  const leases = await prisma.lease.findMany({
    where: {
      orgId, ...unitScope(q), rentPeriod: 'MONTHLY', startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
      status: { in: ['ACTIVE', 'NOTICE', 'ENDED'] },
    },
    include: { tenant: true, space: true, unit: { include: { building: true } } },
  });
  const paid = await prisma.transaction.groupBy({
    by: ['leaseId'],
    where: { orgId, category: 'RENT', periodMonth: key, leaseId: { in: leases.map(l => l.id) } },
    _sum: { amount: true },
  });
  const paidBy = Object.fromEntries(paid.map(p => [p.leaseId, p._sum.amount]));
  const today = startOfDay();
  return leases
    // an ended lease only owes for months it was active in at least partly
    .filter(l => l.status !== 'ENDED' || (l.endDate && l.endDate >= start))
    .map(l => {
      const collected = paidBy[l.id] || 0;
      const due = l.rent;
      // never due before the tenant moved in
      const nominal = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), l.dueDay));
      const dueDate = l.startDate > nominal ? l.startDate : nominal;
      const balance = round(due - collected);
      const status = balance <= 0 ? 'PAID' : collected > 0 ? 'PARTIAL' : dueDate < today ? 'OVERDUE' : 'DUE';
      return {
        month: key, leaseId: l.id, tenant: l.tenant.name, phone: l.tenant.phone,
        building: l.unit.building.name, unit: l.unit.number, unitId: l.unitId, space: l.space?.code || null,
        due, collected, balance: Math.max(balance, 0), dueDate, status,
      };
    })
    .sort((a, b) => a.building.localeCompare(b.building) || a.unit.localeCompare(b.unit, undefined, { numeric: true }) || String(a.space).localeCompare(String(b.space), undefined, { numeric: true }));
}

// Holiday-home occupancy and revenue earned within a month (pro-rated by night)
async function holidayStats(orgId, key, q = {}) {
  const { start, end } = monthRange(key);
  // Each bookable thing counts once: a holiday flat, or each partition of a partitioned holiday flat
  const homes = await prisma.unit.findMany({ where: { orgId, ...unitWhere(q), mode: 'HOLIDAY', active: true }, include: { _count: { select: { spaces: true } } } });
  const units = homes.reduce((n, u) => n + (u._count.spaces || 1), 0);
  const bookings = await prisma.booking.findMany({
    where: { orgId, ...unitScope(q), status: { notIn: ['CANCELLED', 'INQUIRY'] }, checkIn: { lt: end }, checkOut: { gt: start } },
  });
  const daysInMonth = Math.round((end - start) / 86400000);
  let bookedNights = 0, revenue = 0;
  for (const b of bookings) {
    const n = nightsWithin(b.checkIn, b.checkOut, start, end);
    const total = Math.max(1, Math.round((b.checkOut - b.checkIn) / 86400000));
    bookedNights += n;
    revenue += ((b.totalAmount - b.channelFee) * n) / total;
  }
  const available = units * daysInMonth;
  return {
    units, bookings: bookings.length, bookedNights, availableNights: available,
    occupancy: available ? bookedNights / available : 0,
    adr: bookedNights ? Math.round(revenue / bookedNights) : 0, netRevenue: round(revenue),
  };
}

const router = express.Router();

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const key = req.query.month || monthKey();
  const { start, end } = monthRange(key);
  const today = startOfDay();
  const in14 = addDays(today, 14);
  const months = lastMonths(6, key);
  const sixStart = monthRange(months[0]).start;
  const q = req.query, scope = unitScope(q);

  const [monthTx, trendTx, spaces, collection, holiday, chequesDue, bounced, openMaint, arrivals, departures] = await Promise.all([
    prisma.transaction.findMany({ where: { orgId, ...scope, date: { gte: start, lt: end } }, select: { type: true, category: true, amount: true } }),
    prisma.transaction.findMany({ where: { orgId, ...scope, date: { gte: sixStart, lt: end } }, select: { type: true, amount: true, date: true } }),
    prisma.space.groupBy({ by: ['status'], where: { orgId, unit: { active: true, ...unitWhere(q) } }, _count: true }),
    rentCollection(orgId, key, q),
    holidayStats(orgId, key, q),
    prisma.cheque.findMany({
      where: {
        orgId, ...scope,
        OR: [
          { status: 'PENDING', dueDate: { lte: in14 } },
          { status: 'POSTPONED', OR: [{ postponedTo: { lte: in14 } }, { postponedTo: null, dueDate: { lte: in14 } }] },
        ],
      },
      include: { unit: { include: { building: true } } }, orderBy: { dueDate: 'asc' }, take: 10,
    }),
    prisma.cheque.groupBy({ by: ['status'], where: { orgId, ...scope, status: { in: ['BOUNCED', 'POSTPONED'] } }, _count: true }),
    prisma.maintenanceRequest.findMany({
      where: { orgId, ...scope, status: { not: 'RESOLVED' } }, include: { unit: { include: { building: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 6,
    }),
    prisma.booking.findMany({
      where: { orgId, ...scope, status: { in: ['CONFIRMED'] }, checkIn: { gte: today, lt: addDays(today, 7) } },
      include: { unit: { include: { building: true } } }, orderBy: { checkIn: 'asc' },
    }),
    prisma.booking.findMany({
      where: { orgId, ...scope, status: { in: ['CHECKED_IN', 'CONFIRMED'] }, checkOut: { gte: today, lt: addDays(today, 7) } },
      include: { unit: { include: { building: true } } }, orderBy: { checkOut: 'asc' },
    }),
  ]);

  const spaceCount = Object.fromEntries(spaces.map(s => [s.status, s._count]));
  const totalSpaces = sum(spaces, s => s._count);
  const income = sum(monthTx.filter(t => t.type === 'INCOME'));
  const expenses = sum(monthTx.filter(t => t.type === 'EXPENSE'));
  const rentDue = sum(collection, c => c.due);
  const rentCollected = sum(collection, c => Math.min(c.collected, c.due));

  res.json({
    month: key,
    money: { income: round(income), expenses: round(expenses), net: round(income - expenses) },
    partitions: {
      total: totalSpaces, occupied: spaceCount.OCCUPIED || 0, available: spaceCount.AVAILABLE || 0,
      reserved: spaceCount.RESERVED || 0, notReady: spaceCount.NOT_READY || 0,
      occupancy: totalSpaces ? (spaceCount.OCCUPIED || 0) / totalSpaces : 0,
    },
    rent: {
      due: round(rentDue), collected: round(rentCollected), outstanding: round(rentDue - rentCollected),
      rate: rentDue ? rentCollected / rentDue : 0,
      unpaid: collection.filter(c => c.status !== 'PAID').sort((a, b) => b.balance - a.balance).slice(0, 8),
    },
    holiday,
    cheques: {
      dueSoon: chequesDue,
      bounced: bounced.find(b => b.status === 'BOUNCED')?._count || 0,
      postponed: bounced.find(b => b.status === 'POSTPONED')?._count || 0,
    },
    maintenance: openMaint,
    arrivals, departures,
    trend: months.map(m => {
      const { start: s, end: e } = monthRange(m);
      const rows = trendTx.filter(t => t.date >= s && t.date < e);
      const inc = sum(rows.filter(t => t.type === 'INCOME'));
      const exp = sum(rows.filter(t => t.type === 'EXPENSE'));
      return { month: m, income: round(inc), expenses: round(exp), net: round(inc - exp) };
    }),
  });
}));

// ─── Reports ─────────────────────────────────────────────────────────────────
// One month (?month=2026-11), or every rent instalment due between two dates (?from=2026-09-01&to=2026-11-30).
// Both can be narrowed to an apartment or building with the app-wide filter.
router.get('/reports/rent-collection', ah(async (req, res) => {
  const { from, to } = req.query;
  let rows, key = null;
  if (from || to) {
    const f = new Date(from || to), t = new Date(to || from);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || f > t) throw new HttpError(422, 'Choose a valid date range');
    const fromDay = startOfDay(f), toEnd = addDays(startOfDay(t), 1);
    const keys = [];
    for (let k = monthKey(fromDay); k <= monthKey(t) && keys.length < 36; ) {
      keys.push(k);
      const [y, m] = k.split('-').map(Number);
      k = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
    }
    const perMonth = await Promise.all(keys.map(k => rentCollection(req.user.orgId, k, req.query)));
    rows = perMonth.flat().filter(r => r.dueDate >= fromDay && r.dueDate < toEnd);
  } else {
    key = req.query.month || monthKey();
    rows = await rentCollection(req.user.orgId, key, req.query);
  }
  res.json({
    month: key, from: from || null, to: to || null, rows,
    totals: { due: round(sum(rows, r => r.due)), collected: round(sum(rows, r => r.collected)), outstanding: round(sum(rows, r => r.balance)) },
  });
}));

router.get('/reports/pnl', ah(async (req, res) => {
  const key = req.query.month || monthKey();
  const { start, end } = monthRange(key);
  const rows = await prisma.transaction.groupBy({
    by: ['type', 'category'], where: { orgId: req.user.orgId, ...unitScope(req.query), date: { gte: start, lt: end } }, _sum: { amount: true },
  });
  const pick = t => rows.filter(r => r.type === t).map(r => ({ category: r.category, total: round(r._sum.amount) })).sort((a, b) => b.total - a.total);
  const income = pick('INCOME'), expenses = pick('EXPENSE');
  const ti = sum(income, r => r.total), te = sum(expenses, r => r.total);
  res.json({ month: key, income, expenses, totalIncome: round(ti), totalExpenses: round(te), net: round(ti - te), margin: ti ? (ti - te) / ti : null });
}));

// Profit per apartment, like the "Revenue by Apartment" sheet but with costs too
router.get('/reports/units', ah(async (req, res) => {
  const key = req.query.month || monthKey();
  const { start, end } = monthRange(key);
  const orgId = req.user.orgId;
  const [units, grouped] = await Promise.all([
    prisma.unit.findMany({ where: { orgId, ...unitWhere(req.query) }, include: { building: true, landlord: true, _count: { select: { spaces: true } } } }),
    prisma.transaction.groupBy({ by: ['unitId', 'type', 'category'], where: { orgId, ...unitScope(req.query), date: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);
  const rows = units.map(u => {
    const mine = grouped.filter(g => g.unitId === u.id);
    const income = sum(mine.filter(g => g.type === 'INCOME'), g => g._sum.amount);
    const expenses = sum(mine.filter(g => g.type === 'EXPENSE'), g => g._sum.amount);
    const landlordRent = sum(mine.filter(g => g.category === 'RENT_PAID'), g => g._sum.amount);
    const dewa = sum(mine.filter(g => g.category === 'DEWA'), g => g._sum.amount);
    return {
      unitId: u.id, building: u.building.name, unit: u.number, mode: u.mode, arrangement: u.arrangement,
      landlord: u.landlord?.name || null, spaces: u._count.spaces,
      income: round(income), landlordRent: round(landlordRent), dewa: round(dewa),
      otherExpenses: round(expenses - landlordRent - dewa), expenses: round(expenses), net: round(income - expenses),
    };
  }).sort((a, b) => b.net - a.net);
  // company overheads aren't tied to an apartment, so they drop out when filtering by one
  const unassigned = isScoped(req.query) ? [] : grouped.filter(g => !g.unitId);
  const overheadIncome = sum(unassigned.filter(g => g.type === 'INCOME'), g => g._sum.amount);
  const overheads = sum(unassigned.filter(g => g.type === 'EXPENSE'), g => g._sum.amount);
  const unitsNet = sum(rows, r => r.net);
  res.json({
    month: key, rows,
    overheads: {
      income: round(overheadIncome), expenses: round(overheads),
      byCategory: unassigned.filter(g => g.type === 'EXPENSE').map(g => ({ category: g.category, total: round(g._sum.amount) })).sort((a, b) => b.total - a.total),
    },
    totals: { unitsNet: round(unitsNet), companyNet: round(unitsNet + overheadIncome - overheads) },
  });
}));

// Monthly statement for a landlord/owner
router.get('/reports/owner-statement', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const key = req.query.month || monthKey();
  const { start, end } = monthRange(key);
  const landlord = await prisma.landlord.findFirst({
    where: { id: req.query.landlordId, orgId }, include: { units: { include: { building: true } } },
  });
  if (!landlord) throw new HttpError(404, 'Landlord not found');
  const unitIds = landlord.units.map(u => u.id);
  const [tx, cheques] = await Promise.all([
    prisma.transaction.findMany({
      where: { orgId, date: { gte: start, lt: end }, OR: [{ unitId: { in: unitIds } }, { landlordId: landlord.id }] },
      include: { space: true }, orderBy: { date: 'asc' },
    }),
    prisma.cheque.findMany({ where: { orgId, landlordId: landlord.id }, include: { unit: true }, orderBy: { dueDate: 'asc' } }),
  ]);

  const units = landlord.units.map(u => {
    const mine = tx.filter(t => t.unitId === u.id);
    const income = sum(mine.filter(t => t.type === 'INCOME'));
    const expenses = sum(mine.filter(t => t.type === 'EXPENSE' && !['RENT_PAID', 'OWNER_PAYOUT'].includes(t.category)));
    const paidToLandlord = sum(mine.filter(t => ['RENT_PAID', 'OWNER_PAYOUT'].includes(t.category)));
    const base = {
      unitId: u.id, building: u.building.name, unit: u.number, arrangement: u.arrangement,
      income: round(income), expenses: round(expenses), paidToLandlord: round(paidToLandlord),
      lines: mine.map(t => ({ date: t.date, type: t.type, category: t.category, description: t.description, space: t.space?.code, amount: t.amount })),
    };
    if (u.arrangement === 'MANAGEMENT') {
      const fee = (income * (u.managementFee || 0)) / 100;
      return { ...base, feePct: u.managementFee || 0, fee: round(fee), ownerShare: round(income - expenses - fee) };
    }
    return { ...base, annualRent: u.landlordRent || 0, monthlyRent: round((u.landlordRent || 0) / 12) };
  });
  const managed = units.filter(u => u.arrangement === 'MANAGEMENT');
  const ownerShare = sum(managed, u => u.ownerShare);
  const paid = sum(managed, u => u.paidToLandlord) + sum(tx.filter(t => !t.unitId && t.landlordId && t.category === 'OWNER_PAYOUT'));
  res.json({
    month: key, landlord: { id: landlord.id, name: landlord.name, phone: landlord.phone, email: landlord.email },
    units,
    totals: {
      income: round(sum(units, u => u.income)), expenses: round(sum(units, u => u.expenses)),
      fees: round(sum(managed, u => u.fee)), ownerShare: round(ownerShare), paidOut: round(paid),
      balanceDue: round(ownerShare - paid),
      masterLeaseRentPaid: round(sum(units.filter(u => u.arrangement === 'MASTER_LEASE'), u => u.paidToLandlord)),
    },
    cheques,
  });
}));

module.exports = router;
