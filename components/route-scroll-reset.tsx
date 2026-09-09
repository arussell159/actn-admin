"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { hasMonthEndReturnIntent } from "@/lib/month-end-return-point"

function scrollOuterViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "instant" })
}

function scrollPageToTop() {
  scrollOuterViewportToTop()

  document
    .querySelectorAll<HTMLElement>("[data-slot='sidebar-inset']")
    .forEach((element) => {
      element.scrollTo({ top: 0, left: 0, behavior: "instant" })
    })
}

export function RouteScrollReset() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const period = searchParams.get("period") ?? undefined

  React.useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  React.useLayoutEffect(() => {
    const shouldRestoreMonthEndReturn =
      pathname === "/month-end" && hasMonthEndReturnIntent(period)

    // A return to Month End restores the inner app scroller separately. The
    // outer viewport must still reset or mobile Safari can keep the country
    // page's visual offset and render the next sticky header above the screen.
    scrollOuterViewportToTop()
    const animationFrameId = window.requestAnimationFrame(
      shouldRestoreMonthEndReturn
        ? scrollOuterViewportToTop
        : scrollPageToTop
    )

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [pathname, period, search])

  return null
}
