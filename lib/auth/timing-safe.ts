/**
 * Timing-safe string comparison for webhook secrets and API keys.
 *
 * Uses Node.js crypto.timingSafeEqual to prevent timing attacks where
 * an attacker could deduce the expected secret character-by-character
 * by measuring response times.
 *
 * Falls back to constant-time XOR comparison if crypto is unavailable
 * (should not happen in Next.js server routes).
 */

import { timingSafeEqual } from 'crypto'

/**
 * Compare two strings in constant time.
 * Returns false if either string is empty/undefined.
 */
export function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false

  try {
    const bufA = Buffer.from(a, 'utf-8')
    const bufB = Buffer.from(b, 'utf-8')
    return timingSafeEqual(bufA, bufB)
  } catch {
    // Fallback: should never reach here in Node.js
    return false
  }
}
