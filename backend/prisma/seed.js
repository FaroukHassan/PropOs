// backend/prisma/seed.js
// Run: node prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // ─── Org 1: Sakanly (Farouk's company) ─────────────────────────────────────
  const sakanly = await prisma.org.upsert({
    where: { slug: 'sakanly' },
    update: {},
    create: { name: 'Sakanly', slug: 'sakanly', plan: 'PRO' },
  });

  await prisma.user.upsert({
    where: { email: 'farouk@sakanly.com' },
    update: {},
    create: {
      email: 'farouk@sakanly.com',
      passwordHash,
      name: 'Farouk Hassan',
      role: 'ADMIN',
      orgId: sakanly.id,
    },
  });

  // Sakanly Properties
  const nileView = await prisma.property.create({
    data: { name: 'Nile View Residences', address: '45 Corniche El Nil', city: 'Cairo', type: 'RESIDENTIAL', orgId: sakanly.id },
  });
  const madiApts = await prisma.property.create({
    data: { name: 'Maadi Garden Apartments', address: '12 Street 9', city: 'Maadi', type: 'RESIDENTIAL', orgId: sakanly.id },
  });
  const tagamo3 = await prisma.property.create({
    data: { name: 'Tagamoa Business Center', address: '88 90th Street', city: 'New Cairo', type: 'COMMERCIAL', orgId: sakanly.id },
  });
  const sahel = await prisma.property.create({
    data: { name: 'Sahel Beach Villas', address: 'Marina 5, KM 130', city: 'North Coast', type: 'SHORT_TERM', orgId: sakanly.id },
  });

  // Sakanly Units
  const sUnits = await Promise.all([
    prisma.unit.create({ data: { propertyId: nileView.id,  number: '12A', floor: 12, bedrooms: 3, bathrooms: 2,   sqft: 1800, rentAmount: 4500 } }),
    prisma.unit.create({ data: { propertyId: nileView.id,  number: '8B',  floor: 8,  bedrooms: 2, bathrooms: 1,   sqft: 1200, rentAmount: 3200 } }),
    prisma.unit.create({ data: { propertyId: nileView.id,  number: '3C',  floor: 3,  bedrooms: 1, bathrooms: 1,   sqft: 750,  rentAmount: 2100 } }),
    prisma.unit.create({ data: { propertyId: madiApts.id,  number: 'G1',  floor: 0,  bedrooms: 3, bathrooms: 2,   sqft: 1600, rentAmount: 3800 } }),
    prisma.unit.create({ data: { propertyId: madiApts.id,  number: 'A5',  floor: 2,  bedrooms: 2, bathrooms: 1.5, sqft: 1100, rentAmount: 2800 } }),
    prisma.unit.create({ data: { propertyId: tagamo3.id,   number: 'OF-1', floor: 1, bedrooms: 0, bathrooms: 1,   sqft: 600,  rentAmount: 5000 } }),
    prisma.unit.create({ data: { propertyId: tagamo3.id,   number: 'OF-2', floor: 2, bedrooms: 0, bathrooms: 1,   sqft: 450,  rentAmount: 3500 } }),
    prisma.unit.create({ data: { propertyId: sahel.id,     number: 'V-01', floor: 1, bedrooms: 4, bathrooms: 3,   sqft: 2200, rentAmount: 8000 } }),
    prisma.unit.create({ data: { propertyId: sahel.id,     number: 'V-02', floor: 1, bedrooms: 3, bathrooms: 2,   sqft: 1800, rentAmount: 6500 } }),
  ]);

  // Sakanly Tenants
  const sTenants = await Promise.all([
    prisma.tenant.create({ data: { name: 'Ahmed Mostafa',    email: 'ahmed.m@email.com',    phone: '+20 100 111 2233', orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'Nour El-Din',      email: 'nour@email.com',       phone: '+20 100 222 3344', orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'Yasmin Khalil',    email: 'yasmin.k@email.com',   phone: '+20 100 333 4455', orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'Hassan Ibrahim',   email: 'hassan.i@email.com',   phone: '+20 100 444 5566', orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'Sara Abdel-Fattah',email: 'sara.af@email.com',    phone: '+20 100 555 6677', orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'TechStart Inc.',   email: 'info@techstart.com',   phone: '+20 2 2222 3333',  orgId: sakanly.id } }),
    prisma.tenant.create({ data: { name: 'Global Imports Co.',email:'contact@globalimports.com', phone: '+20 2 3333 4444', orgId: sakanly.id } }),
  ]);

  // Sakanly Leases
  const sLeases = await Promise.all([
    prisma.lease.create({ data: { unitId: sUnits[0].id, tenantId: sTenants[0].id, startDate: new Date('2025-01-01'), endDate: new Date('2026-12-31'), rentAmount: 4500, deposit: 9000 } }),
    prisma.lease.create({ data: { unitId: sUnits[1].id, tenantId: sTenants[1].id, startDate: new Date('2025-03-01'), endDate: new Date('2026-02-28'), rentAmount: 3200, deposit: 6400 } }),
    prisma.lease.create({ data: { unitId: sUnits[2].id, tenantId: sTenants[2].id, startDate: new Date('2024-06-01'), endDate: new Date('2026-05-31'), rentAmount: 2100, deposit: 4200 } }),
    prisma.lease.create({ data: { unitId: sUnits[3].id, tenantId: sTenants[3].id, startDate: new Date('2025-02-01'), endDate: new Date('2027-01-31'), rentAmount: 3800, deposit: 7600 } }),
    prisma.lease.create({ data: { unitId: sUnits[4].id, tenantId: sTenants[4].id, startDate: new Date('2024-09-01'), endDate: new Date('2025-08-31'), rentAmount: 2800, deposit: 5600 } }),
    prisma.lease.create({ data: { unitId: sUnits[5].id, tenantId: sTenants[5].id, startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), rentAmount: 5000, deposit: 15000 } }),
    prisma.lease.create({ data: { unitId: sUnits[6].id, tenantId: sTenants[6].id, startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), rentAmount: 3500, deposit: 10500 } }),
  ]);

  // Sakanly Payments (last 3 months)
  const now = new Date();
  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const dueDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const statuses = monthsAgo === 0
      ? ['PAID', 'PAID', 'LATE', 'PAID', 'PENDING', 'PAID', 'PENDING']
      : ['PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID'];

    await Promise.all(sLeases.map((lease, i) =>
      prisma.payment.create({
        data: {
          leaseId: lease.id,
          amount: lease.rentAmount,
          dueDate,
          status: statuses[i],
          ...(statuses[i] === 'PAID' ? { paidDate: new Date(dueDate.getFullYear(), dueDate.getMonth(), 3 + Math.floor(Math.random() * 5)), method: 'BANK_TRANSFER' } : {}),
        },
      })
    ));
  }

  // Sakanly Maintenance Requests
  await Promise.all([
    prisma.maintenanceRequest.create({ data: { unitId: sUnits[0].id, title: 'AC not cooling properly',    description: 'The AC in the master bedroom blows warm air', category: 'HVAC',       priority: 'HIGH',   status: 'OPEN' } }),
    prisma.maintenanceRequest.create({ data: { unitId: sUnits[1].id, title: 'Water leak in bathroom',     description: 'Small leak under the bathroom sink',          category: 'PLUMBING',   priority: 'URGENT', status: 'IN_PROGRESS', assignedTo: 'Mohamed Plumbing Co.' } }),
    prisma.maintenanceRequest.create({ data: { unitId: sUnits[3].id, title: 'Broken door lock',           description: 'Front door lock is jammed',                    category: 'GENERAL',    priority: 'HIGH',   status: 'OPEN' } }),
    prisma.maintenanceRequest.create({ data: { unitId: sUnits[5].id, title: 'Flickering office lights',   description: 'Fluorescent lights in main area flickering',   category: 'ELECTRICAL', priority: 'NORMAL', status: 'RESOLVED', resolvedAt: new Date(), cost: 350 } }),
    prisma.maintenanceRequest.create({ data: { unitId: sUnits[7].id, title: 'Pool filter needs cleaning', description: 'Villa pool filter clogged',                    category: 'GENERAL',    priority: 'NORMAL', status: 'OPEN' } }),
  ]);

  // Sakanly Expenses
  const expDate = new Date();
  await Promise.all([
    prisma.expense.create({ data: { orgId: sakanly.id, category: 'INSURANCE',   description: 'Building insurance — Nile View',       amount: 4200, date: expDate } }),
    prisma.expense.create({ data: { orgId: sakanly.id, category: 'MAINTENANCE', description: 'HVAC annual service — all buildings',   amount: 2800, date: expDate, vendor: 'CoolTech HVAC' } }),
    prisma.expense.create({ data: { orgId: sakanly.id, category: 'UTILITIES',   description: 'Common area electricity — March',      amount: 1450, date: expDate } }),
    prisma.expense.create({ data: { orgId: sakanly.id, category: 'TAX',         description: 'Property tax Q1 2026',                 amount: 6300, date: expDate } }),
    prisma.expense.create({ data: { orgId: sakanly.id, category: 'MANAGEMENT',  description: 'Property management software license', amount: 500,  date: expDate } }),
  ]);

  // ─── Org 2: Demo Org (Nile Properties — original demo data) ────────────────
  const demoOrg = await prisma.org.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Nile Properties LLC', slug: 'demo', plan: 'PRO' },
  });

  await prisma.user.upsert({
    where: { email: 'admin@nileprops.com' },
    update: {},
    create: {
      email: 'admin@nileprops.com',
      passwordHash,
      name: 'Ahmed Hassan',
      role: 'ADMIN',
      orgId: demoOrg.id,
    },
  });

  const towerA = await prisma.property.create({ data: { name: 'Nile Tower A', address: '12 Tahrir Street', city: 'Cairo', type: 'RESIDENTIAL', orgId: demoOrg.id } });
  const villas = await prisma.property.create({ data: { name: 'Garden Villas', address: '5 Palm Avenue', city: 'Giza', type: 'RESIDENTIAL', orgId: demoOrg.id } });

  const dUnits = await Promise.all([
    prisma.unit.create({ data: { propertyId: towerA.id, number: '3B', floor: 3, bedrooms: 2, bathrooms: 1,   sqft: 900,  rentAmount: 1850 } }),
    prisma.unit.create({ data: { propertyId: towerA.id, number: '1C', floor: 1, bedrooms: 1, bathrooms: 1,   sqft: 650,  rentAmount: 1600 } }),
    prisma.unit.create({ data: { propertyId: villas.id, number: '7A', floor: 1, bedrooms: 3, bathrooms: 2,   sqft: 1400, rentAmount: 2100 } }),
    prisma.unit.create({ data: { propertyId: villas.id, number: '5D', floor: 1, bedrooms: 2, bathrooms: 1.5, sqft: 1100, rentAmount: 2400 } }),
  ]);

  const dTenants = await Promise.all([
    prisma.tenant.create({ data: { name: 'Sarah Johnson', email: 'sarah@email.com', phone: '+1 555 0101', orgId: demoOrg.id } }),
    prisma.tenant.create({ data: { name: 'Lena Torres',   email: 'lena@email.com',  phone: '+1 555 0102', orgId: demoOrg.id } }),
    prisma.tenant.create({ data: { name: 'Mike Chen',     email: 'mike@email.com',  phone: '+1 555 0103', orgId: demoOrg.id } }),
    prisma.tenant.create({ data: { name: 'Omar Khalil',   email: 'omar@email.com',  phone: '+20 100 123', orgId: demoOrg.id } }),
  ]);

  const dLeases = await Promise.all([
    prisma.lease.create({ data: { unitId: dUnits[0].id, tenantId: dTenants[0].id, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), rentAmount: 1850, deposit: 3700 } }),
    prisma.lease.create({ data: { unitId: dUnits[1].id, tenantId: dTenants[1].id, startDate: new Date('2023-06-01'), endDate: new Date('2025-05-31'), rentAmount: 1600, deposit: 3200 } }),
    prisma.lease.create({ data: { unitId: dUnits[2].id, tenantId: dTenants[2].id, startDate: new Date('2024-03-01'), endDate: new Date('2026-02-28'), rentAmount: 2100, deposit: 4200 } }),
    prisma.lease.create({ data: { unitId: dUnits[3].id, tenantId: dTenants[3].id, startDate: new Date('2022-09-01'), endDate: new Date('2025-08-31'), rentAmount: 2400, deposit: 4800 } }),
  ]);

  const thisMonth = new Date(); thisMonth.setDate(1);
  await Promise.all([
    prisma.payment.create({ data: { leaseId: dLeases[0].id, amount: 1850, dueDate: thisMonth, status: 'PAID', paidDate: new Date(), method: 'BANK_TRANSFER' } }),
    prisma.payment.create({ data: { leaseId: dLeases[1].id, amount: 1600, dueDate: thisMonth, status: 'LATE' } }),
    prisma.payment.create({ data: { leaseId: dLeases[2].id, amount: 2100, dueDate: thisMonth, status: 'PAID', paidDate: new Date(), method: 'BANK_TRANSFER' } }),
    prisma.payment.create({ data: { leaseId: dLeases[3].id, amount: 2400, dueDate: thisMonth, status: 'OVERDUE' } }),
  ]);

  await Promise.all([
    prisma.maintenanceRequest.create({ data: { unitId: dUnits[0].id, title: 'Boiler not working', description: 'Boiler not heating', category: 'HVAC', priority: 'URGENT', status: 'OPEN' } }),
    prisma.maintenanceRequest.create({ data: { unitId: dUnits[1].id, title: 'Leaking faucet', description: 'Kitchen faucet dripping', category: 'PLUMBING', priority: 'HIGH', status: 'IN_PROGRESS' } }),
    prisma.maintenanceRequest.create({ data: { unitId: dUnits[2].id, title: 'Light bulb out', description: 'Living room light out', category: 'ELECTRICAL', priority: 'NORMAL', status: 'OPEN' } }),
  ]);

  await Promise.all([
    prisma.expense.create({ data: { orgId: demoOrg.id, category: 'INSURANCE',   description: 'Monthly property insurance', amount: 2100, date: expDate } }),
    prisma.expense.create({ data: { orgId: demoOrg.id, category: 'MAINTENANCE', description: 'Plumbing repair Unit 1C',    amount: 380,  date: expDate, vendor: 'ABC Plumbing' } }),
    prisma.expense.create({ data: { orgId: demoOrg.id, category: 'UTILITIES',   description: 'Common area electricity',    amount: 620,  date: expDate } }),
  ]);

  console.log('✅ Seed complete!');
  console.log('');
  console.log('   Sakanly (Farouk):  farouk@sakanly.com / password123');
  console.log('   Demo org:          admin@nileprops.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
