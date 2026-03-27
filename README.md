# PropOS — Property Management SaaS

A full-stack SaaS application for property management with integrated finance module.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Recharts |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (via Prisma ORM) |
| Auth | JWT + bcrypt |
| Styling | CSS Modules + CSS Variables |
| Payments | Stripe (rent collection) |

## Project Structure

```
propos/
├── frontend/          # React SPA
│   └── src/
│       ├── components/    # Shared UI components
│       ├── pages/         # Route-level pages
│       ├── hooks/         # Custom React hooks
│       ├── context/       # Auth & App context
│       └── utils/         # API client, helpers
├── backend/           # Express API
│   └── src/
│       ├── routes/        # API route definitions
│       ├── controllers/   # Business logic
│       ├── models/        # Prisma schema
│       └── middleware/    # Auth, error handling
└── README.md
```

## Modules

- **Dashboard** — KPIs, revenue chart, occupancy, recent activity
- **Properties** — CRUD for property portfolio
- **Tenants** — Tenant profiles, contact info, history
- **Leases** — Lease agreements, renewals, expirations
- **Maintenance** — Request queue, priorities, assignment
- **Finance** — Rent collection, transactions, P&L, expenses
- **Reports** — PDF export of financial & operational reports

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in DB_URL, JWT_SECRET, STRIPE_KEY
npx prisma migrate dev
npm run dev                 # starts on :4000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL=http://localhost:4000
npm run dev                 # starts on :5173
```

## Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql://user:pass@localhost:5432/propos
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_...
PORT=4000
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:4000/api
```
