-- Migration 037: Add lead_status to call_logs
-- Tracks the funnel stage for each lead:
--   new → contacted → booking_link_sent → clicked_link → booked → lost

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';

-- Index for filtering leads by status
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_status
  ON call_logs (client_id, lead_status)
  WHERE is_lead = TRUE;

COMMENT ON COLUMN call_logs.lead_status IS
  'Lead funnel stage: new | contacted | booking_link_sent | clicked_link | booked | lost';
