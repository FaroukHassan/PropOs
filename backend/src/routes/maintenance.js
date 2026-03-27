// backend/src/routes/maintenance.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { status, priority, propertyId } = req.query;
    const where = {
      unit: { property: { orgId: req.user.orgId } },
    };
    if (status)     where.status   = status;
    if (priority)   where.priority  = priority;
    if (propertyId) where.unit      = { ...where.unit, propertyId };

    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: { unit: { include: { property: { select: { id: true, name: true } } } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(requests);
  } catch (err) { next(err); }
});

router.post('/', [
  body('unitId').notEmpty(),
  body('title').notEmpty(),
  body('category').notEmpty(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const request = await prisma.maintenanceRequest.create({ data: req.body });
    res.status(201).json(request);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.status === 'RESOLVED') data.resolvedAt = new Date();
    const request = await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data });
    res.json(request);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.maintenanceRequest.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
