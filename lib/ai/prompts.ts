/**
 * AI Prompt Templates — strict JSON output, deterministic, short.
 *
 * Each function returns { system, user } strings ready for the LLM.
 * All prompts enforce JSON-only output and include guardrails.
 */

interface PromptPair {
  system: string
  user: string
}

// ── Tags prompt ──────────────────────────────────────────────────────────────

export function buildTagsPrompt(callInput: string): PromptPair {
  return {
    system: `You are a medical spa call analysis assistant. Analyze the call data and return ONLY a JSON object with these exact keys:

{
  "intent": one of "consultation", "pricing", "rebook", "complaint", "info", "other",
  "service": the specific service discussed (string) or null if unclear,
  "objection": one of "price", "timing", "trust", "location", "unknown", "none",
  "urgency": one of "hot", "warm", "cold",
  "outcome": one of "booked", "lead", "completed", "followup", "lost",
  "lead_confidence": number between 0.0 and 1.0
}

Rules:
- Return ONLY the JSON object, no other text.
- No extra keys beyond the 6 listed.
- lead_confidence must be a decimal between 0 and 1.
- If the call metadata shows is_booked=yes, outcome MUST be "booked".
- If is_booked=no, outcome must NOT be "booked" — do not hallucinate bookings.
- If information is insufficient, use "other"/"unknown"/"none" and set lead_confidence low.
- Be accurate, not creative. When in doubt, say "unknown".`,
    user: callInput,
  }
}

// ── Summary prompt ───────────────────────────────────────────────────────────

export function buildSummaryPrompt(summaryInput: string): PromptPair {
  return {
    system: `You are a medical spa business analyst. Analyze the call data and return ONLY a JSON object:

{
  "headline": "One concise sentence summarizing the period's performance",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "risks": ["risk 1"],
  "recommended_actions": ["action 1", "action 2"]
}

Rules:
- Return ONLY the JSON object, no other text.
- headline: max 15 words, focus on the most impactful metric or trend.
- insights: exactly 3 bullets. Be specific with numbers (e.g. "12 of 45 calls booked").
- risks: 1-2 bullets about concerning trends or gaps. If none, use ["No significant risks identified"].
- recommended_actions: 2 actionable items the clinic owner should do this week.
- Use the aggregate metrics provided. Do not invent numbers.
- Be direct and business-oriented, not generic.`,
    user: summaryInput,
  }
}

// ── Insights prompt ───────────────────────────────────────────────────────────

export function buildInsightsPrompt(batchInput: string): PromptPair {
  return {
    system: `You are an outbound call strategy analyst for medical spas. Analyze a batch of outbound call logs and return ONLY a JSON object with these exact keys:

{
  "top_objections": [
    { "label": "objection description", "count": 3, "examples": ["quote or paraphrase 1", "quote 2"] }
  ],
  "top_fail_reasons": [
    { "label": "why call did not convert", "count": 5 }
  ],
  "winning_lines": [
    { "snippet": "what the agent said that worked", "why": "brief explanation" }
  ],
  "recommendations": [
    {
      "title": "Short recommendation title",
      "rationale": "1-2 sentence explanation referencing the data",
      "expected_impact": "high",
      "diff": {
        "opening": { "before": "old script line", "after": "improved script line" },
        "objections": [
          { "objection": "price", "before": "old response", "after": "improved response" }
        ]
      },
      "ab_plan": { "split": 50, "success_metric": "lead_rate", "duration_days": 14 }
    }
  ]
}

Rules:
- Return ONLY the JSON object, no other text.
- top_objections: list 2-5 most common objections. count = number of calls affected. examples: 1-2 brief quotes or paraphrases from summaries.
- top_fail_reasons: list 2-4 non-objection reasons (no answer, wrong timing, bad intro, etc). count = calls affected.
- winning_lines: list 1-3 phrases or approaches from BOOKED/LEAD calls that seemed effective. If none evident, use [].
- recommendations: provide 3-5 actionable script improvements. Each must include:
  - title: max 8 words
  - rationale: cite specific data (e.g. "23% of calls cite price concerns")
  - expected_impact: "high", "med", or "low"
  - diff: include ONLY the sections that need changing (opening, qualifying, objections, closing). Omit unchanged sections.
  - ab_plan.split: always 50. success_metric: one of "lead_rate", "booked_rate", "contact_rate". duration_days: 7-30.
- Do NOT invent call data. Only reference what is in the batch.
- Do NOT recommend paid tools or external services.
- Be concrete and actionable — not generic.`,
    user: batchInput,
  }
}

// ── Follow-up prompt ─────────────────────────────────────────────────────────

export function buildFollowupPrompt(callInput: string): PromptPair {
  return {
    system: `You are a medical spa follow-up SMS specialist. Write follow-up messages for a flagged call.

Return ONLY a JSON object:

{
  "variant_a": "SMS text (warm, personal tone)",
  "variant_b": "SMS text (professional, concise tone)",
  "cta": "Short call-to-action phrase"
}

Rules:
- Return ONLY the JSON object, no other text.
- Each SMS variant must be under 160 characters.
- variant_a: warm and personal, mention the service or concern if known.
- variant_b: professional and concise, focus on next step.
- cta: a short phrase like "Book now" or "Reply YES to schedule".
- Reference the caller's actual situation from the call data.
- Do NOT promise specific prices or outcomes.
- If the caller had objections, address them gently.
- If is_booked=yes, do NOT write a follow-up to book — instead write a confirmation/thank-you message.`,
    user: callInput,
  }
}
