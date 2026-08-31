"use client"

export const mobileNavActiveIndicatorStorageKey =
  "actn-mobile-nav-active-index-v1"
export const mobileNavActiveIndicatorPendingStorageKey =
  "actn-mobile-nav-transition-pending-v1"
export const mobileDashboardDockIndex = 0

export function setMobileDashboardActiveNavState() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(
    mobileNavActiveIndicatorStorageKey,
    String(mobileDashboardDockIndex)
  )
  window.sessionStorage.removeItem(mobileNavActiveIndicatorPendingStorageKey)
}
