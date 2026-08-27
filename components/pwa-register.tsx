"use client"

import * as React from "react"

export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister())
      })
      window.caches?.keys().then((keys) => {
        keys.forEach((key) => {
          if (key.startsWith("actn-admin")) {
            window.caches.delete(key)
          }
        })
      })
      return
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {
        // The app still works online if service worker registration fails.
      })

    window.caches?.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.startsWith("actn-admin") && key !== "actn-admin-v15") {
          window.caches.delete(key)
        }
      })
    })
  }, [])

  return null
}
