/**
 * POST /api/ops/tenants/[tenantId]/generate-retell-prompts
 *
 * Generates inbound + outbound Retell agent prompts from clinic metadata.
 * Uses deterministic templates (no LLM). Stores results in ops_clinic_assets.
 * Creates ops notification when prompts are ready.
 *
 * Operator-only — guarded by resolveOperatorAccess().
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateInboundPrompt, generateOutboundPrompt } from '@/lib/ops/prompt-templates'
import { updateClinicAsset, getClinicAssets, createClinicAsset } from '@/lib/ops/clinic-assets'
import { createOpsNotification } from '@/lib/ops/notifications'
import type { Client } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tenantId } = await params
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
  }

  // Fetch tenant
  const supabase = createSupabaseServerClient()
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenantData) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const tenant = tenantData as unknown as Client

  // Get existing assets to find website URL
  const existingAssets = await getClinicAssets(tenantId)
  const inboundAsset = existingAssets.find((a) => a.type === 'retell_prompt_inbound')
  const outboundAsset = existingAssets.find((a) => a.type === 'retell_prompt_outbound')

  const websiteUrl = inboundAsset?.generatedFromUrl
    ?? outboundAsset?.generatedFromUrl
    ?? `https://${tenant.slug}.servify.ai`

  // Generate prompts from templates
  const templateVars = {
    clinicName: tenant.name,
    websiteUrl,
    timezone: tenant.timezone ?? 'America/New_York',
    phoneNumber: tenant.retell_phone_number,
  }

  const inboundContent = generateInboundPrompt(templateVars)
  const outboundContent = generateOutboundPrompt(templateVars)

  // Update existing assets or create new ones
  const results = { inbound: false, outbound: false }

  if (inboundAsset) {
    const updated = await updateClinicAsset(inboundAsset.id, {
      content: inboundContent,
      status: 'ready',
      errorMessage: null,
    })
    results.inbound = !!updated
  } else {
    const created = await createClinicAsset({
      tenantId,
      type: 'retell_prompt_inbound',
      title: 'Inbound Agent Prompt',
      content: inboundContent,
      status: 'ready',
      source: 'generated',
      generatedFromUrl: websiteUrl,
    })
    results.inbound = !!created
  }

  if (outboundAsset) {
    const updated = await updateClinicAsset(outboundAsset.id, {
      content: outboundContent,
      status: 'ready',
      errorMessage: null,
    })
    results.outbound = !!updated
  } else {
    const created = await createClinicAsset({
      tenantId,
      type: 'retell_prompt_outbound',
      title: 'Outbound Agent Prompt',
      content: outboundContent,
      status: 'ready',
      source: 'generated',
      generatedFromUrl: websiteUrl,
    })
    results.outbound = !!created
  }

  // Create notification
  await createOpsNotification({
    tenantId,
    type: 'prompts_ready',
    title: `Prompts ready: ${tenant.name}`,
    description: 'Inbound and outbound agent prompts generated. Copy to Retell and add Agent IDs.',
    actionHref: `/ops/clients/${tenantId}/files`,
  })

  // Audit
  logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'retell_prompts_generated',
    targetClientId: tenantId,
    targetClientSlug: tenant.slug,
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    inbound: results.inbound,
    outbound: results.outbound,
  })
}
