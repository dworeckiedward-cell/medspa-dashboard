-- Migration 033: Add client_status and website_url to tenants table.
-- Used by OPS dashboard for lifecycle management.

alter table public.tenants
  add column if not exists client_status text null default 'onboarding',
  add column if not exists website_url   text null;

-- Constrain client_status to valid values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_client_status'
  ) then
    alter table public.tenants
      add constraint chk_client_status
      check (client_status in ('onboarding', 'live', 'watch', 'canceled'));
  end if;
end $$;
