export const authSessionStartedAtKey = "actn-admin-auth-started-at"
export const authPasskeyEnabledKey = "actn-admin-passkey-enabled"
export const authSessionMaxAgeMs = 2 * 60 * 60 * 1000

export function markAuthSessionStarted() {
  window.localStorage.setItem(authSessionStartedAtKey, String(Date.now()))
}

export function clearAuthSessionStart() {
  window.localStorage.removeItem(authSessionStartedAtKey)
}

export function hasAuthSessionExpired() {
  const startedAt = Number(window.localStorage.getItem(authSessionStartedAtKey))

  return Number.isFinite(startedAt) && Date.now() - startedAt > authSessionMaxAgeMs
}
