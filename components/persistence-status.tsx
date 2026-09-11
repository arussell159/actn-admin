"use client"

import * as React from "react"
import {
  pendingDatabaseSaves,
  persistenceUpdatedEvent,
} from "@/lib/persistence"
import { Button } from "@/components/ui/button"

export function PersistenceStatus() {
  const [saves, setSaves] = React.useState<
    ReturnType<typeof pendingDatabaseSaves>
  >([])
  React.useEffect(() => {
    const refresh = () => setSaves(pendingDatabaseSaves())
    const retry = () =>
      pendingDatabaseSaves()
        .filter((save) => save.failed && !save.readOnly)
        .forEach((save) => save.retry())
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingDatabaseSaves().some((save) => !save.readOnly)) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    refresh()
    window.addEventListener(persistenceUpdatedEvent, refresh)
    window.addEventListener("online", retry)
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      window.removeEventListener(persistenceUpdatedEvent, refresh)
      window.removeEventListener("online", retry)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [])
  const failures = saves.filter((save) => save.failed)
  if (!failures.length) return null
  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 z-[100] flex w-[min(94vw,36rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-destructive bg-background p-3 text-sm shadow-lg"
    >
      <p className="flex-1">
        {failures
          .map(
            (save) =>
              `${save.label}: ${save.readOnly ? "shared data could not be loaded. The displayed copy may be out of date." : "changes haven’t synced. Your draft is still available in this browser."}`
          )
          .join(" ")}
      </p>
      <Button
        size="sm"
        onClick={() => failures.forEach((save) => save.retry())}
      >
        Retry
      </Button>
    </div>
  )
}
