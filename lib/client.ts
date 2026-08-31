import { createBrowserClient } from '@supabase/ssr'
import type { CookieOptions } from "@supabase/ssr"

import {
  desktopAuthSessionMaxAgeSeconds,
  isPhoneAuthSession,
} from "@/lib/auth-session-timeout"
import { assertSupabaseConfig } from "@/lib/supabase-env"

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
  const { supabaseUrl, supabaseKey } = assertSupabaseConfig()

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
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
    }
  )
}
