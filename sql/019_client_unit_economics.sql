-- ============================================================================
-- Migration 019: Client Unit Economics (Internal / Ops-Only)
--
-- Stores per-client acquisition cost (CAC) and metadata for internal
-- financial analytics. This data is NEVER exposed to tenant-facing routes.
--
-- LTV is computed at query time from billing data, not stored here.
-- ============================================================================

-- ── Create table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_unit_economics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid        NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  cac_amount    numeric(12,2)   DEFAULT NULL,     -- acquisition cost in dollars (not cents)
  cac_currency  text            NOT NULL DEFAULT 'USD',
  cac_source    text            DEFAULT NULL,     -- 'ads' | 'outbound' | 'referral' | 'organic' | 'mixed' | 'other'
  cac_notes     text            DEFAULT NULL,
  acquired_at   timestamptz     DEFAULT NULL,     -- actual acquisition date (for cohort analysis)
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_unit_economics_client_id
  ON client_unit_economics (client_id);

CREATE INDEX IF NOT EXISTS idx_unit_economics_cac_source
  ON client_unit_economics (cac_source)
  WHERE cac_source IS NOT NULL;

-- ── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE client_unit_economics IS 'Internal ops-only table for per-client acquisition cost tracking. Never exposed to tenants.';
COMMENT ON COLUMN client_unit_economics.cac_amount IS 'Customer acquisition cost in dollars. NULL means not set.';
COMMENT ON COLUMN client_unit_economics.cac_source IS 'Acquisition channel: ads, outbound, referral, organic, mixed, other.';
COMMENT ON COLUMN client_unit_economics.acquired_at IS 'Actual acquisition date. Falls back to client created_at for cohort analysis if NULL.';
