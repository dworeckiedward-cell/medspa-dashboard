-- ============================================================================
-- Migration 025: Dashboard variant (client_type) on clients table
--
-- Adds a client_type column to clients so the operator can set which dashboard
-- variant renders for each tenant:
--   'clinic'   (default) — current MedSpa / inbound dashboard (unchanged)
--   'outbound'           — outbound-calling dashboard with KPIs, funnel, table
--
-- Idempotent: safe to run on fresh installs and re-runs.
-- Existing rows automatically backfill to 'clinic' via the DEFAULT.
-- ============================================================================

-- ── Add column (IF NOT EXISTS → idempotent) ──────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'clinic';

-- ── CHECK constraint (idempotent guard) ──────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_client_type_check
    CHECK (client_type IN ('clinic', 'outbound'));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- constraint already exists, skip
END $$;

-- ── Index for ops console filtering by type ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_client_type
  ON public.clients (client_type)
  WHERE is_active = true;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.clients.client_type IS
  'Dashboard variant rendered for this tenant. '
  '''clinic'' (default) = MedSpa inbound dashboard; '
  '''outbound'' = outbound-calling KPI dashboard.';
