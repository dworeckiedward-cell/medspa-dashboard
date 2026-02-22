import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter, rateLimit } from '../rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000, name: 'test' })
  })

  it('allows requests within limit', () => {
    const r1 = limiter.check('ip1')
    expect(r1.limited).toBe(false)
    if (!r1.limited) expect(r1.remaining).toBe(2)

    const r2 = limiter.check('ip1')
    expect(r2.limited).toBe(false)
    if (!r2.limited) expect(r2.remaining).toBe(1)

    const r3 = limiter.check('ip1')
    expect(r3.limited).toBe(false)
    if (!r3.limited) expect(r3.remaining).toBe(0)
  })

  it('blocks requests over limit', () => {
    limiter.check('ip1')
    limiter.check('ip1')
    limiter.check('ip1')

    const r4 = limiter.check('ip1')
    expect(r4.limited).toBe(true)
    if (r4.limited) {
      expect(r4.retryAfterMs).toBeGreaterThan(0)
      expect(r4.retryAfterMs).toBeLessThanOrEqual(60_000)
    }
  })

  it('tracks different IPs independently', () => {
    limiter.check('ip1')
    limiter.check('ip1')
    limiter.check('ip1')

    // ip1 is exhausted
    expect(limiter.check('ip1').limited).toBe(true)

    // ip2 is fresh
    const r = limiter.check('ip2')
    expect(r.limited).toBe(false)
    if (!r.limited) expect(r.remaining).toBe(2)
  })

  it('resets after window expires', () => {
    // Use a very short window
    const shortLimiter = new RateLimiter({ maxRequests: 1, windowMs: 1, name: 'short' })

    shortLimiter.check('ip1')
    expect(shortLimiter.check('ip1').limited).toBe(true)

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const r = shortLimiter.check('ip1')
        expect(r.limited).toBe(false)
        resolve()
      }, 10)
    })
  })
})

describe('rateLimit helper', () => {
  it('returns null when not limited', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000, name: 'test' })
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    const result = rateLimit(req, limiter)
    expect(result).toBeNull()
  })

  it('returns 429 response when rate-limited', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, name: 'test' })
    const makeReq = () =>
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

    rateLimit(makeReq(), limiter) // first — allowed
    const result = rateLimit(makeReq(), limiter) // second — blocked

    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    expect(result!.headers.get('Retry-After')).toBeTruthy()
  })

  it('uses x-forwarded-for for client identification', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, name: 'test' })

    const req1 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const req2 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '5.6.7.8' },
    })

    rateLimit(req1, limiter) // exhaust ip1
    const result = rateLimit(req2, limiter) // different ip — should be allowed
    expect(result).toBeNull()
  })
})
