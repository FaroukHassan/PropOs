// backend/src/routes/documents.js — files in a tenant's file: Emirates ID, passport, visa, other
const express = require('express');
const prisma = require('../db');
const { findOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');

const KINDS = ['EMIRATES_ID', 'PASSPORT', 'VISA', 'OTHER'];
const TYPES = { '%PDF-': 'application/pdf', '\x89PNG': 'image/png', '\xFF\xD8\xFF': 'image/jpeg' };
const META = { id: true, tenantId: true, kind: true, fileName: true, mime: true, size: true, number: true, expiresAt: true, uploadedBy: true, createdAt: true };

function sniff(buf) {
  const head = buf.subarray(0, 5).toString('latin1');
  for (const [magic, mime] of Object.entries(TYPES)) if (head.startsWith(magic)) return mime;
  if (buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

const router = express.Router();

router.get('/', ah(async (req, res) => {
  if (!req.query.tenantId) throw new HttpError(422, 'tenantId is required');
  res.json(await prisma.tenantDocument.findMany({ where: { orgId: req.user.orgId, tenantId: req.query.tenantId }, select: META, orderBy: { createdAt: 'desc' } }));
}));

router.get('/:id/file', ah(async (req, res) => {
  const d = await findOwned('tenantDocument', req.params.id, req.user.orgId);
  res.setHeader('Content-Type', d.mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.fileName)}"`);
  res.send(Buffer.from(d.data));
}));

// body: { tenantId, kind, fileName, data (base64 or data URL), number?, expiresAt? }
router.post('/', ah(async (req, res) => {
  const { tenantId, kind = 'OTHER', fileName, number, expiresAt } = req.body;
  await findOwned('tenant', tenantId, req.user.orgId);
  if (!KINDS.includes(kind)) throw new HttpError(422, 'Unknown document type');
  const buf = Buffer.from(String(req.body.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) throw new HttpError(422, 'Choose a file to upload');
  if (buf.length > 8 * 1024 * 1024) throw new HttpError(422, 'The file is larger than 8 MB');
  const mime = sniff(buf);
  if (!mime) throw new HttpError(422, 'Upload a photo (JPG, PNG) or a PDF');
  const exp = expiresAt ? new Date(expiresAt) : null;
  if (exp && Number.isNaN(exp.getTime())) throw new HttpError(422, 'expiresAt must be a date');
  const doc = await prisma.tenantDocument.create({
    data: {
      orgId: req.user.orgId, tenantId, kind, mime, size: buf.length, data: buf,
      fileName: String(fileName || `${kind.toLowerCase()}.${mime.split('/')[1]}`).slice(0, 200),
      number: number ? String(number).trim().slice(0, 60) : null, expiresAt: exp, uploadedBy: req.user.name,
    },
    select: META,
  });
  // keep the tenant's ID number in step when it's blank
  if (doc.number && ['EMIRATES_ID', 'PASSPORT'].includes(kind)) {
    await prisma.tenant.updateMany({ where: { id: tenantId, orgId: req.user.orgId, OR: [{ idNumber: null }, { idNumber: '' }] }, data: { idNumber: doc.number } });
  }
  res.status(201).json(doc);
}));

router.delete('/:id', ah(async (req, res) => {
  const d = await findOwned('tenantDocument', req.params.id, req.user.orgId);
  await prisma.tenantDocument.delete({ where: { id: d.id } });
  res.status(204).end();
}));

module.exports = router;
