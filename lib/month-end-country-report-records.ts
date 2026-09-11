import { createPublicClient } from "@/lib/public-client"
import { readAllRows, deleteRowsById } from "@/lib/database-records"
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
export const antaserInvoiceParserKey = "antaser-invoice-v1"

function getSupabaseClient() {
  assertSupabaseConfig()
  return createPublicClient()
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
  if (
    records.some(
      (record) =>
        record.monthEndId !== monthEndId ||
        getCanonicalCountryId(record.countryId) !== canonicalCountryId
    )
  )
    throw new Error(
      "The imported records do not belong to this month and country."
    )
  const supabase = getSupabaseClient()
  const existingRows = await readAllRows<{ id: string }>((from, to) =>
    supabase
      .from(tableName)
      .select("id")
      .eq("month_end_id", monthEndId)
      .eq("country_id", canonicalCountryId)
      .order("id")
      .range(from, to)
  )
  for (let index = 0; index < records.length; index += 500) {
    const { error } = await supabase
      .from(tableName)
      .upsert(records.slice(index, index + 500).map(toRow), {
        onConflict: "id",
      })
    if (error) throw error
  }
  const nextIds = new Set(records.map((record) => record.id))
  await deleteRowsById(
    existingRows.map((row) => row.id).filter((id) => !nextIds.has(id)),
    (ids) =>
      supabase
        .from(tableName)
        .delete()
        .eq("month_end_id", monthEndId)
        .eq("country_id", canonicalCountryId)
        .in("id", ids)
  )
}

export async function listMonthEndCountryReportRecords({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId: string
}) {
  const canonicalCountryId = getCanonicalCountryId(countryId)
  const supabase = getSupabaseClient()
  const rows = await readAllRows<MonthEndCountryReportRecordRow>((from, to) =>
    supabase
      .from(tableName)
      .select("*")
      .eq("month_end_id", monthEndId)
      .eq("country_id", canonicalCountryId)
      .order("id")
      .range(from, to)
  )
  return rows
    .map(toRecord)
    .sort((a, b) => a.reference.localeCompare(b.reference))
}
