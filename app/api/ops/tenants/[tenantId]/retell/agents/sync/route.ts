/**
 * POST /api/ops/tenants/[tenantId]/retell/agents/sync
 *
 * Operator-only. Pulls all agents from Retell API, matches them to the
 * tenant, and upserts into tenant_retell_agents mapping table.
 *
 * This allows the webhook ingest to resolve tenant by agent_id.
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listAgents } from '@/lib/retell/api'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tenantId } = await params
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json(
      { error: 'RETELL_API_KEY not configured on server' },
      { status: 503 },
    )
  }

  try {
    const agents = await listAgents()
    const supabase = createSupabaseServerClient()

    let synced = 0
    let errors = 0

    for (const agent of agents) {
      try {
        const { error } = await supabase
          .from('tenant_retell_agents')
          .upsert(
            {
              tenant_id: tenantId,
              agent_id: agent.agent_id,
              agent_name: agent.agent_name ?? null,
            },
            { onConflict: 'agent_id' },
          )

        if (error) {
          // Table may not exist yet — return clear error
          if (error.message.includes('not found') || error.message.includes('does not exist')) {
            return NextResponse.json(
              { error: 'tenant_retell_agents table not found. Run the migration first.' },
              { status: 503 },
            )
          }
          errors++
          console.warn('[agents/sync] Upsert error:', error.message, agent.agent_id)
        } else {
          synced++
        }
      } catch {
        errors++
      }
    }

    // Audit log
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'retell_agents_synced',
      targetClientId: tenantId,
      metadata: { totalAgents: agents.length, synced, errors },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      totalAgents: agents.length,
      synced,
      errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[agents/sync] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
