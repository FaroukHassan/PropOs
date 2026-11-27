// backend/src/routes/marketing.js — the marketing team's media library: every apartment and
// partition with its photos and videos, what is free to advertise, and what still needs shooting.
const express = require('express');
const prisma = require('../db');
const { ah } = require('../middleware/errorHandler');
const { unitWhere } = require('../lib/scope');

const byCode = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
const MEDIA = { id: true, spaceId: true, kind: true, url: true, size: true, duration: true, mime: true, width: true, height: true, caption: true, cover: true, sort: true, createdAt: true };

const router = express.Router();

router.get('/library', ah(async (req, res) => {
  const units = await prisma.unit.findMany({
    where: { orgId: req.user.orgId, active: true, ...unitWhere(req.query) },
    include: {
      building: { select: { id: true, name: true, area: true } },
      spaces: { select: { id: true, code: true, kind: true, status: true, monthlyRate: true, deposit: true, availableFrom: true, amenities: true } },
      photos: { select: MEDIA, orderBy: [{ cover: 'desc' }, { sort: 'asc' }, { createdAt: 'asc' }] },
    },
    orderBy: [{ building: { name: 'asc' } }, { number: 'asc' }],
  });
  const out = units.map(u => ({
    id: u.id, number: u.number, mode: u.mode, occupancy: u.occupancy, amenities: u.amenities,
    building: u.building, nightlyRate: u.nightlyRate ?? null, monthlyRent: u.monthlyRent ?? null,
    spaces: [...u.spaces].sort(byCode), media: u.photos,
  }));
  const rooms = out.flatMap(u => u.spaces.map(s => ({ s, media: u.media.filter(m => m.spaceId === s.id || !m.spaceId) })));
  const free = rooms.filter(r => r.s.status === 'AVAILABLE' || r.s.status === 'RESERVED');
  res.json({
    units: out,
    totals: {
      photos: units.reduce((n, u) => n + u.photos.filter(m => m.kind === 'PHOTO').length, 0),
      videos: units.reduce((n, u) => n + u.photos.filter(m => m.kind === 'VIDEO').length, 0),
      rooms: rooms.length,
      freeRooms: free.length,
      freeNoPhotos: free.filter(r => !r.media.some(m => m.kind === 'PHOTO')).length,
      freeNoVideo: free.filter(r => !r.media.some(m => m.kind === 'VIDEO')).length,
    },
  });
}));

module.exports = router;
