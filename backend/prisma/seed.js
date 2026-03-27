// backend/prisma/seed.js
// Run: node prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Org + Admin user
  const org = await prisma.org.create({ data: { name: 'Nile Properties LLC', plan: 'PRO' } });
  const passwordHash = await bcrypt.hash('password123', 12);
  await prisma.user.create({ data: { email: 'admin@nileprops.com', passwordHash, name: 'Ahmed Hassan', role: 'ADMIN', orgId: org.id } });

  // Properties
  const towerA = await prisma.property.create({ data: { name: 'Nile Tower A', address: '12 Tahrir Street', city: 'Cairo', type: 'RESIDENTIAL', orgId: org.id } });
  const villas = await prisma.property.create({ data: { name: 'Garden Villas',  address: '5 Palm Avenue',   city: 'Giza',  type: 'RESIDENTIAL', orgId: org.id } });

  // Units
  const units = await Promise.all([
    prisma.unit.create({ data: { propertyId: towerA.id, number: '3B', floor: 3, bedrooms: 2, bathrooms: 1,   sqft: 900,  rentAmount: 1850 } }),
    prisma.unit.create({ data: { propertyId: towerA.id, number: '1C', floor: 1, bedrooms: 1, bathrooms: 1,   sqft: 650,  rentAmount: 1600 } }),
    prisma.unit.create({ data: { propertyId: villas.id, number: '7A', floor: 1, bedrooms: 3, bathrooms: 2,   sqft: 1400, rentAmount: 2100 } }),
    prisma.unit.create({ data: { propertyId: villas.id, number: '5D', floor: 1, bedrooms: 2, bathrooms: 1.5, sqft: 1100, rentAmount: 2400 } }),
  ]);

  // Tenants
  const tenants = await Promise.all([
    prisma.tenant.create({ data: { name: 'Sarah Johnson', email: 'sarah@email.com', phone: '+1 555 0101', orgId: org.id } }),
    prisma.tenant.create({ data: { name: 'Lena Torres',   email: 'lena@email.com',  phone: '+1 555 0102', orgId: org.id } }),
    prisma.tenant.create({ data: { name: 'Mike Chen',     email: 'mike@email.com',  phone: '+1 555 0103', orgId: org.id } }),
    prisma.tenant.create({ data: { name: 'Omar Khalil',   email: 'omar@email.com',  phone: '+20 100 123', orgId: org.id } }),
  ]);

  // Leases
  const leases = await Promise.all([
    prisma.lease.create({ data: { unitId: units[0].id, tenantId: tenants[0].id, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), rentAmount: 1850, deposit: 3700 } }),
    prisma.lease.create({ data: { unitId: units[1].id, tenantId: tenants[1].id, startDate: new Date('2023-06-01'), endDate: new Date('2025-05-31'), rentAmount: 1600, deposit: 3200 } }),
    prisma.lease.create({ data: { unitId: units[2].id, tenantId: tenants[2].id, startDate: new Date('2024-03-01'), endDate: new Date('2026-02-28'), rentAmount: 2100, deposit: 4200 } }),
    prisma.lease.create({ data: { unitId: units[3].id, tenantId: tenants[3].id, startDate: new Date('2022-09-01'), endDate: new Date('2025-08-31'), rentAmount: 2400, deposit: 4800 } }),
  ]);

  // Payments (current month)
  const thisMonth = new Date(); thisMonth.setDate(1);
  await Promise.all([
    prisma.payment.create({ data: { leaseId: leases[0].id, amount: 1850, dueDate: thisMonth, status: 'PAID', paidDate: new Date(), method: 'BANK_TRANSFER' } }),
    prisma.payment.create({ data: { leaseId: leases[1].id, amount: 1600, dueDate: thisMonth, status: 'LATE' } }),
    prisma.payment.create({ data: { leaseId: leases[2].id, amount: 2100, dueDate: thisMonth, status: 'PAID', paidDate: new Date(), method: 'BANK_TRANSFER' } }),
    prisma.payment.create({ data: { leaseId: leases[3].id, amount: 2400, dueDate: thisMonth, status: 'OVERDUE' } }),
  ]);

  // Maintenance
  await Promise.all([
    prisma.maintenanceRequest.create({ data: { unitId: units[0].id, title: 'Boiler not working', category: 'HVAC',     priority: 'URGENT', status: 'OPEN' } }),
    prisma.maintenanceRequest.create({ data: { unitId: units[1].id, title: 'Leaking faucet',     category: 'PLUMBING', priority: 'HIGH',   status: 'IN_PROGRESS' } }),
    prisma.maintenanceRequest.create({ data: { unitId: units[2].id, title: 'Light bulb out',     category: 'ELECTRICAL',priority:'NORMAL', status: 'OPEN' } }),
  ]);

  // Expenses
  const expDate = new Date(); expDate.setDate(15);
  await Promise.all([
    prisma.expense.create({ data: { orgId: org.id, category: 'INSURANCE',   description: 'Monthly property insurance', amount: 2100, date: expDate } }),
    prisma.expense.create({ data: { orgId: org.id, category: 'MAINTENANCE', description: 'Plumbing repair Unit 1C',    amount: 380,  date: expDate, vendor: 'ABC Plumbing' } }),
    prisma.expense.create({ data: { orgId: org.id, category: 'UTILITIES',   description: 'Common area electricity',    amount: 620,  date: expDate } }),
  ]);

  console.log('✅ Seed complete!');
  console.log('   Login: admin@nileprops.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
