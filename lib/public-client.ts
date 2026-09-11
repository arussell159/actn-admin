import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js"
import { createClient as createBrowserClient } from "@/lib/client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import { fetchWithTimeout } from "@/lib/network"

export function createPublicClient(): SupabaseClient {
  // Browser operations must carry the signed-in staff session. A separate anon
  // client discarded that session and failed against authenticated RLS tables.
  if (typeof window !== "undefined") return createBrowserClient()
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 30_000),
    },
  })
}
