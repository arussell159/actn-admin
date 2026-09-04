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
    let isChecking = false
    const supabase = createClient()

    async function enforceTimeout() {
      if (isChecking || document.visibilityState === "hidden") {
        return
      }

      isChecking = true

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!isMounted || error || !session) {
          return
        }

        if (!hasAuthSessionStarted() && !isPhoneAuthSession()) {
          markAuthSessionStarted()
          return
        }

        if (hasAuthSessionExpired()) {
          clearAuthSessionStart()
          await supabase.auth.signOut()

          if (isMounted) {
            router.replace("/login")
            router.refresh()
          }
        }
      } catch (error) {
        console.warn("[ACTN auth] Session refresh failed", {
          message: error instanceof Error ? error.message : String(error),
          online: navigator.onLine,
        })
      } finally {
        isChecking = false
      }
    }

    void enforceTimeout()
    const intervalId = window.setInterval(enforceTimeout, 60_000)
    const handleResume = () => void enforceTimeout()

    window.addEventListener("focus", handleResume)
    window.addEventListener("online", handleResume)
    document.addEventListener("visibilitychange", handleResume)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleResume)
      window.removeEventListener("online", handleResume)
      document.removeEventListener("visibilitychange", handleResume)
    }
  }, [pathname, router])

  return null
}
