"use client"

import * as React from "react"

import { repairApplication } from "@/lib/pwa-recovery"

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [isRepairing, setIsRepairing] = React.useState(false)

  React.useEffect(() => {
    console.error("[ACTN root render failure]", {
      digest: error.digest,
      name: error.name,
      route: window.location.pathname,
      online: navigator.onLine,
    })
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#f7fafb",
            color: "#111827",
          }}
        >
          <section style={{ maxWidth: 440 }}>
            <h1>The app needs to recover</h1>
            <p>
              Your data has not been deleted. Retry the page, or repair the
              installed app if the problem continues.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={unstable_retry}>
                Try again
              </button>
              <button
                type="button"
                disabled={isRepairing}
                onClick={() => {
                  setIsRepairing(true)
                  void repairApplication()
                }}
              >
                {isRepairing ? "Repairing…" : "Repair app"}
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
