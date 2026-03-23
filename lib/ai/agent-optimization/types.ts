/**
 * Agent Optimization — shared TypeScript types.
 *
 * Storage path: tenants.branding.ai_modules.agent_optimization
 *   .insights.<rangeDays>     — StoredInsight
 *   .recommendations.<id>    — Recommendation
 *   .experiment              — Experiment
 */

// ── Sub-shapes ────────────────────────────────────────────────────────────────

export interface TopObjection {
  label: string
  count: number
  examples: string[]
}

export interface FailReason {
  label: string
  count: number
}

export interface WinningLine {
  snippet: string
  why: string
  call_log_id?: string
}

export interface PromptDiff {
  opening?: { before: string; after: string }
  qualifying?: { before: string; after: string }
  objections?: Array<{ objection: string; before: string; after: string }>
  closing?: { before: string; after: string }
}

export interface AbPlan {
  split: number
  success_metric: string
  duration_days: number
}

export interface ComparisonDeltas {
  connect_rate?: number
  lead_rate?: number
  booked_rate?: number
  avg_duration?: number
}

// ── Recommendation ────────────────────────────────────────────────────────────

export type RecommendationStatus = 'draft' | 'approved' | 'rejected' | 'archived'
export type ExpectedImpact = 'high' | 'med' | 'low'

export interface Recommendation {
  id: string
  status: RecommendationStatus
  created_at: string
  approved_at: string | null
  title: string
  rationale: string
  expected_impact: ExpectedImpact
  diff: PromptDiff
  ab_plan: AbPlan
}

// ── Insight ───────────────────────────────────────────────────────────────────

export interface InsightData {
  top_objections: TopObjection[]
  top_fail_reasons: FailReason[]
  winning_lines: WinningLine[]
  recommendation_ids: string[]
  comparison: {
    prev_range: number
    deltas: ComparisonDeltas
  }
}

export interface StoredInsight {
  generated_at: string
  model: string
  input_hash: string
  data: InsightData
}

// ── Experiment ────────────────────────────────────────────────────────────────

export interface Experiment {
  active_variant: 'A' | 'B'
  variantA_prompt: string
  variantB_prompt: string
  last_switched_at: string
}

// ── Top-level store ───────────────────────────────────────────────────────────

export interface AgentOptimizationStore {
  insights: Record<string, StoredInsight>
  recommendations: Record<string, Recommendation>
  experiment?: Experiment
}

// ── Raw LLM output (before we assign IDs / status) ───────────────────────────

export interface LlmRawRecommendation {
  title: string
  rationale: string
  expected_impact: ExpectedImpact
  diff: PromptDiff
  ab_plan: AbPlan
}

export interface LlmInsightsOutput {
  top_objections: TopObjection[]
  top_fail_reasons: FailReason[]
  winning_lines: WinningLine[]
  recommendations: LlmRawRecommendation[]
}
