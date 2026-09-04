"use client"

import * as React from "react"
import { SmartphoneIcon } from "lucide-react"

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait") => Promise<void>
}

export function MobileAppGuard() {
  React.useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)")
    let touchStartX = 0
    let touchStartY = 0
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
      void orientation.lock?.("portrait").catch(() => {
        // Browser tabs may reject orientation locking. The CSS guard below
        // keeps the app unavailable in landscape when that happens.
      })
    }

    const preventGesture = (event: Event) => event.preventDefault()
    const handleTouchStart = (event: TouchEvent) => {
      if (!coarsePointer.matches) {
        return
      }

      if (event.touches.length > 1) {
        edgeSwipeTarget = null
        edgeSwipeDistance = 0
        event.preventDefault()
        return
      }

      touchStartX = event.touches[0]?.clientX ?? 0
      touchStartY = event.touches[0]?.clientY ?? 0
      edgeSwipeDistance = 0
      edgeSwipeTarget = touchStartX <= 28 ? visibleBackButton() : null
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (!coarsePointer.matches) {
        return
      }

      if (event.touches.length > 1) {
        edgeSwipeTarget = null
        edgeSwipeDistance = 0
        event.preventDefault()
        return
      }

      const touch = event.touches[0]
      const signedDeltaX = (touch?.clientX ?? 0) - touchStartX
      const deltaX = Math.abs(signedDeltaX)
      const deltaY = Math.abs((touch?.clientY ?? 0) - touchStartY)

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
      edgeSwipeTarget = null
      edgeSwipeDistance = 0
    }

    lockPortrait()
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

    return () => {
      document.removeEventListener("gesturestart", preventGesture)
      document.removeEventListener("gesturechange", preventGesture)
      document.removeEventListener("gestureend", preventGesture)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchcancel", handleTouchCancel)
      screen.orientation?.removeEventListener("change", lockPortrait)
    }
  }, [])

  return (
    <div className="mobile-landscape-guard" role="alert" aria-live="assertive">
      <SmartphoneIcon className="size-10" aria-hidden="true" />
      <div className="grid gap-1 text-center">
        <p className="font-semibold">Portrait mode required</p>
        <p className="text-sm text-muted-foreground">
          Rotate your device to continue.
        </p>
      </div>
    </div>
  )
}
