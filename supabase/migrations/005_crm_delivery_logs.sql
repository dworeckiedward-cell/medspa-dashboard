-- ── 005_crm_delivery_logs.sql ──────────────────────────────────────────────────
--
-- Tracks every outbound CRM event delivery attempt (webhook POST, API call, etc.).
-- Scoped by client_id for multi-tenant isolation.
--
-- RLS: not yet enabled — consistent with existing tables in this project.
--      Add policies when Supabase Auth is integrated.

create table if not exists public.crm_delivery_logs (
  id                      uuid        primary key default gen_random_uuid(),

  -- Tenant isolation (mirrors naming convention of existing tables)
  client_id               uuid        not null,

  -- What was delivered
  integration_provider    text        not null,   -- e.g. 'custom_webhook', 'hubspot', 'ghl'
  event_type              text        not null,   -- e.g. 'call.completed', 'lead.created'
  event_id                text        null,       -- optional correlation id from source system

  -- Outbound request details
  payload                 jsonb       not null default '{}',
  request_url             text        null,
  request_headers_masked  jsonb       null,       -- secrets replaced with '***MASKED***'
  http_method             text        not null default 'POST',

  -- Response details
  response_status         integer     null,
  response_body_preview   text        null,       -- truncated to 1 000 chars max

  -- Timing
  latency_ms              integer     null,

  -- Outcome
  success                 boolean     not null default false,
  error_code              text        null,       -- NOT_CONFIGURED | NOT_IMPLEMENTED | TIMEOUT | NETWORK_ERROR | HTTP_ERROR | UNKNOWN_ERROR
  error_message           text        null,

  created_at              timestamptz not null default now()
);

comment on table public.crm_delivery_logs is
  'Outbound CRM event delivery attempts. client_id = tenant.'
  ' RLS: add select policies when Supabase Auth is integrated.';

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Primary query pattern: list by tenant, newest first
create index if not exists idx_crm_delivery_logs_client_created
  on public.crm_delivery_logs (client_id, created_at desc);

-- Filter by success / failure
create index if not exists idx_crm_delivery_logs_client_success
  on public.crm_delivery_logs (client_id, success, created_at desc);

-- Filter by event type (e.g. show only call.completed events)
create index if not exists idx_crm_delivery_logs_client_event
  on public.crm_delivery_logs (client_id, event_type, created_at desc);
