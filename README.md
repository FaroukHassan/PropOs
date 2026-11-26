# PropOS — Sakanly edition

The operating system for **Sakanly Stay Holiday Homes**: partitions and bed-spaces, holiday homes, long-term lets, rent collection, cheques, landlords and owner statements in one place. Built for the internal team (Farouk, Mohamed Khalil, Ahmed Fawzy).

| | |
|---|---|
| **Website** | React 18 + Vite, served from GitHub Pages |
| **API** | Node.js + Express, on Railway |
| **Database** | PostgreSQL via Prisma, on Railway |

## What it does

- **Partitions board.** Every building, flat and partition/bed as a tile: available, occupied, reserved or not ready, with the tenant and rent. Click a tile to move a tenant in, record rent or move them out (with the deposit refund). One button copies the available list, formatted for WhatsApp.
- **Apartments.** Each flat is *Partitions*, *Holiday home* or *Long-term*. It is either leased from a landlord (annual rent paid by cheques), managed for an owner (fee %), or owned.
- **Holiday bookings.** A month calendar per home, with Airbnb / Booking.com / direct channels, commission, Tourism Dirham and cleaning fee. Occupancy and average nightly rate are calculated.
- **Rent collection.** Who has paid for the month, part payments, overdue, a one-click WhatsApp reminder in English and Arabic, and CSV export.
- **Income & expenses.** One ledger for rent, deposits, DEWA, internet, salaries, landlord rent, commission and refunds, linked to the flat and partition. Entries can be marked *estimated* until the receipt is checked.
- **Cheques.** Issued to landlords and received from tenants. Colours follow the team's sheet: **yellow = paid, green = postponed (with the new date), white = pending**, red = bounced. Marking a cheque paid records it in the ledger once. Add a year of post-dated cheques in one go.
- **Reports.** Monthly profit & loss and profit per apartment (income, landlord rent, DEWA, other costs), plus a printable owner statement for managed homes.
- **Maintenance.** Requests per flat/partition with priority, assignee and cost.
- **Import.** Paste rows from Google Sheets (availability, transaction log, cheques), preview, then import. Running an import twice does not create duplicates.
- **Team.** Admin, Manager and Read-only accounts.

## Running it on your computer

```bash
# API
cd backend
cp .env.example .env              # set DATABASE_URL to a local PostgreSQL
npm install
npx prisma migrate deploy
SEED_PASSWORD=choose-one SEED_DEMO=1 node prisma/seed.js   # team logins + sample data
npm run dev                        # http://localhost:4000

# Website (second terminal)
cd frontend
npm install
npm run dev                        # http://localhost:5173 (talks to the API through /api)
```

Sign in as `farouk@sakanly.com` with the password you chose.

Tests: `cd backend && npm test` (needs a database seeded with `SEED_DEMO=1`). GitHub runs them on every push.

## Bringing in Sakanly's existing sheets

**From the website:** *Import from sheets* → choose what you are importing → copy the table from Google Sheets including the header row → paste → *Preview* → *Import*.

**The full operations workbook** (the one with `UNIT PAYMENTS`, `BANK` and the month sheet such as `NOVMBER`):

```bash
cd backend
pip install openpyxl
python3 scripts/import_sakanly_workbook.py SAKANLY_2.xlsx \
  --api https://<your-railway-url>/api --email farouk@sakanly.com --dry-run   # check first
python3 scripts/import_sakanly_workbook.py SAKANLY_2.xlsx \
  --api https://<your-railway-url>/api --email farouk@sakanly.com
```

It creates the buildings, flats, partitions and current tenants, then the bank ledger (rent counted toward the month named in the description), then the landlord payments. The colour of each date cell sets the payment's status: yellow = paid, green = postponed (new date taken from the last column), white = pending.

> The repository is public. Never commit spreadsheets, exports or anything with tenant names; `.gitignore` blocks `.xlsx` and `.csv` files.

## Deploying

See [DEPLOY.md](DEPLOY.md).
