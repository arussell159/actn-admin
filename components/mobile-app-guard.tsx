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
        event.preventDefault()
        return
      }

      touchStartX = event.touches[0]?.clientX ?? 0
      touchStartY = event.touches[0]?.clientY ?? 0
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (!coarsePointer.matches) {
        return
      }

      if (event.touches.length > 1) {
        event.preventDefault()
        return
      }

      const touch = event.touches[0]
      const deltaX = Math.abs((touch?.clientX ?? 0) - touchStartX)
      const deltaY = Math.abs((touch?.clientY ?? 0) - touchStartY)

      if (deltaX > 8 && deltaX > deltaY) {
        event.preventDefault()
      }
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
    screen.orientation?.addEventListener("change", lockPortrait)

    return () => {
      document.removeEventListener("gesturestart", preventGesture)
      document.removeEventListener("gesturechange", preventGesture)
      document.removeEventListener("gestureend", preventGesture)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
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
