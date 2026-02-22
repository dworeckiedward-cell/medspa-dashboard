import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'

// Prevent Next.js from caching this route — auth state must be read fresh
export const dynamic = 'force-dynamic'

/**
 * GET /api/ops/check-access
 *
 * Lightweight endpoint for client components (e.g. sidebar account menu)
 * to check if the current user has operator access.
 *
 * Returns { hasAccess: boolean } — no sensitive details exposed.
 * Uses the same resolveOperatorAccess() as the /ops route guard,
 * ensuring a single source of truth.
 */
export async function GET() {
  try {
    const result = await resolveOperatorAccess()
    console.log('[ops-check-access] Result:', {
      authorized: result.authorized,
      grantedVia: result.grantedVia,
      userId: result.userId,
      reason: result.reason,
    })
    return NextResponse.json({ hasAccess: result.authorized })
  } catch (err) {
    console.warn('[ops-check-access] Unexpected error:', err)
    // Fail closed — hide ops button on error
    return NextResponse.json({ hasAccess: false })
  }
}
