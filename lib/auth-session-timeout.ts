export const authSessionStartedAtKey = "actn-admin-auth-started-at"
export const authPasskeyEnabledKey = "actn-admin-passkey-enabled"
export const desktopAuthSessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000
export const desktopAuthSessionMaxAgeSeconds =
  desktopAuthSessionMaxAgeMs / 1000

export function isPhoneAuthSession() {
  return (
    window.matchMedia("(max-width: 767px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900)
  )
}

function getAuthSessionStorage() {
  return isPhoneAuthSession() ? window.sessionStorage : window.localStorage
}

export function markAuthSessionStarted() {
  window.localStorage.removeItem(authSessionStartedAtKey)
  window.sessionStorage.removeItem(authSessionStartedAtKey)
  getAuthSessionStorage().setItem(authSessionStartedAtKey, String(Date.now()))
}

export function clearAuthSessionStart() {
  window.localStorage.removeItem(authSessionStartedAtKey)
  window.sessionStorage.removeItem(authSessionStartedAtKey)
}

export function hasAuthSessionStarted() {
  return Boolean(getAuthSessionStorage().getItem(authSessionStartedAtKey))
}

export function hasAuthSessionExpired() {
  if (isPhoneAuthSession()) {
    return !hasAuthSessionStarted()
  }

  const startedAt = Number(window.localStorage.getItem(authSessionStartedAtKey))

  return (
    !Number.isFinite(startedAt) ||
    Date.now() - startedAt > desktopAuthSessionMaxAgeMs
  )
}
