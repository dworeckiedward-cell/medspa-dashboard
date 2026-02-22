-- 019: Dedicated operators table for ops console access control
--
-- Replaces the email-allowlist and tenant-role fallback with a proper
-- DB-backed access table. resolveOperatorAccess() checks this first.
--
-- The table may already exist in the production database. This migration
-- uses IF NOT EXISTS to be idempotent.

create table if not exists public.ops_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'operator'
                check (role in ('operator', 'admin', 'super_admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id)
);

-- Index for fast lookup by email (fallback path)
create index if not exists idx_ops_users_email
  on public.ops_users (lower(email));

-- RLS: only service-role should read this table
alter table public.ops_users enable row level security;

-- No policies = only service-role (bypasses RLS) can access
-- This is intentional: ops_users should never be queryable by anon/authenticated roles
