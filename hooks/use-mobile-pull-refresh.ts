"use client"

import * as React from "react"
import { getAppScroller } from "@/lib/app-scroll"

const pullThreshold = 78
const maxPullDistance = 106

export function useMobilePullRefresh() {
  const [pullDistance, setPullDistance] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  React.useEffect(() => {
    const scroller = getAppScroller()
    if (!scroller) return
    const mobile = window.matchMedia("(max-width: 767px)")
    let startX = 0,
      startY = 0,
      distance = 0,
      pulling = false
    const cancel = () => {
      pulling = false
      distance = 0
      setPullDistance(0)
    }
    const start = (event: TouchEvent) => {
      cancel()
      if (
        !mobile.matches ||
        isRefreshing ||
        event.touches.length !== 1 ||
        scroller.scrollTop > 0
      )
        return
      const target = event.target instanceof Element ? event.target : null
      if (
        !target ||
        target.closest(
          "input, textarea, select, button, a, [contenteditable], [data-app-panel], [role=dialog]"
        )
      )
        return
      // Never steal gestures from intentional table/editor/overlay scrollers.
      for (
        let node = target;
        node && node !== scroller;
        node = node.parentElement!
      ) {
        if (
          node.scrollHeight > node.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)
        )
          return
      }
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
      pulling = true
    }
    const move = (event: TouchEvent) => {
      if (!pulling) return
      if (event.touches.length !== 1) {
        cancel()
        return
      }
      const dy = event.touches[0].clientY - startY
      const dx = Math.abs(event.touches[0].clientX - startX)
      if (dy <= 0 || dx > dy || scroller.scrollTop > 0) {
        cancel()
        return
      }
      if (event.cancelable) event.preventDefault()
      distance = Math.min(dy * 0.45, maxPullDistance)
      setPullDistance(distance)
    }
    const end = () => {
      if (pulling && distance >= pullThreshold && navigator.onLine) {
        pulling = false
        setIsRefreshing(true)
        // An explicit user refresh; no timers or transformed content/chrome.
        window.location.reload()
      } else cancel()
    }
    scroller.addEventListener("touchstart", start, { passive: true })
    scroller.addEventListener("touchmove", move, { passive: false })
    scroller.addEventListener("touchend", end)
    scroller.addEventListener("touchcancel", cancel)
    window.addEventListener("app:navigate", cancel)
    return () => {
      scroller.removeEventListener("touchstart", start)
      scroller.removeEventListener("touchmove", move)
      scroller.removeEventListener("touchend", end)
      scroller.removeEventListener("touchcancel", cancel)
      window.removeEventListener("app:navigate", cancel)
    }
  }, [isRefreshing])
  return {
    isRefreshing,
    pullDistance,
    progress: Math.min(pullDistance / pullThreshold, 1),
  }
}
