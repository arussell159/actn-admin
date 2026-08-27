import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { assertSupabaseConfig } from "@/lib/supabase-env"

export const loginPath = "/login"

export function isLocalhostRequest(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  )
}

export function isAuthBypassPath(pathname: string) {
  return (
    pathname === loginPath ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/actn-admin-icon.png" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    /\.[a-z0-9]+$/i.test(pathname)
  )
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
