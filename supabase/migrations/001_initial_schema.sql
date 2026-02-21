-- ─── MedSpa Dashboard — Initial Schema ───────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor, OR via `supabase db push`
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto for gen_random_uuid() (pre-installed in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Helper: auto-update updated_at ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Table: clients ───────────────────────────────────────────────────────────
-- One row per tenant. This is the source of truth for branding + integrations.
-- New client = one INSERT. Zero code changes required.

CREATE TABLE IF NOT EXISTS clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,        -- internal key, used in subdomains
  subdomain             TEXT UNIQUE,                 -- optional, if different from slug
  custom_domain         TEXT UNIQUE,                 -- e.g. portal.luxeclinic.com
  logo_url              TEXT,
  brand_color           TEXT,                        -- hex e.g. #0EA5E9
  accent_color          TEXT,
  theme_mode            TEXT NOT NULL DEFAULT 'dark',
  retell_agent_id       TEXT,
  retell_phone_number   TEXT,
  n8n_webhook_url       TEXT,
  n8n_api_key_ref       TEXT,                        -- secret manager reference, NOT the key
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  retainer_expiry       TIMESTAMPTZ,
  timezone              TEXT NOT NULL DEFAULT 'America/New_York',
  currency              TEXT NOT NULL DEFAULT 'USD',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Table: call_logs ─────────────────────────────────────────────────────────
-- One row per post-call webhook from Retell/n8n.
-- Tenant isolation: every query MUST filter by client_id.
-- TODO: Add RLS policy once auth is wired.

CREATE TABLE IF NOT EXISTS call_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  external_call_id      TEXT,                        -- Retell call ID (optional, indexed)
  caller_name           TEXT,
  caller_phone          TEXT,
  semantic_title        TEXT,                        -- AI-generated call title
  call_type             TEXT,                        -- see CallType in types/database.ts
  summary               TEXT,
  transcript            TEXT,
  recording_url         TEXT,
  duration_seconds      INTEGER NOT NULL DEFAULT 0,
  potential_revenue     INTEGER NOT NULL DEFAULT 0,  -- conservative estimated pipeline $
  booked_value          INTEGER NOT NULL DEFAULT 0,  -- confirmed booked revenue $
  inquiries_value       INTEGER NOT NULL DEFAULT 0,  -- expressed interest value $
  is_booked             BOOLEAN NOT NULL DEFAULT FALSE,
  lead_confidence       NUMERIC(3,2),                -- 0.00–1.00
  is_lead               BOOLEAN NOT NULL DEFAULT FALSE,
  human_followup_needed BOOLEAN NOT NULL DEFAULT FALSE,
  human_followup_reason TEXT,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  raw_payload           JSONB,                       -- full source webhook payload
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_call_logs_client_created
  ON call_logs(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_external_id
  ON call_logs(external_call_id)
  WHERE external_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_call_type
  ON call_logs(client_id, call_type);

CREATE INDEX IF NOT EXISTS idx_call_logs_is_booked
  ON call_logs(client_id, is_booked);

CREATE TRIGGER call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Table: services_catalog ─────────────────────────────────────────────────
-- Per-client price map for future ROI precision.
-- Maps service names/aliases to price ranges for auto-valuation of calls.

CREATE TABLE IF NOT EXISTS services_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_name  TEXT NOT NULL,
  aliases       TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ARRAY['botox', 'tox', 'neurotoxin']
  price_min     INTEGER,
  price_max     INTEGER,
  avg_price     INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_catalog_client
  ON services_catalog(client_id);

CREATE TRIGGER services_catalog_updated_at
  BEFORE UPDATE ON services_catalog
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Table: kb_versions ──────────────────────────────────────────────────────
-- Knowledge base versions for the AI receptionist (future feature).
-- Tracks which KB is active per client for rollback / audit.

CREATE TABLE IF NOT EXISTS kb_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  content       TEXT NOT NULL,
  source        TEXT,        -- 'dashboard' | 'n8n' | 'api'
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_client
  ON kb_versions(client_id, created_at DESC);

-- ─── Row Level Security (RLS) — TO BE ENABLED WITH AUTH ──────────────────────
-- Uncomment and customize when Supabase Auth is integrated.
--
-- ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_read_own_logs" ON call_logs
--   FOR SELECT USING (
--     client_id = (
--       SELECT id FROM clients WHERE slug = auth.jwt() ->> 'tenant_slug'
--     )
--   );
--
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_read_own_config" ON clients
--   FOR SELECT USING (id::text = auth.uid()::text);
-- ─────────────────────────────────────────────────────────────────────────────
