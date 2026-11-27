// backend/src/routes/photos.js — photos of apartments and of single rooms / beds.
// The browser resizes before upload (about 1600 px plus a 480 px thumbnail), so files stay small.
const express = require('express');
const prisma = require('../db');
const { findOwned, assertOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');

const META = { id: true, unitId: true, spaceId: true, mime: true, width: true, height: true, caption: true, cover: true, sort: true, createdAt: true };

function image(b64, max, label) {
  const buf = Buffer.from(String(b64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) throw new HttpError(422, `${label} is missing`);
  if (buf.length > max) throw new HttpError(422, `${label} is too large`);
  const h = buf.subarray(0, 12).toString('latin1');
  const mime = h.startsWith('\xFF\xD8\xFF') ? 'image/jpeg' : h.startsWith('\x89PNG') ? 'image/png' : h.slice(8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!mime) throw new HttpError(422, 'Upload a photo (JPG, PNG or WebP)');
  return { buf, mime };
}

const router = express.Router();

router.get('/', ah(async (req, res) => {
  const where = { orgId: req.user.orgId };
  if (req.query.unitId) where.unitId = req.query.unitId;
  if (req.query.spaceId) where.spaceId = req.query.spaceId;
  res.json(await prisma.unitPhoto.findMany({ where, select: META, orderBy: [{ cover: 'desc' }, { sort: 'asc' }, { createdAt: 'asc' }] }));
}));

router.post('/', ah(async (req, res) => {
  const orgId = req.user.orgId;
  const { unitId, spaceId } = req.body;
  if (!unitId) throw new HttpError(422, 'unitId is required');
  await assertOwned('unit', unitId, orgId);
  if (spaceId) {
    const s = await prisma.space.findFirst({ where: { id: spaceId, orgId, unitId }, select: { id: true } });
    if (!s) throw new HttpError(422, 'That room is not in this apartment');
  }
  const full = image(req.body.data, 4 * 1024 * 1024, 'Photo');
  const thumb = image(req.body.thumb || req.body.data, 600 * 1024, 'Thumbnail');
  const count = await prisma.unitPhoto.count({ where: { unitId } });
  if (count >= 60) throw new HttpError(422, 'An apartment can have up to 60 photos');
  const photo = await prisma.unitPhoto.create({
    data: {
      orgId, unitId, spaceId: spaceId || null, data: full.buf, thumb: thumb.buf, mime: full.mime,
      width: Number(req.body.width) || null, height: Number(req.body.height) || null,
      caption: req.body.caption ? String(req.body.caption).slice(0, 200) : null,
      cover: count === 0, sort: count,
    },
    select: META,
  });
  res.status(201).json(photo);
}));

router.patch('/:id', ah(async (req, res) => {
  const p = await findOwned('unitPhoto', req.params.id, req.user.orgId);
  const data = {};
  if (req.body.caption !== undefined) data.caption = req.body.caption ? String(req.body.caption).slice(0, 200) : null;
  if (req.body.spaceId !== undefined) {
    if (req.body.spaceId) {
      const s = await prisma.space.findFirst({ where: { id: req.body.spaceId, orgId: req.user.orgId, unitId: p.unitId }, select: { id: true } });
      if (!s) throw new HttpError(422, 'That room is not in this apartment');
    }
    data.spaceId = req.body.spaceId || null;
  }
  if (req.body.cover === true) {
    await prisma.unitPhoto.updateMany({ where: { unitId: p.unitId }, data: { cover: false } });
    data.cover = true;
  }
  res.json(await prisma.unitPhoto.update({ where: { id: p.id }, data, select: META }));
}));

router.post('/reorder', ah(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 100) : [];
  const owned = await prisma.unitPhoto.findMany({ where: { id: { in: ids }, orgId: req.user.orgId }, select: { id: true } });
  const ok = new Set(owned.map(o => o.id));
  await prisma.$transaction(ids.filter(id => ok.has(id)).map((id, i) => prisma.unitPhoto.update({ where: { id }, data: { sort: i } })));
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  const p = await findOwned('unitPhoto', req.params.id, req.user.orgId);
  await prisma.unitPhoto.delete({ where: { id: p.id } });
  if (p.cover) {
    const next = await prisma.unitPhoto.findFirst({ where: { unitId: p.unitId }, orderBy: { sort: 'asc' }, select: { id: true } });
    if (next) await prisma.unitPhoto.update({ where: { id: next.id }, data: { cover: true } });
  }
  res.status(204).end();
}));

// Public image file (the id is a random UUID). Used by the CRM and by sakanly.com.
async function serve(req, res) {
  const id = String(req.params.id || '').replace(/\.(jpg|jpeg|png|webp)$/i, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Not found');
  const thumb = req.query.size === 'thumb';
  const p = await prisma.unitPhoto.findUnique({ where: { id }, select: { mime: true, ...(thumb ? { thumb: true } : { data: true }) } });
  if (!p) throw new HttpError(404, 'Not found');
  res.setHeader('Content-Type', thumb ? 'image/jpeg' : p.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(Buffer.from(thumb ? p.thumb : p.data));
}

module.exports = { router, serve: ah(serve) };
