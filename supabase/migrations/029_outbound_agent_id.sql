-- ── Migration 029: Add outbound_agent_id to clients ──────────────────────────
-- The wizard now captures separate inbound and outbound Retell agent IDs.
-- `retell_agent_id` stores the inbound agent; this adds a dedicated column
-- for the outbound agent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS outbound_agent_id text;
