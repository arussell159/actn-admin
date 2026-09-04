import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import { fetchWithTimeout } from "@/lib/network"

export function createPublicClient() {
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 30_000),
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  })
}
