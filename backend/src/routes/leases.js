// backend/src/routes/leases.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/leases?status=ACTIVE&expiringDays=30
router.get('/', async (req, res, next) => {
  try {
    const { status, expiringDays } = req.query;
    const where = {};

    if (status) where.status = status;

    if (expiringDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + parseInt(expiringDays));
      where.endDate = { lte: cutoff };
      where.status = 'ACTIVE';
    }

    const leases = await prisma.lease.findMany({
      where: {
        ...where,
        unit: { property: { orgId: req.user.orgId } },
      },
      include: {
        tenant: true,
        unit: { include: { property: { select: { id: true, name: true, address: true } } } },
      },
      orderBy: { endDate: 'asc' },
    });
    res.json(leases);
  } catch (err) { next(err); }
});

// POST /api/leases
router.post('/', [
  body('unitId').notEmpty(),
  body('tenantId').notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('rentAmount').isFloat({ min: 0 }),
  body('deposit').isFloat({ min: 0 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { unitId, tenantId, startDate, endDate, rentAmount, deposit } = req.body;

    // Auto-generate monthly payment records for the lease duration
    const lease = await prisma.lease.create({
      data: { unitId, tenantId, startDate: new Date(startDate), endDate: new Date(endDate), rentAmount, deposit },
    });

    // Generate payment schedule
    const payments = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const cur = new Date(start);
    while (cur <= end) {
      payments.push({ leaseId: lease.id, amount: rentAmount, dueDate: new Date(cur), status: 'PENDING' });
      cur.setMonth(cur.getMonth() + 1);
    }
    await prisma.payment.createMany({ data: payments });

    res.status(201).json(lease);
  } catch (err) { next(err); }
});

// PATCH /api/leases/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const lease = await prisma.lease.update({ where: { id: req.params.id }, data: req.body });
    res.json(lease);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/terminate
router.post('/:id/terminate', async (req, res, next) => {
  try {
    const lease = await prisma.lease.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED' },
    });
    // Cancel future unpaid payments
    await prisma.payment.updateMany({
      where: { leaseId: req.params.id, status: 'PENDING', dueDate: { gte: new Date() } },
      data: { status: 'WAIVED' },
    });
    res.json(lease);
  } catch (err) { next(err); }
});

module.exports = router;
