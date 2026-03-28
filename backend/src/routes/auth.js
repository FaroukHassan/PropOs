// backend/src/routes/auth.js
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { signToken, authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty(),
  body('orgName').notEmpty(),
  body('slug').optional().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email, password, name, orgName, slug } = req.body;
    const orgSlug = slug || orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const existingOrg = await prisma.org.findUnique({ where: { slug: orgSlug } });
    if (existingOrg) return res.status(409).json({ error: 'Organization slug already taken' });

    const passwordHash = await bcrypt.hash(password, 12);

    const org = await prisma.org.create({ data: { name: orgName, slug: orgSlug } });
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'ADMIN', orgId: org.id },
    });

    const token = signToken({ id: user.id, orgId: org.id, role: user.role });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, orgId: user.orgId, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, org: { select: { id: true, name: true, plan: true } } },
    });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
