-- ============================================================================
-- Migration 017: Support Requests + Updates
-- ============================================================================
-- Client-facing support request workflow.
-- Clients submit requests; Servify ops triages, responds, resolves.
-- ============================================================================

-- ── Support requests ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code             text NOT NULL,
  client_id              uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by_user_id     uuid,
  source                 text NOT NULL DEFAULT 'dashboard'
                         CHECK (source IN ('dashboard', 'ops', 'email_import', 'api')),
  subject                text NOT NULL,
  category               text NOT NULL
                         CHECK (category IN ('bug', 'improvement', 'question', 'data_issue', 'integration_issue', 'billing_question', 'other')),
  priority               text NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status                 text NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'acknowledged', 'in_progress', 'waiting_for_client', 'resolved', 'closed', 'reopened')),
  description            text NOT NULL,
  page_path              text,
  screenshot_url         text,
  affected_reference     text,
  first_response_due_at  timestamptz,
  first_responded_at     timestamptz,
  resolved_at            timestamptz,
  closed_at              timestamptz,
  assigned_to            text,
  last_public_update_at  timestamptz,
  last_internal_update_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_support_req_client
  ON support_requests(client_id, created_at DESC);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_support_req_status
  ON support_requests(status);

-- Short code uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_req_short_code
  ON support_requests(short_code);

-- SLA tracking: overdue first response
CREATE INDEX IF NOT EXISTS idx_support_req_sla
  ON support_requests(first_response_due_at)
  WHERE first_responded_at IS NULL AND status NOT IN ('resolved', 'closed');

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- ── Support request updates ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_request_updates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  author_type   text NOT NULL CHECK (author_type IN ('client', 'operator', 'system')),
  author_label  text,
  visibility    text NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'internal')),
  update_type   text NOT NULL DEFAULT 'comment'
                CHECK (update_type IN ('comment', 'status_change', 'system_note')),
  body          text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Updates timeline for a request
CREATE INDEX IF NOT EXISTS idx_support_upd_request
  ON support_request_updates(request_id, created_at);

ALTER TABLE support_request_updates ENABLE ROW LEVEL SECURITY;
