-- Migration 038: Add call_summary and ensure sentiment column exists
-- call_summary: direct text from Retell call_analysis.call_summary
-- sentiment: already in schema but add IF NOT EXISTS for safety

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS call_summary TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT;

COMMENT ON COLUMN call_logs.call_summary IS
  'Plain-text call summary from Retell call_analysis.call_summary';
