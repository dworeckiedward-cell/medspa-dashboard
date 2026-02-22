-- ============================================================================
-- Migration 020: Ops Financial Profiles + Payment Logs (Internal / Ops-Only)
--
-- Tracks per-client billing status, setup fees, retainer info, and payment
-- history for internal ops financial visibility. NEVER exposed to tenants.
--
-- CAC data lives in client_unit_economics (migration 019) — not duplicated here.
-- This table covers: setup fees, retainers, MRR inclusion, LTV manual override,
-- billing cycle info, and notes.
-- ============================================================================

-- ── Financial profiles (1 row per client) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS client_financial_profiles (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid          NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,

  -- LTV manual override
  ltv_manual_amount     numeric(12,2) DEFAULT NULL,
  ltv_currency          text          NOT NULL DEFAULT 'USD',
  ltv_mode              text          NOT NULL DEFAULT 'auto',
  -- 'auto' = derived from payment logs / mock billing
  -- 'manual' = operator-entered override

  -- MRR inclusion
  mrr_included          boolean       NOT NULL DEFAULT true,

  -- Setup fee tracking
  setup_fee_amount      numeric(12,2) DEFAULT NULL,
  setup_fee_currency    text          NOT NULL DEFAULT 'USD',
  setup_fee_status      text          NOT NULL DEFAULT 'not_set',
  -- 'not_set' | 'unpaid' | 'partial' | 'paid' | 'waived'
  setup_fee_paid_amount numeric(12,2) DEFAULT NULL,
  setup_fee_invoiced_at timestamptz   DEFAULT NULL,
  setup_fee_paid_at     timestamptz   DEFAULT NULL,

  -- Retainer tracking
  retainer_amount       numeric(12,2) DEFAULT NULL,
  retainer_currency     text          NOT NULL DEFAULT 'USD',
  retainer_status       text          NOT NULL DEFAULT 'not_set',
  -- 'not_set' | 'active_paid' | 'due' | 'overdue' | 'partial' | 'paused' | 'canceled'
  billing_cycle_day     integer       DEFAULT NULL,
  last_paid_at          timestamptz   DEFAULT NULL,
  next_due_at           timestamptz   DEFAULT NULL,

  -- Notes
  billing_notes         text          DEFAULT NULL,

  -- Timestamps
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── Payment logs (manual entries now, Stripe-ready later) ─────────────────

CREATE TABLE IF NOT EXISTS client_payment_logs (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  payment_type        text          NOT NULL,
  -- 'setup_fee' | 'retainer' | 'overage' | 'other'

  amount              numeric(12,2) NOT NULL,
  currency            text          NOT NULL DEFAULT 'USD',

  status              text          NOT NULL,
  -- 'pending' | 'paid' | 'failed' | 'refunded' | 'partial'

  paid_at             timestamptz   DEFAULT NULL,
  due_at              timestamptz   DEFAULT NULL,

  source              text          NOT NULL DEFAULT 'manual',
  -- 'manual' | 'stripe' | 'imported'

  external_payment_id text          DEFAULT NULL,
  -- Stripe payment_intent ID or similar, for future dedup

  notes               text          DEFAULT NULL,
  created_by          text          DEFAULT NULL,

  created_at          timestamptz   NOT NULL DEFAULT now()
);

-- ── Financial events (lightweight audit trail) ────────────────────────────

CREATE TABLE IF NOT EXISTS client_financial_events (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type    text          NOT NULL,
  payload       jsonb         NOT NULL DEFAULT '{}'::jsonb,
  actor_label   text          DEFAULT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_financial_profiles_client_id
  ON client_financial_profiles (client_id);

CREATE INDEX IF NOT EXISTS idx_financial_profiles_retainer_status
  ON client_financial_profiles (retainer_status)
  WHERE retainer_status IS NOT NULL AND retainer_status != 'not_set';

CREATE INDEX IF NOT EXISTS idx_financial_profiles_setup_fee_status
  ON client_financial_profiles (setup_fee_status)
  WHERE setup_fee_status IS NOT NULL AND setup_fee_status != 'not_set';

CREATE INDEX IF NOT EXISTS idx_payment_logs_client_id
  ON client_payment_logs (client_id);

CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at
  ON client_payment_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_status
  ON client_payment_logs (status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_financial_events_client_id
  ON client_financial_events (client_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_created_at
  ON client_financial_events (created_at DESC);

-- ── Comments ──────────────────────────────────────────────────────────────

COMMENT ON TABLE client_financial_profiles IS 'Internal ops-only table for per-client billing/financial tracking. Never exposed to tenants.';
COMMENT ON TABLE client_payment_logs IS 'Manual and future Stripe-synced payment log entries. Ops-only.';
COMMENT ON TABLE client_financial_events IS 'Lightweight audit trail for financial profile changes. Ops-only.';

COMMENT ON COLUMN client_financial_profiles.ltv_mode IS 'auto = derived from payments/billing; manual = operator-entered override.';
COMMENT ON COLUMN client_financial_profiles.setup_fee_status IS 'not_set | unpaid | partial | paid | waived';
COMMENT ON COLUMN client_financial_profiles.retainer_status IS 'not_set | active_paid | due | overdue | partial | paused | canceled';
COMMENT ON COLUMN client_payment_logs.source IS 'manual | stripe | imported — for dedup when Stripe webhooks land.';
COMMENT ON COLUMN client_payment_logs.external_payment_id IS 'Stripe payment_intent ID or similar. Used for dedup on webhook sync.';
