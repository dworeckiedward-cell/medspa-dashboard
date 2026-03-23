-- ============================================================================
-- Migration 026: Dashboard modes + business vertical
--
-- Adds two new columns to `clients` to support multi-vertical dashboard modes:
--   dashboard_mode    — controls which KPIs, pipeline stages, and UI sections render
--   business_vertical — industry vertical for terminology and provider suggestions
--
-- BACKWARD COMPATIBILITY:
--   - Existing `client_type` column is NOT touched — remains as-is.
--   - `dashboard_mode` defaults to 'inbound_clinic' so all existing tenants
--     continue to see the current inbound/clinic dashboard unchanged.
--   - Backfill maps old client_type values to new dashboard_mode values.
--   - Application code falls back to client_type when dashboard_mode is NULL.
--
-- Idempotent: safe to run on fresh installs and re-runs.
-- ============================================================================

-- ── Add columns (IF NOT EXISTS → idempotent) ──────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS dashboard_mode text DEFAULT 'inbound_clinic';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_vertical text DEFAULT 'general';

-- ── Backfill dashboard_mode from existing client_type ─────────────────────
-- Only sets rows where dashboard_mode still has the default value,
-- so re-runs after manual edits won't overwrite intentional changes.

UPDATE public.clients
SET dashboard_mode = CASE
  WHEN client_type = 'outbound' THEN 'outbound_db'
  ELSE 'inbound_clinic'
END
WHERE dashboard_mode = 'inbound_clinic'
  AND client_type IS NOT NULL;

-- ── Backfill business_vertical for existing MedSpa tenants ────────────────

UPDATE public.clients
SET business_vertical = 'medspa'
WHERE business_vertical = 'general'
  AND client_type IS DISTINCT FROM 'outbound';

-- ── CHECK constraint on dashboard_mode (idempotent guard) ─────────────────

DO $$ BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_dashboard_mode_check
    CHECK (dashboard_mode IN ('inbound_clinic', 'outbound_db', 'fb_leads'));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- constraint already exists, skip
END $$;

-- ── Index for filtering by mode ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_dashboard_mode
  ON public.clients (dashboard_mode)
  WHERE is_active = true;

-- ── Comments ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.clients.dashboard_mode IS
  'Controls which KPIs, lead pipeline, and UI sections the tenant dashboard shows. '
  'Values: ''inbound_clinic'' (default, standard inbound dashboard), '
  '''outbound_db'' (old database re-engagement), '
  '''fb_leads'' (Facebook Ads speed-to-lead).';

COMMENT ON COLUMN public.clients.business_vertical IS
  'Industry vertical for terminology and provider suggestions. '
  'Extensible string — not an enum. '
  'Examples: ''medspa'', ''dental'', ''real_estate'', ''general''.';
