/**
 * POST /api/ops/errors/ingest
 *
 * n8n workflow error intake endpoint.
 * Auth: OPS_WEBHOOK_SECRET via x-ops-key or Authorization: Bearer.
 *
 * Body:
 *   tenantSlug?    string — clinic slug (optional)
 *   clientId?      string — clinic id (optional)
 *   workflow       string — workflow name
 *   errorMessage   string — error description
 *   severity?      'critical' | 'error' | 'warning' | 'info'  (default 'error')
 *   timestamp?     string — ISO 8601 (default: now)
 *   stack?         string — optional stack trace
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { createOpsNotification } from '@/lib/ops/notifications'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { WorkflowErrorSeverity } from '@/lib/ops/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const keyResult = verifyOpsServerKey(request, 'errors/ingest')

  if (keyResult.missingSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: OPS_WEBHOOK_SECRET is not set' },
      { status: 500 },
    )
  }

  if (!keyResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const workflow = String(body.workflow ?? '').trim()
  const errorMessage = String(body.errorMessage ?? '').trim()

  if (!workflow || !errorMessage) {
    return NextResponse.json(
      { error: 'workflow and errorMessage are required' },
      { status: 400 },
    )
  }

  const VALID_SEVERITIES: WorkflowErrorSeverity[] = ['critical', 'error', 'warning', 'info']
  const severity: WorkflowErrorSeverity = VALID_SEVERITIES.includes(body.severity as WorkflowErrorSeverity)
    ? (body.severity as WorkflowErrorSeverity)
    : 'error'

  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString()
  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug : null
  const clientId = typeof body.clientId === 'string' ? body.clientId : null
  const stack = typeof body.stack === 'string' ? body.stack : null

  // Resolve tenant_id from slug if needed
  let resolvedTenantId = clientId
  if (!resolvedTenantId && tenantSlug) {
    try {
      const supabase = createSupabaseServerClient()
      const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle()
      resolvedTenantId = data?.id ?? null
    } catch {
      // Non-fatal — store without tenant linkage
    }
  }

  const severityEmoji: Record<WorkflowErrorSeverity, string> = {
    critical: '🔴',
    error: '🟠',
    warning: '🟡',
    info: '🔵',
  }

  const title = `${severityEmoji[severity]} [${severity.toUpperCase()}] ${workflow}: ${errorMessage.slice(0, 120)}`

  const descriptionPayload = JSON.stringify({
    workflow,
    errorMessage,
    severity,
    tenantSlug,
    stack,
    timestamp,
  })

  await createOpsNotification({
    tenantId: resolvedTenantId,
    type: 'workflow_error',
    title,
    description: descriptionPayload,
    actionHref: resolvedTenantId
      ? `/ops/clients/${resolvedTenantId}/errors`
      : '/ops/errors',
  })

  // Also log to server console for immediate visibility
  console.info(
    JSON.stringify({
      level: severity,
      event: 'workflow_error',
      workflow,
      error: errorMessage,
      tenant_slug: tenantSlug,
      timestamp,
    }),
  )

  return NextResponse.json({ ok: true, received: true })
}
