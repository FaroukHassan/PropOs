// backend/src/routes/photos.js — photos of apartments and of single rooms / beds.
// The browser resizes photos before upload (about 1600 px plus a 480 px thumbnail), so files stay small.
// Videos: the browser sends a poster frame first, then the file itself (PUT /:id/file, up to 80 MB),
// or just a link to a video kept elsewhere (YouTube, Google Drive, Instagram, TikTok).
const express = require('express');
const prisma = require('../db');
const { findOwned, assertOwned } = require('../lib/crud');
const { ah, HttpError } = require('../middleware/errorHandler');

const META = { id: true, unitId: true, spaceId: true, kind: true, url: true, size: true, duration: true, mime: true, width: true, height: true, caption: true, cover: true, sort: true, createdAt: true };
const VIDEO_MAX = 80 * 1024 * 1024;
const LIMIT = { PHOTO: 60, VIDEO: 15 };

function videoMime(buf) {
  const h = buf.subarray(0, 12).toString('latin1');
  if (h.slice(4, 8) === 'ftyp') return h.slice(8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

function cleanUrl(u) {
  let url;
  try { url = new URL(String(u || '').trim()); } catch { throw new HttpError(422, 'Paste a full video link (https://…)'); }
  if (url.protocol !== 'https:') throw new HttpError(422, 'Paste a full video link (https://…)');
  return url.toString().slice(0, 500);
}

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
  const kind = req.body.kind === 'VIDEO' ? 'VIDEO' : 'PHOTO';
  const count = await prisma.unitPhoto.count({ where: { unitId, kind } });
  if (count >= LIMIT[kind]) throw new HttpError(422, kind === 'VIDEO' ? 'An apartment can have up to 15 videos' : 'An apartment can have up to 60 photos');
  const caption = req.body.caption ? String(req.body.caption).slice(0, 200) : null;
  const sort = await prisma.unitPhoto.count({ where: { unitId } });
  let data;
  if (kind === 'VIDEO') {
    const url = req.body.url ? cleanUrl(req.body.url) : null;
    const poster = req.body.thumb ? image(req.body.thumb, 600 * 1024, 'Poster') : null;
    data = {
      orgId, unitId, spaceId: spaceId || null, kind, url, thumb: poster?.buf || null,
      mime: url ? 'text/uri-list' : 'video/mp4', // set from the file when it arrives
      width: Number(req.body.width) || null, height: Number(req.body.height) || null,
      duration: Math.round(Number(req.body.duration)) || null, caption, sort,
    };
  } else {
    const full = image(req.body.data, 4 * 1024 * 1024, 'Photo');
    const thumb = image(req.body.thumb || req.body.data, 600 * 1024, 'Thumbnail');
    const hasCover = await prisma.unitPhoto.count({ where: { unitId, cover: true } });
    data = {
      orgId, unitId, spaceId: spaceId || null, kind, data: full.buf, thumb: thumb.buf, mime: full.mime, size: full.buf.length,
      width: Number(req.body.width) || null, height: Number(req.body.height) || null, caption,
      cover: !hasCover, sort,
    };
  }
  const photo = await prisma.unitPhoto.create({ data, select: META });
  res.status(201).json(photo);
}));

// The video file itself, sent as the raw body after POST created the entry with its poster
router.put('/:id/file', express.raw({ type: () => true, limit: VIDEO_MAX }), ah(async (req, res) => {
  const p = await findOwned('unitPhoto', req.params.id, req.user.orgId);
  if (p.kind !== 'VIDEO' || p.url) throw new HttpError(422, 'This item does not take a video file');
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buf.length) throw new HttpError(422, 'The video is missing');
  const mime = videoMime(buf);
  if (!mime) throw new HttpError(422, 'Upload a video (MP4, MOV or WebM)');
  cache.delete(p.id);
  res.json(await prisma.unitPhoto.update({ where: { id: p.id }, data: { data: buf, mime, size: buf.length }, select: META }));
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
    if (p.kind !== 'PHOTO') throw new HttpError(422, 'Only a photo can be the cover');
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
  cache.delete(p.id);
  if (p.cover) {
    const next = await prisma.unitPhoto.findFirst({ where: { unitId: p.unitId, kind: 'PHOTO' }, orderBy: { sort: 'asc' }, select: { id: true } });
    if (next) await prisma.unitPhoto.update({ where: { id: next.id }, data: { cover: true } });
  }
  res.status(204).end();
}));

// Videos are read in pieces by the player, so keep the last few in memory instead of reading
// the whole file from the database for every piece.
const cache = new Map(); // id → { buf, mime }
const CACHE_MAX = 200 * 1024 * 1024;
function remember(id, entry) {
  cache.set(id, entry);
  let total = [...cache.values()].reduce((n, e) => n + e.buf.length, 0);
  for (const k of cache.keys()) { if (total <= CACHE_MAX) break; total -= cache.get(k).buf.length; cache.delete(k); }
}

// Public file (the id is a random UUID). Used by the CRM, the marketing team and sakanly.com.
async function serve(req, res) {
  const id = String(req.params.id || '').replace(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Not found');
  const thumb = req.query.size === 'thumb';
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (thumb) {
    const p = await prisma.unitPhoto.findUnique({ where: { id }, select: { thumb: true } });
    if (!p || !p.thumb) throw new HttpError(404, 'Not found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.from(p.thumb));
  }
  let entry = cache.get(id);
  if (!entry) {
    const p = await prisma.unitPhoto.findUnique({ where: { id }, select: { mime: true, kind: true, url: true, data: true } });
    if (!p) throw new HttpError(404, 'Not found');
    if (p.url) return res.redirect(302, p.url);
    if (!p.data) throw new HttpError(404, 'This video is still uploading');
    entry = { buf: Buffer.from(p.data), mime: p.mime, video: p.kind === 'VIDEO' };
    if (entry.video) remember(id, entry);
  }
  res.setHeader('Content-Type', entry.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  if (req.query.download) {
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[entry.mime] || 'bin';
    const name = String(req.query.download).replace(/[^\w .-]/g, '').slice(0, 80) || 'sakanly';
    res.setHeader('Content-Disposition', `attachment; filename="${name}.${ext}"`);
  }
  const size = entry.buf.length;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start < 0) start = 0;
    if (start >= size || start > end) { res.setHeader('Content-Range', `bytes */${size}`); return res.status(416).end(); }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    return res.send(entry.buf.subarray(start, end + 1));
  }
  res.send(entry.buf);
}

module.exports = { router, serve: ah(serve) };
