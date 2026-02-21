import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Server-side Supabase client using the service role key.
 * Bypasses Row Level Security — safe to use only in server components and API routes.
 *
 * Uses typed env validation from lib/env.ts — will fail fast with a clear
 * error message if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.
 *
 * TODO: When Supabase Auth is added, use createServerClient from @supabase/ssr
 * and pass the user's session so RLS policies can enforce per-user tenant isolation.
 */
export function createSupabaseServerClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
