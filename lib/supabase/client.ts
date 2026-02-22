'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton browser client — safe to call multiple times
let _client: SupabaseClient | null = null

/**
 * Browser-side Supabase client using @supabase/ssr.
 *
 * Uses createBrowserClient which stores the auth session in cookies
 * (via document.cookie), making it readable by the server-side
 * createServerClient in auth-server.ts. This is critical for
 * server components to detect authenticated users.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  _client = createBrowserClient(url, key)
  return _client
}
