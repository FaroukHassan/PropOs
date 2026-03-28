// backend/src/middleware/tenant.js
// Resolves the current tenant (Org) from the subdomain or X-Tenant header.
// E.g. sakanly.propos.app → slug "sakanly" → looks up Org with that slug.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Extracts tenant slug from:
 *   1. X-Tenant header (useful for dev/testing)
 *   2. Subdomain of MAIN_DOMAIN env var
 */
function extractSlug(req) {
  // Header override (for dev & testing)
  const headerSlug = req.headers['x-tenant'];
  if (headerSlug) return headerSlug.toLowerCase();

  // Subdomain extraction
  const host = req.hostname; // e.g. "sakanly.propos.app"
  const mainDomain = process.env.MAIN_DOMAIN; // e.g. "propos.app"
  if (mainDomain && host.endsWith(mainDomain) && host !== mainDomain) {
    const sub = host.slice(0, -(mainDomain.length + 1)); // remove ".propos.app"
    if (sub && !sub.includes('.')) return sub.toLowerCase();
  }

  return null;
}

/**
 * Middleware: resolves tenant from subdomain → Org record.
 * Sets req.tenant = { id, name, slug, plan }
 * If no subdomain detected, skips (allows global routes like auth/register).
 */
async function resolveTenant(req, res, next) {
  const slug = extractSlug(req);
  if (!slug) return next(); // no subdomain → proceed without tenant scope

  try {
    const org = await prisma.org.findUnique({ where: { slug } });
    if (!org) {
      return res.status(404).json({ error: `Tenant "${slug}" not found` });
    }
    req.tenant = { id: org.id, name: org.name, slug: org.slug, plan: org.plan };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveTenant, extractSlug };
