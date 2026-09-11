"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  clearAuthSessionStart,
  hasAuthSessionExpired,
  hasAuthSessionStarted,
  isPhoneAuthSession,
  markAuthSessionStarted,
} from "@/lib/auth-session-timeout"
import { createClient } from "@/lib/client"

export function AuthSessionGuard() {
  const router = useRouter()

  React.useEffect(() => {
    let isMounted = true
    let isChecking = false
    const supabase = createClient()

    async function createLocalSession() {
      const response = await fetch("/api/auth/local-session", {
        method: "POST",
        cache: "no-store",
      })
      const result = await response.json()

      if (!response.ok || !result.tokenHash) {
        throw new Error(
          result.message || "Could not create the local development session."
        )
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      })
      if (error) throw error
      markAuthSessionStarted()
      router.refresh()
    }

    async function enforceTimeout() {
      if (
        isChecking ||
        document.visibilityState === "hidden" ||
        window.location.pathname === "/login"
      ) {
        return
      }

      isChecking = true

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!isMounted || error) {
          return
        }

        if (!session) {
          if (
            ["localhost", "127.0.0.1", "[::1]"].includes(
              window.location.hostname
            )
          ) {
            await createLocalSession()
          }
          return
        }

        if (session.user.app_metadata.local_development === true) return

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
  }, [router])

  return null
}
