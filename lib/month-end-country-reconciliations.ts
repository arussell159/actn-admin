import { createPublicClient } from "@/lib/public-client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import {
  readJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"
import { getCanonicalCountryId } from "@/lib/month-end-master-records"

export type MonthEndCountryReconciliationRecord<TSnapshot = unknown> = {
  id: string
  monthEndId: string
  period: string
  countryId: string
  snapshot: TSnapshot
  createdAt?: string
  updatedAt?: string
}

type MonthEndCountryReconciliationRow = {
  id: string
  month_end_id: string
  period: string
  country_id: string
  snapshot: unknown
  created_at?: string
  updated_at?: string
}

const tableName = "month_end_country_reconciliations"
const localStorageKey = "actn-month-end-country-reconciliations-v1"

function getSupabaseClient() {
  assertSupabaseConfig()
  return createPublicClient()
}

function isLocalhostBrowser() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.endsWith(".localhost")
  )
}

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message.includes(tableName))
  )
}

function makeCountryReconciliationId(monthEndId: string, countryId: string) {
  return `${monthEndId}__${getCanonicalCountryId(countryId)}`
}

function toRecord<TSnapshot>(
  row: MonthEndCountryReconciliationRow
): MonthEndCountryReconciliationRecord<TSnapshot> {
  return {
    id: row.id,
    monthEndId: row.month_end_id,
    period: row.period,
    countryId: row.country_id,
    snapshot: row.snapshot as TSnapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow<TSnapshot>({
  record,
  now,
}: {
  record: MonthEndCountryReconciliationRecord<TSnapshot>
  now: string
}): MonthEndCountryReconciliationRow {
  return {
    id: record.id,
    month_end_id: record.monthEndId,
    period: record.period,
    country_id: getCanonicalCountryId(record.countryId),
    snapshot: record.snapshot,
    created_at: record.createdAt ?? now,
    updated_at: now,
  }
}

function getLocalRecords() {
  if (typeof window === "undefined") {
    return []
  }

  return readJsonBrowserStorage({
    kind: "localStorage",
    key: localStorageKey,
    fallback: [],
    validate: isCountryReconciliationRecordArray,
  })
}

function isCountryReconciliationRecordArray(
  value: unknown
): value is MonthEndCountryReconciliationRecord[] {
  return (
    Array.isArray(value) &&
    value.every((record) => {
      if (typeof record !== "object" || record === null) {
        return false
      }

      const candidate = record as Partial<MonthEndCountryReconciliationRecord>
      return (
        typeof candidate.id === "string" &&
        typeof candidate.monthEndId === "string" &&
        typeof candidate.period === "string" &&
        typeof candidate.countryId === "string" &&
        "snapshot" in candidate
      )
    })
  )
}

function saveLocalRecords(records: MonthEndCountryReconciliationRecord[]) {
  if (typeof window === "undefined") {
    return
  }

  writeBrowserStorage("localStorage", localStorageKey, JSON.stringify(records))
}

function saveLocalRecord(record: MonthEndCountryReconciliationRecord) {
  const records = getLocalRecords()
  const existingIndex = records.findIndex((item) => item.id === record.id)
  const nextRecords =
    existingIndex >= 0
      ? records.map((item, index) => (index === existingIndex ? record : item))
      : [record, ...records]

  saveLocalRecords(nextRecords)
}

function deleteLocalRecord(monthEndId: string, countryId: string) {
  const canonicalCountryId = getCanonicalCountryId(countryId)

  saveLocalRecords(
    getLocalRecords().filter(
      (record) =>
        record.monthEndId !== monthEndId ||
        getCanonicalCountryId(record.countryId) !== canonicalCountryId
    )
  )
}

export async function getMonthEndCountryReconciliation<TSnapshot = unknown>({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId: string
}) {
  const canonicalCountryId = getCanonicalCountryId(countryId)

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("month_end_id", monthEndId)
      .eq("country_id", canonicalCountryId)
      .maybeSingle<MonthEndCountryReconciliationRow>()

    if (error) {
      throw error
    }

    return data ? toRecord<TSnapshot>(data) : undefined
  } catch (error) {
    if (isMissingTableError(error)) {
      return undefined
    }

    if (isLocalhostBrowser()) {
      const localRecord = getLocalRecords().find(
        (record) =>
          record.monthEndId === monthEndId &&
          getCanonicalCountryId(record.countryId) === canonicalCountryId
      )

      return localRecord as
        MonthEndCountryReconciliationRecord<TSnapshot> | undefined
    }

    throw error
  }
}

export async function saveMonthEndCountryReconciliation<TSnapshot>({
  monthEndId,
  period,
  countryId,
  snapshot,
}: {
  monthEndId: string
  period: string
  countryId: string
  snapshot: TSnapshot
}) {
  const now = new Date().toISOString()
  const canonicalCountryId = getCanonicalCountryId(countryId)
  const record: MonthEndCountryReconciliationRecord<TSnapshot> = {
    id: makeCountryReconciliationId(monthEndId, canonicalCountryId),
    monthEndId,
    period,
    countryId: canonicalCountryId,
    snapshot,
    updatedAt: now,
  }

  if (isLocalhostBrowser()) {
    saveLocalRecord(record)
  }

  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from(tableName)
      .upsert(toRow({ record, now }), { onConflict: "id" })

    if (error) {
      throw error
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return
    }

    if (isLocalhostBrowser()) {
      saveLocalRecord(record)
      return
    }

    throw error
  }
}

export async function deleteMonthEndCountryReconciliation({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId: string
}) {
  const canonicalCountryId = getCanonicalCountryId(countryId)

  if (isLocalhostBrowser()) {
    deleteLocalRecord(monthEndId, canonicalCountryId)
  }

  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("month_end_id", monthEndId)
      .eq("country_id", canonicalCountryId)

    if (error) {
      throw error
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return
    }

    if (isLocalhostBrowser()) {
      deleteLocalRecord(monthEndId, canonicalCountryId)
      return
    }

    throw error
  }
}
