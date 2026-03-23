-- Migration 041: Follow-up call tracking
-- Adds columns to outbound_call_tracker for tracking 1-click follow-up calls
-- triggered from the dashboard Follow-up Queue.

ALTER TABLE outbound_call_tracker
  ADD COLUMN IF NOT EXISTS follow_up_count      INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_follow_up_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_call_context    TEXT;

-- Index for follow-up queue queries (filter by booking_interest + DNC + follow_up_count)
CREATE INDEX IF NOT EXISTS idx_tracker_followup
  ON outbound_call_tracker(booking_interest, do_not_call, follow_up_count);

-- Index used when rate-limiting: look up by phone + client within last N hours
CREATE INDEX IF NOT EXISTS idx_call_logs_followup_ratelimit
  ON call_logs(client_id, caller_phone, call_status, created_at DESC)
  WHERE call_status = 'follow_up_triggered';
