import {
  isStaleAssetError,
  recoverFromStaleAssets,
  serviceWorkerCacheName,
} from "@/lib/pwa-recovery"

function reportClientFailure(category: string, reason: unknown) {
  const error = reason instanceof Error ? reason : new Error(String(reason))

  console.error("[ACTN client failure]", {
    category,
    name: error.name,
    message: error.message,
    route: window.location.pathname,
    lifecycle: document.visibilityState,
    online: navigator.onLine,
    serviceWorkerVersion: serviceWorkerCacheName,
  })
}

function handleFailure(category: string, reason: unknown) {
  reportClientFailure(category, reason)

  if (isStaleAssetError(reason)) {
    void recoverFromStaleAssets()
  }
}

window.addEventListener(
  "error",
  (event) => {
    const failedElement = event.target
    const assetUrl =
      failedElement instanceof HTMLScriptElement
        ? failedElement.src
        : failedElement instanceof HTMLLinkElement
          ? failedElement.href
          : ""

    handleFailure(
      assetUrl ? "asset-load" : "uncaught-error",
      event.error ??
        (assetUrl ? `Failed to load module script ${assetUrl}` : event.message)
    )
  },
  true
)

window.addEventListener("unhandledrejection", (event) => {
  handleFailure("unhandled-rejection", event.reason)
})
