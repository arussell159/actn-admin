"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const scriptURL = new URL("/sw.js", window.location.origin).href
    let mounted = true
    let registration: ServiceWorkerRegistration | undefined
    let lastUpdateCheck = 0
    const update = () => {
      if (
        !registration ||
        !navigator.onLine ||
        Date.now() - lastUpdateCheck < 60_000
      )
        return
      lastUpdateCheck = Date.now()
      void registration.update().catch(() => undefined)
    }
    const resume = () => {
      if (document.visibilityState === "visible") update()
    }
    if (process.env.NODE_ENV !== "production") {
      // Only unregister our own worker; other apps may share a development origin.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter(
                (r) =>
                  (r.active ?? r.waiting ?? r.installing)?.scriptURL ===
                  scriptURL
              )
              .map((r) => r.unregister())
          )
        )
        .catch(() => undefined)
      return
    }
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((value) => {
        if (!mounted) return
        registration = value
        update()
      })
      .catch((error) =>
        console.warn("[ACTN PWA] Registration unavailable", error)
      )
    // A waiting worker activates when old clients close. Neither controllerchange
    // nor resume is permission to reload an in-progress editor or form.
    window.addEventListener("online", update)
    window.addEventListener("pageshow", resume)
    document.addEventListener("visibilitychange", resume)
    return () => {
      mounted = false
      window.removeEventListener("online", update)
      window.removeEventListener("pageshow", resume)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [])
  return null
}
