import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertSupabaseConfig } from "@/lib/supabase-env"

export function createPublicClient() {
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createSupabaseClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    }
  )
}
