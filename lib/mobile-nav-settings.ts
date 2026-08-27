import { createClient } from "@/lib/client"

const tableName = "app_settings"
const settingId = "mobile_nav_layout"
const localStorageKey = "actn-mobile-nav-layout-v1"

type AppSettingRow = {
  id: string
  value: {
    dockHrefs?: unknown
  } | null
  updated_at: string
}

function cleanDockHrefs(hrefs: unknown, validHrefs: string[], maxItems: number) {
  if (!Array.isArray(hrefs)) {
    return undefined
  }

  return hrefs
    .filter(
      (href): href is string =>
        typeof href === "string" && validHrefs.includes(href)
    )
    .slice(0, maxItems)
}

function readLocalDockHrefs(validHrefs: string[], maxItems: number) {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    const stored = window.localStorage.getItem(localStorageKey)
    const parsed = stored ? JSON.parse(stored) : undefined

    return cleanDockHrefs(parsed, validHrefs, maxItems)
  } catch {
    return undefined
  }
}

function writeLocalDockHrefs(dockHrefs: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(localStorageKey, JSON.stringify(dockHrefs))
  }
}

export async function getMobileNavDockHrefs(
  validHrefs: string[],
  maxItems: number
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", settingId)
      .maybeSingle<AppSettingRow>()

    if (error) {
      return readLocalDockHrefs(validHrefs, maxItems)
    }

    const dockHrefs = cleanDockHrefs(data?.value?.dockHrefs, validHrefs, maxItems)

    if (dockHrefs) {
      writeLocalDockHrefs(dockHrefs)
    }

    return dockHrefs
  } catch {
    return readLocalDockHrefs(validHrefs, maxItems)
  }
}

export async function saveMobileNavDockHrefs(dockHrefs: string[]) {
  writeLocalDockHrefs(dockHrefs)

  try {
    const supabase = createClient()
    const { error } = await supabase.from(tableName).upsert(
      {
        id: settingId,
        value: { dockHrefs },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )

    if (error) {
      throw error
    }
  } catch {}
}
