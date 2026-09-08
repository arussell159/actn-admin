"use client"

import { LoaderCircleIcon } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

import { useMobilePullRefresh } from "@/hooks/use-mobile-pull-refresh"
import { cn } from "@/lib/utils"

function subscribeToClientMount() {
  return () => {}
}

export function MobilePullRefresh() {
  const { isRefreshing, pullDistance, progress } = useMobilePullRefresh()
  const isMounted = React.useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false
  )
  const portalTarget = isMounted ? document.body : null

  React.useEffect(() => {
    if (!portalTarget) {
      return
    }

    document.documentElement.style.setProperty(
      "--mobile-pull-distance",
      `${pullDistance}px`
    )

    if (!pullDistance && !isRefreshing) {
      document.documentElement.style.removeProperty("--mobile-pull-distance")
    }

    return () => {
      document.documentElement.style.removeProperty("--mobile-pull-distance")
    }
  }, [isRefreshing, portalTarget, pullDistance])

  if (!portalTarget) {
    return null
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[calc(env(safe-area-inset-top)+0.25rem)] transition-opacity duration-150 md:hidden"
      style={{
        opacity: pullDistance > 4 || isRefreshing ? 1 : 0,
        transform: `translateY(${Math.max(0, pullDistance - 42)}px)`,
      }}
      aria-hidden="true"
    >
      <div className="grid size-10 place-items-center rounded-full border border-white/60 bg-background/70 shadow-lg backdrop-blur-2xl">
        <LoaderCircleIcon
          className={cn(
            "size-5 text-foreground",
            isRefreshing && "animate-spin"
          )}
          style={{
            opacity: 0.45 + progress * 0.55,
            transform: isRefreshing
              ? undefined
              : `rotate(${Math.round(progress * 260)}deg)`,
          }}
        />
      </div>
    </div>,
    portalTarget
  )
}
