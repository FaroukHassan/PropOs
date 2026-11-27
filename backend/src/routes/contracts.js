// backend/src/routes/contracts.js — sub-lease contracts: draw up, sign (office or online link), upload a signed scan, download
const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { findOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');
const { buildTerms } = require('../lib/contractText');
const { renderContract } = require('../lib/contractPdf');

const LIGHT = {
  id: true, number: true, status: true, tenantId: true, leaseId: true, terms: true, signToken: true,
  companySignedBy: true, companySignedAt: true, tenantSignedName: true, tenantSignedAt: true, tenantSignedIp: true,
  scanName: true, scanUploadedAt: true, createdAt: true, updatedAt: true,
};

const leaseInclude = { unit: { include: { building: true } }, space: true };

const OVERRIDES = ['startDate', 'endDate', 'rent', 'deposit', 'dueDay', 'noticeDays', 'includes', 'includesAr', 'specialTerms', 'specialTermsAr'];
const cleanOverrides = body => {
  const o = {};
  for (const k of OVERRIDES) if (body[k] !== undefined && body[k] !== null && body[k] !== '') o[k] = body[k];
  for (const k of ['rent', 'deposit', 'dueDay', 'noticeDays']) {
    if (o[k] !== undefined) {
      const n = Number(String(o[k]).replace(/,/g, ''));
      if (Number.isNaN(n) || n < 0) throw new HttpError(422, `${k} must be a number`);
      o[k] = n;
    }
  }
  for (const k of ['startDate', 'endDate']) if (o[k] && Number.isNaN(new Date(o[k]).getTime())) throw new HttpError(422, `${k} must be a date`);
  return o;
};

function checkSignature(sig) {
  if (typeof sig !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig)) throw new HttpError(422, 'Signature is missing');
  if (sig.length > 400000) throw new HttpError(422, 'Signature image is too large');
  return sig;
}

const shape = c => ({
  ...c,
  companySigned: !!c.companySignedAt,
  tenantSigned: !!c.tenantSignedAt,
  hasScan: !!c.scanUploadedAt,
});

// Both sides signed on screen, or a signed paper copy uploaded → SIGNED
const statusAfter = c => (c.status === 'VOID' ? 'VOID' : ((c.companySignedAt && c.tenantSignedAt) || c.scanUploadedAt ? 'SIGNED' : 'DRAFT'));

async function nextNumber(orgId) {
  const year = new Date().getFullYear();
  const prefix = `SL-${year}-`;
  const last = await prisma.contract.findFirst({ where: { orgId, number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { number: true } });
  const n = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function sendPdf(res, contract, original) {
  if (original && contract.scan) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.number}-signed.pdf"`);
    return res.send(Buffer.from(contract.scan));
  }
  const pdf = await renderContract(contract);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${contract.number}.pdf"`);
  res.send(pdf);
}

const router = express.Router();

router.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  if (req.query.tenantId) where.tenantId = req.query.tenantId;
  if (req.query.leaseId) where.leaseId = req.query.leaseId;
  const rows = await prisma.contract.findMany({ where, select: LIGHT, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(shape));
}));

router.get('/:id', ah(async (req, res) => {
  const c = await prisma.contract.findFirst({ where: { id: req.params.id, orgId: req.user.orgId }, select: LIGHT });
  if (!c) throw new HttpError(404, 'Not found');
  res.json(shape(c));
}));

router.get('/:id/pdf', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  await sendPdf(res, c, req.query.original === '1');
}));

// Draw up a contract from a tenancy
router.post('/', ah(async (req, res) => {
  const { leaseId } = req.body;
  if (!leaseId) throw new HttpError(422, 'Choose the tenancy this contract is for');
  const lease = await findOwned('lease', leaseId, req.user.orgId, { ...leaseInclude, tenant: true });
  const terms = buildTerms({ lease, tenant: lease.tenant, overrides: cleanOverrides(req.body) });
  let created;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await prisma.contract.create({
        data: {
          orgId: req.user.orgId, number: await nextNumber(req.user.orgId), tenantId: lease.tenantId, leaseId: lease.id,
          terms, signToken: crypto.randomBytes(24).toString('base64url'), createdById: req.user.id,
        },
        select: LIGHT,
      });
    } catch (e) { if (e.code !== 'P2002') throw e; }
  }
  if (!created) throw new HttpError(409, 'Could not number the contract, try again');
  res.status(201).json(shape(created));
}));

// Change the terms (only before anyone signs). Also picks up the tenant's latest details.
router.patch('/:id', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  if (c.status !== 'DRAFT' || c.companySignedAt || c.tenantSignedAt || c.scanUploadedAt) {
    throw new HttpError(409, 'This contract has been signed, so it can\'t be changed. Void it and draw up a new one.');
  }
  if (!c.leaseId) throw new HttpError(409, 'The tenancy for this contract no longer exists');
  const lease = await findOwned('lease', c.leaseId, req.user.orgId, { ...leaseInclude, tenant: true });
  const terms = buildTerms({ lease, tenant: lease.tenant, overrides: cleanOverrides(req.body) });
  const updated = await prisma.contract.update({ where: { id: c.id }, data: { terms }, select: LIGHT });
  res.json(shape(updated));
}));

router.post('/:id/sign-company', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  if (c.status === 'VOID') throw new HttpError(409, 'This contract is void');
  const data = { companySignature: checkSignature(req.body.signature), companySignedBy: (req.body.name || req.user.name || '').trim(), companySignedAt: new Date() };
  data.status = statusAfter({ ...c, ...data });
  res.json(shape(await prisma.contract.update({ where: { id: c.id }, data, select: LIGHT })));
}));

// The tenant signs on this device (in the office)
router.post('/:id/sign-tenant', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  if (c.status === 'VOID') throw new HttpError(409, 'This contract is void');
  const data = { tenantSignature: checkSignature(req.body.signature), tenantSignedName: (req.body.name || c.terms.tenant.name).trim(), tenantSignedAt: new Date(), tenantSignedIp: null };
  data.status = statusAfter({ ...c, ...data });
  res.json(shape(await prisma.contract.update({ where: { id: c.id }, data, select: LIGHT })));
}));

// A signed paper copy, as a PDF (base64)
router.post('/:id/upload', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  if (c.status === 'VOID') throw new HttpError(409, 'This contract is void');
  const b64 = String(req.body.data || '').replace(/^data:application\/pdf;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(422, 'Upload the signed contract as a PDF file');
  if (buf.length > 10 * 1024 * 1024) throw new HttpError(422, 'The file is larger than 10 MB');
  const data = { scan: buf, scanName: String(req.body.fileName || `${c.number}-signed.pdf`).slice(0, 200), scanUploadedAt: new Date() };
  data.status = statusAfter({ ...c, ...data });
  res.json(shape(await prisma.contract.update({ where: { id: c.id }, data, select: LIGHT })));
}));

router.post('/:id/void', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  res.json(shape(await prisma.contract.update({ where: { id: c.id }, data: { status: 'VOID' }, select: LIGHT })));
}));

router.delete('/:id', ah(async (req, res) => {
  const c = await findOwned('contract', req.params.id, req.user.orgId);
  if (c.companySignedAt || c.tenantSignedAt || c.scanUploadedAt) throw new HttpError(409, 'A signed contract can\'t be deleted; void it instead');
  await prisma.contract.delete({ where: { id: c.id } });
  res.status(204).end();
}));

// ─── Public signing link: the tenant opens it on their phone, reads, signs ───
const pub = express.Router();

async function byToken(token) {
  if (!token || token.length < 20) throw new HttpError(404, 'This signing link is not valid');
  const c = await prisma.contract.findUnique({ where: { signToken: token } });
  if (!c) throw new HttpError(404, 'This signing link is not valid');
  return c;
}

pub.get('/sign/:token', ah(async (req, res) => {
  const c = await byToken(req.params.token);
  res.json({
    number: c.number, status: c.status, terms: c.terms,
    companySigned: !!c.companySignedAt, companySignedBy: c.companySignedBy,
    tenantSigned: !!c.tenantSignedAt, tenantSignedAt: c.tenantSignedAt,
  });
}));

pub.get('/sign/:token/pdf', ah(async (req, res) => {
  const c = await byToken(req.params.token);
  await sendPdf(res, c, false);
}));

pub.post('/sign/:token', ah(async (req, res) => {
  const c = await byToken(req.params.token);
  if (c.status === 'VOID') throw new HttpError(409, 'This contract has been cancelled. Please contact Sakanly.');
  if (c.tenantSignedAt) throw new HttpError(409, 'This contract has already been signed.');
  if (req.body.agree !== true) throw new HttpError(422, 'Please confirm that you have read and agree to the contract');
  const name = String(req.body.name || '').trim();
  if (name.length < 2) throw new HttpError(422, 'Please type your full name');
  const data = { tenantSignature: checkSignature(req.body.signature), tenantSignedName: name.slice(0, 120), tenantSignedAt: new Date(), tenantSignedIp: req.ip };
  data.status = statusAfter({ ...c, ...data });
  await prisma.contract.update({ where: { id: c.id }, data });
  res.json({ ok: true, status: data.status });
}));

module.exports = { router, pub };
