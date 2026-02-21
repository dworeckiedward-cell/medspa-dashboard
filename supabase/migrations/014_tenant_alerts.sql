-- Migration 014: Tenant Alerts & Incident Response
--
-- Persistent alert model with lifecycle management.
-- Supports: open → acknowledged → resolved (+ muted).
-- Fingerprint-based deduplication for derived alerts.

-- ── tenant_alerts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_key          TEXT NOT NULL,           -- e.g. 'integration_disconnected'
  source            TEXT NOT NULL,           -- e.g. 'integrations', 'delivery_logs'
  severity          TEXT NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info', 'warning', 'critical')),
  severity_rank     INT NOT NULL DEFAULT 2,  -- 0=critical, 1=warning, 2=info (for sorting)
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'acknowledged', 'resolved', 'muted')),
  confidence        TEXT NOT NULL DEFAULT 'derived'
                    CHECK (confidence IN ('exact', 'derived', 'estimated')),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  evidence          JSONB DEFAULT '{}',
  fingerprint       TEXT NOT NULL,           -- dedupe key: (client_id, rule_key, context)
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   TEXT,                    -- user/operator ID (scaffold)
  resolved_at       TIMESTAMPTZ,
  resolved_by       TEXT,                    -- user/operator ID (scaffold)
  muted_until       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on active alerts per fingerprint
-- Only one open/acknowledged alert per fingerprint per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_alerts_fingerprint_active
  ON public.tenant_alerts (fingerprint)
  WHERE status IN ('open', 'acknowledged');

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_tenant_alerts_client_status
  ON public.tenant_alerts (client_id, status, severity_rank);

CREATE INDEX IF NOT EXISTS idx_tenant_alerts_severity_status
  ON public.tenant_alerts (severity_rank, status);

CREATE INDEX IF NOT EXISTS idx_tenant_alerts_detected
  ON public.tenant_alerts (last_detected_at DESC);

-- RLS: service-role only (no policies = deny all for anon/authenticated)
ALTER TABLE public.tenant_alerts ENABLE ROW LEVEL SECURITY;

-- ── tenant_alert_events (history/audit trail) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_alert_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    UUID NOT NULL REFERENCES public.tenant_alerts(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL
              CHECK (event_type IN ('detected', 'updated', 'acknowledged', 'resolved', 'reopened', 'muted')),
  actor       TEXT,              -- user/operator who triggered the event
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_alert_events_alert
  ON public.tenant_alert_events (alert_id, created_at DESC);

-- RLS: service-role only
ALTER TABLE public.tenant_alert_events ENABLE ROW LEVEL SECURITY;
