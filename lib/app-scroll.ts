export function getAppScroller() {
  return document.querySelector<HTMLElement>("[data-app-scroll]")
}

export function getAppScrollY() {
  return getAppScroller()?.scrollTop ?? 0
}

// Restore once the asynchronous route is tall enough. User input cancels a
// pending restore so late data can never pull the user away from their work.
export function restoreAppScroll(top: number) {
  const scroller = getAppScroller()
  const route = scroller?.querySelector<HTMLElement>("[data-app-route]")
  if (!scroller || !route) return () => {}
  const target = Math.max(0, top)
  const cancel = () => {
    observer.disconnect()
    scroller.removeEventListener("pointerdown", cancel)
    scroller.removeEventListener("touchstart", cancel)
    scroller.removeEventListener("wheel", cancel)
    scroller.removeEventListener("keydown", cancel)
  }
  const restore = () => {
    scroller.scrollTo({ top: target, left: 0, behavior: "instant" })
    if (scroller.scrollHeight - scroller.clientHeight >= target - 1) cancel()
  }
  const observer = new ResizeObserver(restore)
  observer.observe(route)
  scroller.addEventListener("pointerdown", cancel, { passive: true })
  scroller.addEventListener("touchstart", cancel, { passive: true })
  scroller.addEventListener("wheel", cancel, { passive: true })
  scroller.addEventListener("keydown", cancel)
  restore()
  return cancel
}
