/**
 * POST /api/ops/tenants — Create a new clinic (tenant).
 *
 * Operator-only — guarded by resolveOperatorAccess().
 * Creates tenant + financial profile + onboarding assets + workspace invite.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createClinic, type CreateClinicInput } from '@/lib/ops/clinic-creation'

export const dynamic = 'force-dynamic'

const CreateClinicSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  websiteUrl: z.string().url(),
  logoUrl: z.string().url().nullable().optional(),
  primaryContactEmail: z.string().email(),
  retellPhoneNumber: z.string().max(30).nullable().optional(),
  inboundAgentId: z.string().max(100).nullable().optional(),
  outboundAgentId: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  setupFeeAmount: z.number().min(0).max(999_999).nullable().optional(),
  retainerAmount: z.number().min(0).max(999_999).nullable().optional(),
  currency: z.string().length(3).optional(),
})

export async function POST(request: Request) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateClinicSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const input: CreateClinicInput = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    websiteUrl: parsed.data.websiteUrl,
    logoUrl: parsed.data.logoUrl ?? null,
    primaryContactEmail: parsed.data.primaryContactEmail,
    retellPhoneNumber: parsed.data.retellPhoneNumber ?? null,
    inboundAgentId: parsed.data.inboundAgentId ?? null,
    outboundAgentId: parsed.data.outboundAgentId ?? null,
    notes: parsed.data.notes ?? null,
    setupFeeAmount: parsed.data.setupFeeAmount ?? null,
    retainerAmount: parsed.data.retainerAmount ?? null,
    currency: parsed.data.currency,
  }

  const operatorEmail = access.email ?? 'unknown'
  const result = await createClinic(input, operatorEmail)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Audit log
  logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail,
    action: 'clinic_created',
    targetClientId: result.tenantId,
    metadata: { clinicName: input.name, slug: input.slug },
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    tenantId: result.tenantId,
    inviteToken: result.inviteToken,
  })
}
