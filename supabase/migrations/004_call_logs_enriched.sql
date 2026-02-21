-- ─── Migration 004: Enrich call_logs with direction, disposition, and AI fields ──
--
-- All columns are nullable for zero-breaking backward compatibility.
-- Existing rows receive best-effort backfill from existing fields.
--
-- Run in Supabase SQL Editor or via Supabase CLI:
--   supabase db push  (if linked to a project)
--   supabase migration up  (if using local dev)

-- ── New columns ────────────────────────────────────────────────────────────────

ALTER TABLE public.call_logs
  -- Call direction — replaces the call_type proxy used in dashboard tabs
  ADD COLUMN IF NOT EXISTS direction           TEXT
    CHECK (direction IN ('inbound', 'outbound')),

  -- Outbound sub-classification
  ADD COLUMN IF NOT EXISTS outbound_type       TEXT
    CHECK (outbound_type IN ('speed_to_lead', 'reminder', 'reactivation', 'campaign')),

  -- Speed-to-lead tracking (seconds from lead creation to first outbound contact)
  ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER,

  -- Timestamp of first outbound contact attempt
  ADD COLUMN IF NOT EXISTS contacted_at        TIMESTAMPTZ,

  -- Structured AI-generated summary (separate from raw Retell call_summary)
  ADD COLUMN IF NOT EXISTS ai_summary          TEXT,

  -- Full structured AI output (entities, confidence scores, custom fields)
  ADD COLUMN IF NOT EXISTS ai_summary_json     JSONB,

  -- Call disposition — what was the outcome
  ADD COLUMN IF NOT EXISTS disposition         TEXT
    CHECK (disposition IN (
      'booked', 'follow_up', 'not_interested', 'no_answer', 'voicemail', 'spam', 'other'
    )),

  -- Caller sentiment inferred by AI
  ADD COLUMN IF NOT EXISTS sentiment           TEXT
    CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Primary intent of the caller
  ADD COLUMN IF NOT EXISTS intent              TEXT
    CHECK (intent IN (
      'book_appointment', 'inquiry', 'cancel', 'reschedule', 'complaint', 'other'
    )),

  -- When the appointment was booked (if is_booked = true)
  ADD COLUMN IF NOT EXISTS booked_at           TIMESTAMPTZ,

  -- Scheduled appointment date/time (if known from booking)
  ADD COLUMN IF NOT EXISTS appointment_datetime TIMESTAMPTZ,

  -- Where the lead originated (e.g. 'website', 'google', 'referral', 'instagram')
  ADD COLUMN IF NOT EXISTS lead_source         TEXT,

  -- AI agent provider (e.g. 'retell', 'vapi', 'bland')
  ADD COLUMN IF NOT EXISTS agent_provider      TEXT,

  -- Agent configuration name / label
  ADD COLUMN IF NOT EXISTS agent_name          TEXT;

-- ── Best-effort backfill for existing rows ─────────────────────────────────────

-- Infer direction from call_type (inbound_inquiry → inbound; leave the rest as NULL
-- rather than guessing — new webhooks will set it explicitly)
UPDATE public.call_logs
  SET direction = 'inbound'
  WHERE direction IS NULL
    AND call_type = 'inbound_inquiry';

-- Infer disposition from existing boolean fields
UPDATE public.call_logs
  SET disposition = 'booked'
  WHERE disposition IS NULL
    AND is_booked = true;

UPDATE public.call_logs
  SET disposition = 'spam'
  WHERE disposition IS NULL
    AND call_type = 'spam'
    AND is_booked = false;

-- ── Indexes for new filter patterns ────────────────────────────────────────────

-- Direction filter on the Inbound/Outbound tabs
CREATE INDEX IF NOT EXISTS idx_call_logs_direction
  ON public.call_logs (client_id, direction, created_at DESC)
  WHERE direction IS NOT NULL;

-- Disposition filter (future analytics / funnel views)
CREATE INDEX IF NOT EXISTS idx_call_logs_disposition
  ON public.call_logs (client_id, disposition)
  WHERE disposition IS NOT NULL;

-- GIN index for ai_summary_json (JSONB path queries)
CREATE INDEX IF NOT EXISTS idx_call_logs_ai_summary_json
  ON public.call_logs USING gin (ai_summary_json)
  WHERE ai_summary_json IS NOT NULL;
