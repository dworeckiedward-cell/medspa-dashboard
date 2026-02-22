import { getAuthenticatedUser } from '@/lib/supabase/auth-server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Operator Access Guard — resolves whether the current user is a Servify operator.
 *
 * Resolution strategy (fail-closed):
 *
 *   1. Verify Supabase Auth session (must be authenticated)
 *   2. Check `ops_users` table by user_id (primary lookup)
 *   3. Fallback: check `ops_users` by normalized email
 *   4. Fallback: check SERVIFY_OPERATOR_EMAILS env allowlist
 *   5. Denied
 *
 * Schema resilience:
 *   - If `is_active` column exists, requires is_active = true
 *   - If no `is_active` column, treats existence of row as access granted
 *
 * Dev mode bypass available for local development only (guarded by multiple env checks).
 */

export interface OperatorAccessResult {
  authorized: boolean
  userId: string | null
  email: string | null
  /** How operator access was granted */
  grantedVia: 'ops_users_id' | 'ops_users_email' | 'allowlist' | 'dev_mode' | null
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

/**
 * Check if an ops_users row grants active access.
 * Resilient to schema variations: if `is_active` column exists, it must be true.
 * If the column doesn't exist (undefined), row existence = access.
 */
function isRowActive(row: Record<string, unknown>): boolean {
  if ('is_active' in row && row.is_active !== undefined && row.is_active !== null) {
    return row.is_active === true
  }
  return true // no is_active column → existence = access
}

export async function resolveOperatorAccess(): Promise<OperatorAccessResult> {
  const denied = (reason: string): OperatorAccessResult => ({
    authorized: false,
    userId: null,
    email: null,
    grantedVia: null,
    reason,
  })

  // ── Dev mode bypass (local development ONLY) ────────────────────────────
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.OPS_DEV_BYPASS === 'true' &&
    !process.env.VERCEL &&
    !process.env.RAILWAY_ENVIRONMENT
  ) {
    console.warn('[ops-access] Dev bypass active — NOT safe for production')
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
    console.log('[ops-access] DENIED — no authenticated session')
    return denied('Not authenticated — no valid Supabase session')
  }

  const { userId, email } = authResult
  const normalizedEmail = email?.trim().toLowerCase() ?? null

  console.log('[ops-access] Checking access for:', userId, normalizedEmail)

  // ── 2. Check ops_users table by user_id (primary) ─────────────────────
  const supabase = createSupabaseServerClient()

  let opsRowByUserId = false
  let opsRowByEmail = false

  try {
    // Use select('*') for schema resilience — works regardless of is_active column
    const { data: byId, error: byIdError } = await supabase
      .from('ops_users')
      .select('*')
      .eq('user_id', userId)
      .limit(1)

    if (byIdError) {
      console.warn('[ops-access] ops_users query error (by user_id):', byIdError.message)
    }

    const activeById = byId?.find((row) => isRowActive(row as Record<string, unknown>))
    opsRowByUserId = !!activeById

    if (opsRowByUserId) {
      console.log('[ops-access] GRANTED via ops_users (user_id)')
      return {
        authorized: true,
        userId,
        email: normalizedEmail,
        grantedVia: 'ops_users_id',
      }
    }

    // ── 3. Fallback: check ops_users by normalized email ──────────────────
    if (normalizedEmail) {
      const { data: byEmail, error: byEmailError } = await supabase
        .from('ops_users')
        .select('*')
        .ilike('email', normalizedEmail)
        .limit(1)

      if (byEmailError) {
        console.warn('[ops-access] ops_users query error (by email):', byEmailError.message)
      }

      const activeByEmail = byEmail?.find((row) => isRowActive(row as Record<string, unknown>))
      opsRowByEmail = !!activeByEmail

      if (opsRowByEmail) {
        console.log('[ops-access] GRANTED via ops_users (email)')
        return {
          authorized: true,
          userId,
          email: normalizedEmail,
          grantedVia: 'ops_users_email',
        }
      }
    }
  } catch (err) {
    // ops_users table may not exist yet — fall through to allowlist
    console.warn('[ops-access] ops_users query error (table may not exist):', err)
  }

  // ── 4. Fallback: check email allowlist (env var) ──────────────────────
  const allowlist = getOperatorAllowlist()
  if (normalizedEmail && allowlist.length > 0 && allowlist.includes(normalizedEmail)) {
    console.log('[ops-access] GRANTED via email allowlist')
    return { authorized: true, userId, email: normalizedEmail, grantedVia: 'allowlist' }
  }

  // ── 5. Denied ─────────────────────────────────────────────────────────
  console.log('[ops-access] DENIED', {
    userId,
    email: normalizedEmail,
    opsRowByUserId,
    opsRowByEmail,
    allowlistLength: allowlist.length,
  })

  return denied(
    'User is not a Servify operator (not in ops_users table, not in email allowlist)',
  )
}
