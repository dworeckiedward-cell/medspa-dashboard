'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Singleton browser client — safe to call multiple times
let _client: SupabaseClient | null = null

/**
 * Browser-side Supabase client (anon key only — subject to RLS).
 * Call this in Client Components.
 *
 * TODO: Switch to createBrowserClient from @supabase/ssr when adding auth.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  _client = createClient(url, key)
  return _client
}
