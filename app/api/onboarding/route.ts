/**
 * GET/PATCH /api/onboarding
 *
 * Tenant-scoped onboarding state API.
 * - GET:   returns current onboarding state (or null if not persisted)
 * - PATCH: upserts onboarding state (complete step, dismiss, etc.)
 *
 * Falls gracefully if migration 009 is not applied — returns null/false.
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getOnboardingStateFromDb } from '@/lib/dashboard/onboarding-query'
import {
  completeStepOnServer,
  dismissOnboardingOnServer,
  upsertOnboardingState,
} from '@/lib/dashboard/onboarding-mutations'
import { apiUnauthorized, apiBadRequest } from '@/lib/api-utils'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_STEPS = ['branding', 'ai_settings', 'services', 'integrations', 'reporting', 'launch'] as const

const PatchBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('complete_step'),
    step: z.enum(VALID_STEPS),
  }),
  z.object({
    action: z.literal('dismiss'),
  }),
  z.object({
    action: z.literal('upsert'),
    state: z.object({
      completedSteps: z.array(z.enum(VALID_STEPS)),
      isComplete: z.boolean(),
      currentStep: z.enum(VALID_STEPS),
      skippedAt: z.string().optional(),
    }),
  }),
])

// ── GET — read current state ─────────────────────────────────────────────────

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  const state = await getOnboardingStateFromDb(tenant.id)
  log.info('onboarding.read', { tenantId: tenant.id, found: !!state })
  return Response.json({ state })
}

// ── PATCH — update state ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  const parsed = PatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiBadRequest('Invalid request body', parsed.error.flatten().fieldErrors)
  }

  const body = parsed.data

  switch (body.action) {
    case 'complete_step': {
      const updated = await completeStepOnServer(tenant.id, body.step)
      log.info('onboarding.complete_step', { tenantId: tenant.id, step: body.step, persisted: !!updated })
      if (!updated) {
        return Response.json({ state: null, persisted: false })
      }
      return Response.json({ state: updated, persisted: true })
    }

    case 'dismiss': {
      const ok = await dismissOnboardingOnServer(tenant.id)
      log.info('onboarding.dismiss', { tenantId: tenant.id, persisted: ok })
      return Response.json({ persisted: ok })
    }

    case 'upsert': {
      const ok = await upsertOnboardingState(tenant.id, body.state)
      log.info('onboarding.upsert', { tenantId: tenant.id, persisted: ok })
      return Response.json({ persisted: ok })
    }
  }
}
