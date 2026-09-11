"use client"

import { useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/client"
import {
  captureLegacyBrowserData,
  preserveLegacyBrowserData,
} from "@/lib/browser-data-recovery"

export function BrowserDataRecovery() {
  useEffect(() => {
    // Capture before asynchronous database reads refresh browser caches.
    const copies = captureLegacyBrowserData()
    if (!copies.length) return
    const client: SupabaseClient = createClient()
    let started = false
    const preserve = () => {
      if (started) return
      started = true
      void preserveLegacyBrowserData(copies).catch(() => {
        // The shared persistence notice offers retry; original copies remain.
      })
    }
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) preserve()
      })
      .catch(() => {})
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session) queueMicrotask(preserve)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}
