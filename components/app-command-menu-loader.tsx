"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { openAppCommandMenuEvent } from "@/lib/app-command-menu"

const LazyAppCommandMenu = dynamic(
  () =>
    import("@/components/app-command-menu").then(
      (module) => module.AppCommandMenu
    ),
  { ssr: false }
)

export function AppCommandMenuLoader() {
  const [shouldLoad, setShouldLoad] = React.useState(false)
  const [initiallyOpen, setInitiallyOpen] = React.useState(false)

  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      return
    }

    const loadAndOpen = () => {
      setInitiallyOpen(true)
      setShouldLoad(true)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault()
        loadAndOpen()
      }
    }
    const idleId = window.requestIdleCallback?.(() => setShouldLoad(true))

    window.addEventListener(openAppCommandMenuEvent, loadAndOpen)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      if (idleId !== undefined) {
        window.cancelIdleCallback?.(idleId)
      }
      window.removeEventListener(openAppCommandMenuEvent, loadAndOpen)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return shouldLoad ? <LazyAppCommandMenu initiallyOpen={initiallyOpen} /> : null
}
