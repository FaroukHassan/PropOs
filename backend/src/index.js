// backend/src/index.js — PropOS API (Sakanly edition)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');
const { authenticate, writeGuard } = require('./middleware/auth');
const { authorize } = require('./lib/permissions');
const portfolio = require('./routes/portfolio');
const occupancy = require('./routes/occupancy');
const money = require('./routes/money');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet());

// CORS: comma-separated list of allowed front-end origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')),
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ limit: '15mb' })); // signed contract scans are uploaded as base64

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', require('./routes/auth'));
const contracts = require('./routes/contracts');
const photos = require('./routes/photos');
app.get('/api/public/photo/:id', photos.serve); // apartment photos, for the CRM and the website
app.use('/api/public/site', require('./routes/website')); // sakanly.com: availability + enquiries
app.use('/api/public', contracts.pub); // tenant signing links, no login

const api = express.Router();
api.use(authenticate, writeGuard, authorize);
api.use('/buildings', portfolio.buildings);
api.use('/landlords', portfolio.landlords);
api.use('/units', portfolio.units);
api.use('/spaces', portfolio.spaces);
api.use('/tenants', occupancy.tenants);
api.use('/leases', occupancy.leases);
api.use('/bookings', occupancy.bookings);
api.use('/transactions', money.transactions);
api.use('/cheques', money.cheques);
api.use('/maintenance', money.maintenance);
api.use('/import', require('./routes/import'));
api.use('/leasing', require('./routes/leasing'));
api.use('/contracts', contracts.router);
api.use('/tenant-documents', require('./routes/documents'));
api.use('/invoices', require('./routes/invoices'));
api.use('/photos', photos.router);
api.use('/marketing', require('./routes/marketing'));
api.use('/', require('./routes/reports'));
app.use('/api', api);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => console.log(`PropOS API running on :${PORT}`));
}

module.exports = app;
