import { createPublicClient } from "@/lib/public-client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
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

function getSupabaseClient() {
  assertSupabaseConfig()
  return createPublicClient()
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

export async function getMonthEndCountryReconciliation<TSnapshot>({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId: string
}) {
  const { data, error } = await getSupabaseClient()
    .from(tableName)
    .select("*")
    .eq("month_end_id", monthEndId)
    .eq("country_id", getCanonicalCountryId(countryId))
    .maybeSingle<MonthEndCountryReconciliationRow>()
  if (error) throw error
  return data ? toRecord<TSnapshot>(data) : undefined
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
  const { error } = await getSupabaseClient()
    .from(tableName)
    .upsert(toRow({ record, now }), { onConflict: "id" })
  if (error) throw error
}

export async function deleteMonthEndCountryReconciliation({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId: string
}) {
  const { error } = await getSupabaseClient()
    .from(tableName)
    .delete()
    .eq("month_end_id", monthEndId)
    .eq("country_id", getCanonicalCountryId(countryId))
  if (error) throw error
}
