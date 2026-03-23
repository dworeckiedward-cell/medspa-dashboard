/**
 * AI failure logger — surfaces AI errors into the OPS Errors console.
 *
 * Writes a workflow_error notification into ops_notifications so that
 * failures are visible at /ops/errors without silent log-only dropping.
 */

import { createOpsNotification } from '@/lib/ops/notifications'

export interface AiFailureParams {
  tenantId: string | null
  tenantSlug: string | null
  /** API route identifier, e.g. "api/ai/tag-call" */
  route: string
  /** Model name from env, e.g. process.env.OLLAMA_MODEL_TAGS */
  model: string
  error: unknown
}

/**
 * Log an AI generation failure to ops_notifications.
 * Fire-and-forget — never throws, never cascades into the calling route.
 */
export async function logAiFailure({
  tenantId,
  tenantSlug,
  route,
  model,
  error,
}: AiFailureParams): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error))

  const payload = {
    // WorkflowErrorPayload-compatible fields
    workflow: route,
    errorMessage: err.message,
    severity: 'error' as const,
    tenantSlug: tenantSlug ?? null,
    stack: err.stack ?? null,
    timestamp: new Date().toISOString(),
    // Extra context (stored in description JSON, not in the interface)
    model,
  }

  await createOpsNotification({
    tenantId: tenantId ?? null,
    type: 'workflow_error',
    title: `\u26A0 AI error \u2014 ${route}`,
    description: JSON.stringify(payload),
    actionHref: tenantId ? `/ops/clients/${tenantId}/errors` : '/ops/errors',
  }).catch((e: unknown) => {
    // Last-resort: don't let notification write failure swallow the original error info
    console.error('[ai/ops-log] Failed to write AI failure to ops_notifications:', e)
  })
}
