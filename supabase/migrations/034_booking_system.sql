-- ============================================================================
-- Migration 034: Booking System — Categories, Services, Bookings, Jane Integration
--
-- Creates tables for the public booking page (/book/:slug):
--   - tenant_service_categories: service groupings (Aesthetics, Acupuncture, etc.)
--   - tenant_services: individual bookable services with pricing
--   - bookings: patient appointment records with Jane App sync
--   - jane_integrations: OAuth tokens for Jane App API
--
-- Idempotent — safe for fresh installs and reruns.
-- ============================================================================

-- ── Service categories ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_service_categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  sort_order    int         NOT NULL DEFAULT 0,
  campaign_types text[],
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_tenant
  ON tenant_service_categories (tenant_id, sort_order);

-- ── Bookable services ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_services (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category_id     uuid        REFERENCES tenant_service_categories(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  duration_minutes int        NOT NULL,
  price_cents     int         NOT NULL DEFAULT 0,
  currency        text        NOT NULL DEFAULT 'cad',
  practitioners   text[],
  is_active       boolean     NOT NULL DEFAULT true,
  sort_order      int         NOT NULL DEFAULT 0,
  price_varies    boolean     NOT NULL DEFAULT false,
  jane_treatment_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_services_tenant
  ON tenant_services (tenant_id, category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_tenant_services_active
  ON tenant_services (tenant_id)
  WHERE is_active = true;

-- ── Bookings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id               uuid        REFERENCES tenant_services(id),
  call_log_id              uuid        REFERENCES call_logs(id),

  patient_name             text        NOT NULL,
  patient_phone            text,
  patient_email            text,
  patient_notes            text,

  appointment_date         date        NOT NULL,
  appointment_time         time        NOT NULL,
  practitioner_name        text,
  duration_minutes         int,

  amount_cents             int         NOT NULL DEFAULT 0,
  currency                 text        NOT NULL DEFAULT 'cad',
  payment_status           text        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'pending_jane' | 'paid' | 'free'

  status                   text        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

  source                   text        NOT NULL DEFAULT 'ai_booking_page',
  campaign_type            text,

  jane_appointment_id      text,
  jane_patient_id          text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant
  ON bookings (tenant_id, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings (tenant_id, status)
  WHERE status IN ('confirmed', 'completed');

-- ── Jane App integration ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jane_integrations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  clinic_url        text        NOT NULL,
  access_token      text,
  refresh_token     text,
  token_expires_at  timestamptz,
  scopes            text[],
  practitioner_id   text,
  oauth_state       text,
  pkce_verifier     text,
  status            text        NOT NULL DEFAULT 'disconnected',
  -- 'connected' | 'disconnected' | 'error'
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE tenant_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jane_integrations ENABLE ROW LEVEL SECURITY;

-- Public read for booking page (no auth needed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_service_categories' AND policyname = 'public_read_categories') THEN
    CREATE POLICY "public_read_categories"
      ON tenant_service_categories FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_services' AND policyname = 'public_read_services') THEN
    CREATE POLICY "public_read_services"
      ON tenant_services FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- ── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE tenant_service_categories IS 'Service categories for the public booking page (e.g. Aesthetics, Acupuncture).';
COMMENT ON TABLE tenant_services IS 'Individual bookable services with pricing, duration, and practitioners.';
COMMENT ON TABLE bookings IS 'Patient appointment records with Jane App payment and scheduling.';
COMMENT ON TABLE jane_integrations IS 'OAuth2 tokens for Jane App API integration per tenant.';
