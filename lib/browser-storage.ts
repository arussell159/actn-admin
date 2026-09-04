export type BrowserStorageKind = "localStorage" | "sessionStorage"

function getStorage(kind: BrowserStorageKind): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    return window[kind]
  } catch {
    return undefined
  }
}

export function readBrowserStorage(
  kind: BrowserStorageKind,
  key: string
): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeBrowserStorage(
  kind: BrowserStorageKind,
  key: string,
  value: string
) {
  try {
    getStorage(kind)?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeBrowserStorage(kind: BrowserStorageKind, key: string) {
  try {
    getStorage(kind)?.removeItem(key)
  } catch {
    // Storage can be unavailable in private mode or under storage pressure.
  }
}

export function readJsonBrowserStorage<T>({
  kind,
  key,
  fallback,
  validate,
}: {
  kind: BrowserStorageKind
  key: string
  fallback: T
  validate: (value: unknown) => value is T
}): T {
  const stored = readBrowserStorage(kind, key)

  if (stored === null) {
    return fallback
  }

  try {
    const parsed: unknown = JSON.parse(stored)

    if (validate(parsed)) {
      return parsed
    }
  } catch {
    // The invalid value is removed below so it cannot brick later launches.
  }

  removeBrowserStorage(kind, key)
  return fallback
}

export function readUnknownJsonBrowserStorage(
  kind: BrowserStorageKind,
  key: string
): unknown {
  const stored = readBrowserStorage(kind, key)

  if (stored === null) {
    return undefined
  }

  try {
    return JSON.parse(stored) as unknown
  } catch {
    removeBrowserStorage(kind, key)
    return undefined
  }
}
