import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseConfig } from "@/lib/supabase-env"
import { desktopAuthSessionMaxAgeSeconds } from "@/lib/auth-session-timeout"

export function createClient() {
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        maxAge: desktopAuthSessionMaxAgeSeconds,
      },
      auth: {
        experimental: {
          passkey: true,
        },
      },
    }
  )
}
