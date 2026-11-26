// backend/src/routes/import.js — bring in rows pasted or uploaded from Sakanly's Google Sheets.
// Accepts { kind: 'spaces' | 'transactions', rows: [ {header: value} ], dryRun }
// Headers are matched loosely so both the "Partitions Availability" and older "Availability"
// sheets work, as does the monthly "Transaction Log".
const router = require('express').Router();
const prisma = require('../db');
const { ah, HttpError } = require('../middleware/errorHandler');
const { startOfDay, monthKey } = require('../lib/dates');

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES = {
  building: ['building', 'buildingname'],
  area: ['area', 'location'],
  unit: ['flatno', 'apartmentno', 'apartment', 'apt', 'unit', 'flat'],
  code: ['partitionnumber', 'partationroomno', 'partitionroomno', 'partition', 'partation', 'room', 'bed', 'space'],
  price: ['price', 'rent', 'monthlyrate', 'monthlyrent'],
  deposit: ['securitydeposit', 'deposit'],
  capacity: ['capacity', 'persons'],
  type: ['type', 'apartmenttype', 'gender'],
  amenities: ['aminiteis', 'amenities', 'sellingpoints', 'features'],
  status: ['status'],
  available: ['date', 'availablemonth', 'availablefrom', 'available'],
  date: ['date'],
  txType: ['type'],
  category: ['category'],
  description: ['description', 'details'],
  amount: ['amountaed', 'amount'],
  notes: ['notes', 'note', 'comments'],
  chequeNo: ['chequenumber', 'chequeno', 'cheque', 'checknumber', 'checkno', 'no', 'number'],
  chequeDate: ['chequedate', 'duedate', 'date', 'installmentduedate'],
  party: ['name', 'tenant', 'tenantname', 'party', 'payee', 'drawer', 'landlord', 'owner'],
  bank: ['bank', 'bankname'],
  newDate: ['postponedto', 'newdate', 'postponeddate'],
  period: ['period', 'periodmonth', 'formonth'],
  tenant: ['tenantname', 'tenant', 'name', 'occupant'],
  from: ['from', 'startdate', 'movein', 'start'],
  to: ['to', 'enddate', 'until'],
};

function getter(row) {
  const keys = Object.keys(row).map(k => [norm(k), k]);
  return field => {
    for (const a of ALIASES[field]) {
      const hit = keys.find(([n]) => n === a);
      if (hit && String(row[hit[1]] ?? '').trim() !== '') return String(row[hit[1]]).trim();
    }
    return null;
  };
}

// "SHEIKHA NOURA", "El sheikha Nora", "SHEIKHA NOORA" → one building
const buildingKey = s => norm(String(s).replace(/^\s*(el|al)[\s-]*/i, '')).replace(/ou|oo/g, 'o').replace(/aa/g, 'a');
const titleCase = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
// "F706" and "706" are the same apartment
const unitKey = s => String(s || '').replace(/^[^0-9]+/, '').trim() || String(s || '').trim();

function spaceCode(raw) {
  const s = String(raw).trim();
  if (/^bed/i.test(s)) return { code: `Bed ${s.replace(/\D/g, '') || 1}`, kind: 'BED' };
  if (/^room/i.test(s)) return { code: `R${s.replace(/\D/g, '')}`, kind: 'ROOM' };
  if (/^s\s*\d/i.test(s)) return { code: `S${s.replace(/\D/g, '')}`, kind: 'ROOM' };
  if (/^\d+$/.test(s) || /^p(t|artition|artation)?\s*\d+/i.test(s)) return { code: `P${s.replace(/\D/g, '')}`, kind: 'PARTITION' };
  return { code: s, kind: 'PARTITION' };
}

function parseNumberRange(s) {
  if (!s) return { value: null, range: null };
  const nums = String(s).replace(/,/g, '').match(/\d+(\.\d+)?/g)?.map(Number) || [];
  if (!nums.length) return { value: null, range: null };
  return { value: Math.min(...nums), range: nums.length > 1 ? `${Math.min(...nums)}–${Math.max(...nums)}` : null };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(s, { future = false } = {}) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (/ready|now|immediate/.test(t)) return startOfDay();
  let m = t.match(/^(\d{1,2})[-/ ]([a-z]{3})[a-z]*[-/ ]?(\d{2,4})?$/); // 01-Jun-2026, 01-Mar
  if (!m) m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]{3})[a-z]*\s*(\d{4})?$/); // 1st of DEC
  if (m && MONTHS.includes(m[2])) {
    const now = new Date();
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getUTCFullYear();
    let d = new Date(Date.UTC(y, MONTHS.indexOf(m[2]), Number(m[1])));
    if (!m[3] && future && d < startOfDay(new Date(now.getTime() - 60 * 86400000))) d = new Date(Date.UTC(y + 1, MONTHS.indexOf(m[2]), Number(m[1])));
    return d;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 21/03/2024 (day first, as used in the UAE)
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

const occupancyOf = s => {
  const t = norm(s);
  if (/lad|fem|women|girl/.test(t)) return 'LADIES';
  if (/men|male|boys|gent/.test(t) && !/fem/.test(t)) return 'MEN';
  if (/family/.test(t)) return 'FAMILY';
  return 'MIX';
};
const statusOf = s => {
  const t = norm(s);
  if (!t) return null;
  if (/occupied|rented|taken/.test(t)) return 'OCCUPIED';
  if (/notready|renovat|maint/.test(t)) return 'NOT_READY';
  if (/reserv|booked|hold/.test(t)) return 'RESERVED';
  if (/avail|vacant|free/.test(t)) return 'AVAILABLE';
  return null;
};

const CATEGORY_MAP = {
  rent: 'RENT', rentcollection: 'RENT', deposit: 'DEPOSIT', booking: 'BOOKING',
  rentpaid: 'RENT_PAID', landlord: 'RENT_PAID', dewa: 'DEWA', electricity: 'DEWA',
  internet: 'INTERNET', telecom: 'INTERNET', du: 'INTERNET', etisalat: 'INTERNET',
  maintenance: 'MAINTENANCE', repairs: 'MAINTENANCE', cleaning: 'CLEANING',
  salaries: 'SALARIES', salary: 'SALARIES', wages: 'SALARIES', commission: 'COMMISSION',
  depositrefund: 'DEPOSIT_REFUND', refund: 'DEPOSIT_REFUND', license: 'LICENSE', licence: 'LICENSE',
  admin: 'ADMIN', fees: 'ADMIN', security: 'SECURITY', furniture: 'FURNITURE', ownerpayout: 'OWNER_PAYOUT',
};

// Cache of org's buildings/units/spaces so a few hundred rows don't mean a few thousand queries
async function loadPortfolio(orgId) {
  const buildings = await prisma.building.findMany({ where: { orgId }, include: { units: { include: { spaces: true } } } });
  return { buildings };
}

router.post('/', ah(async (req, res) => {
  const { kind, rows, dryRun } = req.body;
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(422, 'No rows to import');
  if (rows.length > 2000) throw new HttpError(422, 'Import at most 2,000 rows at a time');
  const orgId = req.user.orgId;
  const result = { created: 0, updated: 0, skipped: [], preview: [] };
  const portfolio = await loadPortfolio(orgId);

  async function findOrCreateBuilding(name, area) {
    const key = buildingKey(name);
    let b = portfolio.buildings.find(x => buildingKey(x.name) === key);
    if (!b) {
      b = dryRun ? { id: `new-${key}`, name: titleCase(name), units: [] }
        : { ...(await prisma.building.create({ data: { orgId, name: titleCase(name), area: area || null } })), units: [] };
      portfolio.buildings.push(b);
    }
    return b;
  }
  async function findOrCreateUnit(b, number, occupancy) {
    const key = unitKey(number);
    let u = b.units.find(x => unitKey(x.number) === key);
    if (!u) {
      u = dryRun ? { id: `new-${b.id}-${key}`, number: key, spaces: [] }
        : { ...(await prisma.unit.create({ data: { orgId, buildingId: b.id, number: key, mode: 'PARTITIONS', occupancy } })), spaces: [] };
      b.units.push(u);
    }
    return u;
  }
  const allUnits = () => portfolio.buildings.flatMap(b => b.units.map(u => ({ ...u, building: b })));

  if (kind === 'spaces') {
    for (const [i, row] of rows.entries()) {
      const g = getter(row);
      const bName = g('building'), unitNo = g('unit'), rawCode = g('code');
      if (!bName || !unitNo || !rawCode) { result.skipped.push({ row: i + 2, reason: 'Missing building, flat or partition number' }); continue; }
      const { value: price, range } = parseNumberRange(g('price'));
      if (price === null) { result.skipped.push({ row: i + 2, reason: 'No price' }); continue; }
      const { code, kind: spaceKind } = spaceCode(rawCode);
      const occupancy = occupancyOf(g('type'));
      const b = await findOrCreateBuilding(bName, g('area'));
      const u = await findOrCreateUnit(b, unitNo, occupancy);
      const data = {
        monthlyRate: price, kind: spaceKind,
        deposit: parseNumberRange(g('deposit')).value ?? undefined,
        capacity: parseNumberRange(g('capacity')).value ?? undefined,
        amenities: g('amenities') ? titleCase(g('amenities')).replace(/\s+/g, ' ') : undefined,
        status: statusOf(g('status')) || (g('available') ? 'AVAILABLE' : undefined),
        availableFrom: parseDate(g('available'), { future: true }) || undefined,
        notes: range ? `Price range ${range}` : undefined,
      };
      const existing = u.spaces.find(s => s.code.toLowerCase() === code.toLowerCase());
      result.preview.push({ building: b.name, unit: u.number, code, ...data, action: existing ? 'update' : 'create' });
      if (dryRun) { existing ? result.updated++ : result.created++; if (!existing) u.spaces.push({ code }); continue; }
      if (existing) {
        await prisma.space.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        const s = await prisma.space.create({ data: { orgId, unitId: u.id, code, ...data, status: data.status || 'AVAILABLE' } });
        u.spaces.push(s);
        result.created++;
      }
    }
  } else if (kind === 'transactions') {
    for (const [i, row] of rows.entries()) {
      const g = getter(row);
      const date = parseDate(g('date'));
      const amount = parseNumberRange(g('amount')).value;
      const typeRaw = norm(g('txType'));
      const type = /inc|in$|receiv/.test(typeRaw) ? 'INCOME' : /exp|out|paid/.test(typeRaw) ? 'EXPENSE' : null;
      if (!date || !amount || !type) { result.skipped.push({ row: i + 2, reason: 'Needs a date, type (INCOME/EXPENSE) and amount' }); continue; }
      let category = CATEGORY_MAP[norm(g('category'))] || (type === 'INCOME' ? 'OTHER_INCOME' : 'OTHER_EXPENSE');
      const incomeCats = ['RENT', 'DEPOSIT', 'BOOKING', 'OTHER_INCOME'];
      if ((type === 'INCOME') !== incomeCats.includes(category)) category = type === 'INCOME' ? 'OTHER_INCOME' : 'OTHER_EXPENSE';

      let unit = null, space = null;
      const unitNo = g('unit');
      if (unitNo) {
        const matches = allUnits().filter(u => unitKey(u.number) === unitKey(unitNo));
        if (matches.length === 1) unit = matches[0];
      }
      const rawCode = g('code');
      if (unit && rawCode) {
        const { code } = spaceCode(rawCode);
        space = unit.spaces.find(s => s.code.toLowerCase() === code.toLowerCase()) || null;
      }
      const notes = g('notes');
      const data = {
        orgId, date, type, category, amount,
        description: g('description') || titleCase(category.replace(/_/g, ' ')),
        unitId: unit && !String(unit.id).startsWith('new-') ? unit.id : null,
        spaceId: space?.id || null, notes, estimated: /estimat|تقدير/i.test(notes || ''),
        method: 'CASH', createdBy: req.user.id,
      };
      if (category === 'RENT') {
        const p = g('period');
        const period = p && /^\d{4}-\d{2}$/.test(p) ? p : null;
        if (space) {
          // Match the tenancy that covers the month the rent is for (people often pay a few days early)
          let from = date, to = date;
          if (period) {
            const [y, m] = period.split('-').map(Number);
            from = new Date(Date.UTC(y, m - 1, 1));
            to = new Date(Date.UTC(y, m, 0));
          }
          const lease = await prisma.lease.findFirst({
            where: { spaceId: space.id, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
            orderBy: { startDate: 'desc' },
          });
          if (lease) data.leaseId = lease.id;
        }
        data.periodMonth = period || (data.leaseId ? monthKey(date) : null);
      }
      result.preview.push({
        date, type, category, description: data.description, amount,
        unit: unit ? `${unit.building.name} ${unit.number}` : (unitNo ? `${unitNo} (not matched)` : ''), space: space?.code || '',
      });
      if (!dryRun) await prisma.transaction.create({ data });
      result.created++;
    }
  } else if (kind === 'tenancies') {
    // One row per partition: who lives there now, since when, at what rent (the monthly "NOVMBER" sheet)
    for (const [i, row] of rows.entries()) {
      const g = getter(row);
      const bName = g('building'), unitNo = g('unit'), rawCode = g('code');
      if (!bName || !unitNo || !rawCode) { result.skipped.push({ row: i + 2, reason: 'Missing building, flat or partition' }); continue; }
      const { code, kind: spaceKind } = spaceCode(rawCode);
      const price = parseNumberRange(g('price')).value;
      const name = g('tenant');
      const from = parseDate(g('from'));
      const b = await findOrCreateBuilding(bName, g('area'));
      const u = await findOrCreateUnit(b, unitNo, occupancyOf(g('type')));
      let space = u.spaces.find(s => s.code.toLowerCase() === code.toLowerCase());
      const holiday = /holiday/i.test(name || '');
      const occupied = !holiday && (name || (from && price));
      const status = holiday ? 'RESERVED' : occupied ? 'OCCUPIED' : statusOf(g('status')) || 'AVAILABLE';
      const action = occupied ? (space ? 'tenant' : 'create + tenant') : (space ? 'update' : 'create');
      result.preview.push({ building: b.name, unit: u.number, code, tenant: holiday ? 'Holiday homes' : name || (occupied ? '(name missing)' : ''), from, monthlyRate: price, status, action });
      if (dryRun) { space ? result.updated++ : result.created++; if (!space) u.spaces.push({ code }); continue; }
      const spaceData = { status: occupied ? 'AVAILABLE' : status, ...(price ? { monthlyRate: price } : {}), ...(holiday ? { notes: 'Used for holiday homes' } : {}) };
      if (space) { space = await prisma.space.update({ where: { id: space.id }, data: spaceData }); result.updated++; }
      else {
        space = await prisma.space.create({ data: { orgId, unitId: u.id, code, kind: spaceKind, monthlyRate: price || 0, ...spaceData } });
        u.spaces.push(space); result.created++;
      }
      if (!occupied) continue;
      const tenantName = name || `Tenant of ${u.number} ${code}`;
      const current = await prisma.lease.findFirst({ where: { spaceId: space.id, status: { in: ['ACTIVE', 'NOTICE'] } }, include: { tenant: true } });
      if (current && current.tenant.name === tenantName) continue; // already there
      if (current) await prisma.lease.update({ where: { id: current.id }, data: { status: 'ENDED', endDate: from || startOfDay() } });
      const tenant = await prisma.tenant.create({ data: { orgId, name: tenantName, notes: name ? null : 'Name missing in the imported sheet' } });
      const start = from || startOfDay();
      await prisma.lease.create({
        data: { orgId, tenantId: tenant.id, unitId: u.id, spaceId: space.id, startDate: start, rent: price || 0, dueDay: Math.min(28, start.getUTCDate()), status: 'ACTIVE' },
      });
      await prisma.space.update({ where: { id: space.id }, data: { status: 'OCCUPIED' } });
    }
  } else if (kind === 'cheques') {
    // Status words come from the colour key: yellow = Paid, green = Postponed, white/blank = Pending
    const direction = req.body.direction === 'OUT' ? 'OUT' : 'IN';
    const chequeStatus = s => {
      const t = norm(s);
      if (!t || /pend|upcom|due|white/.test(t)) return 'PENDING';
      if (/paid|clear|cash|done|yellow/.test(t)) return 'CLEARED';
      if (/postpon|delay|resched|green|later/.test(t)) return 'POSTPONED';
      if (/bounc|return|reject/.test(t)) return 'BOUNCED';
      if (/deposit/.test(t)) return 'DEPOSITED';
      if (/cancel/.test(t)) return 'CANCELLED';
      if (/replac/.test(t)) return 'REPLACED';
      return 'PENDING';
    };
    const existing = await prisma.cheque.findMany({ where: { orgId, direction }, select: { number: true, amount: true } });
    const seen = new Set(existing.map(c => `${c.number}|${c.amount}`));
    for (const [i, row] of rows.entries()) {
      const g = getter(row);
      const number = g('chequeNo');
      const dueDate = parseDate(g('chequeDate'));
      const amount = parseNumberRange(g('amount')).value;
      if (!number || !dueDate || !amount) { result.skipped.push({ row: i + 2, reason: 'Needs a cheque number, date and amount' }); continue; }
      if (seen.has(`${number}|${amount}`)) { result.skipped.push({ row: i + 2, reason: `Cheque ${number} is already in the system` }); continue; }
      seen.add(`${number}|${amount}`);
      let unit = null;
      const unitNo = g('unit');
      if (unitNo) {
        const matches = allUnits().filter(u => unitKey(u.number) === unitKey(unitNo));
        if (matches.length === 1) unit = matches[0];
      }
      const status = chequeStatus(g('status'));
      const data = {
        orgId, direction, number, amount, dueDate, status, bank: g('bank'), partyName: g('party'),
        postponedTo: status === 'POSTPONED' ? parseDate(g('newDate')) : null,
        unitId: unit && !String(unit.id).startsWith('new-') ? unit.id : null, notes: g('notes'),
      };
      result.preview.push({
        number, dueDate, amount, status, party: data.partyName || '', bank: data.bank || '',
        unit: unit ? `${unit.building.name} ${unit.number}` : (unitNo ? `${unitNo} (not matched)` : ''),
      });
      if (!dryRun) await prisma.cheque.create({ data });
      result.created++;
    }
  } else {
    throw new HttpError(422, 'kind must be "spaces", "tenancies", "transactions" or "cheques"');
  }
  result.preview = result.preview.slice(0, 200);
  res.json(result);
}));

module.exports = router;
