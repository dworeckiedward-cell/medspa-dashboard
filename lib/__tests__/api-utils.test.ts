import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We need to test isDevRouteEnabled which reads process.env
// Import dynamically to allow env manipulation between tests.

describe('isDevRouteEnabled', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  async function loadModule() {
    const mod = await import('../api-utils')
    return mod
  }

  it('returns true in local development (NODE_ENV=development)', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL
    delete process.env.RAILWAY_ENVIRONMENT
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(true)
  })

  it('requires ENABLE_DEV_ROUTES in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ENABLE_DEV_ROUTES
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(false)
  })

  it('allows dev routes in production when explicitly enabled', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENABLE_DEV_ROUTES = 'true'
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(true)
  })

  it('requires ENABLE_DEV_ROUTES on Vercel even in development', async () => {
    process.env.NODE_ENV = 'development'
    process.env.VERCEL = '1'
    delete process.env.ENABLE_DEV_ROUTES
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(false)
  })

  it('requires ENABLE_DEV_ROUTES on Railway even in development', async () => {
    process.env.NODE_ENV = 'development'
    process.env.RAILWAY_ENVIRONMENT = 'staging'
    delete process.env.ENABLE_DEV_ROUTES
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(false)
  })

  it('allows dev routes on Vercel when ENABLE_DEV_ROUTES=true', async () => {
    process.env.NODE_ENV = 'development'
    process.env.VERCEL = '1'
    process.env.ENABLE_DEV_ROUTES = 'true'
    const { isDevRouteEnabled } = await loadModule()
    expect(isDevRouteEnabled()).toBe(true)
  })
})

describe('guardDevRoute', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  async function loadModule() {
    const mod = await import('../api-utils')
    return mod
  }

  it('returns null (allowed) in local dev', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL
    delete process.env.RAILWAY_ENVIRONMENT
    const { guardDevRoute } = await loadModule()
    expect(guardDevRoute()).toBeNull()
  })

  it('returns 403 response when dev routes are disabled', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ENABLE_DEV_ROUTES
    const { guardDevRoute } = await loadModule()
    const response = guardDevRoute()
    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
  })
})
