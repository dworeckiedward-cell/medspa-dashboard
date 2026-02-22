/**
 * Support Query Helpers — read operations for support requests and updates.
 *
 * Server-only. Uses service-role client (bypasses RLS).
 * All tenant-scoped queries filter by client_id.
 * Falls back gracefully when tables don't exist.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeSlaInfo } from './sla'
import type {
  SupportRequest,
  SupportRequestUpdate,
  RequestWithClient,
  RequestStatus,
  RequestCategory,
  RequestPriority,
  SupportKpiSummary,
  SlaInfo,
} from './types'

// ── Tenant-scoped request list ──────────────────────────────────────────────

export interface ListRequestsOpts {
  status?: RequestStatus[]
  category?: RequestCategory
  priority?: RequestPriority
  search?: string
  limit?: number
  offset?: number
}

export async function listTenantRequests(
  clientId: string,
  opts: ListRequestsOpts = {},
): Promise<SupportRequest[]> {
  try {
    const supabase = createSupabaseServerClient()
    let query = supabase
      .from('support_requests')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (opts.status && opts.status.length > 0) {
      query = query.in('status', opts.status)
    }
    if (opts.category) {
      query = query.eq('category', opts.category)
    }
    if (opts.priority) {
      query = query.eq('priority', opts.priority)
    }
    if (opts.search) {
      query = query.or(
        `subject.ilike.%${opts.search}%,short_code.ilike.%${opts.search}%,description.ilike.%${opts.search}%`,
      )
    }
    if (opts.limit) {
      query = query.limit(opts.limit)
    }
    if (opts.offset) {
      query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[support] listTenantRequests error:', error.message)
      return []
    }

    return (data ?? []).map(mapDbRequest)
  } catch {
    return []
  }
}

// ── Single request with updates ─────────────────────────────────────────────

export async function getRequestWithUpdates(
  clientId: string,
  requestId: string,
): Promise<{
  request: SupportRequest | null
  updates: SupportRequestUpdate[]
  slaInfo: SlaInfo | null
}> {
  try {
    const supabase = createSupabaseServerClient()

    const [reqResult, updatesResult] = await Promise.all([
      supabase
        .from('support_requests')
        .select('*')
        .eq('id', requestId)
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase
        .from('support_request_updates')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true }),
    ])

    if (reqResult.error || !reqResult.data) {
      return { request: null, updates: [], slaInfo: null }
    }

    const request = mapDbRequest(reqResult.data)
    const updates = (updatesResult.data ?? []).map(mapDbUpdate)
    const slaInfo = computeSlaInfo(request)

    return { request, updates, slaInfo }
  } catch {
    return { request: null, updates: [], slaInfo: null }
  }
}

// ── Ops: cross-tenant request list ──────────────────────────────────────────

export interface OpsListRequestsOpts {
  status?: RequestStatus[]
  priority?: RequestPriority
  search?: string
  limit?: number
  offset?: number
}

export async function listOpsRequests(
  opts: OpsListRequestsOpts = {},
): Promise<RequestWithClient[]> {
  try {
    const supabase = createSupabaseServerClient()
    let query = supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (opts.status && opts.status.length > 0) {
      query = query.in('status', opts.status)
    }
    if (opts.priority) {
      query = query.eq('priority', opts.priority)
    }
    if (opts.search) {
      query = query.or(
        `subject.ilike.%${opts.search}%,short_code.ilike.%${opts.search}%`,
      )
    }
    if (opts.limit) {
      query = query.limit(opts.limit)
    }
    if (opts.offset) {
      query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[support] listOpsRequests error:', error.message)
      return []
    }

    if (!data || data.length === 0) return []

    // Get client names for display
    const clientIds = Array.from(new Set(data.map((r) => r.client_id as string)))
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug')
      .in('id', clientIds)

    const clientMap = new Map<string, { name: string; slug: string }>()
    for (const c of clients ?? []) {
      clientMap.set(c.id, { name: c.name, slug: c.slug })
    }

    return data.map((row) => {
      const req = mapDbRequest(row)
      const client = clientMap.get(req.clientId)
      return {
        ...req,
        clientName: client?.name ?? 'Unknown',
        clientSlug: client?.slug ?? '',
      }
    })
  } catch {
    return []
  }
}

// ── Ops: request detail (no client_id scope) ────────────────────────────────

export async function getOpsRequestWithUpdates(
  requestId: string,
): Promise<{
  request: RequestWithClient | null
  updates: SupportRequestUpdate[]
  slaInfo: SlaInfo | null
}> {
  try {
    const supabase = createSupabaseServerClient()

    const [reqResult, updatesResult] = await Promise.all([
      supabase
        .from('support_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle(),
      supabase
        .from('support_request_updates')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true }),
    ])

    if (reqResult.error || !reqResult.data) {
      return { request: null, updates: [], slaInfo: null }
    }

    const baseRequest = mapDbRequest(reqResult.data)

    // Fetch client info
    const { data: client } = await supabase
      .from('clients')
      .select('name, slug')
      .eq('id', baseRequest.clientId)
      .maybeSingle()

    const request: RequestWithClient = {
      ...baseRequest,
      clientName: client?.name ?? 'Unknown',
      clientSlug: client?.slug ?? '',
    }

    const updates = (updatesResult.data ?? []).map(mapDbUpdate)
    const slaInfo = computeSlaInfo(request)

    return { request, updates, slaInfo }
  } catch {
    return { request: null, updates: [], slaInfo: null }
  }
}

// ── Ops KPI summary ─────────────────────────────────────────────────────────

export async function getSupportKpiSummary(): Promise<SupportKpiSummary> {
  try {
    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('support_requests')
      .select('status, priority, first_response_due_at, first_responded_at, resolved_at, created_at')

    if (error || !data || data.length === 0) {
      return getEmptyKpi()
    }

    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    let totalOpen = 0
    let overdueFirstResponse = 0
    let highUrgentOpen = 0
    let resolvedToday = 0
    const responseTimes: number[] = []
    const resolutionTimes: number[] = []

    for (const r of data) {
      const status = r.status as RequestStatus
      const isOpen = !['resolved', 'closed'].includes(status)

      if (isOpen) {
        totalOpen++
        const priority = r.priority as RequestPriority
        if (priority === 'high' || priority === 'urgent') highUrgentOpen++

        if (r.first_response_due_at && !r.first_responded_at) {
          if (Date.parse(r.first_response_due_at) < now) {
            overdueFirstResponse++
          }
        }
      }

      if (r.resolved_at && Date.parse(r.resolved_at) >= todayStart.getTime()) {
        resolvedToday++
      }

      if (r.first_responded_at && r.created_at) {
        const hours = (Date.parse(r.first_responded_at) - Date.parse(r.created_at)) / (60 * 60 * 1000)
        responseTimes.push(hours)
      }

      if (r.resolved_at && r.created_at) {
        const hours = (Date.parse(r.resolved_at) - Date.parse(r.created_at)) / (60 * 60 * 1000)
        resolutionTimes.push(hours)
      }
    }

    return {
      totalOpen,
      overdueFirstResponse,
      highUrgentOpen,
      resolvedToday,
      avgFirstResponseHours: responseTimes.length > 0
        ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
        : null,
      avgResolutionHours: resolutionTimes.length > 0
        ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 10) / 10
        : null,
    }
  } catch {
    return getEmptyKpi()
  }
}

// ── DB row mappers ──────────────────────────────────────────────────────────

function mapDbRequest(row: Record<string, unknown>): SupportRequest {
  return {
    id: row.id as string,
    shortCode: row.short_code as string,
    clientId: row.client_id as string,
    createdByUserId: (row.created_by_user_id as string) ?? null,
    source: row.source as SupportRequest['source'],
    subject: row.subject as string,
    category: row.category as SupportRequest['category'],
    priority: row.priority as SupportRequest['priority'],
    status: row.status as SupportRequest['status'],
    description: row.description as string,
    pagePath: (row.page_path as string) ?? null,
    screenshotUrl: (row.screenshot_url as string) ?? null,
    affectedReference: (row.affected_reference as string) ?? null,
    firstResponseDueAt: (row.first_response_due_at as string) ?? null,
    firstRespondedAt: (row.first_responded_at as string) ?? null,
    resolvedAt: (row.resolved_at as string) ?? null,
    closedAt: (row.closed_at as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    lastPublicUpdateAt: (row.last_public_update_at as string) ?? null,
    lastInternalUpdateAt: (row.last_internal_update_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapDbUpdate(row: Record<string, unknown>): SupportRequestUpdate {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    authorType: row.author_type as SupportRequestUpdate['authorType'],
    authorLabel: (row.author_label as string) ?? null,
    visibility: row.visibility as SupportRequestUpdate['visibility'],
    updateType: row.update_type as SupportRequestUpdate['updateType'],
    body: (row.body as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }
}

function getEmptyKpi(): SupportKpiSummary {
  return {
    totalOpen: 0,
    overdueFirstResponse: 0,
    highUrgentOpen: 0,
    resolvedToday: 0,
    avgFirstResponseHours: null,
    avgResolutionHours: null,
  }
}
