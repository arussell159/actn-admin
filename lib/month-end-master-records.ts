import { parseCsv, findCsvColumn, normalizeCsvHeader } from "@/lib/csv"
import { createPublicClient } from "@/lib/public-client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import type { TemplateCountryRow } from "@/lib/month-end-template"

export type MonthEndMasterRecord = {
  id: string
  monthEndId: string
  period: string
  countryId: string
  countryName: string
  salesOrderNumber: string
  billOfLadingNumber: string
  ctnNumber: string
  status: string
  amount: number
  sourceClass: string
  sourceInternalId: string
  sourceRowIndex: number
  createdAt?: string
}

type MonthEndMasterRecordRow = {
  id: string
  month_end_id: string
  period: string
  country_id: string
  country_name: string
  sales_order_number: string
  bill_of_lading_number: string
  ctn_number: string
  status: string
  amount: number
  source_class: string
  source_internal_id: string
  source_row_index: number
  created_at?: string
}

const tableName = "month_end_master_records"
const localStorageKey = "actn-month-end-master-records-v1"

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

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

function toRecord(row: MonthEndMasterRecordRow): MonthEndMasterRecord {
  return {
    id: row.id,
    monthEndId: row.month_end_id,
    period: row.period,
    countryId: row.country_id,
    countryName: row.country_name,
    salesOrderNumber: row.sales_order_number,
    billOfLadingNumber: row.bill_of_lading_number,
    ctnNumber: row.ctn_number,
    status: row.status,
    amount: Number(row.amount) || 0,
    sourceClass: row.source_class,
    sourceInternalId: row.source_internal_id,
    sourceRowIndex: row.source_row_index,
    createdAt: row.created_at,
  }
}

function toRow(record: MonthEndMasterRecord): MonthEndMasterRecordRow {
  return {
    id: record.id,
    month_end_id: record.monthEndId,
    period: record.period,
    country_id: record.countryId,
    country_name: record.countryName,
    sales_order_number: record.salesOrderNumber,
    bill_of_lading_number: record.billOfLadingNumber,
    ctn_number: record.ctnNumber,
    status: record.status,
    amount: record.amount,
    source_class: record.sourceClass,
    source_internal_id: record.sourceInternalId,
    source_row_index: record.sourceRowIndex,
  }
}

function getLocalRecords() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const stored = window.localStorage.getItem(localStorageKey)
    const parsed = stored ? JSON.parse(stored) : []

    return Array.isArray(parsed) ? (parsed as MonthEndMasterRecord[]) : []
  } catch {
    return []
  }
}

function saveLocalRecords(records: MonthEndMasterRecord[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(localStorageKey, JSON.stringify(records))
}

function upsertLocalMasterRecords(monthEndId: string, records: MonthEndMasterRecord[]) {
  const existing = getLocalRecords().filter(
    (record) => record.monthEndId !== monthEndId
  )

  saveLocalRecords([...existing, ...records])
}

function upsertLocalCountryMasterRecords(
  monthEndId: string,
  countryIds: string[],
  records: MonthEndMasterRecord[]
) {
  const countryIdSet = new Set(countryIds)
  const existing = getLocalRecords().filter(
    (record) =>
      record.monthEndId !== monthEndId || !countryIdSet.has(record.countryId)
  )

  saveLocalRecords([...existing, ...records])
}

function countryRows(countries: TemplateCountryRow[]) {
  return countries.filter((country) => country.checkable !== false)
}

const groupedCountryRoutes: Record<string, string[]> = {
  centralafricanrepublic: ["antaser", "antaser-oot"],
  guineabissau: ["antaser", "antaser-oot"],
  niger: ["antaser", "antaser-oot"],
  burundi: ["antaser-afrique", "antaser-afrique-oot"],
  equatorialguinea: ["antaser-afrique", "antaser-afrique-oot"],
  southsudan: ["antaser-afrique", "antaser-afrique-oot"],
  togo: ["antaser-afrique", "antaser-afrique-oot"],
}

const linkedCountryRecordIds = [
  ["antaser", "antaser-oot"],
  ["antaser-afrique", "antaser-afrique-oot"],
]

export function getLinkedCountryIds(countryId: string) {
  return (
    linkedCountryRecordIds.find((group) => group.includes(countryId)) ?? [
      countryId,
    ]
  )
}

export function getCanonicalCountryId(countryId: string) {
  return getLinkedCountryIds(countryId)[0] ?? countryId
}

function findCountries(sourceClass: string, countries: TemplateCountryRow[]) {
  const normalizedClass = normalizeMatch(sourceClass)
  const rows = countryRows(countries)
  const groupedRoute = Object.entries(groupedCountryRoutes).find(
    ([sourceCountry]) => normalizedClass.includes(sourceCountry)
  )

  if (groupedRoute) {
    const [, rowIds] = groupedRoute

    return rows.filter((country) => rowIds.includes(country.id))
  }

  const exact = rows.find(
    (country) => normalizeMatch(country.name) === normalizedClass
  )

  if (exact) {
    return [exact]
  }

  const matchedCountry = rows
    .slice()
    .sort((first, second) => second.name.length - first.name.length)
    .find((country) => normalizedClass.includes(normalizeMatch(country.name)))

  return matchedCountry ? [matchedCountry] : []
}

function parseAmount(value: string | undefined) {
  const normalized = (value ?? "").replace(/[$,]/g, "").trim()
  const amount = Number(normalized)

  return Number.isFinite(amount) ? amount : 0
}

function cleanSalesOrder(value: string) {
  return value.replace(/^Sales\s*Order\s*#\s*/i, "").trim()
}

function makeRecordId(
  monthEndId: string,
  countryId: string,
  internalId: string,
  rowIndex: number
) {
  const rowKey = internalId || String(rowIndex)

  return `${monthEndId}__${countryId}__${rowKey}`
}

export function isMasterCsv(csvText: string) {
  const [headers] = parseCsv(csvText)

  if (!headers) {
    return false
  }

  const normalizedHeaders = new Set(headers.map(normalizeCsvHeader))

  return (
    normalizedHeaders.has("createdfrom") &&
    normalizedHeaders.has("billoflading") &&
    normalizedHeaders.has("ctnnumber") &&
    normalizedHeaders.has("ctnstatus") &&
    normalizedHeaders.has("classnohierarchy")
  )
}

export function parseMonthEndMasterCsv({
  csvText,
  countries,
  monthEndId,
  period,
}: {
  csvText: string
  countries: TemplateCountryRow[]
  monthEndId: string
  period: string
}) {
  const rows = parseCsv(csvText)
  const [headers, ...dataRows] = rows

  if (!headers) {
    return []
  }

  const internalIdIndex = findCsvColumn(headers, ["internalid"])
  const salesOrderIndex = findCsvColumn(headers, ["createdfrom"])
  const billOfLadingIndex = findCsvColumn(headers, ["billoflading"])
  const ctnIndex = findCsvColumn(headers, ["ctnnumber"])
  const statusIndex = findCsvColumn(headers, ["ctnstatus"])
  const classIndex = findCsvColumn(headers, ["classnohierarchy"])
  const amountIndex = findCsvColumn(headers, ["amount"])

  if (
    salesOrderIndex === -1 ||
    billOfLadingIndex === -1 ||
    ctnIndex === -1 ||
    statusIndex === -1 ||
    classIndex === -1
  ) {
    throw new Error(
      "The master CSV must include Created From, Bill of Lading, CTN Number, CTN Status, and Class (no hierarchy)."
    )
  }

  return dataRows.flatMap((row, index) => {
    const sourceClass = row[classIndex]?.trim() ?? ""
    const matchedCountries = findCountries(sourceClass, countries)

    if (!matchedCountries.length) {
      return []
    }

    const sourceInternalId =
      internalIdIndex >= 0 ? (row[internalIdIndex]?.trim() ?? "") : ""
    const sourceRowIndex = index + 2

    return matchedCountries.map((country) => ({
      id: makeRecordId(
        monthEndId,
        country.id,
        sourceInternalId,
        sourceRowIndex
      ),
      monthEndId,
      period,
      countryId: country.id,
      countryName: country.name,
      salesOrderNumber: cleanSalesOrder(row[salesOrderIndex]?.trim() ?? ""),
      billOfLadingNumber: row[billOfLadingIndex]?.trim() ?? "",
      ctnNumber: row[ctnIndex]?.trim() ?? "",
      status: row[statusIndex]?.trim() ?? "",
      amount: amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0,
      sourceClass,
      sourceInternalId,
      sourceRowIndex,
    })) satisfies MonthEndMasterRecord[]
  })
}

export function parseCountryMasterCsv({
  csvText,
  targetCountries,
  monthEndId,
  period,
}: {
  csvText: string
  targetCountries: TemplateCountryRow[]
  monthEndId: string
  period: string
}) {
  const rows = parseCsv(csvText)
  const [headers, ...dataRows] = rows

  if (!headers) {
    return []
  }

  const internalIdIndex = findCsvColumn(headers, ["internalid", "id"])
  const salesOrderIndex = findCsvColumn(headers, [
    "createdfrom",
    "salesorder",
    "salesordernumber",
    "sonumber",
  ])
  const billOfLadingIndex = findCsvColumn(headers, [
    "billoflading",
    "bol",
    "bl",
    "blnumber",
  ])
  const ctnIndex = findCsvColumn(headers, ["ctnnumber", "ctn"])
  const statusIndex = findCsvColumn(headers, ["ctnstatus", "status"])
  const amountIndex = findCsvColumn(headers, ["amount", "total"])

  if (
    salesOrderIndex === -1 ||
    billOfLadingIndex === -1 ||
    ctnIndex === -1 ||
    statusIndex === -1
  ) {
    throw new Error(
      "The CSV must include sales order, bill of lading, CTN, and status columns."
    )
  }

  return dataRows.flatMap((row, index) => {
    const sourceInternalId =
      internalIdIndex >= 0 ? (row[internalIdIndex]?.trim() ?? "") : ""
    const sourceRowIndex = index + 2

    return targetCountries.map((country) => ({
      id: makeRecordId(
        monthEndId,
        country.id,
        sourceInternalId,
        sourceRowIndex
      ),
      monthEndId,
      period,
      countryId: country.id,
      countryName: country.name,
      salesOrderNumber: cleanSalesOrder(row[salesOrderIndex]?.trim() ?? ""),
      billOfLadingNumber: row[billOfLadingIndex]?.trim() ?? "",
      ctnNumber: row[ctnIndex]?.trim() ?? "",
      status: row[statusIndex]?.trim() ?? "",
      amount: amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0,
      sourceClass: country.name,
      sourceInternalId,
      sourceRowIndex,
    })) satisfies MonthEndMasterRecord[]
  })
}

export async function saveMonthEndMasterRecords(
  monthEndId: string,
  records: MonthEndMasterRecord[]
) {
  try {
    const supabase = getSupabaseClient()
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq("month_end_id", monthEndId)

    if (deleteError) {
      throw deleteError
    }

    if (records.length) {
      const { error } = await supabase.from(tableName).insert(records.map(toRow))

      if (error) {
        throw error
      }
    }
  } catch (error) {
    if (isLocalhostBrowser()) {
      upsertLocalMasterRecords(monthEndId, records)
      return
    }

    throw error
  }
}

export async function replaceMonthEndCountryMasterRecords({
  monthEndId,
  countryId,
  records,
}: {
  monthEndId: string
  countryId: string
  records: MonthEndMasterRecord[]
}) {
  const countryIds = getLinkedCountryIds(countryId)

  try {
    const supabase = getSupabaseClient()
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq("month_end_id", monthEndId)
      .in("country_id", countryIds)

    if (deleteError) {
      throw deleteError
    }

    if (records.length) {
      const { error } = await supabase.from(tableName).insert(records.map(toRow))

      if (error) {
        throw error
      }
    }
  } catch (error) {
    if (isLocalhostBrowser()) {
      upsertLocalCountryMasterRecords(monthEndId, countryIds, records)
      return
    }

    throw error
  }
}

export function getLinkedCountryRows(
  countryId: string,
  countries: TemplateCountryRow[]
) {
  const rowIds = getLinkedCountryIds(countryId)

  return countries.filter((country) => rowIds.includes(country.id))
}

export async function listMonthEndMasterRecords({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId?: string
}) {
  try {
    const supabase = getSupabaseClient()
    let query = supabase
      .from(tableName)
      .select("*")
      .eq("month_end_id", monthEndId)
      .order("sales_order_number", { ascending: true })

    if (countryId) {
      query = query.eq("country_id", countryId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data ?? []).map((row) => toRecord(row as MonthEndMasterRecordRow))
  } catch (error) {
    if (isLocalhostBrowser()) {
      return getLocalRecords()
        .filter(
          (record) =>
            record.monthEndId === monthEndId &&
            (!countryId || record.countryId === countryId)
        )
        .sort((first, second) =>
          first.salesOrderNumber.localeCompare(second.salesOrderNumber)
        )
    }

    throw error
  }
}
