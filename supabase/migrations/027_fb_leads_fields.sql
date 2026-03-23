-- ============================================================================
-- Migration 027: Facebook Leads enrichment fields on call_logs
--
-- Adds columns to track Facebook Ads attribution for the fb_leads dashboard
-- mode. These fields are populated by n8n when it ingests FB Lead Ads data
-- via the existing /api/retell/webhook or /api/ingest pipeline.
--
-- BACKWARD COMPATIBILITY:
--   - All columns are nullable with no default — zero impact on existing rows.
--   - Existing queries selecting * will include these as NULL.
--   - No existing columns are modified or removed.
--
-- Idempotent: safe to run on fresh installs and re-runs.
-- ============================================================================

-- ── Add FB Ads attribution columns ────────────────────────────────────────

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS fb_ad_id text DEFAULT NULL;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS fb_campaign_id text DEFAULT NULL;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS fb_lead_id text DEFAULT NULL;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS lead_cost_cents integer DEFAULT NULL;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS ad_set_name text DEFAULT NULL;

-- ── Partial index for FB leads queries ────────────────────────────────────
-- Only indexes rows where lead_source = 'facebook' to keep the index small.

CREATE INDEX IF NOT EXISTS idx_call_logs_fb_lead
  ON public.call_logs (client_id, lead_source)
  WHERE lead_source = 'facebook';

-- ── Comments ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.call_logs.fb_ad_id IS
  'Facebook Ad ID — used for cost attribution and ad performance reporting.';

COMMENT ON COLUMN public.call_logs.fb_campaign_id IS
  'Facebook Campaign ID — groups leads by campaign for ROI tracking.';

COMMENT ON COLUMN public.call_logs.fb_lead_id IS
  'Facebook Lead ID — unique identifier from FB Lead Ads form submission.';

COMMENT ON COLUMN public.call_logs.lead_cost_cents IS
  'Cost per lead in cents. Sourced from FB Ads API via n8n or set manually.';

COMMENT ON COLUMN public.call_logs.ad_set_name IS
  'Facebook Ad Set name — for granular ad performance breakdown.';
