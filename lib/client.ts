import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseConfig } from "@/lib/supabase-env"

export function createClient() {
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        experimental: {
          passkey: true,
        },
      },
    }
  )
}
