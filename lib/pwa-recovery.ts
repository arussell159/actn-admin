import { readBrowserStorage, writeBrowserStorage } from "@/lib/browser-storage"
import { isRecoveryCooldownElapsed } from "@/lib/recovery-policy"

export { isStaleAssetError } from "@/lib/recovery-policy"

export const appCachePrefix = "actn-admin-"
export const serviceWorkerCacheName = "actn-admin-shell-v18"

const automaticRecoveryKey = "actn-admin:last-automatic-recovery"
const automaticRecoveryQueryKey = "__pwa_recovery"
const automaticRecoveryCooldownMs = 5 * 60 * 1000

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

export function canAttemptAutomaticRecovery(now = Date.now()) {
  return isRecoveryCooldownElapsed({
    lastRecovery: recentRecoveryTimestamp(),
    now,
    cooldownMs: automaticRecoveryCooldownMs,
  })
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
    const registrations = await navigator.serviceWorker.getRegistrations()

    await Promise.all(
      registrations.map(async (registration) => {
        if (unregister) {
          await registration.unregister()
          return
        }

        await registration.update()
        registration.waiting?.postMessage({ type: "SKIP_WAITING" })
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

  const timestamp = Date.now()
  writeBrowserStorage("sessionStorage", automaticRecoveryKey, String(timestamp))

  await deleteApplicationCaches()
  await refreshServiceWorker(false)
  reloadWithRecoveryMarker(timestamp)
  return true
}

export async function repairApplication() {
  await deleteApplicationCaches()
  await refreshServiceWorker(true)
  window.location.reload()
}
