import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
        },
      },
    }
  )
}
