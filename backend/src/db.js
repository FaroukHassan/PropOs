// backend/src/db.js — one shared Prisma client.
// In production Prisma uses its normal engine. Set PRISMA_USE_ADAPTER=1 to run through
// the node-postgres driver adapter instead (used for local testing without engine downloads).
const { PrismaClient } = require('@prisma/client');

let prisma;
if (process.env.PRISMA_USE_ADAPTER) {
  const { PrismaPg } = require('@prisma/adapter-pg');
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
} else {
  prisma = new PrismaClient();
}

module.exports = prisma;
