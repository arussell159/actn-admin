"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  clearAuthSessionStart,
  hasAuthSessionExpired,
  hasAuthSessionStarted,
  isPhoneAuthSession,
  markAuthSessionStarted,
} from "@/lib/auth-session-timeout"
import { createClient } from "@/lib/client"

export function AuthSessionGuard() {
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (pathname === "/login") {
      return
    }

    let isMounted = true
    const supabase = createClient()

    async function enforceTimeout() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted || !session) {
        return
      }

      if (!hasAuthSessionStarted() && !isPhoneAuthSession()) {
        markAuthSessionStarted()
        return
      }

      if (hasAuthSessionExpired()) {
        clearAuthSessionStart()
        await supabase.auth.signOut()
        router.replace("/login")
        router.refresh()
      }
    }

    enforceTimeout()
    const intervalId = window.setInterval(enforceTimeout, 60_000)
    window.addEventListener("focus", enforceTimeout)
    document.addEventListener("visibilitychange", enforceTimeout)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("focus", enforceTimeout)
      document.removeEventListener("visibilitychange", enforceTimeout)
    }
  }, [pathname, router])

  return null
}
