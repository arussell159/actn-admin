export const authSessionStartedAtKey = "actn-admin-auth-started-at"
export const authPasskeyEnabledKey = "actn-admin-passkey-enabled"
export const desktopAuthSessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000
export const desktopAuthSessionMaxAgeSeconds = desktopAuthSessionMaxAgeMs / 1000

export function isPhoneAuthSession() {
  return (
    window.matchMedia("(max-width: 767px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900)
  )
}

function getAuthSessionStorageKind(): BrowserStorageKind {
  return isPhoneAuthSession() ? "sessionStorage" : "localStorage"
}

export function markAuthSessionStarted() {
  removeBrowserStorage("localStorage", authSessionStartedAtKey)
  removeBrowserStorage("sessionStorage", authSessionStartedAtKey)
  writeBrowserStorage(
    getAuthSessionStorageKind(),
    authSessionStartedAtKey,
    String(Date.now())
  )
}

export function clearAuthSessionStart() {
  removeBrowserStorage("localStorage", authSessionStartedAtKey)
  removeBrowserStorage("sessionStorage", authSessionStartedAtKey)
}

export function hasAuthSessionStarted() {
  return Boolean(
    readBrowserStorage(getAuthSessionStorageKind(), authSessionStartedAtKey)
  )
}

export function hasAuthSessionExpired() {
  if (isPhoneAuthSession()) {
    return !hasAuthSessionStarted()
  }

  const startedAt = Number(
    readBrowserStorage("localStorage", authSessionStartedAtKey)
  )

  return (
    !Number.isFinite(startedAt) ||
    Date.now() - startedAt > desktopAuthSessionMaxAgeMs
  )
}
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
  type BrowserStorageKind,
} from "@/lib/browser-storage"
