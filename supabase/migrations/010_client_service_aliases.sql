-- Migration 010: Client Service Aliases
-- Maps common terms/keywords to canonical services for improved attribution.
-- Tenant-scoped. UI gracefully handles migration-not-applied (returns empty).

create table if not exists client_service_aliases (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  alias_text  text not null,
  service_id  uuid not null references services_catalog(id) on delete cascade,
  is_active   boolean not null default true,
  priority    integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index: fast lookup by tenant + active state
create index if not exists idx_service_aliases_client
  on client_service_aliases (client_id, is_active, priority desc);

-- Unique: prevent duplicate alias text per tenant
create unique index if not exists idx_service_aliases_unique_text
  on client_service_aliases (client_id, lower(alias_text))
  where is_active = true;
