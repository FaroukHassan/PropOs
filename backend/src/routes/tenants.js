// backend/src/routes/tenants.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { orgId: req.user.orgId },
      include: {
        leases: {
          include: { unit: { include: { property: true } } },
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tenants);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: req.params.id, orgId: req.user.orgId },
      include: {
        leases: { include: { unit: { include: { property: true } }, payments: { take: 12, orderBy: { dueDate: 'desc' } } } },
      },
    });
    res.json(tenant);
  } catch (err) { next(err); }
});

router.post('/', [
  body('name').notEmpty(),
  body('email').isEmail(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const tenant = await prisma.tenant.create({ data: { ...req.body, orgId: req.user.orgId } });
    res.status(201).json(tenant);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: req.body });
    res.json(tenant);
  } catch (err) { next(err); }
});

module.exports = router;
