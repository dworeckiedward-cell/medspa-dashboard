/**
 * POST /api/ops/tenants/[tenantId]/retell/agents/[agentId]/update
 *
 * Operator-only. Proxies a PATCH to Retell's Update Agent API.
 * Accepts a JSON body with the fields to update on the agent.
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { updateAgent } from '@/lib/retell/api'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; agentId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tenantId, agentId } = await params
  if (!tenantId || !agentId) {
    return NextResponse.json({ error: 'Tenant ID and Agent ID required' }, { status: 400 })
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json(
      { error: 'RETELL_API_KEY not configured on server' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const updated = await updateAgent(agentId, body)

    // Audit log
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'retell_agent_updated',
      targetClientId: tenantId,
      metadata: { agentId, fields: Object.keys(body) },
    }).catch(() => {})

    return NextResponse.json({ success: true, agent: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[agents/update] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
