// backend/prisma/seed.js
// Creates the Sakanly organisation and team logins. Safe to run more than once.
//   node prisma/seed.js            → org + users only (use this for the real system)
//   SEED_DEMO=1 node prisma/seed.js → also adds sample buildings, tenants and money (for trying it out)
// Passwords: set SEED_PASSWORD, otherwise a random one is generated for each new user and printed once.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../src/db');

const TEAM = [
  { name: 'Farouk Hassan', email: 'farouk@sakanly.com', role: 'ADMIN' },
  { name: 'Mohamed Khalil', email: 'khalil@sakanly.com', role: 'ADMIN' },
  { name: 'Ahmed Fawzy', email: 'info@sakanly.com', role: 'MANAGER' },
];

const d = s => new Date(`${s}T00:00:00Z`);
const today = new Date();
const thisMonth = (day, offset = 0) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, day));

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: 'sakanly' },
    update: { name: 'Sakanly Real Estate' },
    create: { name: 'Sakanly Real Estate', slug: 'sakanly', currency: 'AED' },
  });

  for (const member of TEAM) {
    const exists = await prisma.user.findUnique({ where: { email: member.email } });
    if (exists) { console.log(`• ${member.email} already exists`); continue; }
    const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await prisma.user.create({ data: { ...member, orgId: org.id, passwordHash: await bcrypt.hash(password, 12) } });
    console.log(`✓ ${member.email}  password: ${password}`);
  }

  if (!process.env.SEED_DEMO) return;
  if (await prisma.building.count({ where: { orgId: org.id } })) {
    console.log('Sample data skipped: buildings already exist.');
    return;
  }
  const orgId = org.id;

  // ─── Buildings & landlords ────────────────────────────────────────────────
  const noura = await prisma.building.create({ data: { orgId, name: 'Sheikha Noura', area: 'Barsha Heights (TECOM)' } });
  const fahd = await prisma.building.create({ data: { orgId, name: 'Al Fahd 2', area: 'Barsha Heights (TECOM)' } });
  const atria = await prisma.building.create({ data: { orgId, name: 'Millennium Atria', area: 'Business Bay' } });
  const jvt = await prisma.building.create({ data: { orgId, name: 'Novotel Residences', area: 'JVT' } });

  const sultan = await prisma.landlord.create({ data: { orgId, name: 'Saeed Al Mansoori', phone: '+971 50 000 0001' } });
  const rashid = await prisma.landlord.create({ data: { orgId, name: 'Rashid Holdings', phone: '+971 50 000 0002' } });
  const owner = await prisma.landlord.create({ data: { orgId, name: 'Layla Haddad', phone: '+971 50 000 0003', email: 'owner@example.com' } });

  // ─── Partition apartments ─────────────────────────────────────────────────
  const partitionUnits = [
    { b: noura, number: '2803', landlord: rashid, rent: 120000, occ: 'MIX', spaces: 12, base: 1700 },
    { b: noura, number: '1904', landlord: rashid, rent: 115000, occ: 'MIX', spaces: 10, base: 1600 },
    { b: fahd, number: '706', landlord: sultan, rent: 95000, occ: 'MIX', spaces: 7, base: 1750 },
    { b: fahd, number: '811', landlord: sultan, rent: 90000, occ: 'LADIES', spaces: 6, base: 1800 },
  ];
  const tenantNames = ['Aisha Rahman', 'Omar Siddiqui', 'Priya Nair', 'Bilal Ahmed', 'Maria Santos', 'Youssef Adel', 'Farah Nasser', 'Joy Reyes',
    'Reem Adel', 'Kareem Nabil', 'Noor Ali', 'Rania Saleh', 'Ali Raza', 'Grace Mensah', 'Dana Karim', 'Samar Ismail', 'Manal Fathi',
    'Ruma Begum', 'Mei Lin', 'Huda Samir', 'Lina Haddad', 'Zainab Khan', 'Asma Qureshi', 'Rita Gomes', 'Nadine Aziz'];
  let t = 0;
  const lastMonthKey = (() => { const x = thisMonth(1, -1); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`; })();
  const curMonthKey = (() => { const x = thisMonth(1); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`; })();

  for (const pu of partitionUnits) {
    const unit = await prisma.unit.create({
      data: {
        orgId, buildingId: pu.b.id, number: pu.number, mode: 'PARTITIONS', arrangement: 'MASTER_LEASE',
        landlordId: pu.landlord.id, landlordRent: pu.rent, occupancy: pu.occ, bedrooms: 3, bathrooms: 3,
        amenities: 'Private fridge, wardrobe, shared balcony, gym, pool',
      },
    });
    for (let i = 1; i <= pu.spaces; i++) {
      const rate = pu.base + ((i * 137) % 5) * 100;
      const state = i % 5 === 0 ? 'AVAILABLE' : i % 7 === 0 ? 'NOT_READY' : 'OCCUPIED';
      const space = await prisma.space.create({
        data: {
          orgId, unitId: unit.id, code: i === pu.spaces && pu.number === '811' ? 'Bed 1' : `P${i}`,
          kind: i === pu.spaces && pu.number === '811' ? 'BED' : 'PARTITION',
          monthlyRate: rate, deposit: pu.occ === 'LADIES' ? 500 : 400, status: state,
          availableFrom: state === 'AVAILABLE' ? thisMonth(1, 1) : null,
        },
      });
      if (state !== 'OCCUPIED') continue;
      const tenant = await prisma.tenant.create({ data: { orgId, name: tenantNames[t % tenantNames.length], phone: `+971 55 ${String(1000000 + t * 7919).slice(-7)}` } });
      t++;
      const lease = await prisma.lease.create({
        data: {
          orgId, tenantId: tenant.id, unitId: unit.id, spaceId: space.id, startDate: thisMonth(1, -(2 + (i % 4))),
          rent: rate, deposit: space.deposit, depositPaid: space.deposit, dueDay: 1, status: 'ACTIVE',
        },
      });
      // last month fully paid; this month most paid, a few partial or unpaid
      await prisma.transaction.create({ data: { orgId, date: thisMonth(2, -1), type: 'INCOME', category: 'RENT', description: 'Rent collection', amount: rate, unitId: unit.id, spaceId: space.id, leaseId: lease.id, periodMonth: lastMonthKey } });
      if (i % 6 !== 3) {
        const amt = i % 4 === 2 ? Math.round(rate / 2) : rate;
        await prisma.transaction.create({ data: { orgId, date: thisMonth(Math.min(today.getUTCDate(), 1 + (i % 5))), type: 'INCOME', category: 'RENT', description: amt < rate ? 'Rent (part payment)' : 'Rent collection', amount: amt, method: i % 2 ? 'CASH' : 'BANK', unitId: unit.id, spaceId: space.id, leaseId: lease.id, periodMonth: curMonthKey } });
      }
    }
    for (const off of [-1, 0]) {
      await prisma.transaction.create({ data: { orgId, date: thisMonth(3, off), type: 'EXPENSE', category: 'DEWA', description: `DEWA - Apt ${pu.number}`, amount: 1150 + (Number(pu.number) % 7) * 120, unitId: unit.id, method: 'BANK' } });
    }
    // Quarterly cheques to the landlord for the year
    for (let q = 0; q < 4; q++) {
      const due = thisMonth(15, q * 3 - 2);
      await prisma.cheque.create({
        data: {
          orgId, direction: 'OUT', number: `${pu.number}00${q + 1}`, bank: 'Wio', amount: pu.rent / 4, dueDate: due,
          status: due < today ? 'CLEARED' : 'PENDING', partyName: pu.landlord.name, unitId: unit.id, landlordId: pu.landlord.id,
        },
      });
    }
  }

  // ─── Holiday homes (one managed for an owner) ─────────────────────────────
  const hh1 = await prisma.unit.create({ data: { orgId, buildingId: atria.id, number: '1408', mode: 'HOLIDAY', arrangement: 'MANAGEMENT', landlordId: owner.id, managementFee: 20, bedrooms: 1, bathrooms: 1, nightlyRate: 450, occupancy: 'FAMILY', amenities: 'Burj view, pool, gym' } });
  const hh2 = await prisma.unit.create({ data: { orgId, buildingId: atria.id, number: '2210', mode: 'HOLIDAY', arrangement: 'MASTER_LEASE', landlordId: rashid.id, landlordRent: 85000, bedrooms: 1, bathrooms: 1, nightlyRate: 520, occupancy: 'FAMILY' } });
  const guests = [
    { unit: hh1, name: 'James Whitfield', ch: 'AIRBNB', from: -20, n: 4, rate: 430 },
    { unit: hh1, name: 'Chen Wei', ch: 'BOOKING', from: -12, n: 6, rate: 460 },
    { unit: hh1, name: 'Ahmed Al Sayed', ch: 'DIRECT', from: -3, n: 5, rate: 420 },
    { unit: hh1, name: 'Elena Petrova', ch: 'AIRBNB', from: 4, n: 3, rate: 480 },
    { unit: hh2, name: 'Ravi Menon', ch: 'BOOKING', from: -15, n: 7, rate: 500 },
    { unit: hh2, name: 'Sophie Laurent', ch: 'AIRBNB', from: -5, n: 4, rate: 540 },
    { unit: hh2, name: 'Mohammed Saeed', ch: 'DIRECT', from: 1, n: 2, rate: 520 },
  ];
  for (const g of guests) {
    const checkIn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + g.from));
    const checkOut = new Date(checkIn.getTime() + g.n * 86400000);
    const total = g.rate * g.n;
    const fee = g.ch === 'AIRBNB' ? total * 0.15 : g.ch === 'BOOKING' ? total * 0.17 : 0;
    const status = checkOut <= today ? 'CHECKED_OUT' : checkIn <= today ? 'CHECKED_IN' : 'CONFIRMED';
    const b = await prisma.booking.create({ data: { orgId, unitId: g.unit.id, guestName: g.name, channel: g.ch, checkIn, checkOut, guests: 2, totalAmount: total, channelFee: Math.round(fee), cleaningFee: 150, tourismFee: g.n * 15, status } });
    if (status !== 'CONFIRMED') {
      await prisma.transaction.create({ data: { orgId, date: checkIn, type: 'INCOME', category: 'BOOKING', description: `${g.ch === 'DIRECT' ? 'Direct' : g.ch === 'AIRBNB' ? 'Airbnb' : 'Booking.com'} payout — ${g.name}`, amount: Math.round(total - fee), method: 'BANK', unitId: g.unit.id, bookingId: b.id } });
    }
  }
  await prisma.transaction.create({ data: { orgId, date: thisMonth(5), type: 'EXPENSE', category: 'CLEANING', description: 'Turnover cleaning — Atria 1408', amount: 450, unitId: hh1.id } });

  // ─── Long-term unit with tenant cheques ───────────────────────────────────
  const lt = await prisma.unit.create({ data: { orgId, buildingId: jvt.id, number: '905', mode: 'LONG_TERM', arrangement: 'MANAGEMENT', landlordId: owner.id, managementFee: 5, bedrooms: 2, bathrooms: 2, monthlyRent: 7500, occupancy: 'FAMILY' } });
  const family = await prisma.tenant.create({ data: { orgId, name: 'Khaled Mansour', phone: '+971 52 000 0101', nationality: 'Jordanian' } });
  const ltLease = await prisma.lease.create({ data: { orgId, tenantId: family.id, unitId: lt.id, startDate: thisMonth(1, -4), endDate: thisMonth(1, 8), rent: 90000, rentPeriod: 'YEARLY', deposit: 4500, depositPaid: 4500, status: 'ACTIVE' } });
  for (let q = 0; q < 4; q++) {
    const due = thisMonth(1, q * 3 - 4);
    const cleared = due < today;
    const c = await prisma.cheque.create({ data: { orgId, direction: 'IN', number: `00045${q + 1}`, bank: 'Emirates NBD', amount: 22500, dueDate: due, status: cleared ? 'CLEARED' : 'PENDING', partyName: family.name, unitId: lt.id, leaseId: ltLease.id } });
    if (cleared) await prisma.transaction.create({ data: { orgId, date: due, type: 'INCOME', category: 'RENT', description: `Cheque ${c.number} — ${family.name}`, amount: 22500, method: 'CHEQUE', unitId: lt.id, leaseId: ltLease.id, chequeId: c.id } });
  }

  // ─── Company overheads ────────────────────────────────────────────────────
  for (const off of [-1, 0]) {
    await prisma.transaction.createMany({
      data: [
        { orgId, date: thisMonth(3, off), type: 'EXPENSE', category: 'SALARIES', description: 'Team salaries', amount: 20000, method: 'BANK' },
        { orgId, date: thisMonth(4, off), type: 'EXPENSE', category: 'INTERNET', description: 'du internet — all apartments', amount: 2390, method: 'BANK' },
        { orgId, date: thisMonth(8, off), type: 'EXPENSE', category: 'CLEANING', description: 'Cleaner salary', amount: 1250 },
        { orgId, date: thisMonth(9, off), type: 'EXPENSE', category: 'MAINTENANCE', description: 'AC servicing', amount: 760, estimated: off === 0 },
      ],
    });
  }

  const units = await prisma.unit.findMany({ where: { orgId, mode: 'PARTITIONS' } });
  await prisma.maintenanceRequest.createMany({
    data: [
      { orgId, unitId: units[0].id, spaceCode: 'P4', title: 'AC not cooling', category: 'AC', priority: 'HIGH' },
      { orgId, unitId: units[2].id, title: 'Kitchen sink leaking', category: 'PLUMBING', priority: 'NORMAL', status: 'IN_PROGRESS', assignedTo: 'AC technician' },
      { orgId, unitId: units[3].id, spaceCode: 'P2', title: 'Light fixture broken', category: 'ELECTRICAL', priority: 'LOW' },
    ],
  });
  console.log('✓ Sample data added');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
