import { createClient } from "@/lib/client"

export type MonthEndStatus = "Open" | "Closed"
export type MonthEndValue = boolean | number | string

export type MonthEndRecord = {
  id: string
  period: string
  checked: Record<string, MonthEndValue>
  status: MonthEndStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
}

type MonthEndRow = {
  id: string
  period: string
  checked: Record<string, MonthEndValue> | null
  status: MonthEndStatus
  created_at: string
  updated_at: string
  completed_at: string | null
}

const tableName = "month_end_records"
const monthTitleKey = "__month_title"

export function exchangeRateKey(rowId: string) {
  return `${rowId}__exchange_rate`
}

function getCurrentPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}`
}

export function formatPeriod(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return period
  }

  const [year, month] = period.split("-").map(Number)
  const date = new Date(year, month - 1, 1)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date)
}

export function getMonthEndTitle(record: MonthEndRecord) {
  const title = record.checked[monthTitleKey]

  return typeof title === "string" && title.trim()
    ? title.trim()
    : formatPeriod(record.period)
}

export function withMonthEndTitle(
  checked: Record<string, MonthEndValue>,
  title: string
) {
  return {
    ...checked,
    [monthTitleKey]: title.trim(),
  }
}

export function getDefaultPeriod() {
  return getCurrentPeriod()
}

export function getNextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number)
  const date = new Date(year, month, 1)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0")

  return `${nextYear}-${nextMonth}`
}

function getSupabaseClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
  }

  return createClient()
}

function toRecord(row: MonthEndRow): MonthEndRecord {
  return {
    id: row.id,
    period: row.period,
    checked: row.checked ?? {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  }
}

function toRow(record: MonthEndRecord): MonthEndRow {
  const now = new Date().toISOString()

  return {
    id: record.id,
    period: record.period,
    checked: record.checked,
    status: record.status,
    created_at: record.createdAt || now,
    updated_at: now,
    completed_at: record.completedAt ?? null,
  }
}

export async function getMonthEndRecord(period = getDefaultPeriod()) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("period", period)
    .maybeSingle<MonthEndRow>()

  if (error) {
    throw error
  }

  return data ? toRecord(data) : undefined
}

export async function saveMonthEndRecord(record: MonthEndRecord) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from(tableName).upsert(toRow(record), {
    onConflict: "id",
  })

  if (error) {
    throw error
  }
}

export async function deleteMonthEndRecord(period: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from(tableName).delete().eq("period", period)

  if (error) {
    throw error
  }
}

export async function listMonthEndRecords() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("period", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => toRecord(row as MonthEndRow))
}

export async function ensureMonthEndRecord(period = getDefaultPeriod()) {
  const existingRecord = await getMonthEndRecord(period)

  if (existingRecord) {
    return existingRecord
  }

  const now = new Date().toISOString()
  const record: MonthEndRecord = {
    id: period,
    period,
    checked: {},
    status: "Open",
    createdAt: now,
    updatedAt: now,
  }

  await saveMonthEndRecord(record)
  return record
}

export async function getOpenMonthEndRecord() {
  const records = await listMonthEndRecords()

  return records.find((record) => record.status === "Open")
}

export async function ensureCurrentMonthEndRecord() {
  const defaultPeriod = getDefaultPeriod()
  const records = await listMonthEndRecords()
  const openRecord = records.find((record) => record.status === "Open")

  if (openRecord) {
    return openRecord
  }

  const latestRecord = records[0]
  const nextPeriod =
    latestRecord && latestRecord.period >= defaultPeriod
      ? getNextPeriod(latestRecord.period)
      : defaultPeriod

  return ensureMonthEndRecord(nextPeriod)
}
