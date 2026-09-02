import { createPublicClient } from "@/lib/public-client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import {
  mergeReportValues,
  normalizeCountryReportReference,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
import { getCanonicalCountryId } from "@/lib/month-end-master-records"

export type MonthEndCountryReportRecord = ParsedCountryReportRecord & {
  id: string
  monthEndId: string
  period: string
  countryId: string
  countryName: string
  parserKey: string
  createdAt?: string
}

type MonthEndCountryReportRecordRow = {
  id: string
  month_end_id: string
  period: string
  country_id: string
  country_name: string
  invoice_number: string
  ctn_number: string
  bill_of_lading_number: string
  reference: string
  amount: number
  secondary_amount?: number
  source_row_count: number
  parser_key: string
  status?: string
  transaction_date?: string
  selling_date?: string
  created_at?: string
}

const tableName = "month_end_country_report_records"
const localStorageKey = "actn-month-end-country-report-records-v1"
export const antaserInvoiceParserKey = "antaser-invoice-v1"

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

function toRecord(
  row: MonthEndCountryReportRecordRow
): MonthEndCountryReportRecord {
  return {
    id: row.id,
    monthEndId: row.month_end_id,
    period: row.period,
    countryId: row.country_id,
    countryName: row.country_name,
    invoiceNumber: row.invoice_number,
    ctnNumber: row.ctn_number,
    billOfLadingNumber: row.bill_of_lading_number ?? "",
    reference: row.reference,
    amount: Number(row.amount) || 0,
    secondaryAmount: Number(row.secondary_amount) || 0,
    sourceRowCount: row.source_row_count,
    parserKey: row.parser_key,
    status: row.status ?? "",
    transactionDate: row.transaction_date ?? "",
    sellingDate: row.selling_date ?? "",
    createdAt: row.created_at,
  }
}

function toRow(
  record: MonthEndCountryReportRecord
): MonthEndCountryReportRecordRow {
  return {
    id: record.id,
    month_end_id: record.monthEndId,
    period: record.period,
    country_id: record.countryId,
    country_name: record.countryName,
    invoice_number: record.invoiceNumber,
    ctn_number: record.ctnNumber,
    bill_of_lading_number: record.billOfLadingNumber ?? "",
    reference: record.reference,
    amount: record.amount,
    secondary_amount: record.secondaryAmount ?? 0,
    source_row_count: record.sourceRowCount,
    parser_key: record.parserKey,
    status: record.status ?? "",
    transaction_date: record.transactionDate ?? "",
    selling_date: record.sellingDate ?? "",
  }
}

function withoutOptionalCountryReportColumns(
  row: MonthEndCountryReportRecordRow
) {
  const rest = { ...row }

  delete rest.status
  delete rest.transaction_date
  delete rest.selling_date
  delete rest.secondary_amount

  return rest
}

function isMissingOptionalCountryReportColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.code === "42703" || error.code === "PGRST204") &&
    (error.message.includes("transaction_date") ||
      error.message.includes("selling_date") ||
      error.message.includes("status") ||
      error.message.includes("secondary_amount"))
  )
}

function getLocalRecords() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const stored = window.localStorage.getItem(localStorageKey)
    const parsed = stored ? JSON.parse(stored) : []

    return Array.isArray(parsed)
      ? (parsed as MonthEndCountryReportRecord[])
      : []
  } catch {
    return []
  }
}

function saveLocalRecords(records: MonthEndCountryReportRecord[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(localStorageKey, JSON.stringify(records))
}

function replaceLocalCountryReportRecords(
  monthEndId: string,
  countryId: string,
  records: MonthEndCountryReportRecord[]
) {
  const canonicalCountryId = getCanonicalCountryId(countryId)
  const existing = getLocalRecords().filter(
    (record) =>
      record.monthEndId !== monthEndId ||
      getCanonicalCountryId(record.countryId) !== canonicalCountryId
  )

  saveLocalRecords([...existing, ...records])
}

function countryReportGroupKey(
  record: ParsedCountryReportRecord,
  parserKey: string
) {
  if (parserKey === antaserInvoiceParserKey) {
    return [
      record.invoiceNumber,
      normalizeCountryReportReference(record.reference),
    ].join("__")
  }

  return [
    record.invoiceNumber,
    record.ctnNumber,
    record.billOfLadingNumber,
    record.reference,
    record.sourceCountryName ?? "",
    record.targetCountryId ?? "",
  ].join("__")
}

export function makeCountryReportRecords({
  parsedRecords,
  monthEndId,
  period,
  countryId,
  countryName,
  parserKey = antaserInvoiceParserKey,
}: {
  parsedRecords: ParsedCountryReportRecord[]
  monthEndId: string
  period: string
  countryId: string
  countryName: string
  parserKey?: string
}) {
  const canonicalCountryId = getCanonicalCountryId(countryId)
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const record of parsedRecords) {
    const key = countryReportGroupKey(record, parserKey)
    const existing = grouped.get(key)

    grouped.set(key, {
      ...record,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", record.ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        record.billOfLadingNumber
      ),
      reference:
        parserKey === antaserInvoiceParserKey
          ? normalizeCountryReportReference(record.reference)
          : record.reference,
      amount: (existing?.amount ?? 0) + record.amount,
      secondaryAmount:
        (existing?.secondaryAmount ?? 0) + (record.secondaryAmount ?? 0),
      sourceRowCount: (existing?.sourceRowCount ?? 0) + record.sourceRowCount,
      sourceCountryName: mergeReportValues(
        existing?.sourceCountryName ?? "",
        record.sourceCountryName ?? ""
      ),
      status: mergeReportValues(existing?.status ?? "", record.status ?? ""),
      transactionDate: mergeReportValues(
        existing?.transactionDate ?? "",
        record.transactionDate ?? ""
      ),
      sellingDate: mergeReportValues(
        existing?.sellingDate ?? "",
        record.sellingDate ?? ""
      ),
    })
  }

  return Array.from(grouped.values()).map((record, index) => ({
    id: [
      monthEndId,
      canonicalCountryId,
      record.invoiceNumber || "invoice",
      record.ctnNumber || "ctn",
      record.billOfLadingNumber || "bl",
      record.reference || index,
    ].join("__"),
    monthEndId,
    period,
    countryId: canonicalCountryId,
    countryName: record.sourceCountryName || countryName,
    parserKey,
    ...record,
  }))
}

export async function replaceMonthEndCountryReportRecords({
  monthEndId,
  countryId,
  records,
}: {
  monthEndId: string
  countryId: string
  records: MonthEndCountryReportRecord[]
}) {
  const canonicalCountryId = getCanonicalCountryId(countryId)

  if (isLocalhostBrowser()) {
    replaceLocalCountryReportRecords(monthEndId, countryId, records)
  }

  try {
    const supabase = getSupabaseClient()
    const { data: existingRows, error: selectError } = await supabase
      .from(tableName)
      .select("id")
      .eq("month_end_id", monthEndId)
      .eq("country_id", canonicalCountryId)

    if (selectError) {
      throw selectError
    }

    if (records.length) {
      const { error } = await supabase
        .from(tableName)
        .upsert(records.map(toRow), { onConflict: "id" })

      if (isMissingOptionalCountryReportColumnError(error)) {
        const { error: retryError } = await supabase
          .from(tableName)
          .upsert(records.map(toRow).map(withoutOptionalCountryReportColumns), {
            onConflict: "id",
          })

        if (retryError) {
          throw retryError
        }
      } else if (error) {
        throw error
      }
    }

    const nextIds = new Set(records.map((record) => record.id))
    const staleIds = (existingRows ?? [])
      .map((row) => row.id)
      .filter((id) => !nextIds.has(id))

    if (staleIds.length) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .in("id", staleIds)

      if (error) {
        throw error
      }
    }
  } catch (error) {
    if (isLocalhostBrowser()) {
      replaceLocalCountryReportRecords(monthEndId, countryId, records)
      return
    }

    throw error
  }
}

export async function listMonthEndCountryReportRecords({
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
      .order("reference", { ascending: true })

    if (error) {
      throw error
    }

    const remoteRecords = (data ?? []).map((row) =>
      toRecord(row as MonthEndCountryReportRecordRow)
    )

    if (!isLocalhostBrowser()) {
      return remoteRecords
    }

    const localRecords = getLocalRecords().filter(
      (record) =>
        record.monthEndId === monthEndId &&
        getCanonicalCountryId(record.countryId) === canonicalCountryId
    )
    const localIds = new Set(localRecords.map((record) => record.id))
    const remoteOnlyRecords = remoteRecords.filter(
      (record) => !localIds.has(record.id)
    )

    return [...remoteOnlyRecords, ...localRecords].sort((first, second) =>
      first.reference.localeCompare(second.reference)
    )
  } catch (error) {
    if (isLocalhostBrowser()) {
      return getLocalRecords()
        .filter(
          (record) =>
            record.monthEndId === monthEndId &&
            getCanonicalCountryId(record.countryId) === canonicalCountryId
        )
        .sort((first, second) =>
          first.reference.localeCompare(second.reference)
        )
    }

    throw error
  }
}
