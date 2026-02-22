-- 022: Ops Clinic Assets + Notifications
-- Supports: clinic onboarding wizard, Retell prompt generation, operator notifications

-- ── Clinic Assets (generated prompts, docs, notes per tenant) ──────────────

CREATE TABLE IF NOT EXISTS public.ops_clinic_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  type              TEXT NOT NULL CHECK (type IN (
    'retell_prompt_inbound',
    'retell_prompt_outbound',
    'note',
    'doc'
  )),
  title             TEXT NOT NULL,
  content           TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'error')),
  source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('generated', 'manual')),
  generated_from_url TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_clinic_assets_tenant_id
  ON public.ops_clinic_assets (tenant_id);

ALTER TABLE public.ops_clinic_assets ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only (ops)

-- ── Ops Notifications ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ops_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  type        TEXT NOT NULL CHECK (type IN (
    'prompts_ready',
    'invite_created',
    'missing_agent_ids',
    'clinic_created',
    'general'
  )),
  title       TEXT NOT NULL,
  description TEXT,
  action_href TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_notifications_created_at
  ON public.ops_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_notifications_unread
  ON public.ops_notifications (is_read)
  WHERE is_read = FALSE;

ALTER TABLE public.ops_notifications ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only (ops)
