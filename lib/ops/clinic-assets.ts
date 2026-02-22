/**
 * Ops — Clinic Assets CRUD.
 *
 * Queries and mutations for the ops_clinic_assets table.
 * Stores generated prompts, documents, and other clinic files.
 * Uses service-role client (bypasses RLS).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

// ── Types ────────────────────────────────────────────────────────────────────

export type ClinicAssetType =
  | 'retell_prompt_inbound'
  | 'retell_prompt_outbound'
  | 'note'
  | 'document'

export type ClinicAssetStatus = 'pending' | 'ready' | 'error'

export type ClinicAssetSource = 'generated' | 'manual'

export interface ClinicAsset {
  id: string
  tenantId: string
  type: ClinicAssetType
  title: string
  content: string
  status: ClinicAssetStatus
  source: ClinicAssetSource
  generatedFromUrl: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

interface ClinicAssetRow {
  id: string
  tenant_id: string
  type: string
  title: string
  content: string
  status: string
  source: string
  generated_from_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: ClinicAssetRow): ClinicAsset {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type as ClinicAssetType,
    title: row.title,
    content: row.content,
    status: row.status as ClinicAssetStatus,
    source: row.source as ClinicAssetSource,
    generatedFromUrl: row.generated_from_url,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get all clinic assets for a tenant */
export async function getClinicAssets(tenantId: string): Promise<ClinicAsset[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('ops_clinic_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return (data as unknown as ClinicAssetRow[]).map(mapRow)
  } catch {
    return []
  }
}

/** Get a single asset by ID */
export async function getClinicAsset(assetId: string): Promise<ClinicAsset | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('ops_clinic_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()

    if (error || !data) return null
    return mapRow(data as unknown as ClinicAssetRow)
  } catch {
    return null
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Update asset content and status */
export async function updateClinicAsset(
  assetId: string,
  update: {
    content?: string
    status?: ClinicAssetStatus
    errorMessage?: string | null
  },
): Promise<ClinicAsset | null> {
  try {
    const supabase = createSupabaseServerClient()
    const dbUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (update.content !== undefined) dbUpdate.content = update.content
    if (update.status !== undefined) dbUpdate.status = update.status
    if (update.errorMessage !== undefined) dbUpdate.error_message = update.errorMessage

    const { data, error } = await supabase
      .from('ops_clinic_assets')
      .update(dbUpdate)
      .eq('id', assetId)
      .select('*')
      .single()

    if (error || !data) return null
    return mapRow(data as unknown as ClinicAssetRow)
  } catch {
    return null
  }
}

/** Create a new clinic asset */
export async function createClinicAsset(input: {
  tenantId: string
  type: ClinicAssetType
  title: string
  content: string
  status: ClinicAssetStatus
  source: ClinicAssetSource
  generatedFromUrl?: string | null
}): Promise<ClinicAsset | null> {
  try {
    const supabase = createSupabaseServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('ops_clinic_assets')
      .insert({
        tenant_id: input.tenantId,
        type: input.type,
        title: input.title,
        content: input.content,
        status: input.status,
        source: input.source,
        generated_from_url: input.generatedFromUrl ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (error || !data) return null
    return mapRow(data as unknown as ClinicAssetRow)
  } catch {
    return null
  }
}
