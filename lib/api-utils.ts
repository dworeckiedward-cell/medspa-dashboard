/**
 * API Utilities — shared helpers for route handlers.
 *
 * Standardizes error responses, dev route gating, and tenant auth checks.
 * Import in API route handlers only (server-side).
 */

import { NextResponse } from 'next/server'

// ── Typed error response ─────────────────────────────────────────────────────

interface ApiErrorBody {
  error: string
  code?: string
  details?: unknown
}

/**
 * Return a typed JSON error response.
 */
export function apiError(
  message: string,
  status: number,
  opts?: { code?: string; details?: unknown },
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: message,
      ...(opts?.code && { code: opts.code }),
      ...(opts?.details !== undefined && { details: opts.details }),
    },
    { status },
  )
}

/** 400 Bad Request */
export function apiBadRequest(message = 'Bad request', details?: unknown) {
  return apiError(message, 400, { code: 'BAD_REQUEST', details })
}

/** 401 Unauthorized */
export function apiUnauthorized(message = 'Unauthorized') {
  return apiError(message, 401, { code: 'UNAUTHORIZED' })
}

/** 403 Forbidden */
export function apiForbidden(message = 'Forbidden') {
  return apiError(message, 403, { code: 'FORBIDDEN' })
}

/** 404 Not Found */
export function apiNotFound(message = 'Not found') {
  return apiError(message, 404, { code: 'NOT_FOUND' })
}

/** 500 Internal Server Error */
export function apiInternalError(message = 'Internal server error') {
  return apiError(message, 500, { code: 'INTERNAL_ERROR' })
}

// ── Dev route guard ──────────────────────────────────────────────────────────

/**
 * Check if dev routes are enabled for this environment.
 *
 * Returns true when:
 * - NODE_ENV is not 'production', OR
 * - ENABLE_DEV_ROUTES is explicitly set to 'true'
 *
 * Use this to gate development-only endpoints.
 */
export function isDevRouteEnabled(): boolean {
  // In production or on deployment platforms, require explicit opt-in
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL ||
    process.env.RAILWAY_ENVIRONMENT
  ) {
    return process.env.ENABLE_DEV_ROUTES === 'true'
  }
  return true // local dev
}

/**
 * Guard a route handler. Returns a 403 response if dev routes are disabled.
 * Usage: `const blocked = guardDevRoute(); if (blocked) return blocked;`
 */
export function guardDevRoute(): NextResponse | null {
  if (isDevRouteEnabled()) return null
  return apiForbidden('Dev routes are disabled in production. Set ENABLE_DEV_ROUTES=true to enable.')
}
