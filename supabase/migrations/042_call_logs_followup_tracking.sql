-- Migration 042: Follow-up tracking on call_logs
-- Adds follow_up_count and last_follow_up_at to call_logs so the system can
-- track how many times Agent #3 has attempted to re-contact a human_followup_needed lead.
-- Max 3 attempts, then human_followup_needed is set back to false automatically.

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS follow_up_count    INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_follow_up_at  TIMESTAMPTZ;

-- Efficient query for the follow-up scheduler (filters by client + flag + count + recency)
CREATE INDEX IF NOT EXISTS idx_call_logs_followup
  ON call_logs(client_id, human_followup_needed, follow_up_count, created_at DESC)
  WHERE human_followup_needed = true;
