// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const SECRET = JWT_SECRET || 'dev-only-secret';

const signToken = payload => jwt.sign(payload, SECRET, { expiresIn: '7d' });

// Confirm the account still exists and use its current role, so removing someone or changing
// their access takes effect straight away. Cached for 30 seconds to keep requests fast.
const prisma = require('../db');
const seen = new Map();
async function currentUser(id) {
  const hit = seen.get(id);
  if (hit && Date.now() - hit.at < 30000) return hit.user;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, orgId: true, role: true } });
  seen.set(id, { user, at: Date.now() });
  return user;
}
const forgetUser = id => seen.delete(id);

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not signed in' });
  let payload;
  try {
    payload = jwt.verify(header.slice(7), SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
  try {
    const user = await currentUser(payload.id);
    if (!user) return res.status(401).json({ error: 'This account no longer exists' });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

// VIEWERs can read but not change anything
function writeGuard(req, res, next) {
  if (req.method !== 'GET' && req.user.role === 'VIEWER') {
    return res.status(403).json({ error: 'Your account is read-only' });
  }
  next();
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed' });

module.exports = { signToken, authenticate, writeGuard, requireRole, forgetUser };
