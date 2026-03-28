// backend/src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes        = require('./routes/auth');
const propertiesRoutes  = require('./routes/properties');
const tenantsRoutes     = require('./routes/tenants');
const leasesRoutes      = require('./routes/leases');
const paymentsRoutes    = require('./routes/payments');
const maintenanceRoutes = require('./routes/maintenance');
const financeRoutes     = require('./routes/finance');
const reportsRoutes     = require('./routes/reports');
const { errorHandler }  = require('./middleware/errorHandler');
const { authenticate }  = require('./middleware/auth');
const { resolveTenant } = require('./middleware/tenant');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());

// CORS — allow multiple origins for multi-tenant subdomains
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    // Allow any subdomain of the main domain
    const mainDomain = process.env.MAIN_DOMAIN; // e.g. propos.app
    if (mainDomain && origin.endsWith(mainDomain)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

// ─── Tenant resolution (subdomain → org) ─────────────────────────────────────
app.use(resolveTenant);

// ─── Public routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/properties',  authenticate, propertiesRoutes);
app.use('/api/tenants',     authenticate, tenantsRoutes);
app.use('/api/leases',      authenticate, leasesRoutes);
app.use('/api/payments',    authenticate, paymentsRoutes);
app.use('/api/maintenance', authenticate, maintenanceRoutes);
app.use('/api/finance',     authenticate, financeRoutes);
app.use('/api/reports',     authenticate, reportsRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => console.log(`PropOS API running on :${PORT}`));
