import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

export const persistenceUpdatedEvent = "actn:persistence-updated"
type SaveState = {
  label: string
  pending: boolean
  failed: boolean
  readOnly?: boolean
  retry: () => void
}
const states = new Map<string, SaveState>()
const queues = new Map<string, Promise<void>>()
const draftKey = (key: string) => `actn-pending-save:${key}`

function notify() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(persistenceUpdatedEvent))
}

export function pendingDatabaseSaves() {
  return [...states.entries()].map(([key, state]) => ({ key, ...state }))
}

export function reportDatabaseReadFailure(key: string, label: string) {
  states.set("read:" + key, {
    label,
    pending: false,
    failed: true,
    readOnly: true,
    retry: () => window.location.reload(),
  })
  notify()
}

export function clearDatabaseReadFailure(key: string) {
  if (states.delete("read:" + key)) notify()
}

export function readPendingDatabaseSave<T>(key: string): T | undefined {
  const value = readBrowserStorage("localStorage", draftKey(key))
  if (!value) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

// Keep drafts separate from confirmed caches and serialize overlapping saves.
export function saveDatabaseDraft<T>(
  key: string,
  label: string,
  value: T,
  save: (value: T) => Promise<void>
): Promise<void> {
  const snapshot = structuredClone(value)
  const serialized = JSON.stringify(snapshot)
  writeBrowserStorage("localStorage", draftKey(key), serialized)
  const state: SaveState = {
    label,
    pending: true,
    failed: false,
    retry: () => {
      void saveDatabaseDraft(key, label, snapshot, save).catch(() => {})
    },
  }
  states.set(key, state)
  notify()
  const task = (queues.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      try {
        await save(snapshot)
        if (states.get(key) === state) {
          states.delete(key)
          if (readBrowserStorage("localStorage", draftKey(key)) === serialized)
            removeBrowserStorage("localStorage", draftKey(key))
        }
      } catch (error) {
        if (states.get(key) === state) {
          state.pending = false
          state.failed = true
        }
        throw error
      } finally {
        notify()
      }
    })
  queues.set(key, task)
  void task.then(
    () => {
      if (queues.get(key) === task) queues.delete(key)
    },
    () => {}
  )
  return task
}

export function waitForDatabaseSave(key: string) {
  return queues.get(key) ?? Promise.resolve()
}
