// backend/src/routes/website.js — what sakanly.com reads and sends: rooms and homes available
// right now (no tenant data), and enquiries that land in Leasing as new leads.
const express = require('express');
const cors = require('cors');
const prisma = require('../db');
const { ah, HttpError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(cors()); // the public website may call these from any origin

let orgCache;
async function orgId() {
  if (orgCache) return orgCache;
  const org = process.env.WEBSITE_ORG_SLUG
    ? await prisma.org.findUnique({ where: { slug: process.env.WEBSITE_ORG_SLUG } })
    : await prisma.org.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new HttpError(503, 'Not set up yet');
  orgCache = org.id;
  return orgCache;
}

const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cacheFor = (res, seconds) => res.setHeader('Cache-Control', `public, max-age=${seconds}`);

// Shared-living rooms and beds free now (or soon), with their real prices
router.get('/rooms', ah(async (req, res) => {
  const spaces = await prisma.space.findMany({
    where: { orgId: await orgId(), status: 'AVAILABLE', unit: { is: { active: true, onWebsite: true, mode: 'PARTITIONS' } } },
    include: {
      unit: { include: { building: true, photos: { select: { id: true, spaceId: true, cover: true }, orderBy: [{ cover: 'desc' }, { sort: 'asc' }] } } },
    },
    orderBy: [{ monthlyRate: 'asc' }],
  });
  cacheFor(res, 120);
  res.json(spaces.map(s => ({
    id: s.id, code: s.code, kind: s.kind, price: s.monthlyRate, deposit: s.deposit, capacity: s.capacity,
    availableFrom: s.availableFrom && s.availableFrom > new Date() ? s.availableFrom.toISOString().slice(0, 10) : null,
    amenities: s.amenities || s.unit.amenities || null,
    apartment: s.unit.number, occupancy: s.unit.occupancy,
    building: s.unit.building.name, buildingSlug: slug(s.unit.building.name), area: s.unit.building.area || null,
    // this room's own photos first, then the apartment's shared photos
    photos: [...s.unit.photos.filter(p => p.spaceId === s.id), ...s.unit.photos.filter(p => !p.spaceId)].slice(0, 12).map(p => p.id),
  })));
}));

// Holiday homes listed on the website
router.get('/homes', ah(async (req, res) => {
  const units = await prisma.unit.findMany({
    where: { orgId: await orgId(), active: true, onWebsite: true, mode: 'HOLIDAY' },
    include: { building: true, photos: { select: { id: true }, orderBy: [{ cover: 'desc' }, { sort: 'asc' }], take: 20 } },
    orderBy: [{ nightlyRate: 'asc' }],
  });
  cacheFor(res, 300);
  res.json(units.map(u => ({
    id: u.id, building: u.building.name, buildingSlug: slug(u.building.name), area: u.building.area || null,
    bedrooms: u.bedrooms, bathrooms: u.bathrooms, nightlyRate: u.nightlyRate, monthlyRent: u.monthlyRent,
    amenities: u.amenities || null, airbnbUrl: u.airbnbUrl || null, bookingUrl: u.bookingUrl || null,
    photos: u.photos.map(p => p.id),
  })));
}));

// ── Enquiries → Leasing (status Lead, source Website) ──
const TYPES = {
  rent: 'Rent a home', shared: 'Shared living', stay: 'Holiday stay', owner: 'Owner — rental estimate',
  buy: 'Buy', contact: 'Contact form', careers: 'Careers',
};
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 12;
}
const clip = (v, n = 200) => (v === undefined || v === null || v === '' ? null : String(v).trim().slice(0, n));

router.post('/leads', ah(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot field filled by bots
  if (tooMany(req.ip)) throw new HttpError(429, 'Too many requests, please try again later or message us on WhatsApp');
  const type = TYPES[b.type] ? b.type : 'contact';
  const name = clip(b.name, 120);
  const phone = clip(b.phone, 40);
  if (!name || name.length < 2) throw new HttpError(422, 'Please tell us your name');
  if (!phone || phone.replace(/\D/g, '').length < 7) throw new HttpError(422, 'Please add a phone or WhatsApp number');
  const d = b.details && typeof b.details === 'object' ? b.details : {};
  const lines = Object.entries(d).filter(([, v]) => v !== '' && v != null).slice(0, 20).map(([k, v]) => `${k}: ${clip(v, 300)}`);
  const notes = [`Website enquiry — ${TYPES[type]}`, ...lines, clip(b.message, 2000) && `Message: ${clip(b.message, 2000)}`, clip(b.page, 200) && `Page: ${clip(b.page, 200)}`, b.lang === 'ar' && 'Language: Arabic']
    .filter(Boolean).join('\n');
  const id = await orgId();
  const months = Number(d.months) || null;
  const data = {
    orgId: id, status: 'LEAD', source: 'Website', clientName: name, clientPhone: phone, clientEmail: clip(b.email, 120),
    contractType: d.term === 'yearly' || type === 'owner' || type === 'buy' ? 'YEARLY' : 'SHORT_TERM',
    property: clip(d.building || d.property || d.home, 120), area: clip(d.area, 80), unitType: clip(d.unitType || d.room, 60),
    rent: Number(d.budget) || null, months: months && months > 0 && months < 13 ? months : null,
    moveIn: d.moveIn && !Number.isNaN(new Date(d.moveIn).getTime()) ? new Date(d.moveIn) : null,
    followUpAt: new Date(), notes,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.leasingDeal.findFirst({ where: { orgId: id }, orderBy: { number: 'desc' }, select: { number: true } });
    try {
      await prisma.leasingDeal.create({ data: { ...data, number: (last?.number || 0) + 1 } });
      return res.status(201).json({ ok: true });
    } catch (e) { if (e.code !== 'P2002') throw e; }
  }
  throw new HttpError(503, 'Please try again');
}));

module.exports = router;
