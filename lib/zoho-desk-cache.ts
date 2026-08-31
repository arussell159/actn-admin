import "server-only"

import { createPublicClient } from "@/lib/public-client"
import { hasSupabaseConfig } from "@/lib/supabase-env"

type ZohoDeskCacheRow<T> = {
  id: string
  value: T | null
  updated_at: string
}

const tableName = "app_settings"
const cacheIdPrefix = "zoho_desk_cache"

function cacheId(key: string) {
  return `${cacheIdPrefix}:${key}`
}

export async function readZohoDeskCache<T>(key: string, maxAgeMs: number) {
  if (!hasSupabaseConfig()) {
    return null
  }

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", cacheId(key))
      .maybeSingle<ZohoDeskCacheRow<T>>()

    if (error || !data?.value) {
      return null
    }

    const updatedAt = new Date(data.updated_at).getTime()

    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxAgeMs) {
      return null
    }

    return data.value
  } catch {
    return null
  }
}

export async function writeZohoDeskCache<T>(key: string, value: T) {
  if (!hasSupabaseConfig()) {
    return
  }

  try {
    const supabase = createPublicClient()

    await supabase.from(tableName).upsert(
      {
        id: cacheId(key),
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
  } catch {}
}

