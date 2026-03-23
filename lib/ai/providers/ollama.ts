/**
 * Ollama AI provider — connects to self-hosted Ollama via HTTP.
 *
 * Uses /api/chat (preferred) with JSON format enforcement.
 * Falls back to /api/generate if /api/chat is unavailable.
 *
 * ENV:
 *   OLLAMA_BASE_URL        — e.g. http://vps:11434
 *   OLLAMA_MODEL_TAGS      — model for call tagging
 *   OLLAMA_MODEL_SUMMARY   — model for executive summaries
 *   OLLAMA_MODEL_FOLLOWUP  — model for follow-up SMS drafts
 *   AI_CONTEXT_LIMIT       — soft token limit for prompt trimming (default 4096)
 */

import {
  type AiProvider,
  type TagsOutput,
  type SummaryOutput,
  type FollowupOutput,
  type InsightsOutput,
  parseJsonFromLlm,
} from '../provider'
import { buildTagsPrompt, buildSummaryPrompt, buildFollowupPrompt, buildInsightsPrompt } from '../prompts'

// ── Config ───────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = process.env.OLLAMA_BASE_URL
  if (!url) throw new Error('[ollama] OLLAMA_BASE_URL not set')
  return url.replace(/\/$/, '')
}

function getModel(task: 'tags' | 'summary' | 'followup'): string {
  const envMap = {
    tags: 'OLLAMA_MODEL_TAGS',
    summary: 'OLLAMA_MODEL_SUMMARY',
    followup: 'OLLAMA_MODEL_FOLLOWUP',
  } as const
  const model = process.env[envMap[task]]
  if (!model) throw new Error(`[ollama] ${envMap[task]} not set`)
  return model
}

function getInsightsModel(): string {
  // Prefer a dedicated model; fall back to summary model for flexibility.
  const model = process.env.OLLAMA_MODEL_INSIGHTS ?? process.env.OLLAMA_MODEL_SUMMARY
  if (!model) throw new Error('[ollama] OLLAMA_MODEL_INSIGHTS and OLLAMA_MODEL_SUMMARY are both unset')
  return model
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

interface OllamaChatResponse {
  message?: { content?: string }
  response?: string
}

/**
 * Call Ollama /api/chat with JSON format.
 * Falls back to /api/generate if chat endpoint is unavailable.
 */
async function callOllama(
  model: string,
  systemPrompt: string,
  userContent: string,
  numPredict = 1024,
): Promise<string> {
  const baseUrl = getBaseUrl()
  const timeout = 120_000 // 2 minutes for slow models

  // Try /api/chat first
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        format: 'json',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: numPredict,
        },
      }),
      signal: AbortSignal.timeout(timeout),
    })

    if (res.ok) {
      const data = (await res.json()) as OllamaChatResponse
      const content = data.message?.content ?? data.response ?? ''
      if (content) return content
    }

    // If /api/chat returns 404, fall through to /api/generate
    if (res.status !== 404) {
      throw new Error(`Ollama /api/chat returned ${res.status}: ${await res.text().catch(() => '')}`)
    }
  } catch (err) {
    // Only fall through for 404/connection errors to /api/chat
    if (err instanceof Error && !err.message.includes('404') && !err.message.includes('ECONNREFUSED')) {
      throw err
    }
  }

  // Fallback: /api/generate
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\n${userContent}`,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: numPredict,
      },
    }),
    signal: AbortSignal.timeout(timeout),
  })

  if (!res.ok) {
    throw new Error(`Ollama /api/generate returned ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = (await res.json()) as OllamaChatResponse
  return data.response ?? ''
}

// ── Provider class ───────────────────────────────────────────────────────────

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama'

  async generateTags(input: string): Promise<TagsOutput> {
    const model = getModel('tags')
    const { system, user } = buildTagsPrompt(input)
    const raw = await callOllama(model, system, user)
    const parsed = parseJsonFromLlm<TagsOutput>(raw, [
      'intent', 'service', 'objection', 'urgency', 'outcome', 'lead_confidence',
    ])
    // Clamp lead_confidence to 0-1
    parsed.lead_confidence = Math.max(0, Math.min(1, Number(parsed.lead_confidence) || 0))
    return parsed
  }

  async generateSummary(input: string): Promise<SummaryOutput> {
    const model = getModel('summary')
    const { system, user } = buildSummaryPrompt(input)
    const raw = await callOllama(model, system, user)
    return parseJsonFromLlm<SummaryOutput>(raw, [
      'headline', 'insights', 'risks', 'recommended_actions',
    ])
  }

  async generateFollowup(input: string): Promise<FollowupOutput> {
    const model = getModel('followup')
    const { system, user } = buildFollowupPrompt(input)
    const raw = await callOllama(model, system, user)
    return parseJsonFromLlm<FollowupOutput>(raw, ['variant_a', 'variant_b', 'cta'])
  }

  async generateInsights(input: string): Promise<InsightsOutput> {
    const model = getInsightsModel()
    const { system, user } = buildInsightsPrompt(input)
    // Insights output is large — give the model more tokens
    const raw = await callOllama(model, system, user, 2048)
    return parseJsonFromLlm<InsightsOutput>(raw, [
      'top_objections',
      'top_fail_reasons',
      'winning_lines',
      'recommendations',
    ])
  }
}
