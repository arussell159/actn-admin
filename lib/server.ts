import { createServerClient } from "@supabase/ssr"
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import { fetchWithTimeout } from "@/lib/network"

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient(
  accessToken?: string
): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()
  // SSR clients own cookie sessions. Explicit bearer requests need an isolated
  // client so stale cookies cannot replace the token supplied by the browser.
  if (accessToken) {
    return createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
        fetch: (input, init) => fetchWithTimeout(input, init, 30_000),
      },
    })
  }
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 30_000),
    },
  })
}
