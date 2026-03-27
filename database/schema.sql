-- PropOS Database Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  plan        VARCHAR(50) DEFAULT 'starter',   -- starter | pro | enterprise
  currency    VARCHAR(10) DEFAULT 'USD',
  timezone    VARCHAR(100) DEFAULT 'UTC',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  role            VARCHAR(50) DEFAULT 'manager',   -- owner | manager | staff | viewer
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROPERTIES ──────────────────────────────────────────────────────────────
CREATE TABLE properties (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) DEFAULT 'residential',  -- residential | commercial | mixed
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'Egypt',
  postal_code   VARCHAR(20),
  description   TEXT,
  image_url     TEXT,
  total_units   INTEGER DEFAULT 0,
  year_built    INTEGER,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── UNITS ───────────────────────────────────────────────────────────────────
CREATE TABLE units (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id   UUID REFERENCES properties(id) ON DELETE CASCADE,
  unit_number   VARCHAR(50) NOT NULL,
  floor         INTEGER,
  bedrooms      INTEGER DEFAULT 1,
  bathrooms     NUMERIC(3,1) DEFAULT 1,
  area_sqm      NUMERIC(10,2),
  base_rent     NUMERIC(12,2),
  status        VARCHAR(50) DEFAULT 'vacant',  -- vacant | occupied | maintenance | reserved
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, unit_number)
);

-- ─── TENANTS ─────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  national_id     VARCHAR(100),
  date_of_birth   DATE,
  emergency_name  VARCHAR(200),
  emergency_phone VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEASES ──────────────────────────────────────────────────────────────────
CREATE TABLE leases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id         UUID REFERENCES units(id) ON DELETE RESTRICT,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  monthly_rent    NUMERIC(12,2) NOT NULL,
  security_deposit NUMERIC(12,2) DEFAULT 0,
  payment_day     INTEGER DEFAULT 1,         -- day of month rent is due
  status          VARCHAR(50) DEFAULT 'active', -- active | expired | terminated | pending
  terms           TEXT,
  document_url    TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id        UUID REFERENCES leases(id) ON DELETE RESTRICT,
  tenant_id       UUID REFERENCES tenants(id),
  amount          NUMERIC(12,2) NOT NULL,
  payment_date    DATE,
  due_date        DATE NOT NULL,
  method          VARCHAR(50),               -- cash | bank_transfer | card | stripe
  status          VARCHAR(50) DEFAULT 'pending', -- pending | paid | late | overdue | partial
  reference       VARCHAR(255),
  stripe_id       VARCHAR(255),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXPENSES ────────────────────────────────────────────────────────────────
CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id),
  unit_id         UUID REFERENCES units(id),
  category        VARCHAR(100) NOT NULL,     -- maintenance | insurance | tax | utilities | management | other
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  expense_date    DATE NOT NULL,
  vendor          VARCHAR(255),
  receipt_url     TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MAINTENANCE REQUESTS ─────────────────────────────────────────────────────
CREATE TABLE maintenance_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id         UUID REFERENCES units(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),              -- plumbing | electrical | hvac | general | appliance
  priority        VARCHAR(50) DEFAULT 'normal', -- urgent | high | normal | low
  status          VARCHAR(50) DEFAULT 'open',   -- open | in_progress | resolved | cancelled
  assigned_to     VARCHAR(255),
  estimated_cost  NUMERIC(12,2),
  actual_cost     NUMERIC(12,2),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MAINTENANCE NOTES ───────────────────────────────────────────────────────
CREATE TABLE maintenance_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  note            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUDGET LINES ────────────────────────────────────────────────────────────
CREATE TABLE budget_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id),
  category        VARCHAR(100) NOT NULL,
  budget_month    DATE NOT NULL,             -- first day of the month
  budgeted_amount NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, property_id, category, budget_month)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_leases_unit ON leases(unit_id);
CREATE INDEX idx_leases_tenant ON leases(tenant_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_payments_lease ON payments(lease_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_expenses_property ON expenses(property_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_maintenance_unit ON maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_priority ON maintenance_requests(priority);
