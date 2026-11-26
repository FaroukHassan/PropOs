// backend/src/lib/crud.js — org-scoped CRUD routes built from a field spec.
const express = require('express');
const prisma = require('../db');
const { ah, HttpError } = require('../middleware/errorHandler');

// Which Prisma model each foreign-key field points at (used to check it belongs to the same org)
const REF_MODELS = {
  buildingId: 'building', unitId: 'unit', spaceId: 'space', landlordId: 'landlord',
  tenantId: 'tenant', leaseId: 'lease', bookingId: 'booking', chequeId: 'cheque', dealId: 'leasingDeal',
};

function coerce(type, value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  switch (type) {
    case 'string': return String(value).trim();
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
      if (Number.isNaN(n)) throw new HttpError(422, `${field} must be a number`);
      return n;
    }
    case 'int': {
      const n = parseInt(value, 10);
      if (Number.isNaN(n)) throw new HttpError(422, `${field} must be a whole number`);
      return n;
    }
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) throw new HttpError(422, `${field} must be a date`);
      return d;
    }
    case 'bool': return value === true || value === 'true' || value === 1 || value === '1';
    default: return value; // enums and ids are passed through; Prisma validates enums
  }
}

// Build Prisma data from a request body using the spec. `partial` skips required checks.
async function pick(spec, body, orgId, { partial = false } = {}) {
  const data = {};
  for (const [field, def] of Object.entries(spec)) {
    const { type, required } = typeof def === 'string' ? { type: def } : def;
    const v = coerce(type, body[field], field);
    if (v === undefined || v === null) {
      if (required && (!partial || v === null)) throw new HttpError(422, `${field} is required`);
      if (v === undefined) continue;
    }
    if (v !== null && REF_MODELS[field]) await assertOwned(REF_MODELS[field], v, orgId);
    data[field] = v;
  }
  return data;
}

async function assertOwned(model, id, orgId) {
  const row = await prisma[model].findFirst({ where: { id, orgId }, select: { id: true } });
  if (!row) throw new HttpError(422, `${model} not found`);
  return row;
}

async function findOwned(model, id, orgId, include) {
  const row = await prisma[model].findFirst({ where: { id, orgId }, ...(include ? { include } : {}) });
  if (!row) throw new HttpError(404, 'Not found');
  return row;
}

/**
 * crudRouter({ model, spec, include, orderBy, filters, search, beforeSave })
 *   filters: query params passed straight through as equality filters (e.g. ['unitId','status'])
 *   search:  string fields matched by ?q=
 *   scope:   query → extra where (e.g. the app-wide apartment filter)
 */
function crudRouter({ model, spec, include, listInclude, orderBy = { createdAt: 'desc' }, filters = [], search = [], scope, beforeSave, afterSave, router = express.Router() }) {
  router.get('/', ah(async (req, res) => {
    const where = { orgId: req.user.orgId };
    for (const f of filters) if (req.query[f]) where[f] = req.query[f];
    if (scope) Object.assign(where, scope(req.query));
    if (req.query.q && search.length) {
      where.OR = search.map(f => ({ [f]: { contains: req.query.q, mode: 'insensitive' } }));
    }
    res.json(await prisma[model].findMany({ where, include: listInclude || include, orderBy }));
  }));

  router.get('/:id', ah(async (req, res) => {
    res.json(await findOwned(model, req.params.id, req.user.orgId, include));
  }));

  router.post('/', ah(async (req, res) => {
    let data = await pick(spec, req.body, req.user.orgId);
    if (beforeSave) data = await beforeSave(data, req, null);
    const row = await prisma[model].create({ data: { ...data, orgId: req.user.orgId }, include });
    if (afterSave) await afterSave(row, req, null);
    res.status(201).json(row);
  }));

  router.patch('/:id', ah(async (req, res) => {
    const existing = await findOwned(model, req.params.id, req.user.orgId);
    let data = await pick(spec, req.body, req.user.orgId, { partial: true });
    if (beforeSave) data = await beforeSave(data, req, existing);
    const row = await prisma[model].update({ where: { id: existing.id }, data, include });
    if (afterSave) await afterSave(row, req, existing);
    res.json(row);
  }));

  router.delete('/:id', ah(async (req, res) => {
    const existing = await findOwned(model, req.params.id, req.user.orgId);
    await prisma[model].delete({ where: { id: existing.id } });
    res.status(204).send();
  }));

  return router;
}

module.exports = { crudRouter, pick, coerce, assertOwned, findOwned };
