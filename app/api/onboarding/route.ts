/**
 * GET/PATCH /api/onboarding
 *
 * Tenant-scoped onboarding state API.
 * - GET:   returns current onboarding state (or null if not persisted)
 * - PATCH: upserts onboarding state (complete step, dismiss, etc.)
 *
 * Falls gracefully if migration 009 is not applied — returns null/false.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getOnboardingStateFromDb } from '@/lib/dashboard/onboarding-query'
import {
  completeStepOnServer,
  dismissOnboardingOnServer,
  upsertOnboardingState,
} from '@/lib/dashboard/onboarding-mutations'
import type { OnboardingStep, OnboardingState } from '@/lib/dashboard/onboarding-state'

export const dynamic = 'force-dynamic'

// ── GET — read current state ─────────────────────────────────────────────────

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = await getOnboardingStateFromDb(tenant.id)
  return NextResponse.json({ state })
}

// ── PATCH — update state ─────────────────────────────────────────────────────

interface PatchBody {
  action: 'complete_step' | 'dismiss' | 'upsert'
  step?: OnboardingStep
  state?: OnboardingState
}

export async function PATCH(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  switch (body.action) {
    case 'complete_step': {
      if (!body.step) {
        return NextResponse.json({ error: 'Missing step' }, { status: 400 })
      }
      const updated = await completeStepOnServer(tenant.id, body.step)
      if (!updated) {
        return NextResponse.json({ state: null, persisted: false })
      }
      return NextResponse.json({ state: updated, persisted: true })
    }

    case 'dismiss': {
      const ok = await dismissOnboardingOnServer(tenant.id)
      return NextResponse.json({ persisted: ok })
    }

    case 'upsert': {
      if (!body.state) {
        return NextResponse.json({ error: 'Missing state' }, { status: 400 })
      }
      const ok = await upsertOnboardingState(tenant.id, body.state)
      return NextResponse.json({ persisted: ok })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
