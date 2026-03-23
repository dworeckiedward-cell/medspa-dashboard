-- Allow 'follow_up' as a valid outbound_type value.
-- The original CHECK constraint from migration 004 only allowed
-- speed_to_lead | reminder | reactivation | campaign.
-- We drop and recreate it to include follow_up.

ALTER TABLE call_logs
  DROP CONSTRAINT IF EXISTS call_logs_outbound_type_check;

ALTER TABLE call_logs
  ADD CONSTRAINT call_logs_outbound_type_check
    CHECK (outbound_type IN ('speed_to_lead', 'reminder', 'reactivation', 'campaign', 'follow_up'));
