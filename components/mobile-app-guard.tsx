"use client"

import * as React from "react"

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>
}

export function MobileAppGuard() {
  React.useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)")
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0
    let topTapCandidate = false
    let edgeSwipeDistance = 0
    let edgeSwipeTarget: HTMLElement | null = null

    const visibleBackButton = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-site-header-back]")
      ).find(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getAttribute("aria-disabled") !== "true" &&
          !(element instanceof HTMLButtonElement && element.disabled)
      ) ?? null

    const lockPortrait = () => {
      if (!coarsePointer.matches) {
        return
      }

      const orientation = screen.orientation as LockableScreenOrientation
      void orientation.lock?.("portrait-primary").catch(() => {
        // Regular browser tabs can reject orientation locking. Installed
        // apps also declare portrait-primary in the web app manifest.
      })
    }

    const preventGesture = (event: Event) => event.preventDefault()
    const scrollCurrentPageToTop = () => {
      const scrollableElements = Array.from(
        document.querySelectorAll<HTMLElement>("*")
      ).filter((element) => {
        if (
          element.scrollTop <= 0 ||
          element.scrollHeight <= element.clientHeight
        ) {
          return false
        }

        const bounds = element.getBoundingClientRect()

        if (
          bounds.width <= 0 ||
          bounds.height <= 0 ||
          bounds.bottom <= 0 ||
          bounds.top >= window.innerHeight
        ) {
          return false
        }

        const overflowY = window.getComputedStyle(element).overflowY
        return overflowY === "auto" || overflowY === "scroll"
      })

      for (const element of scrollableElements) {
        element.scrollTo({ top: 0, left: 0, behavior: "smooth" })
      }

      window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
      document.scrollingElement?.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      })
    }
    const handleTouchStart = (event: TouchEvent) => {
      if (!coarsePointer.matches) {
        return
      }

      if (event.touches.length > 1) {
        topTapCandidate = false
        edgeSwipeTarget = null
        edgeSwipeDistance = 0
        event.preventDefault()
        return
      }

      touchStartX = event.touches[0]?.clientX ?? 0
      touchStartY = event.touches[0]?.clientY ?? 0
      touchStartTime = performance.now()
      const topEdge = (window.visualViewport?.offsetTop ?? 0) + 44
      topTapCandidate =
        touchStartY <= topEdge &&
        !(event.target as Element | null)?.closest(
          "a, button, input, select, textarea, [role='button']"
        )
      edgeSwipeDistance = 0
      edgeSwipeTarget = touchStartX <= 28 ? visibleBackButton() : null
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (!coarsePointer.matches) {
        return
      }

      if (event.touches.length > 1) {
        topTapCandidate = false
        edgeSwipeTarget = null
        edgeSwipeDistance = 0
        event.preventDefault()
        return
      }

      const touch = event.touches[0]
      const signedDeltaX = (touch?.clientX ?? 0) - touchStartX
      const deltaX = Math.abs(signedDeltaX)
      const deltaY = Math.abs((touch?.clientY ?? 0) - touchStartY)

      if (deltaX > 8 || deltaY > 8) {
        topTapCandidate = false
      }

      if (edgeSwipeTarget && deltaY > deltaX && deltaY > 12) {
        edgeSwipeTarget = null
        edgeSwipeDistance = 0
      }

      if (deltaX > 8 && deltaX > deltaY) {
        event.preventDefault()

        if (edgeSwipeTarget && signedDeltaX > 0) {
          edgeSwipeDistance = signedDeltaX
        }
      }
    }
    const handleTouchEnd = (event: TouchEvent) => {
      if (topTapCandidate && performance.now() - touchStartTime < 500) {
        topTapCandidate = false
        event.preventDefault()
        scrollCurrentPageToTop()
      }

      if (!edgeSwipeTarget) {
        return
      }

      const activationDistance = Math.min(140, window.innerWidth * 0.35)
      const target = edgeSwipeTarget

      edgeSwipeTarget = null

      if (edgeSwipeDistance < activationDistance) {
        edgeSwipeDistance = 0
        return
      }

      edgeSwipeDistance = 0
      event.preventDefault()
      target.click()
    }
    const handleTouchCancel = () => {
      topTapCandidate = false
      edgeSwipeTarget = null
      edgeSwipeDistance = 0
    }

    lockPortrait()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lockPortrait()
      }
    }
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    })
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    })
    document.addEventListener("gestureend", preventGesture, {
      passive: false,
    })
    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    })
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    })
    document.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    })
    document.addEventListener("touchcancel", handleTouchCancel, {
      passive: false,
    })
    screen.orientation?.addEventListener("change", lockPortrait)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("gesturestart", preventGesture)
      document.removeEventListener("gesturechange", preventGesture)
      document.removeEventListener("gestureend", preventGesture)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchcancel", handleTouchCancel)
      screen.orientation?.removeEventListener("change", lockPortrait)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
