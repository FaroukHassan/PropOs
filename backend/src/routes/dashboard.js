// backend/src/routes/dashboard.js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { startOfMonth, endOfMonth } = require('date-fns');

const prisma = new PrismaClient();

// GET /api/dashboard
router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    properties,
    units,
    activeLeases,
    monthlyPayments,
    openMaintenance,
    expiringLeases,
    overduePayments,
  ] = await Promise.all([
    prisma.property.count({ where: { orgId, isActive: true } }),
    prisma.unit.findMany({
      where: { property: { orgId } },
      select: { status: true, baseRent: true },
    }),
    prisma.lease.count({ where: { unit: { property: { orgId } }, status: 'active' } }),
    prisma.payment.findMany({
      where: {
        lease: { unit: { property: { orgId } } },
        dueDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { unit: { property: { orgId } }, status: { in: ['open', 'in_progress'] } },
      include: { unit: { include: { property: { select: { name: true } } } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.lease.findMany({
      where: {
        unit: { property: { orgId } },
        status: 'active',
        endDate: { lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) }, // next 60 days
      },
      include: {
        tenant: { select: { firstName: true, lastName: true } },
        unit: { select: { unitNumber: true }, include: { property: { select: { name: true } } } },
      },
      orderBy: { endDate: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        lease: { unit: { property: { orgId } } },
        status: { in: ['overdue', 'late'] },
      },
      include: {
        tenant: { select: { firstName: true, lastName: true } },
        lease: { include: { unit: { select: { unitNumber: true } } } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    }),
  ]);

  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0;

  const monthlyRevenue = monthlyPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const expectedRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const collectionRate = expectedRevenue > 0 ? Math.round((monthlyRevenue / expectedRevenue) * 1000) / 10 : 0;

  res.json({
    kpis: {
      totalProperties: properties,
      totalUnits,
      occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      occupancyRate,
      activeLeases,
      monthlyRevenue,
      collectionRate,
      openMaintenance: openMaintenance.length,
      overdueCount: overduePayments.length,
    },
    recentMaintenance: openMaintenance,
    expiringLeases,
    overduePayments,
  });
}));

module.exports = router;
