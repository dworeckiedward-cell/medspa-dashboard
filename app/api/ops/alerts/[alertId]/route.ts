/**
 * /api/ops/alerts/[alertId] — PATCH lifecycle actions on a specific alert.
 *
 * Supported actions: acknowledge, resolve, reopen, mute.
 * Protected by operator access guard.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import {
  acknowledgeAlert,
  resolveAlert,
  reopenAlert,
  muteAlert,
} from '@/lib/alerts/mutations'

const ActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve', 'reopen', 'mute']),
  mutedUntil: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const { alertId } = await params
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const actor = access.email ?? access.userId ?? 'operator'
  const { action, mutedUntil } = parsed.data

  let result: { success: boolean; error?: string }

  switch (action) {
    case 'acknowledge':
      result = await acknowledgeAlert(alertId, actor)
      break
    case 'resolve':
      result = await resolveAlert(alertId, actor)
      break
    case 'reopen':
      result = await reopenAlert(alertId, actor)
      break
    case 'mute':
      result = await muteAlert(
        alertId,
        actor,
        mutedUntil ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      )
      break
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, action })
}
