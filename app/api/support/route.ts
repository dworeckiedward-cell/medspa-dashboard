/**
 * /api/support — tenant-scoped support requests.
 *
 * GET  → list requests for the authenticated tenant
 * POST → create a new support request
 *
 * Auth: tenant-scoped via resolveTenantAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listTenantRequests } from '@/lib/support/query'
import { createRequest } from '@/lib/support/mutations'
import type { RequestStatus, RequestCategory, RequestPriority } from '@/lib/support/types'

// ── GET: tenant-scoped list ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const category = params.get('category') as RequestCategory | null
  const priority = params.get('priority') as RequestPriority | null
  const search = params.get('search') ?? undefined
  const limit = Math.min(parseInt(params.get('limit') ?? '50'), 100)
  const offset = parseInt(params.get('offset') ?? '0')

  const statusArr = status
    ? (status.split(',') as RequestStatus[])
    : undefined

  const requests = await listTenantRequests(tenant.id, {
    status: statusArr,
    category: category ?? undefined,
    priority: priority ?? undefined,
    search,
    limit,
    offset,
  })

  return NextResponse.json({ requests, total: requests.length })
}

// ── POST: create request ────────────────────────────────────────────────────

const CreateSchema = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum([
    'bug', 'improvement', 'question', 'data_issue',
    'integration_issue', 'billing_question', 'other',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  description: z.string().min(1).max(5000),
  pagePath: z.string().max(500).optional(),
  screenshotUrl: z.string().url().max(2000).optional(),
  affectedReference: z.string().max(200).optional(),
})

export async function POST(request: Request) {
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const data = parsed.data

  const result = await createRequest({
    clientId: tenant.id,
    createdByUserId: userId ?? null,
    source: 'dashboard',
    subject: data.subject,
    category: data.category,
    priority: data.priority,
    description: data.description,
    pagePath: data.pagePath,
    screenshotUrl: data.screenshotUrl,
    affectedReference: data.affectedReference,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(
    { success: true, requestId: result.requestId, shortCode: result.shortCode },
    { status: 201 },
  )
}
