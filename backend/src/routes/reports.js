// backend/src/routes/reports.js
// Reports generate structured JSON that the frontend can render as PDF
// (use react-pdf or the browser's print dialog on the frontend)

const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/reports/financial?year=2025&month=4
router.get('/financial', async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const from  = new Date(year, month - 1, 1);
    const to    = new Date(year, month, 1);

    const [payments, expenses, org] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'PAID', paidDate: { gte: from, lt: to }, lease: { unit: { property: { orgId: req.user.orgId } } } },
        include: { lease: { include: { tenant: true, unit: { include: { property: { select: { name: true } } } } } } },
      }),
      prisma.expense.findMany({
        where: { orgId: req.user.orgId, date: { gte: from, lt: to } },
      }),
      prisma.org.findUnique({ where: { id: req.user.orgId } }),
    ]);

    const totalRevenue  = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      org,
      period: { year, month, from, to },
      revenue: { total: totalRevenue, items: payments },
      expenses: { total: totalExpenses, items: expenses },
      noi: totalRevenue - totalExpenses,
      generatedAt: new Date(),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/occupancy
router.get('/occupancy', async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { orgId: req.user.orgId },
      include: {
        units: {
          include: { leases: { where: { status: 'ACTIVE' }, take: 1 } },
        },
      },
    });

    const report = properties.map(p => {
      const total    = p.units.length;
      const occupied = p.units.filter(u => u.leases.length > 0).length;
      return { id: p.id, name: p.name, address: p.address, totalUnits: total, occupiedUnits: occupied, vacantUnits: total - occupied, occupancyRate: total > 0 ? (occupied / total) * 100 : 0 };
    });

    const totalUnits    = report.reduce((s, p) => s + p.totalUnits, 0);
    const occupiedUnits = report.reduce((s, p) => s + p.occupiedUnits, 0);

    res.json({
      summary: { totalUnits, occupiedUnits, vacantUnits: totalUnits - occupiedUnits, overallOccupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0 },
      properties: report,
      generatedAt: new Date(),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/lease-expirations?days=90
router.get('/lease-expirations', async (req, res, next) => {
  try {
    const days   = parseInt(req.query.days || 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const leases = await prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: cutoff },
        unit: { property: { orgId: req.user.orgId } },
      },
      include: { tenant: true, unit: { include: { property: { select: { name: true, address: true } } } } },
      orderBy: { endDate: 'asc' },
    });
    res.json({ leases, count: leases.length, generatedAt: new Date() });
  } catch (err) { next(err); }
});

module.exports = router;
