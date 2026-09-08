import { readBrowserStorage, writeBrowserStorage } from "@/lib/browser-storage"

export { isStaleAssetError } from "@/lib/recovery-policy"

export const appCachePrefix = "actn-admin-"
export const serviceWorkerCacheName = "actn-admin-shell-v19"

const automaticRecoveryKey = "actn-admin:last-automatic-recovery"
const automaticRecoveryQueryKey = "__pwa_recovery"
let recoveryInFlight = false

function recentRecoveryTimestamp() {
  const storedTimestamp = Number(
    readBrowserStorage("sessionStorage", automaticRecoveryKey)
  )
  const queryTimestamp = Number(
    new URL(window.location.href).searchParams.get(automaticRecoveryQueryKey)
  )

  return Math.max(
    Number.isFinite(storedTimestamp) ? storedTimestamp : 0,
    Number.isFinite(queryTimestamp) ? queryTimestamp : 0
  )
}

export function canAttemptAutomaticRecovery() {
  // One automatic reload per tab/session. The URL marker survives disabled
  // storage and prevents the failing document from repeatedly reloading itself.
  return (
    navigator.onLine && !recoveryInFlight && recentRecoveryTimestamp() === 0
  )
}

async function deleteApplicationCaches() {
  if (!("caches" in window)) {
    return
  }

  try {
    const keys = await window.caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(appCachePrefix))
        .map((key) => window.caches.delete(key))
    )
  } catch {
    // Reloading without Cache Storage cleanup is still a useful recovery path.
  }
}

async function refreshServiceWorker(unregister: boolean) {
  if (!("serviceWorker" in navigator)) {
    return
  }

  try {
    const scriptURL = new URL("/sw.js", window.location.origin).href
    const registrations = (
      await navigator.serviceWorker.getRegistrations()
    ).filter(
      (registration) =>
        (registration.active ?? registration.waiting ?? registration.installing)
          ?.scriptURL === scriptURL
    )

    await Promise.all(
      registrations.map(async (registration) => {
        if (unregister) {
          await registration.unregister()
          return
        }

        await registration.update()
      })
    )
  } catch {
    // A reload still allows the browser to retry registration on next startup.
  }
}

function reloadWithRecoveryMarker(timestamp: number) {
  const recoveryUrl = new URL(window.location.href)
  recoveryUrl.searchParams.set(automaticRecoveryQueryKey, String(timestamp))
  window.location.replace(recoveryUrl.toString())
}

export async function recoverFromStaleAssets() {
  if (!canAttemptAutomaticRecovery()) {
    return false
  }

  recoveryInFlight = true
  const timestamp = Date.now()
  writeBrowserStorage("sessionStorage", automaticRecoveryKey, String(timestamp))

  // Public fallback caches do not contain app chunks. Deleting them here only
  // damages offline recovery. Let the navigation fetch a fresh document.
  void refreshServiceWorker(false)
  reloadWithRecoveryMarker(timestamp)
  return true
}

export async function repairApplication() {
  if (!navigator.onLine) return false
  await deleteApplicationCaches()
  await refreshServiceWorker(true)
  window.location.reload()
  return true
}
