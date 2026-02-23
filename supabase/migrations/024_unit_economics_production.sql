-- ============================================================================
-- Migration 024: Align client_unit_economics to production schema
--
-- Production columns (confirmed from Supabase dashboard):
--   tenant_id          uuid (PK, FK → tenants.id)
--   cac_usd            numeric
--   ltv_usd            numeric
--   ltv_mode           text          ('auto' | 'manual')
--   acquisition_source text
--   acquired_date      date
--   notes              text
--   acquired_at        timestamptz
--   updated_at         timestamptz
--
-- This migration is fully idempotent. Safe for fresh installs and reruns.
-- ============================================================================

-- ── 1. Create table if it doesn't exist ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_unit_economics (
  tenant_id          uuid          PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cac_usd            numeric,
  ltv_usd            numeric,
  ltv_mode           text          NOT NULL DEFAULT 'auto',
  acquisition_source text,
  acquired_date      date,
  notes              text,
  acquired_at        timestamptz,
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

-- ── 2. Ensure all production columns exist (safe for existing tables) ────────

ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS cac_usd numeric;
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS ltv_usd numeric;
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS ltv_mode text NOT NULL DEFAULT 'auto';
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS acquisition_source text;
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS acquired_date date;
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE client_unit_economics ADD COLUMN IF NOT EXISTS acquired_at timestamptz;

-- ── 3. Migrate legacy column data → production columns (if applicable) ──────
-- If table was originally created with legacy names (cac_amount, cac_source, etc.)
-- copy data into production columns then drop legacy columns.

DO $$
BEGIN
  -- cac_amount → cac_usd
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'cac_amount'
  ) THEN
    UPDATE client_unit_economics SET cac_usd = cac_amount WHERE cac_usd IS NULL AND cac_amount IS NOT NULL;
    ALTER TABLE client_unit_economics DROP COLUMN cac_amount;
  END IF;

  -- cac_source → acquisition_source
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'cac_source'
  ) THEN
    UPDATE client_unit_economics SET acquisition_source = cac_source WHERE acquisition_source IS NULL AND cac_source IS NOT NULL;
    ALTER TABLE client_unit_economics DROP COLUMN cac_source;
  END IF;

  -- cac_notes → notes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'cac_notes'
  ) THEN
    UPDATE client_unit_economics SET notes = cac_notes WHERE notes IS NULL AND cac_notes IS NOT NULL;
    ALTER TABLE client_unit_economics DROP COLUMN cac_notes;
  END IF;

  -- client_id → tenant_id (PK rename not needed if PK is already tenant_id)
  -- If legacy table used client_id as PK, it needs manual intervention.
  -- The CREATE TABLE above uses tenant_id as PK so this only applies to existing tables.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'client_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE client_unit_economics RENAME COLUMN client_id TO tenant_id;
  END IF;

  -- Drop legacy cac_currency column (always USD, not needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'cac_currency'
  ) THEN
    ALTER TABLE client_unit_economics DROP COLUMN cac_currency;
  END IF;

  -- Drop legacy id column (tenant_id is the PK)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_economics' AND column_name = 'id'
    AND table_name = 'client_unit_economics'
  ) THEN
    -- Only drop if tenant_id exists as PK
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'client_unit_economics' AND column_name = 'tenant_id'
    ) THEN
      ALTER TABLE client_unit_economics DROP COLUMN IF EXISTS id;
    END IF;
  END IF;
END $$;

-- ── 4. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_unit_economics_source
  ON client_unit_economics (acquisition_source)
  WHERE acquisition_source IS NOT NULL;

-- ── 5. RLS (ops-only, service-role bypasses) ────────────────────────────────

ALTER TABLE client_unit_economics ENABLE ROW LEVEL SECURITY;
