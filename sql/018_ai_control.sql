-- ============================================================================
-- Migration 018: AI System Control
--
-- Adds AI control columns to the clients table so tenants can manage their
-- AI receptionist state (enable/disable, operating mode, fallback mode, etc.)
--
-- External systems (Retell, n8n, etc.) should read these columns to determine
-- the authoritative AI state for each tenant.
-- ============================================================================

-- ── Custom types ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ai_operating_mode AS ENUM (
    'live', 'paused', 'outbound_only', 'inbound_only', 'maintenance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_fallback_mode AS ENUM (
    'human_handoff', 'voicemail_only', 'capture_only', 'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_pause_reason AS ENUM (
    'holiday', 'staff_preference', 'testing', 'billing_issue', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Add columns to clients table ────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ai_enabled              boolean           NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_operating_mode       ai_operating_mode NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS ai_fallback_mode        ai_fallback_mode  NOT NULL DEFAULT 'voicemail_only',
  ADD COLUMN IF NOT EXISTS ai_pause_reason         ai_pause_reason            DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_pause_note           text                       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_auto_resume_at       timestamptz                DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_control_updated_at   timestamptz                DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_control_updated_by   text                       DEFAULT NULL;

-- ── Index for ops watchlist (non-active clients) ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_ai_status
  ON clients (ai_enabled, ai_operating_mode)
  WHERE is_active = true;

-- ── Comment ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN clients.ai_enabled IS 'Master AI toggle. When false, operating mode is effectively paused.';
COMMENT ON COLUMN clients.ai_operating_mode IS 'Current AI operating mode (live, paused, outbound_only, inbound_only, maintenance).';
COMMENT ON COLUMN clients.ai_fallback_mode IS 'Fallback strategy when AI is paused or unavailable.';
COMMENT ON COLUMN clients.ai_pause_reason IS 'Categorized reason for pausing the AI system.';
COMMENT ON COLUMN clients.ai_pause_note IS 'Free-form note explaining the pause.';
COMMENT ON COLUMN clients.ai_auto_resume_at IS 'ISO 8601 timestamp for automatic resume. NULL = no auto-resume.';
COMMENT ON COLUMN clients.ai_control_updated_at IS 'Timestamp of the last AI control state change.';
COMMENT ON COLUMN clients.ai_control_updated_by IS 'User ID or identifier of who last changed the AI control state.';
