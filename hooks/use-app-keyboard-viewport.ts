"use client"

import { useEffect } from "react"

// CSS handles browser bars and orientation. iOS keyboards can shrink only the
// visual viewport, so adapt the one shell while an editable control is focused.
export function useAppKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const mobile = window.matchMedia("(max-width: 767px)")
    const clear = () => {
      root.style.removeProperty("--app-keyboard-height")
      root.style.removeProperty("--app-keyboard-top")
      delete root.dataset.appKeyboard
    }
    const sync = () => {
      const editable = document.activeElement?.matches(
        "input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]"
      )
      if (
        !mobile.matches ||
        (!editable && root.dataset.appKeyboard !== "true") ||
        viewport.scale !== 1 ||
        window.innerHeight - viewport.height < 120
      ) {
        clear()
        return
      }
      root.style.setProperty("--app-keyboard-height", `${viewport.height}px`)
      root.style.setProperty("--app-keyboard-top", `${viewport.offsetTop}px`)
      root.dataset.appKeyboard = "true"
    }
    // Keep the current geometry while the keyboard is visibly closing. Clearing
    // on pointer-down blur moves buttons before pointer-up and loses the click.
    const resume = () => {
      clear()
      sync()
    }
    viewport.addEventListener("resize", sync)
    viewport.addEventListener("scroll", sync)
    document.addEventListener("focusin", sync)
    document.addEventListener("focusout", sync)
    window.addEventListener("pageshow", resume)
    mobile.addEventListener("change", sync)
    return () => {
      clear()
      viewport.removeEventListener("resize", sync)
      viewport.removeEventListener("scroll", sync)
      document.removeEventListener("focusin", sync)
      document.removeEventListener("focusout", sync)
      window.removeEventListener("pageshow", resume)
      mobile.removeEventListener("change", sync)
    }
  }, [])
}
