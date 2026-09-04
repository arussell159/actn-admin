"use client"

import * as React from "react"

import { appCachePrefix, serviceWorkerCacheName } from "@/lib/pwa-recovery"

const controllerReloadKey = "actn-admin:last-controller-reload"
const controllerReloadCooldownMs = 60_000

function canReloadForControllerChange() {
  try {
    const lastReload = Number(
      window.sessionStorage.getItem(controllerReloadKey)
    )

    if (
      Number.isFinite(lastReload) &&
      Date.now() - lastReload < controllerReloadCooldownMs
    ) {
      return false
    }

    window.sessionStorage.setItem(controllerReloadKey, String(Date.now()))
  } catch {
    // The in-memory flag in the effect still prevents repeated reloads.
  }

  return true
}

export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister())
          )
        )
        .catch(() => undefined)
      void window.caches
        ?.keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(appCachePrefix))
              .map((key) => window.caches.delete(key))
          )
        )
        .catch(() => undefined)
      return
    }

    let isMounted = true
    let isReloading = false
    let registration: ServiceWorkerRegistration | undefined
    let lastUpdateCheck = 0
    const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller)

    const updateRegistration = () => {
      if (
        !registration ||
        !navigator.onLine ||
        Date.now() - lastUpdateCheck < 60_000
      ) {
        return
      }

      lastUpdateCheck = Date.now()
      void registration.update().catch(() => undefined)
    }

    const handleControllerChange = () => {
      if (
        !hadControllerAtStartup ||
        isReloading ||
        !canReloadForControllerChange()
      ) {
        return
      }

      isReloading = true
      window.location.reload()
    }

    const handleResume = () => {
      if (document.visibilityState === "visible") {
        updateRegistration()
      }
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    )
    window.addEventListener("online", updateRegistration)
    document.addEventListener("visibilitychange", handleResume)

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((activeRegistration) => {
        if (!isMounted) {
          return
        }

        registration = activeRegistration
        activeRegistration.waiting?.postMessage({ type: "SKIP_WAITING" })
        updateRegistration()
      })
      .catch((error) => {
        console.warn("[ACTN PWA] Service worker registration failed", {
          message: error instanceof Error ? error.message : String(error),
          online: navigator.onLine,
        })
      })

    void window.caches
      ?.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(appCachePrefix) && key !== serviceWorkerCacheName
            )
            .map((key) => window.caches.delete(key))
        )
      )
      .catch(() => undefined)

    return () => {
      isMounted = false
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      )
      window.removeEventListener("online", updateRegistration)
      document.removeEventListener("visibilitychange", handleResume)
    }
  }, [])

  return null
}
