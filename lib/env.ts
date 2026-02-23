/**
 * Environment Validation — server-side only.
 *
 * Validates required env vars at import time and exports typed accessors.
 * Fails fast with clear error messages if required vars are missing.
 *
 * DO NOT import this file from client components — it references
 * server-only env vars (SUPABASE_SERVICE_ROLE_KEY, etc.).
 */

// ── Required vars ────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${name}\n` +
        `See .env.example for the full list of required variables.`,
    )
  }
  return value
}

// ── Optional vars with defaults ──────────────────────────────────────────────

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

// ── Exported config ──────────────────────────────────────────────────────────

/** Supabase connection (required) */
export const env = {
  /** Supabase project URL (public, used by both server and browser client) */
  get SUPABASE_URL() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },

  /** Supabase anon key (public, subject to RLS) */
  get SUPABASE_ANON_KEY() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },

  /** Supabase service role key (server-only, bypasses RLS) */
  get SUPABASE_SERVICE_ROLE_KEY() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },

  /** App domain for subdomain routing */
  get APP_DOMAIN() {
    return optionalEnv('NEXT_PUBLIC_APP_DOMAIN', 'lvh.me')
  },

  /** Webhook API key for /api/retell/webhook */
  get WEBHOOK_API_KEY() {
    return process.env.WEBHOOK_API_KEY ?? ''
  },

  /** Call summary webhook secret */
  get CALL_SUMMARY_WEBHOOK_SECRET() {
    return process.env.CALL_SUMMARY_WEBHOOK_SECRET ?? ''
  },

  /** Retell API key (server-only — NEVER expose to browser) */
  get RETELL_API_KEY() {
    return process.env.RETELL_API_KEY ?? ''
  },

  /** Dev action key for test-delivery route */
  get DEV_ACTION_KEY() {
    return process.env.DEV_ACTION_KEY ?? ''
  },

  /** Whether dev routes are enabled in production */
  get DEV_ROUTES_ENABLED() {
    return process.env.ENABLE_DEV_ROUTES === 'true'
  },

  /** Current NODE_ENV */
  get NODE_ENV() {
    return process.env.NODE_ENV ?? 'development'
  },

  /** Whether we're running in production */
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
} as const
