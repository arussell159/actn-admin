"use client"

import * as React from "react"

const pullThreshold = 78
const maxPullDistance = 106

export function useMobilePullRefresh() {
  const [pullDistance, setPullDistance] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    let startY = 0
    let startX = 0
    let isPulling = false
    let activeScroller: HTMLElement | null = null

    function getScroller(target: EventTarget | null) {
      const element = target instanceof Element ? target : null

      return (
        element?.closest<HTMLElement>("[data-slot='sidebar-inset']") ??
        document.querySelector<HTMLElement>("[data-slot='sidebar-inset']")
      )
    }

    function handleTouchStart(event: TouchEvent) {
      if (!mediaQuery.matches || isRefreshing || event.touches.length !== 1) {
        return
      }

      activeScroller = getScroller(event.target)
      startY = event.touches[0]?.clientY ?? 0
      startX = event.touches[0]?.clientX ?? 0
      isPulling = Boolean(activeScroller && activeScroller.scrollTop <= 0)
    }

    function handleTouchMove(event: TouchEvent) {
      if (!isPulling || !activeScroller || event.touches.length !== 1) {
        return
      }

      const touch = event.touches[0]
      const deltaY = (touch?.clientY ?? 0) - startY
      const deltaX = Math.abs((touch?.clientX ?? 0) - startX)

      if (deltaY <= 0 || deltaX > deltaY) {
        setPullDistance(0)
        return
      }

      if (activeScroller.scrollTop > 0) {
        isPulling = false
        setPullDistance(0)
        return
      }

      event.preventDefault()
      setPullDistance(Math.min(deltaY * 0.45, maxPullDistance))
    }

    function handleTouchEnd() {
      if (!isPulling) {
        return
      }

      isPulling = false

      setPullDistance((currentDistance) => {
        if (currentDistance >= pullThreshold) {
          setIsRefreshing(true)
          window.setTimeout(() => window.location.reload(), 120)
          return pullThreshold
        }

        return 0
      })
    }

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    })
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    })
    document.addEventListener("touchend", handleTouchEnd)
    document.addEventListener("touchcancel", handleTouchEnd)

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [isRefreshing])

  return {
    isRefreshing,
    pullDistance,
    progress: Math.min(pullDistance / pullThreshold, 1),
  }
}
