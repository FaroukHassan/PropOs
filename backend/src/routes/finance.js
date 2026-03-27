// backend/src/routes/finance.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/finance/summary?year=2025&month=4
// Returns: totalRevenue, totalExpenses, NOI, collectionRate
router.get('/summary', async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const from  = new Date(year, month - 1, 1);
    const to    = new Date(year, month, 1);

    const [paidPayments, expenses, totalPayments] = await Promise.all([
      // Revenue: all PAID payments in range
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'PAID',
          paidDate: { gte: from, lt: to },
          lease: { unit: { property: { orgId: req.user.orgId } } },
        },
      }),
      // Expenses in range
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { orgId: req.user.orgId, date: { gte: from, lt: to } },
      }),
      // All payments due (for collection rate)
      prisma.payment.count({
        where: {
          dueDate: { gte: from, lt: to },
          status: { not: 'WAIVED' },
          lease: { unit: { property: { orgId: req.user.orgId } } },
        },
      }),
    ]);

    const paidCount = await prisma.payment.count({
      where: {
        status: 'PAID',
        paidDate: { gte: from, lt: to },
        lease: { unit: { property: { orgId: req.user.orgId } } },
      },
    });

    const totalRevenue  = paidPayments._sum.amount || 0;
    const totalExpenses = expenses._sum.amount || 0;

    res.json({
      totalRevenue,
      totalExpenses,
      noi: totalRevenue - totalExpenses,
      collectionRate: totalPayments > 0 ? (paidCount / totalPayments) * 100 : 0,
    });
  } catch (err) { next(err); }
});

// GET /api/finance/revenue-trend?months=6
router.get('/revenue-trend', async (req, res, next) => {
  try {
    const months = parseInt(req.query.months || 6);
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const from = new Date(d.getFullYear(), d.getMonth(), 1);
      const to   = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const [rev, exp] = await Promise.all([
        prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidDate: { gte: from, lt: to }, lease: { unit: { property: { orgId: req.user.orgId } } } } }),
        prisma.expense.aggregate({ _sum: { amount: true }, where: { orgId: req.user.orgId, date: { gte: from, lt: to } } }),
      ]);

      result.push({
        month: from.toLocaleString('default', { month: 'short' }),
        year: from.getFullYear(),
        revenue: rev._sum.amount || 0,
        expenses: exp._sum.amount || 0,
      });
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/finance/expenses?propertyId=&category=
router.get('/expenses', async (req, res, next) => {
  try {
    const { propertyId, category } = req.query;
    const where = { orgId: req.user.orgId };
    if (propertyId) where.propertyId = propertyId;
    if (category)   where.category   = category;

    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
    res.json(expenses);
  } catch (err) { next(err); }
});

// POST /api/finance/expenses
router.post('/expenses', [
  body('category').notEmpty(),
  body('description').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('date').isISO8601(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const expense = await prisma.expense.create({ data: { ...req.body, orgId: req.user.orgId } });
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/finance/expense-breakdown?year=2025&month=4
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const from  = new Date(year, month - 1, 1);
    const to    = new Date(year, month, 1);

    const breakdown = await prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { orgId: req.user.orgId, date: { gte: from, lt: to } },
    });

    res.json(breakdown.map(b => ({ category: b.category, total: b._sum.amount })));
  } catch (err) { next(err); }
});

module.exports = router;
