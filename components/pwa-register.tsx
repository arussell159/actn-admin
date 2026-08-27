"use client"

import * as React from "react"

export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app still works online if service worker registration fails.
    })
  }, [])

  return null
}
