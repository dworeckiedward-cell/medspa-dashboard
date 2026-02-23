-- ============================================================================
-- Migration 023: Retell call details enhancements
--
-- Adds missing columns to call_logs for Retell-style call details,
-- and creates tenant_retell_agents mapping table.
-- All additions are idempotent (IF NOT EXISTS / safe for reruns).
-- ============================================================================

-- ── 1. Add missing columns to call_logs ────────────────────────────────────

-- Retell call ID alias (mirrors external_call_id but explicit name for clarity)
-- Not adding a separate column — external_call_id already serves this purpose.

-- Phone numbers: from_number and to_number (caller_phone exists, add to_number)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS from_number text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS to_number text;

-- Timestamps: started_at and ended_at
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- Cost tracking
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4);

-- Retell agent identifier (separate from agent_provider/agent_name)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS retell_agent_id text;

-- Call status from Retell (registered, ongoing, ended, error)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_status text;

-- Structured call summary from Retell (separate from ai_summary_json)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_summary_json jsonb;

-- Disconnect reason
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS disconnect_reason text;

-- ── 2. Backfill from_number from caller_phone where missing ───────────────
UPDATE call_logs SET from_number = caller_phone
WHERE from_number IS NULL AND caller_phone IS NOT NULL;

-- ── 3. Index for retell_agent_id lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_call_logs_retell_agent_id
  ON call_logs (retell_agent_id)
  WHERE retell_agent_id IS NOT NULL;

-- ── 4. tenant_retell_agents mapping table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_retell_agents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id      text        NOT NULL,
  agent_name    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, agent_id),
  UNIQUE(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_retell_agents_tenant
  ON tenant_retell_agents (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_retell_agents_agent
  ON tenant_retell_agents (agent_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────
-- tenant_retell_agents is ops-only — enable RLS with no policies
-- (service-role client bypasses, matching existing ops patterns).
ALTER TABLE tenant_retell_agents ENABLE ROW LEVEL SECURITY;

-- ── 6. (Removed) ─────────────────────────────────────────────────────────
-- CAC schema reconciliation moved to 024_unit_economics_production.sql
-- to align code with actual production column names.
