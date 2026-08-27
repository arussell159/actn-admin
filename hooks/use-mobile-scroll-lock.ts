"use client"

import * as React from "react"

function pageNeedsScroll() {
  const documentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  )
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight

  return documentHeight > viewportHeight + 16
}

export function useMobileScrollLock() {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")

    function syncScrollLock() {
      const shouldLock = mediaQuery.matches && !pageNeedsScroll()
      document.documentElement.dataset.scrollLock = shouldLock
        ? "true"
        : "false"
    }

    const resizeObserver = new ResizeObserver(syncScrollLock)
    resizeObserver.observe(document.documentElement)
    resizeObserver.observe(document.body)

    syncScrollLock()
    window.addEventListener("resize", syncScrollLock)
    window.visualViewport?.addEventListener("resize", syncScrollLock)
    mediaQuery.addEventListener("change", syncScrollLock)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", syncScrollLock)
      window.visualViewport?.removeEventListener("resize", syncScrollLock)
      mediaQuery.removeEventListener("change", syncScrollLock)
      delete document.documentElement.dataset.scrollLock
    }
  }, [])
}
