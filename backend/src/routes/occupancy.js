// backend/src/routes/occupancy.js — tenants, leases (tenancies) and holiday bookings
const express = require('express');
const prisma = require('../db');
const { Prisma } = require('@prisma/client');
const { crudRouter, findOwned, coerce } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');
const { nights, startOfDay, periodFrom } = require('../lib/dates');
const { unitScope, isScoped } = require('../lib/scope');

// ─── Tenants ─────────────────────────────────────────────────────────────────
const tenants = crudRouter({
  model: 'tenant',
  spec: {
    name: { type: 'string', required: true }, phone: 'string', email: 'string',
    nationality: 'string', idNumber: 'string', notes: 'string',
    secondPhone: 'string', emergencyName: 'string', emergencyPhone: 'string', emergencyRelation: 'string',
  },
  include: {
    leases: { include: { unit: { include: { building: true } }, space: true }, orderBy: { startDate: 'desc' } },
  },
  orderBy: { name: 'asc' },
  search: ['name', 'phone', 'secondPhone', 'email'],
  // with the apartment filter on, show the people who have lived there
  scope: q => (isScoped(q) ? { leases: { some: unitScope(q) } } : {}),
});

// ─── Leases ──────────────────────────────────────────────────────────────────
// Keep the space's status in step with its tenancy.
async function syncSpace(spaceId) {
  if (!spaceId) return;
  const active = await prisma.lease.count({ where: { spaceId, status: { in: ['ACTIVE', 'NOTICE'] } } });
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) return;
  if (active && space.status !== 'OCCUPIED') await prisma.space.update({ where: { id: spaceId }, data: { status: 'OCCUPIED' } });
  if (!active && space.status === 'OCCUPIED') await prisma.space.update({ where: { id: spaceId }, data: { status: 'AVAILABLE' } });
}

const leases = express.Router();

leases.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  Object.assign(where, unitScope(req.query));
  for (const f of ['unitId', 'spaceId', 'tenantId', 'status']) if (req.query[f]) where[f] = req.query[f];
  if (req.query.active) where.status = { in: ['ACTIVE', 'NOTICE'] };
  res.json(await prisma.lease.findMany({
    where,
    include: { tenant: true, unit: { include: { building: true } }, space: true, cheques: { orderBy: { dueDate: 'asc' } } },
    orderBy: { startDate: 'desc' },
  }));
}));

// A new rent on a running tenancy starts from a chosen month (default: this month); the months
// before keep the rent they had, so past rent collection doesn't change.
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
function rentChange(existing, rent, rentFrom, user) {
  const now = new Date();
  const from = rentFrom || monthOf(now);
  if (!MONTH.test(from)) throw new HttpError(422, 'Choose the month the new rent starts');
  const list = (Array.isArray(existing.rentChanges) ? [...existing.rentChanges] : []).sort((x, y) => x.from.localeCompare(y.from));
  const base = list.length ? list[0].previous : existing.rent; // the rent before any change
  const kept = list.filter(c => c.from < from); // a new change replaces any from the same month on
  // from the very first month: the tenancy simply has this rent
  const changes = from <= monthOf(existing.startDate) ? []
    : [...kept, { from, rent, previous: kept.length ? kept[kept.length - 1].rent : base, at: now.toISOString(), by: user?.name || user?.email || null }];
  return changes.length ? changes : Prisma.DbNull;
}

crudRouter({
  router: leases,
  model: 'lease',
  spec: {
    tenantId: { type: 'id', required: true }, unitId: { type: 'id', required: true }, spaceId: 'id',
    startDate: { type: 'date', required: true }, endDate: 'date',
    rent: { type: 'number', required: true }, rentPeriod: 'enum',
    deposit: 'number', depositPaid: 'number', dueDay: 'int',
    broker: 'string', commission: 'number', status: 'enum', notes: 'string',
  },
  include: {
    tenant: true, unit: { include: { building: true } }, space: true,
    cheques: { orderBy: { dueDate: 'asc' } },
    transactions: { orderBy: { date: 'desc' } },
  },
  beforeSave: async (data, req, existing) => {
    const unitId = data.unitId || existing?.unitId;
    const spaceId = data.spaceId !== undefined ? data.spaceId : existing?.spaceId;
    if (spaceId) {
      const space = await prisma.space.findUnique({ where: { id: spaceId } });
      if (space.unitId !== unitId) throw new HttpError(422, 'That room is not in this apartment');
      // Only one active tenancy per space
      const status = data.status || existing?.status || 'ACTIVE';
      if (status !== 'ENDED') {
        const clash = await prisma.lease.findFirst({
          where: { spaceId, status: { in: ['ACTIVE', 'NOTICE'] }, ...(existing ? { id: { not: existing.id } } : {}) },
          include: { tenant: true },
        });
        if (clash) throw new HttpError(409, `${space.code} is already occupied by ${clash.tenant.name}. End that tenancy first.`);
      }
    }
    if (existing && data.rent !== undefined && data.rent !== null) {
      if (!(data.rent > 0)) throw new HttpError(422, 'Rent must be more than 0');
      if (data.rent !== existing.rent) data.rentChanges = rentChange(existing, data.rent, req.body.rentFrom, req.user);
    }
    if (data.dueDay !== undefined && data.dueDay !== null && (data.dueDay < 1 || data.dueDay > 28)) {
      throw new HttpError(422, 'Rent due day must be between 1 and 28');
    }
    return data;
  },
  afterSave: async (row, req, existing) => {
    await syncSpace(row.spaceId);
    if (existing && existing.spaceId && existing.spaceId !== row.spaceId) await syncSpace(existing.spaceId);
  },
});

// End a tenancy: sets end date, frees the space, optionally records the deposit refund

leases.post('/:id/end', ah(async (req, res) => {
  const lease = await findOwned('lease', req.params.id, req.user.orgId);
  const endDate = coerce('date', req.body.endDate, 'endDate') || startOfDay();
  const refund = coerce('number', req.body.refund, 'refund') || 0;
  const updated = await prisma.$transaction(async tx => {
    const l = await tx.lease.update({ where: { id: lease.id }, data: { status: 'ENDED', endDate } });
    if (refund > 0) {
      await tx.transaction.create({
        data: {
          orgId: req.user.orgId, date: endDate, type: 'EXPENSE', category: 'DEPOSIT_REFUND',
          description: 'Deposit refund', amount: refund, method: req.body.method || 'CASH',
          unitId: lease.unitId, spaceId: lease.spaceId, leaseId: lease.id, createdBy: req.user.id,
        },
      });
    }
    return l;
  });
  await syncSpace(lease.spaceId);
  res.json(updated);
}));

// ─── Holiday bookings ────────────────────────────────────────────────────────
const bookings = express.Router();

bookings.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  Object.assign(where, unitScope(req.query));
  for (const f of ['unitId', 'spaceId', 'status', 'channel']) if (req.query[f]) where[f] = req.query[f];
  if (req.query.from || req.query.to) {
    // bookings that overlap the window (both days included)
    const { start, end } = periodFrom(req.query, HttpError);
    if (req.query.to) where.checkIn = { lt: end };
    if (req.query.from) where.checkOut = { gt: start };
  }
  const rows = await prisma.booking.findMany({
    where, include: { unit: { include: { building: true } }, space: true }, orderBy: { checkIn: 'asc' },
  });
  res.json(rows.map(b => ({ ...b, nights: nights(b.checkIn, b.checkOut), net: b.totalAmount - b.channelFee })));
}));

crudRouter({
  router: bookings,
  model: 'booking',
  spec: {
    unitId: { type: 'id', required: true }, spaceId: 'id', guestName: { type: 'string', required: true },
    guestPhone: 'string', guests: 'int', channel: 'enum', reference: 'string',
    checkIn: { type: 'date', required: true }, checkOut: { type: 'date', required: true },
    totalAmount: { type: 'number', required: true }, channelFee: 'number', cleaningFee: 'number',
    tourismFee: 'number', status: 'enum', notes: 'string',
  },
  include: { unit: { include: { building: true } }, space: true, transactions: true },
  beforeSave: async (data, req, existing) => {
    const unitId = data.unitId || existing.unitId;
    const spaceId = data.spaceId !== undefined ? data.spaceId : existing?.spaceId;
    const checkIn = data.checkIn || existing.checkIn;
    const checkOut = data.checkOut || existing.checkOut;
    const status = data.status || existing?.status || 'CONFIRMED';
    if (checkOut <= checkIn) throw new HttpError(422, 'Check-out must be after check-in');
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (spaceId) {
      // A partition can be let as a holiday stay (e.g. Azizi Riviera 920, or a partition reserved for holiday use)
      const space = await prisma.space.findUnique({ where: { id: spaceId } });
      if (space.unitId !== unitId) throw new HttpError(422, 'That room is not in this apartment');
      const tenant = await prisma.lease.findFirst({ where: { spaceId, status: { in: ['ACTIVE', 'NOTICE'] } }, include: { tenant: true } });
      if (tenant) throw new HttpError(409, `${space.code} has a monthly tenant (${tenant.tenant.name})`);
    } else if (unit.mode !== 'HOLIDAY') {
      throw new HttpError(422, 'Choose a room, or make the apartment a holiday home');
    }
    if (!['CANCELLED', 'INQUIRY'].includes(status)) {
      // Whole-apartment bookings clash with everything in that apartment; partition bookings clash with the same partition or a whole-apartment booking
      const clash = await prisma.booking.findFirst({
        where: {
          unitId, status: { notIn: ['CANCELLED', 'INQUIRY'] },
          checkIn: { lt: checkOut }, checkOut: { gt: checkIn },
          ...(spaceId ? { OR: [{ spaceId }, { spaceId: null }] } : {}),
          ...(existing ? { id: { not: existing.id } } : {}),
        },
      });
      if (clash) throw new HttpError(409, `Dates overlap with ${clash.guestName}'s booking`);
    }
    return data;
  },
});

module.exports = { tenants, leases, bookings, syncSpace };
