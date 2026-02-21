import { getAuthenticatedUser } from '@/lib/supabase/auth-server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Operator Access Guard — resolves whether the current user is a Servify operator.
 *
 * Resolution strategy (fail-closed):
 *
 *   1. Verify Supabase Auth session (must be authenticated)
 *   2. Check if user email is in the SERVIFY_OPERATOR_EMAILS allowlist (env var)
 *   3. Fallback: check if user has 'owner' or 'admin' role on ANY tenant
 *      (temporary dev guard — in production, use explicit operator table)
 *
 * If neither check passes, access is denied.
 *
 * ── Production hardening TODO ──────────────────────────────────────────────
 *
 *   □  Create a dedicated `operators` table (user_id, role, created_at)
 *   □  Replace email allowlist with DB-backed RBAC
 *   □  Add rate limiting on ops routes
 *   □  Wire audit logging to persistent store
 */

export interface OperatorAccessResult {
  authorized: boolean
  userId: string | null
  email: string | null
  /** How operator access was granted */
  grantedVia: 'allowlist' | 'tenant_role' | 'dev_mode' | null
  /** Reason for denial (when authorized=false) */
  reason?: string
}

/**
 * Parse comma-separated operator email allowlist from env.
 * Set SERVIFY_OPERATOR_EMAILS="admin@servify.ai,ops@servify.ai" in .env
 */
function getOperatorAllowlist(): string[] {
  const raw = process.env.SERVIFY_OPERATOR_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function resolveOperatorAccess(): Promise<OperatorAccessResult> {
  const denied = (reason: string): OperatorAccessResult => ({
    authorized: false,
    userId: null,
    email: null,
    grantedVia: null,
    reason,
  })

  // ── Dev mode bypass (non-production only) ──────────────────────────────
  // In development, if no auth is configured, allow access for local testing.
  // This NEVER activates in production.
  if (process.env.NODE_ENV !== 'production' && process.env.OPS_DEV_BYPASS === 'true') {
    return {
      authorized: true,
      userId: 'dev-operator',
      email: 'dev@localhost',
      grantedVia: 'dev_mode',
    }
  }

  // ── 1. Authenticate ────────────────────────────────────────────────────
  const authResult = await getAuthenticatedUser()

  if (!authResult) {
    return denied('Not authenticated — no valid Supabase session')
  }

  const { userId, email } = authResult

  // ── 2. Check email allowlist ───────────────────────────────────────────
  const allowlist = getOperatorAllowlist()
  if (email && allowlist.length > 0 && allowlist.includes(email.toLowerCase())) {
    return { authorized: true, userId, email: email ?? null, grantedVia: 'allowlist' }
  }

  // ── 3. Fallback: check for admin/owner role on any tenant ──────────────
  // This is a temporary dev guard. In production, use a dedicated operators table.
  try {
    const supabase = createSupabaseServerClient()
    const { data: roles } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .limit(1)

    if (roles && roles.length > 0) {
      return { authorized: true, userId, email: email ?? null, grantedVia: 'tenant_role' }
    }
  } catch {
    // user_tenants table may not exist yet — continue to denial
  }

  // ── 4. Denied ──────────────────────────────────────────────────────────
  return denied('User is not a Servify operator (not in allowlist, no admin role)')
}
