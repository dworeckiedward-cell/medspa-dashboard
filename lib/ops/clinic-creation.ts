/**
 * Ops — Clinic Creation (server-only).
 *
 * Creates a new tenant with all supporting rows:
 * tenant → financial profile → workspace invite → onboarding asset stubs.
 * Uses service-role client (bypasses RLS).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { upsertFinancialProfile } from '@/lib/ops-financials/mutations'
import type { Client } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateClinicInput {
  // Step 1: Basics
  name: string
  slug: string
  websiteUrl: string
  logoUrl?: string | null
  primaryContactEmail: string

  // Step 2: AI / Identifiers (optional)
  retellPhoneNumber?: string | null
  inboundAgentId?: string | null
  outboundAgentId?: string | null
  notes?: string | null

  // Step 3: Commercials
  setupFeeAmount?: number | null
  retainerAmount?: number | null
  currency?: string

  // Dashboard variant
  clientType?: 'clinic' | 'outbound' | 'fb_leads' | null
}

export interface CreateClinicResult {
  success: boolean
  tenantId?: string
  tenant?: Client
  inviteToken?: string
  error?: string
  /** Non-fatal warning: clinic was created but clients table update failed (run migration 025). */
  warning?: string
}

// ── Slug helpers ─────────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return !data
}

// ── Main creation flow ───────────────────────────────────────────────────────

export async function createClinic(
  input: CreateClinicInput,
  operatorEmail: string,
): Promise<CreateClinicResult> {
  const supabase = createSupabaseServerClient()

  // 1. Validate slug uniqueness
  const slugFree = await isSlugAvailable(input.slug)
  if (!slugFree) {
    return { success: false, error: `Slug "${input.slug}" is already taken` }
  }

  // 2. Create tenant row — only include columns guaranteed to exist on `tenants`.
  //    Agent IDs, branding, and phone number live on `clients` table (step 2b).
  //    AI columns (ai_enabled, ai_operating_mode, etc.) are NOT included
  //    because they may not exist in the production schema / PostgREST cache.
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: input.name,
      slug: input.slug,
      subdomain: input.slug,
      theme_mode: 'dark',
      timezone: 'America/New_York',
      is_active: true,
    })
    .select('*')
    .single()

  if (tenantError || !tenant) {
    console.error('[clinic-creation] Tenant insert error:', tenantError?.message)
    return { success: false, error: tenantError?.message ?? 'Failed to create tenant' }
  }

  const tenantId = tenant.id

  // 2b. Persist branding, agent IDs, and dashboard mode to clients table
  //     (graceful — client creation continues if this errors)
  const dashboardMode =
    input.clientType === 'outbound' ? 'outbound_db'
    : input.clientType === 'fb_leads' ? 'fb_leads'
    : 'inbound_clinic'

  let brandingWarning: string | undefined
  try {
    const { error: brandingError } = await supabase
      .from('clients')
      .update({
        logo_url: input.logoUrl ?? null,
        brand_color: '#2563EB',
        accent_color: '#8B5CF6',
        currency: input.currency ?? 'USD',
        client_type: input.clientType === 'fb_leads' ? 'clinic' : (input.clientType ?? 'clinic'),
        dashboard_mode: dashboardMode,
        retell_agent_id: input.inboundAgentId ?? null,
        outbound_agent_id: input.outboundAgentId ?? null,
        retell_phone_number: input.retellPhoneNumber ?? null,
      })
      .eq('id', tenantId)

    if (brandingError) {
      console.warn('[clinic-creation] Clients update failed:', brandingError.message)
      brandingWarning = `Client details not saved (${brandingError.message})`
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[clinic-creation] Clients update failed — continuing without details')
    brandingWarning = `Client details not saved (${msg})`
  }

  // 3. Create financial profile (commercials) — graceful if table missing
  if (input.setupFeeAmount || input.retainerAmount) {
    try {
      await upsertFinancialProfile(tenantId, {
        setupFeeAmount: input.setupFeeAmount ?? null,
        setupFeeStatus: input.setupFeeAmount ? 'unpaid' : 'not_set',
        retainerAmount: input.retainerAmount ?? null,
        retainerStatus: input.retainerAmount ? 'due' : 'not_set',
        billingNotes: input.notes ?? null,
      })
    } catch {
      console.warn('[clinic-creation] Financial profile upsert failed — table may not exist')
    }
  }

  // 4. Create onboarding asset stubs (pending status for prompt generation)
  try {
    await supabase.from('ops_clinic_assets').insert([
      {
        tenant_id: tenantId,
        type: 'retell_prompt_inbound',
        title: 'Inbound Agent Prompt',
        content: '',
        status: 'pending',
        source: 'generated',
        generated_from_url: input.websiteUrl,
      },
      {
        tenant_id: tenantId,
        type: 'retell_prompt_outbound',
        title: 'Outbound Agent Prompt',
        content: '',
        status: 'pending',
        source: 'generated',
        generated_from_url: input.websiteUrl,
      },
    ])
  } catch {
    // Graceful — table may not exist yet
  }

  // 5. Create workspace invite for the primary contact
  let inviteToken: string | undefined
  try {
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    inviteToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('workspace_invites').insert({
      client_id: tenantId,
      email: input.primaryContactEmail.toLowerCase(),
      role: 'owner',
      status: 'pending',
      invited_by: '00000000-0000-0000-0000-000000000000', // system
      inviter_email: operatorEmail,
      token: inviteToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
  } catch {
    // Graceful — workspace_invites may not exist
  }

  // 6. Create ops notification
  try {
    await supabase.from('ops_notifications').insert({
      tenant_id: tenantId,
      type: 'clinic_created',
      title: `New client: ${input.name}`,
      description: `Created by ${operatorEmail}. Prompts pending generation.`,
      action_href: `/ops/clients/${tenantId}/financials`,
    })
  } catch {
    // Graceful
  }

  return {
    success: true,
    tenantId,
    tenant: tenant as Client,
    inviteToken,
    warning: brandingWarning,
  }
}
