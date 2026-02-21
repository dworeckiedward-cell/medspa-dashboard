-- Migration 013: Workspace Team & Access
--
-- Adds workspace invitations table, workspace activity log,
-- and extends user_tenants role constraint for 4-role RBAC.

-- ── Extend user_tenants role check ──────────────────────────────────────────
-- Add 'manager', 'staff', 'analyst' to the existing check constraint.
-- Backward-compatible: existing 'owner', 'admin', 'viewer' values still valid.

ALTER TABLE public.user_tenants
  DROP CONSTRAINT IF EXISTS user_tenants_role_check;

ALTER TABLE public.user_tenants
  ADD CONSTRAINT user_tenants_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer', 'analyst'));

-- ── Workspace invitations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'staff'
              CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer', 'analyst')),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by  UUID NOT NULL,        -- user_id of inviter
  inviter_email TEXT,
  token       TEXT NOT NULL UNIQUE,  -- secure invite token
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_client
  ON public.workspace_invites (client_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_email
  ON public.workspace_invites (email, status);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token
  ON public.workspace_invites (token) WHERE status = 'pending';

-- RLS: service-role only (no policies = deny all for anon/authenticated)
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- ── Workspace activity log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL,           -- user who performed the action
  actor_email TEXT,
  action      TEXT NOT NULL,           -- e.g. 'member_invited', 'role_changed'
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_client
  ON public.workspace_activity (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_actor
  ON public.workspace_activity (actor_id, created_at DESC);

-- RLS: service-role only
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;
