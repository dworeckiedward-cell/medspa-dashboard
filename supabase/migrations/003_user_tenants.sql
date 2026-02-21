-- ── Migration 003: user_tenants ─────────────────────────────────────────────
--
-- Connects auth.users to public.clients for the Lovable login flow.
--
-- Run this migration BEFORE enabling SUPABASE_AUTH_ENABLED or wiring Lovable.
--
-- After running:
--   1. Insert test row:
--        insert into public.user_tenants (user_id, client_id, role)
--        values ('<your-supabase-user-uuid>', '<client-id>', 'owner');
--   2. Verify resolveTenantAccess() returns accessMode = 'authenticated'
--      when logged in via Supabase Auth.

create table if not exists public.user_tenants (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id)       on delete cascade,
  client_id   uuid        not null references public.clients(id)   on delete cascade,
  role        text        not null default 'viewer'
                            check (role in ('owner', 'admin', 'viewer')),
  created_at  timestamptz not null default now(),

  unique (user_id, client_id)
);

-- Index for fast user → tenant lookups (primary access pattern)
create index if not exists user_tenants_user_id_idx on public.user_tenants (user_id);

-- RLS: enable so anon/auth clients can only read their own rows
alter table public.user_tenants enable row level security;

-- Policy: authenticated users can read their own memberships
create policy "user_tenants: own rows" on public.user_tenants
  for select using (auth.uid() = user_id);

-- Service-role client bypasses RLS (used in getAuthenticatedUser after JWT verify)
