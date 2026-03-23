/**
 * Retell API wrappers — server-only.
 *
 * Minimal typed wrappers around the Retell REST API.
 * Uses getRetellClient() which requires RETELL_API_KEY.
 *
 * Endpoint reference: https://docs.retellai.com/api-references
 */

import { getRetellClient } from './client'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RetellCall {
  call_id: string
  agent_id: string
  call_type?: string
  call_status?: string
  from_number?: string
  to_number?: string
  direction?: string
  start_timestamp?: number  // epoch ms
  end_timestamp?: number    // epoch ms
  duration_ms?: number
  recording_url?: string
  public_log_url?: string
  transcript?: string
  transcript_object?: Array<{ role: string; content: string }>
  call_analysis?: {
    call_summary?: string
    custom_analysis_data?: Record<string, unknown>
    [key: string]: unknown
  }
  metadata?: Record<string, unknown>
  retell_llm_dynamic_variables?: Record<string, unknown>
  opt_out_sensitive_data_storage?: boolean
  [key: string]: unknown
}

export interface RetellAgent {
  agent_id: string
  agent_name?: string
  voice_id?: string
  llm_websocket_url?: string
  [key: string]: unknown
}

export interface ListCallsResponse {
  calls: RetellCall[]
  nextCursor?: string
}

// ── Call endpoints ─────────────────────────────────────────────────────────

/**
 * List recent calls from Retell API.
 * POST /v2/list-calls — returns a flat array of call objects.
 *
 * filter_criteria must be a plain object (e.g. { start_timestamp_ms: 123 }),
 * NOT an array. Retell returns 400 if it receives an array or string.
 */
export async function listCalls(opts: {
  limit?: number
  filterCriteria?: Record<string, unknown>
  sortOrder?: 'ascending' | 'descending'
  cursor?: string
}): Promise<ListCallsResponse> {
  const client = getRetellClient()
  const { limit = 50, filterCriteria, sortOrder = 'descending', cursor } = opts

  const body: Record<string, unknown> = {
    sort_order: sortOrder,
    limit,
  }

  // filter_criteria must be a plain object — only include when non-empty
  if (filterCriteria && Object.keys(filterCriteria).length > 0) {
    body.filter_criteria = filterCriteria
  }

  if (cursor) {
    body.pagination_key = cursor
  }

  // Retell returns a flat array, NOT { calls: [...] }
  const result = await client.request<RetellCall[]>('/v2/list-calls', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const calls = Array.isArray(result) ? result : []
  const nextCursor = calls.length === limit ? calls[calls.length - 1]?.call_id : undefined

  return { calls, nextCursor }
}

/**
 * Get a single call by ID.
 */
export async function getCall(callId: string): Promise<RetellCall> {
  const client = getRetellClient()
  return client.request<RetellCall>(`/v2/get-call/${callId}`)
}

/**
 * Get recording URL for a call. Retell includes it in the call object.
 */
export async function getCallRecording(callId: string): Promise<{ recording_url?: string }> {
  const call = await getCall(callId)
  return { recording_url: call.recording_url }
}

// ── Agent endpoints ───────────────────────────────────────────────────────

/**
 * List all agents.
 * POST /v2/list-agents — returns a flat array of agent objects.
 */
export async function listAgents(): Promise<RetellAgent[]> {
  const client = getRetellClient()
  const result = await client.request<RetellAgent[]>('/v2/list-agents', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return Array.isArray(result) ? result : []
}

/**
 * Get a single agent by ID.
 */
export async function getAgent(agentId: string): Promise<RetellAgent> {
  const client = getRetellClient()
  return client.request<RetellAgent>(`/v2/get-agent/${agentId}`)
}

/**
 * Update an agent. Patch is a partial update object.
 */
export async function updateAgent(
  agentId: string,
  patch: Record<string, unknown>,
): Promise<RetellAgent> {
  const client = getRetellClient()
  return client.request<RetellAgent>(`/v2/update-agent/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
