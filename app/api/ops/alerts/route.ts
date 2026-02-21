/**
 * /api/ops/alerts — GET cross-tenant alerts for operator console.
 *
 * Protected by operator access guard.
 * Supports query params: severity, status, source, clientId, limit.
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { listAllAlerts, getAlertsSummary } from '@/lib/alerts/query'
import type { AlertSeverity, AlertStatus, AlertSource } from '@/lib/alerts/types'

export async function GET(request: Request) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(request.url)
  const severity = url.searchParams.getAll('severity') as AlertSeverity[]
  const status = url.searchParams.getAll('status') as AlertStatus[]
  const source = url.searchParams.getAll('source') as AlertSource[]
  const clientId = url.searchParams.get('clientId') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)

  const [alerts, summary] = await Promise.all([
    listAllAlerts({
      severity: severity.length > 0 ? severity : undefined,
      status: status.length > 0 ? status : undefined,
      source: source.length > 0 ? source : undefined,
      clientId,
      limit,
    }),
    getAlertsSummary(),
  ])

  return NextResponse.json({ alerts, summary })
}
