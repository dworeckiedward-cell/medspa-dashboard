-- ── Operator Audit Log ──────────────────────────────────────────────────────
-- Records operator actions on the ops console (support views, config access, etc.)
-- Used for accountability and compliance.
--
-- This table is INTERNAL (Servify team only) and should NOT be exposed to client users.

create table if not exists ops_audit_log (
  id            uuid primary key default gen_random_uuid(),
  operator_id   text not null,                    -- user ID or 'dev-operator' for dev mode
  operator_email text,                            -- email for display
  action        text not null,                    -- e.g. 'support_view_started', 'ops_console_viewed'
  target_client_id   uuid,                        -- which client was acted upon (nullable)
  target_client_slug text,                        -- slug for readability
  metadata      jsonb default '{}',               -- additional context
  created_at    timestamptz not null default now()
);

-- Index for querying by operator
create index if not exists idx_ops_audit_operator
  on ops_audit_log (operator_id, created_at desc);

-- Index for querying by target client
create index if not exists idx_ops_audit_target
  on ops_audit_log (target_client_id, created_at desc)
  where target_client_id is not null;

-- RLS: only service role should access this table
alter table ops_audit_log enable row level security;

-- No policies = service-role only access (default deny for all other roles)
