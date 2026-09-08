"use client"

import * as React from "react"

import {
  isStaleAssetError,
  recoverFromStaleAssets,
  repairApplication,
} from "@/lib/pwa-recovery"

export function AppErrorRecovery({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  const [isRepairing, setIsRepairing] = React.useState(false)
  const [repairMessage, setRepairMessage] = React.useState("")

  React.useEffect(() => {
    console.error("[ACTN render failure]", {
      digest: error.digest,
      name: error.name,
      route: window.location.pathname,
      lifecycle: document.visibilityState,
      online: navigator.onLine,
    })
    if (isStaleAssetError(error)) void recoverFromStaleAssets()
  }, [error])

  async function repair() {
    setIsRepairing(true)
    const started = await repairApplication()
    if (!started) {
      setIsRepairing(false)
      setRepairMessage("Reconnect to the internet, then try again.")
    }
  }

  return (
    <main className="app-page grid place-items-center bg-background p-6 text-foreground">
      <section className="grid w-full max-w-md gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="grid gap-2">
          <h1 className="text-xl font-semibold">The app needs to recover</h1>
          <p className="text-sm text-muted-foreground">
            Saved data is preserved. Try loading this screen again, or repair
            the installed app if the problem continues.
          </p>
        </div>
        {repairMessage ? <p role="status">{repairMessage}</p> : null}
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
