// backend/src/routes/properties.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/properties
router.get('/', async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { orgId: req.user.orgId },
      include: {
        units: {
          include: {
            leases: { where: { status: 'ACTIVE' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with computed stats
    const enriched = properties.map(p => ({
      ...p,
      totalUnits: p.units.length,
      occupiedUnits: p.units.filter(u => u.leases.length > 0).length,
      monthlyRevenue: p.units
        .flatMap(u => u.leases)
        .reduce((sum, l) => sum + l.rentAmount, 0),
    }));

    res.json(enriched);
  } catch (err) { next(err); }
});

// GET /api/properties/:id
router.get('/:id', async (req, res, next) => {
  try {
    const property = await prisma.property.findFirstOrThrow({
      where: { id: req.params.id, orgId: req.user.orgId },
      include: {
        units: {
          include: {
            leases: { include: { tenant: true }, where: { status: 'ACTIVE' }, take: 1 },
            maintenance: { where: { status: { not: 'CLOSED' } } },
          },
        },
      },
    });
    res.json(property);
  } catch (err) { next(err); }
});

// POST /api/properties
router.post('/', [
  body('name').notEmpty(),
  body('address').notEmpty(),
  body('city').notEmpty(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { name, address, city, type } = req.body;
    const property = await prisma.property.create({
      data: { name, address, city, type: type || 'RESIDENTIAL', orgId: req.user.orgId },
    });
    res.status(201).json(property);
  } catch (err) { next(err); }
});

// PATCH /api/properties/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, address, city, type } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { name, address, city, type },
    });
    res.json(property);
  } catch (err) { next(err); }
});

// DELETE /api/properties/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.property.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/properties/:id/units — add a unit to property
router.post('/:id/units', [
  body('number').notEmpty(),
  body('rentAmount').isFloat({ min: 0 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { number, floor, bedrooms, bathrooms, sqft, rentAmount } = req.body;
    const unit = await prisma.unit.create({
      data: { propertyId: req.params.id, number, floor, bedrooms, bathrooms, sqft, rentAmount },
    });
    res.status(201).json(unit);
  } catch (err) { next(err); }
});

module.exports = router;
