/**
 * /api/ops/requests/[requestId]/updates — add operator updates (comments + notes).
 *
 * POST → add an update to the request timeline
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { addRequestUpdate } from '@/lib/support/mutations'

const AddUpdateSchema = z.object({
  body: z.string().min(1).max(5000),
  visibility: z.enum(['public', 'internal']).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { authorized, email } = await resolveOperatorAccess()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { requestId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AddUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const data = parsed.data

  const result = await addRequestUpdate({
    requestId,
    authorType: 'operator',
    authorLabel: email ?? 'Operator',
    visibility: data.visibility ?? 'public',
    updateType: 'comment',
    body: data.body,
  })

  return NextResponse.json(result)
}
