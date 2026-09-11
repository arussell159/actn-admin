import { createBrowserClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"

import {
  desktopAuthSessionMaxAgeSeconds,
  isPhoneAuthSession,
} from "@/lib/auth-session-timeout"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import { fetchWithTimeout } from "@/lib/network"

let browserClient: ReturnType<typeof createBrowserClient> | undefined
let localSessionPromise: Promise<boolean> | undefined

function readBrowserCookies() {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const separatorIndex = cookie.indexOf("=")
      const name =
        separatorIndex >= 0 ? cookie.slice(0, separatorIndex) : cookie
      const value = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : ""

      return {
        name,
        value,
      }
    })
}

function writeBrowserCookie(
  name: string,
  value: string,
  options: CookieOptions
) {
  const parts = [`${name}=${value}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  parts.push(`Path=${options.path ?? "/"}`)

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  if (options.secure) {
    parts.push("Secure")
  }

  document.cookie = parts.join("; ")
}

function authCookieOptions(options: CookieOptions) {
  // Supabase clears session chunks with Max-Age=0. Never turn deletion into a
  // fresh long-lived cookie (or revive old chunks after signing out).
  if (options.maxAge !== undefined && options.maxAge <= 0) return options
  if (isPhoneAuthSession()) {
    const sessionOptions = { ...options }

    delete sessionOptions.maxAge
    delete sessionOptions.expires

    return sessionOptions
  }

  return {
    ...options,
    maxAge: desktopAuthSessionMaxAgeSeconds,
  }
}

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  browserClient = createBrowserClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return readBrowserCookies()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          writeBrowserCookie(name, value, authCookieOptions(options))
        })
      },
    },
    auth: {
      experimental: {
        passkey: true,
      },
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 30_000),
    },
  })

  return browserClient
}

export function ensureLocalDevelopmentSession() {
  if (process.env.NODE_ENV !== "development") return Promise.resolve(false)
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname
  )
  if (!isLocalhost) return Promise.resolve(false)
  if (localSessionPromise) return localSessionPromise

  localSessionPromise = (async () => {
    const supabase = createClient()
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    // Any authenticated localhost session can use the OKF. The database's
    // trusted app_metadata still enforces explicitly restricted viewer roles.
    if (session && !sessionError) {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data.user) return false
    }

    const response = await fetchWithTimeout("/api/auth/local-session", {
      method: "POST",
      cache: "no-store",
    })
    const result = (await response.json()) as {
      message?: string
      tokenHash?: string
    }
    if (!response.ok || !result.tokenHash) {
      throw new Error(
        result.message ||
          "Sign in at /login to use your staff account on localhost."
      )
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: result.tokenHash,
      type: "magiclink",
    })
    if (error) throw error
    return true
  })().finally(() => {
    localSessionPromise = undefined
  })

  return localSessionPromise
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  await ensureLocalDevelopmentSession()
  const {
    data: { session },
    error,
  } = await createClient().auth.getSession()
  if (error) throw error

  const requestHeaders = new Headers(
    input instanceof Request ? input.headers : undefined
  )
  new Headers(init?.headers).forEach((value, name) =>
    requestHeaders.set(name, value)
  )
  if (session?.access_token) {
    requestHeaders.set("Authorization", `Bearer ${session.access_token}`)
  }

  return fetch(input, {
    ...init,
    headers: requestHeaders,
    credentials: "same-origin",
  })
}
