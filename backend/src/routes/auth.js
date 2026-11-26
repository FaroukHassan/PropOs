// backend/src/routes/auth.js — sign-in and team accounts (internal team only, no public sign-up)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { ah, HttpError } = require('../middleware/errorHandler');
const { signToken, authenticate, requireRole, forgetUser } = require('../middleware/auth');
const ROLES = ['ADMIN', 'MANAGER', 'VIEWER'];

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// Simple in-memory throttle on failed logins: 10 failures per email per 15 minutes
const failures = new Map();
function tooMany(email) {
  const f = failures.get(email);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60000) { failures.delete(email); return false; }
  return f.count >= 10;
}
function recordFailure(email) {
  const f = failures.get(email);
  if (!f || Date.now() - f.first > 15 * 60000) failures.set(email, { count: 1, first: Date.now() });
  else f.count++;
}

router.post('/login', ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(422, 'Email and password are required');
  if (tooMany(email)) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');

  const user = await prisma.user.findUnique({ where: { email }, include: { org: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFailure(email);
    throw new HttpError(401, 'Wrong email or password');
  }
  failures.delete(email);
  const token = signToken({ id: user.id, orgId: user.orgId, role: user.role });
  res.json({ token, user: { ...publicUser(user), org: { name: user.org.name, currency: user.org.currency } } });
}));

router.get('/me', authenticate, ah(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { org: true } });
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ ...publicUser(user), org: { name: user.org.name, currency: user.org.currency } });
}));

router.post('/password', authenticate, ah(async (req, res) => {
  const { current, next } = req.body;
  if (!next || String(next).length < 8) throw new HttpError(422, 'New password must be at least 8 characters');
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(String(current || ''), user.passwordHash))) throw new HttpError(401, 'Current password is wrong');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(String(next), 12) } });
  res.json({ ok: true });
}));

// ─── Team management (admins) ────────────────────────────────────────────────
router.get('/users', authenticate, ah(async (req, res) => {
  const users = await prisma.user.findMany({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'asc' } });
  res.json(users.map(publicUser));
}));

router.post('/users', authenticate, requireRole('ADMIN'), ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { name, password, role = 'MANAGER' } = req.body;
  if (!email || !name) throw new HttpError(422, 'Name and email are required');
  if (!password || String(password).length < 8) throw new HttpError(422, 'Password must be at least 8 characters');
  if (!ROLES.includes(role)) throw new HttpError(422, 'Unknown role');
  const user = await prisma.user.create({
    data: { email, name, role, orgId: req.user.orgId, passwordHash: await bcrypt.hash(String(password), 12) },
  });
  res.status(201).json(publicUser(user));
}));

router.patch('/users/:id', authenticate, requireRole('ADMIN'), ah(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
  if (!user) throw new HttpError(404, 'User not found');
  const data = {};
  if (req.body.name) data.name = req.body.name;
  if (req.body.role) {
    if (!ROLES.includes(req.body.role)) throw new HttpError(422, 'Unknown role');
    if (user.id === req.user.id && req.body.role !== 'ADMIN') throw new HttpError(422, 'You cannot remove your own admin access');
    data.role = req.body.role;
  }
  if (req.body.password) {
    if (String(req.body.password).length < 8) throw new HttpError(422, 'Password must be at least 8 characters');
    data.passwordHash = await bcrypt.hash(String(req.body.password), 12);
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  forgetUser(user.id);
  res.json(publicUser(updated));
}));

router.delete('/users/:id', authenticate, requireRole('ADMIN'), ah(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(422, 'You cannot delete your own account');
  const user = await prisma.user.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
  if (!user) throw new HttpError(404, 'User not found');
  await prisma.user.delete({ where: { id: user.id } });
  forgetUser(user.id);
  res.status(204).send();
}));

module.exports = router;
