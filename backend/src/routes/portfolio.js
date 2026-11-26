// backend/src/routes/portfolio.js — buildings, landlords, units and spaces (partitions/beds)
const express = require('express');
const prisma = require('../db');
const { crudRouter } = require('../lib/crud');
const { ah } = require('../middleware/errorHandler');

// P2 before P10; beds after partitions
const byCode = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
const sortSpaces = u => (u && u.spaces ? { ...u, spaces: [...u.spaces].sort(byCode) } : u);

const activeLease = { where: { status: { in: ['ACTIVE', 'NOTICE'] } }, include: { tenant: true }, orderBy: { startDate: 'desc' } };

// ─── Buildings ───────────────────────────────────────────────────────────────
const buildings = crudRouter({
  model: 'building',
  spec: { name: { type: 'string', required: true }, area: 'string', city: 'string', notes: 'string' },
  listInclude: { _count: { select: { units: true } } },
  orderBy: { name: 'asc' },
});

// ─── Landlords / owners ──────────────────────────────────────────────────────
const landlords = crudRouter({
  model: 'landlord',
  spec: { name: { type: 'string', required: true }, phone: 'string', email: 'string', notes: 'string' },
  include: { units: { include: { building: true } } },
  orderBy: { name: 'asc' },
  search: ['name', 'phone'],
});

// ─── Units (apartments) ──────────────────────────────────────────────────────
const unitSpec = {
  buildingId: { type: 'id', required: true },
  number: { type: 'string', required: true },
  mode: 'enum', arrangement: 'enum', landlordId: 'id',
  landlordRent: 'number', managementFee: 'number',
  bedrooms: 'int', bathrooms: 'int', occupancy: 'enum',
  nightlyRate: 'number', monthlyRent: 'number',
  dewaAccount: 'string', amenities: 'string', notes: 'string', active: 'bool',
};

const unitsRouter = express.Router();

// List with live occupancy stats per unit
unitsRouter.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  if (req.query.mode) where.mode = req.query.mode;
  if (req.query.buildingId) where.buildingId = req.query.buildingId;
  const units = await prisma.unit.findMany({
    where,
    include: {
      building: true, landlord: true,
      spaces: { include: { leases: { ...activeLease, take: 1 } }, orderBy: { code: 'asc' } },
      leases: { ...activeLease, where: { ...activeLease.where, spaceId: null }, take: 1 },
    },
    orderBy: [{ building: { name: 'asc' } }, { number: 'asc' }],
  });
  res.json(units.map(sortSpaces).map(u => {
    const totalSpaces = u.spaces.length;
    const occupiedSpaces = u.spaces.filter(s => s.status === 'OCCUPIED').length;
    const monthlyPotential = u.mode === 'PARTITIONS'
      ? u.spaces.reduce((s, x) => s + x.monthlyRate, 0)
      : u.mode === 'LONG_TERM' ? (u.monthlyRent || 0) : (u.nightlyRate || 0) * 30;
    const monthlyContracted = u.mode === 'PARTITIONS'
      ? u.spaces.reduce((s, x) => s + (x.leases[0]?.rent || 0), 0)
      : u.mode === 'LONG_TERM' && u.leases[0]
        ? (u.leases[0].rentPeriod === 'YEARLY' ? u.leases[0].rent / 12 : u.leases[0].rent) : 0;
    return { ...u, totalSpaces, occupiedSpaces, monthlyPotential, monthlyContracted };
  }));
}));

crudRouter({
  router: unitsRouter,
  model: 'unit',
  spec: unitSpec,
  include: {
    building: true, landlord: true,
    spaces: { include: { leases: { ...activeLease, take: 1 } }, orderBy: { code: 'asc' } },
    leases: { include: { tenant: true, space: true }, orderBy: { startDate: 'desc' }, take: 20 },
    bookings: { orderBy: { checkIn: 'desc' }, take: 20 },
    cheques: { orderBy: { dueDate: 'asc' } },
  },
});

// ─── Spaces (partitions, beds, rooms) ────────────────────────────────────────
const spacesRouter = express.Router();

// Availability board: building → unit → spaces, the replacement for the availability sheet
spacesRouter.get('/board', ah(async (req, res) => {
  const where = { orgId: req.user.orgId, mode: 'PARTITIONS', active: true };
  if (req.query.buildingId) where.buildingId = req.query.buildingId;
  const units = await prisma.unit.findMany({
    where,
    include: {
      building: true,
      spaces: { include: { leases: { ...activeLease, take: 1 } }, orderBy: { code: 'asc' } },
    },
    orderBy: [{ building: { name: 'asc' } }, { number: 'asc' }],
  });
  const byBuilding = {};
  for (const u of units.map(sortSpaces)) {
    const b = byBuilding[u.buildingId] ||= { id: u.buildingId, name: u.building.name, area: u.building.area, units: [] };
    b.units.push({
      id: u.id, number: u.number, occupancy: u.occupancy, amenities: u.amenities,
      spaces: u.spaces.map(s => ({ ...s, lease: s.leases[0] || null, leases: undefined })),
    });
  }
  const all = units.flatMap(u => u.spaces);
  res.json({
    buildings: Object.values(byBuilding),
    totals: {
      spaces: all.length,
      occupied: all.filter(s => s.status === 'OCCUPIED').length,
      available: all.filter(s => s.status === 'AVAILABLE').length,
      reserved: all.filter(s => s.status === 'RESERVED').length,
      notReady: all.filter(s => s.status === 'NOT_READY').length,
    },
  });
}));

crudRouter({
  router: spacesRouter,
  model: 'space',
  spec: {
    unitId: { type: 'id', required: true }, code: { type: 'string', required: true },
    kind: 'enum', monthlyRate: { type: 'number', required: true }, deposit: 'number',
    capacity: 'int', amenities: 'string', status: 'enum', availableFrom: 'date', notes: 'string',
  },
  include: { unit: { include: { building: true } }, leases: { include: { tenant: true }, orderBy: { startDate: 'desc' } } },
  filters: ['unitId', 'status', 'kind'],
  orderBy: { code: 'asc' },
});

module.exports = { buildings, landlords, units: unitsRouter, spaces: spacesRouter };
