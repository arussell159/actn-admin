import { readBrowserStorage, writeBrowserStorage } from "@/lib/browser-storage"
import { createPublicClient } from "@/lib/public-client"
import { saveDatabaseDraft } from "@/lib/persistence"

// Only known application data is eligible. Never copy cookies, sessions,
// credentials, or arbitrary browser storage into the shared database.
const legacyKeys = [
  "actn-month-end-records-v1",
  "actn-month-end-master-records-v1",
  "actn-month-end-country-report-records-v1",
  "actn-month-end-country-reconciliations-v1",
  "africa-ctn-month-end-template",
  "africa-ctn-information-notes",
  "africa-ctn-information-notes-trash",
  "africa-ctn-knowledge-base-notes",
  "africa-ctn-knowledge-base-notes-trash",
  "africa-ctn-knowledge-base-v1",
]
const marker = (key: string) => `actn-recovery-saved-v1:${key}`
type RecoveryCopy = { storageKey: string; serialized: string }

export function captureLegacyBrowserData(): RecoveryCopy[] {
  return legacyKeys
    .flatMap((key) => [key, key + ":before-database-sync"])
    .flatMap((storageKey) => {
      if (readBrowserStorage("localStorage", marker(storageKey))) return []
      const serialized = readBrowserStorage("localStorage", storageKey)
      return serialized ? [{ storageKey, serialized }] : []
    })
}

export async function preserveLegacyBrowserData(copies: RecoveryCopy[]) {
  if (!copies.length) return
  const deviceKey = "actn-recovery-device-v1"
  const device =
    readBrowserStorage("localStorage", deviceKey) || crypto.randomUUID()
  writeBrowserStorage("localStorage", deviceKey, device)
  await Promise.all(
    copies.map((copy) =>
      saveDatabaseDraft(
        `browser-recovery:${copy.storageKey}`,
        "Older browser data backup",
        copy,
        async (snapshot) => {
          const { error } = await createPublicClient()
            .from("app_settings")
            .upsert(
              {
                id: `browser-recovery:${device}:${snapshot.storageKey}`,
                value: {
                  ...snapshot,
                  origin: window.location.origin,
                  capturedAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id", ignoreDuplicates: true }
            )
          if (error) throw error
          writeBrowserStorage("localStorage", marker(snapshot.storageKey), "1")
        }
      )
    )
  )
}
