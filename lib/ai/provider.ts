/**
 * AI Provider abstraction — provider-agnostic interface for AI modules.
 *
 * Default: Ollama via HTTP on a self-hosted VPS.
 * Swap providers by changing AI_PROVIDER env var and adding a new provider file.
 */

// ── Output schemas ───────────────────────────────────────────────────────────

export interface TagsOutput {
  intent: 'consultation' | 'pricing' | 'rebook' | 'complaint' | 'info' | 'other'
  service: string | null
  objection: 'price' | 'timing' | 'trust' | 'location' | 'unknown' | 'none'
  urgency: 'hot' | 'warm' | 'cold'
  outcome: 'booked' | 'lead' | 'completed' | 'followup' | 'lost'
  lead_confidence: number
}

export interface SummaryOutput {
  headline: string
  insights: string[]
  risks: string[]
  recommended_actions: string[]
}

export interface FollowupOutput {
  variant_a: string
  variant_b: string
  cta: string
}

/** Raw LLM output from generateInsights — structured batch analysis. */
export interface InsightsOutput {
  top_objections: Array<{ label: string; count: number; examples: string[] }>
  top_fail_reasons: Array<{ label: string; count: number }>
  winning_lines: Array<{ snippet: string; why: string }>
  recommendations: Array<{
    title: string
    rationale: string
    expected_impact: 'high' | 'med' | 'low'
    diff: {
      opening?: { before: string; after: string }
      qualifying?: { before: string; after: string }
      objections?: Array<{ objection: string; before: string; after: string }>
      closing?: { before: string; after: string }
    }
    ab_plan: { split: number; success_metric: string; duration_days: number }
  }>
}

// ── Provider interface ───────────────────────────────────────────────────────

export interface AiProvider {
  readonly name: string
  generateTags(input: string): Promise<TagsOutput>
  generateSummary(input: string): Promise<SummaryOutput>
  generateFollowup(input: string): Promise<FollowupOutput>
  generateInsights(input: string): Promise<InsightsOutput>
}

// ── Factory ──────────────────────────────────────────────────────────────────

let _cached: AiProvider | null = null

export async function getAiProvider(): Promise<AiProvider> {
  if (_cached) return _cached

  // Startup warning — runs once per process on first AI call.
  const requiredEnvs = [
    'OLLAMA_BASE_URL',
    'OLLAMA_MODEL_TAGS',
    'OLLAMA_MODEL_SUMMARY',
    'OLLAMA_MODEL_FOLLOWUP',
  ]
  const missingEnvs = requiredEnvs.filter((k) => !process.env[k])
  if (missingEnvs.length > 0) {
    console.warn(
      `[AI] Missing required env vars: ${missingEnvs.join(', ')}. AI features will fail at runtime. Set these in your production environment.`,
    )
  }

  const providerName = process.env.AI_PROVIDER ?? 'ollama'

  switch (providerName) {
    case 'ollama': {
      const { OllamaProvider } = await import('./providers/ollama')
      _cached = new OllamaProvider()
      return _cached
    }
    default:
      throw new Error(`[ai] Unknown AI_PROVIDER: ${providerName}. Supported: ollama`)
  }
}

// ── Shared JSON parse helper ─────────────────────────────────────────────────

/**
 * Robust JSON extraction from LLM output.
 * 1. Try JSON.parse directly
 * 2. Extract first {...} block and parse
 * 3. Throw structured error
 */
export function parseJsonFromLlm<T>(raw: string, requiredKeys: string[]): T {
  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(raw)
    validateKeys(parsed, requiredKeys)
    return parsed as T
  } catch {
    // fall through
  }

  // Attempt 2: extract first JSON object
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      validateKeys(parsed, requiredKeys)
      return parsed as T
    } catch {
      // fall through
    }
  }

  throw new AiParseError(
    `Failed to parse JSON from LLM output. Required keys: ${requiredKeys.join(', ')}`,
    raw,
  )
}

function validateKeys(obj: unknown, keys: string[]): void {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Parsed value is not an object')
  }
  const missing = keys.filter((k) => !(k in (obj as Record<string, unknown>)))
  if (missing.length > 0) {
    throw new Error(`Missing required keys: ${missing.join(', ')}`)
  }
}

export class AiParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
  ) {
    super(message)
    this.name = 'AiParseError'
  }
}
