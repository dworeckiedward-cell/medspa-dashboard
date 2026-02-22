/**
 * /api/ops/ai-control — cross-tenant AI control watchlist.
 *
 * GET → list AI control states for all active clients.
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { listAllAiControlStates } from '@/lib/ai-control/query'

export async function GET() {
  const { authorized } = await resolveOperatorAccess()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const rows = await listAllAiControlStates()

  // Summary counts for the watchlist header
  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.effectiveStatus === 'active').length,
    paused: rows.filter((r) => r.effectiveStatus === 'paused' || r.effectiveStatus === 'auto_resume_soon').length,
    partial: rows.filter((r) => r.effectiveStatus === 'partial').length,
    maintenance: rows.filter((r) => r.effectiveStatus === 'maintenance').length,
  }

  return NextResponse.json({ rows, summary })
}
