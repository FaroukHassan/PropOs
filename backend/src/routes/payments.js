// backend/src/routes/payments.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// GET /api/payments?leaseId=&status=&month=2025-04
router.get('/', async (req, res, next) => {
  try {
    const { leaseId, status, month } = req.query;
    const where = {};
    if (leaseId) where.leaseId = leaseId;
    if (status) where.status = status;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.dueDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const payments = await prisma.payment.findMany({
      where: {
        ...where,
        lease: { unit: { property: { orgId: req.user.orgId } } },
      },
      include: {
        lease: { include: { tenant: true, unit: { include: { property: { select: { name: true } } } } } },
      },
      orderBy: { dueDate: 'desc' },
    });
    res.json(payments);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/mark-paid — manual payment recording
router.post('/:id/mark-paid', async (req, res, next) => {
  try {
    const { method, notes } = req.body;
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidDate: new Date(), method, notes },
    });
    res.json(payment);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/stripe-session — create Stripe checkout session for online rent pay
router.post('/:id/stripe-session', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { lease: { include: { tenant: true } } },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: payment.lease.tenant.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Rent Payment — ${payment.dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` },
          unit_amount: Math.round(payment.amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payments/${payment.id}?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/payments/${payment.id}?cancelled=1`,
      metadata: { paymentId: payment.id },
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/payments/stripe-webhook — Stripe webhook handler
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Webhook signature mismatch');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await prisma.payment.update({
      where: { id: session.metadata.paymentId },
      data: { status: 'PAID', paidDate: new Date(), method: 'STRIPE', stripeId: session.id },
    });
  }
  res.json({ received: true });
});

// GET /api/payments/overdue — mark overdue payments
router.post('/run-overdue-check', async (req, res, next) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const updated = await prisma.payment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: yesterday } },
      data: { status: 'OVERDUE' },
    });
    res.json({ updated: updated.count });
  } catch (err) { next(err); }
});

module.exports = router;
