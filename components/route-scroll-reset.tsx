"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { hasMonthEndReturnIntent } from "@/lib/month-end-return-point"
import { getAppScroller, restoreAppScroll } from "@/lib/app-scroll"
import {
  readUnknownJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

const entryKey = "__actnScrollEntry"
const storageKey = "actn:scroll-positions"

export function RouteScrollReset() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const period = searchParams.get("period") ?? undefined
  const restoreRef = React.useRef<(() => void) | undefined>(undefined)
  const historyTarget = React.useRef<number | null>(null)
  const readHistoryTarget = React.useRef<() => number | null>(() => null)
  const hasCommittedRoute = React.useRef(false)

  React.useLayoutEffect(() => {
    const scroller = getAppScroller()
    if (!scroller) return
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"
    const stored = readUnknownJsonBrowserStorage("sessionStorage", storageKey)
    const positions = new Map<string, number>(
      stored && typeof stored === "object"
        ? Object.entries(stored).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === "number" && Number.isFinite(entry[1])
          )
        : []
    )
    const originalPush = window.history.pushState
    const originalReplace = window.history.replaceState
    let activeEntry = window.history.state?.[entryKey] ?? crypto.randomUUID()
    let lastPosition = positions.get(activeEntry) ?? scroller.scrollTop
    let navigating = false
    originalReplace.call(
      window.history,
      { ...window.history.state, [entryKey]: activeEntry },
      ""
    )
    const persist = () => {
      positions.set(activeEntry, lastPosition)
      // Bound storage for long-running installations.
      writeBrowserStorage(
        "sessionStorage",
        storageKey,
        JSON.stringify(Object.fromEntries([...positions].slice(-100)))
      )
    }
    const onScroll = () => {
      if (!navigating) lastPosition = scroller.scrollTop
    }
    const startNavigation = () => {
      lastPosition = scroller.scrollTop
      persist()
      navigating = true
    }
    const onPop = () => {
      if (window.history.state?.[entryKey] === activeEntry) return
      persist()
      activeEntry = window.history.state?.[entryKey] ?? crypto.randomUUID()
      lastPosition = positions.get(activeEntry) ?? 0
      historyTarget.current = lastPosition
      navigating = true
    }
    readHistoryTarget.current = () => {
      // Chromium can commit Next's restored tree before dispatching popstate.
      // Read the entry on the commit itself, before the new route is painted.
      onPop()
      return historyTarget.current
    }
    const push: History["pushState"] = function (state, unused, url) {
      persist()
      activeEntry = crypto.randomUUID()
      lastPosition = 0
      originalPush.call(
        window.history,
        { ...state, [entryKey]: activeEntry },
        unused,
        url
      )
      navigating = false
    }
    const replace: History["replaceState"] = function (state, unused, url) {
      originalReplace.call(
        window.history,
        {
          ...state,
          [entryKey]:
            state?.[entryKey] ??
            window.history.state?.[entryKey] ??
            activeEntry,
        },
        unused,
        url
      )
    }
    const finishNavigation = () => {
      navigating = false
    }
    window.history.pushState = push
    window.history.replaceState = replace
    scroller.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("popstate", onPop, true)
    window.addEventListener("pagehide", persist)
    window.addEventListener("app:navigation-start", startNavigation)
    window.addEventListener("app:navigation-complete", finishNavigation)
    historyTarget.current = positions.get(activeEntry) ?? null

    return () => {
      persist()
      restoreRef.current?.()
      scroller.removeEventListener("scroll", onScroll)
      window.removeEventListener("popstate", onPop, true)
      window.removeEventListener("pagehide", persist)
      window.removeEventListener("app:navigation-start", startNavigation)
      window.removeEventListener("app:navigation-complete", finishNavigation)
      if (window.history.pushState === push)
        window.history.pushState = originalPush
      if (window.history.replaceState === replace)
        window.history.replaceState = originalReplace
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  React.useLayoutEffect(() => {
    restoreRef.current?.()
    window.dispatchEvent(new Event("app:navigate"))
    window.dispatchEvent(new Event("information-notes:navigation"))
    const shouldRestoreMonthEndReturn =
      pathname === "/month-end" && hasMonthEndReturnIntent(period)

    if (shouldRestoreMonthEndReturn) {
      hasCommittedRoute.current = true
      historyTarget.current = null
      window.dispatchEvent(new Event("app:navigation-complete"))
      return
    }

    const target = readHistoryTarget.current()
    // A user may already have scrolled the server-rendered page while JS was
    // downloading. Initial hydration must not undo that interaction.
    if (hasCommittedRoute.current || target !== null) {
      restoreRef.current = restoreAppScroll(target ?? 0)
    }
    hasCommittedRoute.current = true
    historyTarget.current = null
    window.dispatchEvent(new Event("app:navigation-complete"))
  }, [pathname, period, search])

  return null
}
