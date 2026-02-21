-- ── Partners & Affiliate Program ────────────────────────────────────────────
-- Internal partner/affiliate tracking for Servify referral channel.
-- Tables are INTERNAL — not exposed to client-facing tenant routes.

-- ── 1. Partners ─────────────────────────────────────────────────────────────

create table if not exists partners (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text,
  type             text not null default 'other'
                     check (type in ('agency', 'freelancer', 'consultant', 'connector', 'influencer', 'other')),
  status           text not null default 'onboarding'
                     check (status in ('active', 'paused', 'onboarding', 'blocked')),
  referral_code    text not null unique,
  notes            text,
  payout_method_type    text,        -- 'bank_transfer' | 'paypal' | 'wise' | null
  payout_details_masked text,        -- e.g. '****1234'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_partners_status on partners (status);
create index if not exists idx_partners_referral_code on partners (referral_code);

-- ── 2. Partner Referrals ────────────────────────────────────────────────────

create table if not exists partner_referrals (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references partners(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,
  lead_name        text,
  lead_email       text,
  referred_at      timestamptz not null default now(),
  status           text not null default 'lead'
                     check (status in ('lead', 'qualified', 'won', 'lost', 'duplicate', 'invalid')),
  estimated_value_cents  integer,
  metadata         jsonb default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_referrals_partner on partner_referrals (partner_id);
create index if not exists idx_referrals_client on partner_referrals (client_id) where client_id is not null;
create index if not exists idx_referrals_status on partner_referrals (status);

-- ── 3. Partner Commissions ──────────────────────────────────────────────────

create table if not exists partner_commissions (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references partners(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,
  referral_id      uuid references partner_referrals(id) on delete set null,
  basis_type       text not null default 'flat'
                     check (basis_type in ('flat', 'percent', 'hybrid')),
  basis_value      numeric not null default 0,
  revenue_amount_cents   integer,
  commission_amount_cents integer not null default 0,
  currency         text not null default 'usd',
  status           text not null default 'pending'
                     check (status in ('pending', 'eligible', 'approved', 'paid', 'held', 'canceled')),
  eligible_at      timestamptz,
  approved_at      timestamptz,
  paid_at          timestamptz,
  payout_batch_id  uuid,             -- scaffold for batch payouts
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_commissions_partner on partner_commissions (partner_id);
create index if not exists idx_commissions_status on partner_commissions (status);

-- ── RLS: service-role only (internal tables) ────────────────────────────────

alter table partners enable row level security;
alter table partner_referrals enable row level security;
alter table partner_commissions enable row level security;

-- No policies = service-role only access (default deny for anon/authenticated)
