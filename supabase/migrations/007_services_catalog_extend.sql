-- Migration 007: extend services_catalog with rich metadata for the Services & Pricing Manager.
-- Columns are all nullable / have defaults so existing rows are unaffected.

alter table public.services_catalog
  add column if not exists category     text    null,
  add column if not exists price_cents  integer null,       -- single list price in minor units; null = quote-based
  add column if not exists currency     text    not null default 'usd',
  add column if not exists duration_min integer null,       -- session length in minutes
  add column if not exists sort_order   integer not null default 0;

-- index: sorted list per tenant (primary ordering surface)
create index if not exists idx_services_catalog_client_sort
  on public.services_catalog (client_id, sort_order asc, service_name asc);
