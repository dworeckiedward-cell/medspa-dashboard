-- ============================================================================
-- Migration 021: RLS Defense-in-Depth
--
-- Enables Row Level Security on ALL remaining tenant-scoped tables and adds
-- SELECT policies so that authenticated users can only read rows belonging
-- to tenants they are a member of (via user_tenants).
--
-- The application uses the service-role client for all server-side queries,
-- which bypasses RLS. These policies are defense-in-depth: they protect
-- against accidental exposure via anon/authenticated Supabase clients.
--
-- Internal/ops-only tables get RLS enabled with NO policies, which means
-- only the service-role client can access them (deny-all for anon/auth).
--
-- NOTE: Run this migration AFTER all prior migrations (001–020) have been applied.
-- ============================================================================

-- ── Helper function: check if user belongs to a tenant ────────────────────
-- Returns TRUE if the authenticated user has any role on the given client_id.
-- Used by all tenant-scoped RLS policies below.

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND client_id = p_client_id
  )
$$;

COMMENT ON FUNCTION public.user_belongs_to_tenant IS
  'RLS helper: returns TRUE if the current auth user has a user_tenants row for the given client_id.';

-- ============================================================================
-- SECTION 1: Tenant-scoped tables — enable RLS + add tenant isolation policies
-- ============================================================================

-- ── 1a. clients ──────────────────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: tenant members can read own client"
  ON public.clients FOR SELECT
  USING (public.user_belongs_to_tenant(id));

-- ── 1b. call_logs ────────────────────────────────────────────────────────────
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_logs: tenant members can read own logs"
  ON public.call_logs FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1c. services_catalog ─────────────────────────────────────────────────────
ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_catalog: tenant members can read own services"
  ON public.services_catalog FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1d. kb_versions ──────────────────────────────────────────────────────────
ALTER TABLE public.kb_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_versions: tenant members can read own kb"
  ON public.kb_versions FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1e. crm_delivery_logs ────────────────────────────────────────────────────
ALTER TABLE public.crm_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_delivery_logs: tenant members can read own logs"
  ON public.crm_delivery_logs FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1f. client_integrations ──────────────────────────────────────────────────
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_integrations: tenant members can read own integrations"
  ON public.client_integrations FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1g. client_onboarding_state ──────────────────────────────────────────────
ALTER TABLE public.client_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_onboarding_state: tenant members can read own state"
  ON public.client_onboarding_state FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1h. client_service_aliases ───────────────────────────────────────────────
ALTER TABLE public.client_service_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_service_aliases: tenant members can read own aliases"
  ON public.client_service_aliases FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1i. chat_conversations (RLS already on, add policy) ──────────────────────
-- RLS was enabled in migration 015 but no policies were added.

CREATE POLICY "chat_conversations: tenant members can read own conversations"
  ON public.chat_conversations FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1j. chat_messages (RLS already on, add policy) ──────────────────────────
CREATE POLICY "chat_messages: tenant members can read own messages"
  ON public.chat_messages FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1k. chat_leads (RLS already on, add policy) ─────────────────────────────
CREATE POLICY "chat_leads: tenant members can read own leads"
  ON public.chat_leads FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1l. support_requests (RLS already on, add policy) ───────────────────────
CREATE POLICY "support_requests: tenant members can read own requests"
  ON public.support_requests FOR SELECT
  USING (public.user_belongs_to_tenant(client_id));

-- ── 1m. support_request_updates (RLS already on, add policy) ────────────────
-- Updates reference request_id, so join through support_requests for isolation.
CREATE POLICY "support_request_updates: tenant members can read own updates"
  ON public.support_request_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id = request_id
        AND public.user_belongs_to_tenant(sr.client_id)
    )
  );

-- ============================================================================
-- SECTION 2: Internal/ops-only tables — enable RLS with NO policies (deny all)
-- These tables should only be accessed via the service-role client.
-- Tables already with RLS enabled (no policies) are skipped.
-- ============================================================================

-- ── 2a. client_unit_economics ────────────────────────────────────────────────
ALTER TABLE public.client_unit_economics ENABLE ROW LEVEL SECURITY;

-- ── 2b. client_financial_profiles ────────────────────────────────────────────
ALTER TABLE public.client_financial_profiles ENABLE ROW LEVEL SECURITY;

-- ── 2c. client_payment_logs ──────────────────────────────────────────────────
ALTER TABLE public.client_payment_logs ENABLE ROW LEVEL SECURITY;

-- ── 2d. client_financial_events ──────────────────────────────────────────────
ALTER TABLE public.client_financial_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTES:
--
-- Tables already RLS-enabled with no policies (service-role only, unchanged):
--   - tenant_alerts, tenant_alert_events (014)
--   - ops_audit_log (011)
--   - workspace_invites, workspace_activity (013)
--   - partners, partner_referrals, partner_commissions (012)
--
-- Tables with existing RLS policies (unchanged):
--   - user_tenants (003) — has "own rows" policy
--
-- All INSERT/UPDATE/DELETE operations use the service-role client which
-- bypasses RLS. These SELECT policies are defense-in-depth only.
-- ============================================================================
