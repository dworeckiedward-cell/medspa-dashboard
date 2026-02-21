-- Migration 008: client_integrations — tenant-scoped CRM integration configurations.
--
-- Replaces mock integration config with a real DB-backed table.
-- Each row represents one integration connection for a tenant.
-- Secrets are stored in `config` (server-only jsonb) — the `secrets_masked`
-- column holds display-safe previews that are safe to return to the UI.

create table if not exists public.client_integrations (
  id                uuid        primary key default gen_random_uuid(),
  client_id         uuid        not null references public.clients(id) on delete cascade,
  provider          text        not null,           -- 'custom_webhook' | 'hubspot' | 'ghl'
  name              text        not null,           -- display label, e.g. "HubSpot Main"
  status            text        not null default 'disconnected',  -- 'connected' | 'disconnected' | 'error' | 'testing'
  is_enabled        boolean     not null default true,
  config            jsonb       not null default '{}'::jsonb,     -- full config with secrets (server-only)
  secrets_masked    jsonb       null,                             -- e.g. {"apiKey":"***abcd"}
  event_toggles     jsonb       not null default '{}'::jsonb,     -- e.g. {"call.completed":true,"booking.created":false}
  event_mapping     jsonb       not null default '{}'::jsonb,     -- local event → remote event mapping
  last_test_at      timestamptz null,
  last_success_at   timestamptz null,
  last_error_at     timestamptz null,
  last_error_message text       null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Prevent duplicate provider+name combos per tenant
create unique index if not exists idx_client_integrations_unique_name
  on public.client_integrations (client_id, provider, name);

-- Common query patterns
create index if not exists idx_client_integrations_client_provider
  on public.client_integrations (client_id, provider);

create index if not exists idx_client_integrations_client_enabled
  on public.client_integrations (client_id, is_enabled)
  where is_enabled = true;

-- Auto-update updated_at via existing trigger function from migration 001
create trigger client_integrations_updated_at
  before update on public.client_integrations
  for each row execute function trigger_set_updated_at();
