/**
 * Agent Optimization store — read/write helpers for
 * tenants.branding.ai_modules.agent_optimization.
 *
 * Follows the same pattern as lib/ai/tenant-summary-store.ts.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  AgentOptimizationStore,
  StoredInsight,
  Recommendation,
  Experiment,
} from './types'

type BrandingJson = Record<string, unknown>

// ── Internal helpers ──────────────────────────────────────────────────────────

async function readBranding(tenantId: string): Promise<BrandingJson> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('branding')
    .eq('id', tenantId)
    .maybeSingle()
  return (data?.branding as BrandingJson) ?? {}
}

async function writeBranding(tenantId: string, branding: BrandingJson): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('tenants')
    .update({ branding })
    .eq('id', tenantId)
  if (error) throw new Error(`[agent-opt] Failed to update branding: ${error.message}`)
}

function extractStore(branding: BrandingJson): AgentOptimizationStore {
  const aiModules = (branding.ai_modules as Record<string, unknown>) ?? {}
  return (
    (aiModules.agent_optimization as AgentOptimizationStore) ?? {
      insights: {},
      recommendations: {},
    }
  )
}

// ── Public read ───────────────────────────────────────────────────────────────

export async function readAgentOptimization(
  tenantId: string,
): Promise<AgentOptimizationStore> {
  const branding = await readBranding(tenantId)
  return extractStore(branding)
}

// ── Write insight + new recommendations ──────────────────────────────────────

export async function writeInsight(
  tenantId: string,
  rangeDays: number,
  insight: StoredInsight,
  newRecommendations: Record<string, Recommendation>,
): Promise<void> {
  const branding = await readBranding(tenantId)
  const aiModules = (branding.ai_modules as Record<string, unknown>) ?? {}
  const existing = extractStore(branding)

  const updated: AgentOptimizationStore = {
    ...existing,
    insights: {
      ...existing.insights,
      [String(rangeDays)]: insight,
    },
    recommendations: {
      ...existing.recommendations,
      ...newRecommendations,
    },
  }

  await writeBranding(tenantId, {
    ...branding,
    ai_modules: { ...aiModules, agent_optimization: updated },
  })
}

// ── Update a single recommendation's status ───────────────────────────────────

export async function updateRecommendation(
  tenantId: string,
  recId: string,
  patch: Partial<Recommendation>,
): Promise<Recommendation> {
  const branding = await readBranding(tenantId)
  const aiModules = (branding.ai_modules as Record<string, unknown>) ?? {}
  const store = extractStore(branding)

  const existing = store.recommendations[recId]
  if (!existing) throw new Error(`Recommendation ${recId} not found`)

  const updated: Recommendation = { ...existing, ...patch }
  const nextStore: AgentOptimizationStore = {
    ...store,
    recommendations: { ...store.recommendations, [recId]: updated },
  }

  await writeBranding(tenantId, {
    ...branding,
    ai_modules: { ...aiModules, agent_optimization: nextStore },
  })

  return updated
}

// ── Update experiment ─────────────────────────────────────────────────────────

export async function updateExperiment(
  tenantId: string,
  patch: Partial<Experiment>,
): Promise<void> {
  const branding = await readBranding(tenantId)
  const aiModules = (branding.ai_modules as Record<string, unknown>) ?? {}
  const store = extractStore(branding)

  const nextStore: AgentOptimizationStore = {
    ...store,
    experiment: {
      active_variant: 'A',
      variantA_prompt: '',
      variantB_prompt: '',
      last_switched_at: new Date().toISOString(),
      ...(store.experiment ?? {}),
      ...patch,
    },
  }

  await writeBranding(tenantId, {
    ...branding,
    ai_modules: { ...aiModules, agent_optimization: nextStore },
  })
}
