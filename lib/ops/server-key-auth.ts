/**
 * Server-to-server key authentication for OPS API routes.
 *
 * Allows curl / CI / n8n to call ops endpoints without a browser session.
 *
 * Header priority (first match wins):
 *   x-ops-key  →  Authorization: Bearer <secret>
 *
 * Expected secret: OPS_WEBHOOK_SECRET (required — no fallback).
 */

import { safeCompare } from '@/lib/auth/timing-safe'

const DEBUG = process.env.DEBUG_OPS === 'true'

export interface ServerKeyResult {
  /** true = key matched */
  valid: boolean
  /** Header that carried the key (null if none found) */
  headerUsed: string | null
  /** Set when a key was sent but OPS_WEBHOOK_SECRET is not configured */
  missingSecret: boolean
}

/**
 * Verify an incoming request carries a valid OPS server key.
 * Pass `route` for debug logging (never logs secrets).
 */
export function verifyOpsServerKey(
  request: Request,
  route?: string,
): ServerKeyResult {
  let incomingKey: string | null = null
  let headerUsed: string | null = null

  // 1. x-ops-key header
  const opsKey = request.headers.get('x-ops-key')
  if (opsKey) {
    incomingKey = opsKey
    headerUsed = 'x-ops-key'
  }

  // 2. Authorization: Bearer <secret>
  if (!incomingKey) {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i)
      if (match) {
        incomingKey = match[1]
        headerUsed = 'authorization'
      }
    }
  }

  if (!incomingKey) {
    if (DEBUG && route) {
      console.log(`[ops-auth] route=${route} auth=serverkey headerUsed=none ok=false`)
    }
    return { valid: false, headerUsed: null, missingSecret: false }
  }

  // Key was sent — OPS_WEBHOOK_SECRET must be configured
  const expected = process.env.OPS_WEBHOOK_SECRET

  if (!expected) {
    if (DEBUG) {
      console.log(`[ops-auth] route=${route} auth=serverkey headerUsed=${headerUsed} ok=false (OPS_WEBHOOK_SECRET not set)`)
    }
    return { valid: false, headerUsed, missingSecret: true }
  }

  const valid = safeCompare(incomingKey, expected)

  if (DEBUG && route) {
    console.log(`[ops-auth] route=${route} auth=serverkey headerUsed=${headerUsed} ok=${valid}`)
  }

  return { valid, headerUsed, missingSecret: false }
}
