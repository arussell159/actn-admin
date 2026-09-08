"use client"

import * as React from "react"

import { repairApplication } from "@/lib/pwa-recovery"

export function AppErrorRecovery({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  const [isRepairing, setIsRepairing] = React.useState(false)

  React.useEffect(() => {
    console.error("[ACTN render failure]", {
      digest: error.digest,
      name: error.name,
      route: window.location.pathname,
      lifecycle: document.visibilityState,
      online: navigator.onLine,
    })
  }, [error])

  async function repair() {
    setIsRepairing(true)
    await repairApplication()
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <section className="grid w-full max-w-md gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="grid gap-2">
          <h1 className="text-xl font-semibold">The app needs to recover</h1>
          <p className="text-sm text-muted-foreground">
            Your data has not been deleted. Try loading this screen again, or
            repair the installed app if the problem continues.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={onRetry}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            disabled={isRepairing}
            onClick={repair}
          >
            {isRepairing ? "Repairing…" : "Repair app"}
          </button>
        </div>
      </section>
    </main>
  )
}
