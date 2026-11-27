// backend/src/routes/invoices.js — invoices Sakanly issues (to companies, tenants, guests, owners)
// and bills it receives from suppliers. VAT is worked out here; payments go into the ledger.
const express = require('express');
const prisma = require('../db');
const { findOwned, assertOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');
const { periodFrom } = require('../lib/dates');
const { renderInvoice } = require('../lib/invoicePdf');
const { INCOME_CATS } = require('./money');

const router = express.Router();
const KINDS = ['SALES', 'PURCHASE'];
const PARTIES = ['COMPANY', 'TENANT', 'GUEST', 'LANDLORD', 'SUPPLIER', 'OTHER'];
const METHODS = ['CASH', 'BANK', 'CARD', 'CHEQUE', 'ONLINE'];
const round = n => Math.round((n || 0) * 100) / 100;
const omitScan = inv => { const { scan, ...rest } = inv; return { ...rest, hasScan: !!scan }; };

function cleanLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new HttpError(422, 'Add at least one line');
  if (lines.length > 100) throw new HttpError(422, 'Too many lines');
  return lines.map((l, i) => {
    const description = String(l.description || '').trim();
    const qty = Number(l.qty ?? 1);
    const unitPrice = Number(String(l.unitPrice ?? '').replace(/,/g, ''));
    if (!description) throw new HttpError(422, `Line ${i + 1} needs a description`);
    if (!(qty > 0)) throw new HttpError(422, `Line ${i + 1}: quantity must be more than 0`);
    if (Number.isNaN(unitPrice) || unitPrice < 0) throw new HttpError(422, `Line ${i + 1}: price must be a number`);
    return { description: description.slice(0, 300), qty, unitPrice, vat: l.vat !== false };
  });
}

function totals(lines, vatRate) {
  let subtotal = 0, vat = 0;
  for (const l of lines) {
    const amount = l.qty * l.unitPrice;
    subtotal += amount;
    if (l.vat) vat += amount * vatRate / 100;
  }
  return { subtotal: round(subtotal), vat: round(vat), total: round(subtotal + vat) };
}

// Paid so far and where the invoice stands
function withMoney(inv) {
  const tx = inv.transactions || [];
  const paid = round(tx.reduce((a, t) => a + t.amount, 0));
  const balance = round(Math.max(inv.total - paid, 0));
  let state;
  if (inv.status === 'VOID') state = 'VOID';
  else if (inv.status === 'DRAFT') state = 'DRAFT';
  else if (balance <= 0.005) state = 'PAID';
  else if (inv.dueDate && new Date(inv.dueDate) < new Date(new Date().toISOString().slice(0, 10))) state = 'OVERDUE';
  else if (paid > 0) state = 'PARTLY_PAID';
  else state = 'UNPAID';
  return { ...omitScan(inv), paid, balance, state };
}

async function body(req, partial = false) {
  const b = req.body;
  const orgId = req.user.orgId;
  const data = {};
  if (!partial || b.kind !== undefined) {
    if (!KINDS.includes(b.kind || 'SALES')) throw new HttpError(422, 'Unknown invoice type');
    data.kind = b.kind || 'SALES';
  }
  if (b.partyType !== undefined) {
    if (!PARTIES.includes(b.partyType)) throw new HttpError(422, 'Unknown party type');
    data.partyType = b.partyType;
  }
  for (const f of ['partyName', 'partyTrn', 'partyAddress', 'partyEmail', 'partyPhone', 'supplierRef', 'notes']) {
    if (b[f] !== undefined) data[f] = b[f] === null || b[f] === '' ? null : String(b[f]).trim().slice(0, 500);
  }
  if (!partial || b.partyName !== undefined) if (!data.partyName) throw new HttpError(422, 'Who is the invoice for?');
  for (const [f, model] of [['tenantId', 'tenant'], ['landlordId', 'landlord'], ['dealId', 'leasingDeal'], ['unitId', 'unit']]) {
    if (b[f] !== undefined) { data[f] = b[f] || null; if (data[f]) await assertOwned(model, data[f], orgId); }
  }
  for (const f of ['issueDate', 'dueDate']) {
    if (b[f] !== undefined) {
      data[f] = b[f] ? new Date(b[f]) : null;
      if (data[f] && Number.isNaN(data[f].getTime())) throw new HttpError(422, `${f} must be a date`);
    }
  }
  if (!partial && !data.issueDate) data.issueDate = new Date(new Date().toISOString().slice(0, 10));
  if (b.vatRate !== undefined) {
    const r = Number(b.vatRate);
    if (![0, 5].includes(r)) throw new HttpError(422, 'VAT must be 0% or 5%');
    data.vatRate = r;
  }
  if (b.category !== undefined) data.category = b.category || null;
  if (b.status !== undefined) {
    if (!['DRAFT', 'ISSUED'].includes(b.status)) throw new HttpError(422, 'Status must be DRAFT or ISSUED');
    data.status = b.status;
  }
  if (b.lines !== undefined || !partial) data.lines = cleanLines(b.lines);
  return data;
}

async function nextNumber(orgId, kind, date) {
  const prefix = `${kind === 'PURCHASE' ? 'BILL' : 'INV'}-${new Date(date || Date.now()).getUTCFullYear()}-`;
  const last = await prisma.invoice.findFirst({ where: { orgId, number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { number: true } });
  return `${prefix}${String((last ? parseInt(last.number.slice(prefix.length), 10) : 0) + 1).padStart(4, '0')}`;
}

const listWhere = (req) => {
  const q = req.query;
  const where = { orgId: req.user.orgId };
  if (q.kind) where.kind = q.kind;
  if (q.partyType) where.partyType = q.partyType;
  if (q.tenantId) where.tenantId = q.tenantId;
  if (q.from || q.to) { const p = periodFrom(q, HttpError); where.issueDate = { gte: p.start, lt: p.end }; }
  if (q.q) where.OR = [{ partyName: { contains: q.q, mode: 'insensitive' } }, { number: { contains: q.q, mode: 'insensitive' } }, { supplierRef: { contains: q.q, mode: 'insensitive' } }];
  return where;
};

// The company's VAT number, printed on every tax invoice
router.get('/settings', ah(async (req, res) => {
  const org = await prisma.org.findUnique({ where: { id: req.user.orgId }, select: { name: true, trn: true } });
  res.json(org);
}));
router.patch('/settings', ah(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Only a super admin can change this');
  const trn = String(req.body.trn || '').replace(/\s/g, '');
  if (trn && !/^\d{15}$/.test(trn)) throw new HttpError(422, 'A UAE TRN has 15 digits');
  res.json(await prisma.org.update({ where: { id: req.user.orgId }, data: { trn: trn || null }, select: { name: true, trn: true } }));
}));

router.get('/', ah(async (req, res) => {
  const rows = await prisma.invoice.findMany({
    where: listWhere(req), omit: { scan: true },
    include: { transactions: { select: { id: true, amount: true, date: true } } },
    orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
  });
  let out = rows.map(r => withMoney({ ...r, scan: null }));
  if (req.query.state) out = out.filter(r => req.query.state.split(',').includes(r.state));
  res.json(out);
}));

router.get('/summary', ah(async (req, res) => {
  const rows = (await prisma.invoice.findMany({ where: listWhere(req), omit: { scan: true }, include: { transactions: { select: { amount: true } } } }))
    .map(r => withMoney({ ...r, scan: null })).filter(r => r.state !== 'VOID' && r.state !== 'DRAFT');
  const sum = (list, f) => round(list.reduce((a, r) => a + r[f], 0));
  res.json({
    count: rows.length,
    total: sum(rows, 'total'), vat: sum(rows, 'vat'), subtotal: sum(rows, 'subtotal'),
    paid: sum(rows, 'paid'), outstanding: sum(rows, 'balance'),
    overdue: sum(rows.filter(r => r.state === 'OVERDUE'), 'balance'),
    overdueCount: rows.filter(r => r.state === 'OVERDUE').length,
  });
}));

router.get('/:id', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: { orderBy: { date: 'asc' } } });
  res.json(withMoney(inv));
}));

router.get('/:id/pdf', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: true });
  const org = await prisma.org.findUnique({ where: { id: req.user.orgId } });
  const pdf = await renderInvoice(inv, org, withMoney(inv).paid);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
  res.send(pdf);
}));

router.get('/:id/scan', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId);
  if (!inv.scan) throw new HttpError(404, 'No file attached');
  res.setHeader('Content-Type', inv.scanMime || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(inv.scanName || 'bill')}"`);
  res.send(Buffer.from(inv.scan));
}));

router.post('/', ah(async (req, res) => {
  const data = await body(req);
  Object.assign(data, totals(data.lines, data.vatRate ?? 5));
  let inv;
  for (let attempt = 0; attempt < 3 && !inv; attempt++) {
    try {
      inv = await prisma.invoice.create({
        data: { ...data, orgId: req.user.orgId, number: await nextNumber(req.user.orgId, data.kind, data.issueDate), createdBy: req.user.name },
        omit: { scan: true }, include: { transactions: true },
      });
    } catch (e) { if (e.code !== 'P2002') throw e; }
  }
  if (!inv) throw new HttpError(409, 'Could not number the invoice, try again');
  res.status(201).json(withMoney({ ...inv, scan: null }));
}));

router.patch('/:id', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: true });
  if (inv.status === 'VOID') throw new HttpError(409, 'This invoice is void');
  if (inv.transactions.length && (req.body.lines !== undefined || req.body.vatRate !== undefined)) {
    throw new HttpError(409, 'This invoice has payments, so its amounts can\'t change. Void it and issue a new one.');
  }
  const data = await body(req, true);
  delete data.kind;
  const lines = data.lines || inv.lines;
  Object.assign(data, totals(lines, data.vatRate ?? inv.vatRate));
  const upd = await prisma.invoice.update({ where: { id: inv.id }, data, omit: { scan: true }, include: { transactions: true } });
  res.json(withMoney({ ...upd, scan: null }));
}));

// Record money received (sales) or paid (bills); it lands in the ledger, linked to the invoice
router.post('/:id/payments', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: true });
  if (inv.status === 'VOID') throw new HttpError(409, 'This invoice is void');
  const amount = round(Number(String(req.body.amount ?? '').replace(/,/g, '')));
  if (!(amount > 0)) throw new HttpError(422, 'Enter the amount paid');
  const balance = round(inv.total - inv.transactions.reduce((a, t) => a + t.amount, 0));
  if (amount > balance + 0.005) throw new HttpError(422, `That is more than the AED ${balance.toLocaleString('en-US')} still due`);
  const type = inv.kind === 'SALES' ? 'INCOME' : 'EXPENSE';
  const category = req.body.category || inv.category || (type === 'INCOME' ? 'OTHER_INCOME' : 'OTHER_EXPENSE');
  if ((type === 'INCOME') !== INCOME_CATS.includes(category)) throw new HttpError(422, `${category} is not an ${type.toLowerCase()} category`);
  const method = METHODS.includes(req.body.method) ? req.body.method : 'BANK';
  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(422, 'date must be a date');
  await prisma.transaction.create({
    data: {
      orgId: req.user.orgId, invoiceId: inv.id, type, category, amount, method, date,
      description: `${inv.kind === 'SALES' ? 'Invoice' : 'Bill'} ${inv.number} · ${inv.partyName}`,
      dealId: inv.dealId || null, unitId: inv.unitId || null, landlordId: inv.landlordId || null,
      notes: req.body.notes || null, createdBy: req.user.name,
    },
  });
  if (inv.status === 'DRAFT') await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'ISSUED' } });
  const fresh = await findOwned('invoice', inv.id, req.user.orgId, { transactions: { orderBy: { date: 'asc' } } });
  res.status(201).json(withMoney(fresh));
}));

router.post('/:id/void', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: true });
  if (inv.transactions.length) throw new HttpError(409, 'Remove its payments from the ledger first, then void it');
  const upd = await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'VOID' }, omit: { scan: true }, include: { transactions: true } });
  res.json(withMoney({ ...upd, scan: null }));
}));

router.delete('/:id', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId, { transactions: true });
  if (inv.status !== 'DRAFT' || inv.transactions.length) throw new HttpError(409, 'Only unpaid drafts can be deleted; void an issued invoice instead');
  await prisma.invoice.delete({ where: { id: inv.id } });
  res.status(204).end();
}));

// The supplier's bill (photo or PDF), kept with it
router.post('/:id/scan', ah(async (req, res) => {
  const inv = await findOwned('invoice', req.params.id, req.user.orgId);
  const buf = Buffer.from(String(req.body.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) throw new HttpError(422, 'Choose a file');
  if (buf.length > 8 * 1024 * 1024) throw new HttpError(422, 'The file is larger than 8 MB');
  const head = buf.subarray(0, 5).toString('latin1');
  const mime = head.startsWith('%PDF-') ? 'application/pdf' : head.startsWith('\x89PNG') ? 'image/png' : head.startsWith('\xFF\xD8\xFF') ? 'image/jpeg' : null;
  if (!mime) throw new HttpError(422, 'Upload a photo (JPG, PNG) or a PDF');
  await prisma.invoice.update({ where: { id: inv.id }, data: { scan: buf, scanMime: mime, scanName: String(req.body.fileName || 'bill').slice(0, 200) } });
  res.json({ ok: true });
}));

module.exports = router;
