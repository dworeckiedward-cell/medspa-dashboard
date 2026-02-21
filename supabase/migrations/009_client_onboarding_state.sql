-- 009: Client onboarding state persistence
--
-- Stores per-tenant onboarding wizard progress. Each tenant has at most
-- one row. The wizard UI falls back to localStorage if this table
-- does not exist (migration not applied).

create table if not exists client_onboarding_state (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null unique references clients(id) on delete cascade,
  current_step  text not null default 'branding',
  completed_steps jsonb not null default '[]'::jsonb,
  payload       jsonb not null default '{}'::jsonb,
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast tenant lookup (unique already creates one, but explicit for clarity)
create index if not exists idx_client_onboarding_client_id on client_onboarding_state(client_id);

-- Auto-update updated_at
create or replace function update_onboarding_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_onboarding_updated_at on client_onboarding_state;
create trigger trg_onboarding_updated_at
  before update on client_onboarding_state
  for each row execute function update_onboarding_updated_at();
