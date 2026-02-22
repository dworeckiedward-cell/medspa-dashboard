/**
 * GET /api/ops/financials
 *
 * Returns cross-tenant financial overview for all clients.
 * Operator-only — guarded by resolveOperatorAccess().
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import { computeOpsFinancialKpis } from '@/lib/ops-financials/compute'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Fetch all clients
    const supabase = createSupabaseServerClient()
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (clientsError || !clients) {
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Fetch unit economics + build snapshots
    const unitEconomics = await getAllClientUnitEconomics()
    const snapshots = await getAllCommercialSnapshots(
      clients as unknown as Client[],
      unitEconomics,
    )
    const kpis = computeOpsFinancialKpis(snapshots)

    // Audit log (fire-and-forget)
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'financials_console_viewed',
      metadata: { clientCount: snapshots.length },
    }).catch(() => {})

    return NextResponse.json({ snapshots, kpis })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
