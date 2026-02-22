/**
 * In-memory sliding-window rate limiter for API/webhook routes.
 *
 * Provides per-IP request throttling to protect against abuse.
 * Uses a Map-based sliding window — suitable for single-process deployments.
 *
 * For multi-instance deployments (e.g., Vercel Functions), consider
 * replacing with Upstash Redis rate limiter (@upstash/ratelimit).
 *
 * Usage in a route handler:
 *
 *   import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'
 *
 *   export async function POST(req: Request) {
 *     const limited = rateLimit(req, webhookLimiter)
 *     if (limited) return limited
 *     // ... handle request
 *   }
 */

import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Name for logging */
  name: string
}

/**
 * In-memory rate limit store.
 * Each instance is independent — create one per limiter config.
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  readonly config: RateLimiterConfig

  constructor(config: RateLimiterConfig) {
    this.config = config
    // Periodic cleanup to prevent unbounded memory growth
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
    // Allow GC if the module is unloaded (Next.js hot reload)
    if (typeof this.cleanupInterval === 'object' && 'unref' in this.cleanupInterval) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Check if a key is rate-limited.
   * Returns { limited: false, remaining } or { limited: true, retryAfterMs }.
   */
  check(key: string): { limited: false; remaining: number } | { limited: true; retryAfterMs: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      // New window
      this.store.set(key, { count: 1, resetAt: now + this.config.windowMs })
      return { limited: false, remaining: this.config.maxRequests - 1 }
    }

    if (entry.count >= this.config.maxRequests) {
      return { limited: true, retryAfterMs: entry.resetAt - now }
    }

    entry.count++
    return { limited: false, remaining: this.config.maxRequests - entry.count }
  }

  private cleanup() {
    const now = Date.now()
    this.store.forEach((entry, key) => {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    })
  }
}

// ── Pre-configured limiters ────────────────────────────────────────────────

/** Webhook endpoints: 60 req/min per IP */
export const webhookLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
  name: 'webhook',
})

/** API endpoints: 120 req/min per IP */
export const apiLimiter = new RateLimiter({
  maxRequests: 120,
  windowMs: 60_000,
  name: 'api',
})

/** Dev/test endpoints: 20 req/min per IP */
export const devLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
  name: 'dev',
})

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extract a rate-limit key from the request (IP-based).
 * Falls back to 'unknown' if IP cannot be determined.
 */
function getClientKey(req: Request): string {
  // Next.js / Vercel headers
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp

  return 'unknown'
}

/**
 * Apply rate limiting to a request.
 * Returns null if allowed, or a 429 response if rate-limited.
 */
export function rateLimit(req: Request, limiter: RateLimiter): NextResponse | null {
  const key = `${limiter.config.name}:${getClientKey(req)}`
  const result = limiter.check(key)

  if (result.limited) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many requests', retryAfterSeconds: retryAfterSec },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
        },
      },
    )
  }

  return null
}
