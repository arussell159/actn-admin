"use client"

import { useEffect } from "react"
import { getAppScroller } from "@/lib/app-scroll"

export function MobileAppGuard() {
  useEffect(() => {
    let startX = 0,
      startY = 0,
      started = 0
    let topTap = false
    let back: HTMLElement | null = null
    const reset = () => {
      topTap = false
      back = null
    }
    const start = (event: TouchEvent) => {
      reset()
      if (event.touches.length !== 1) return
      const target = event.target instanceof Element ? event.target : null
      if (
        target?.closest(
          "a, button, input, textarea, select, [contenteditable], [role=dialog]"
        )
      )
        return
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
      started = performance.now()
      topTap = Boolean(target?.closest("[data-app-header]"))
      // Browsers own their native back swipe. Preserve the app's back gesture
      // only in standalone mode, and only if it starts inside route content.
      if (
        startX <= 28 &&
        target?.closest("[data-app-scroll]") &&
        window.matchMedia("(display-mode: standalone)").matches
      ) {
        back =
          Array.from(
            document.querySelectorAll<HTMLElement>("[data-site-header-back]")
          ).find((el) => el.getClientRects().length > 0) ?? null
      }
    }
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset()
        return
      }
      const dx = event.touches[0].clientX - startX
      const dy = Math.abs(event.touches[0].clientY - startY)
      if (Math.abs(dx) > 8 || dy > 8) topTap = false
      if (dy > Math.abs(dx) && dy > 12) back = null
      if (back && dx > 12 && dx > dy && event.cancelable) event.preventDefault()
    }
    const end = (event: TouchEvent) => {
      if (topTap && performance.now() - started < 500)
        getAppScroller()?.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        })
      const touch = event.changedTouches[0]
      if (
        back &&
        touch &&
        touch.clientX - startX >= Math.min(140, window.innerWidth * 0.35)
      )
        back.click()
      reset()
    }
    document.addEventListener("touchstart", start, { passive: true })
    document.addEventListener("touchmove", move, { passive: false })
    document.addEventListener("touchend", end)
    document.addEventListener("touchcancel", reset)
    return () => {
      document.removeEventListener("touchstart", start)
      document.removeEventListener("touchmove", move)
      document.removeEventListener("touchend", end)
      document.removeEventListener("touchcancel", reset)
    }
  }, [])
  return null
}
