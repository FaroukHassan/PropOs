# Deploying PropOS

The API and database run on **Railway** (about $5/month on the Hobby plan). The website runs on **GitHub Pages** (free). Both redeploy automatically when code is pushed to `main`.

## 1. API and database on Railway

1. In Railway, open (or create) the project and connect the GitHub repo **FaroukHassan/PropOs**.
2. Service **Settings → Root Directory**: `backend`. Railway reads `backend/railway.json`.
3. Add a **PostgreSQL** database to the project.
4. Service **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Reference → Postgres → `DATABASE_URL` |
   | `JWT_SECRET` | A long random string (64+ characters) |
   | `ALLOWED_ORIGINS` | `https://faroukhassan.github.io` |
   | `SEED_PASSWORD` | A temporary password for the three team logins |
   | `NODE_ENV` | `production` |

5. **Settings → Networking → Generate Domain**. Open `https://<domain>/health`; it should show `{"status":"ok"}`.

Each deploy runs `prisma migrate deploy` (database changes), then `prisma/seed.js` (it only creates the Sakanly organisation and the team logins if they are missing; it never adds sample data in production), then starts the API.

> **Upgrading from the first PropOS version.** The old database tables do not match this version. Delete the old Postgres service and add a new one, or run `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` in its Query tab, before the first deploy. The old data was sample data only.

## 2. Website on GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables → New variable**: `API_URL` = `https://<railway-domain>/api`.
3. **Actions → Deploy website → Run workflow** (afterwards it runs on every push that touches `frontend/`).
4. The site is at `https://faroukhassan.github.io/PropOs/`.

## 3. First sign-in

- Sign in as `farouk@sakanly.com`, `khalil@sakanly.com` or `info@sakanly.com` with `SEED_PASSWORD`.
- Everyone changes their password under **Settings → Change password**.
- Then remove `SEED_PASSWORD` from the Railway variables. It is only used when an account is first created.

## 4. Load Sakanly's data

Use the import script in the README (`scripts/import_sakanly_workbook.py`) with `--api https://<railway-domain>/api`, or paste sheets on the **Import from sheets** page.

## Troubleshooting

| What you see | Fix |
|---|---|
| Website says "Cannot reach the server" | `API_URL` variable is wrong or the Railway service is down; check `/health` |
| Sign-in works locally but not on the site | `ALLOWED_ORIGINS` must be exactly `https://faroukhassan.github.io` (no path, no trailing slash) |
| Deploy fails at `prisma migrate deploy` with "relation already exists" | Old tables from the first version: see the upgrade note above |
| Railway crashes with "JWT_SECRET must be set" | Add the `JWT_SECRET` variable |
