import { parseCsv, findCsvColumn, normalizeCsvHeader } from "@/lib/csv"
import { createPublicClient } from "@/lib/public-client"
import { assertSupabaseConfig } from "@/lib/supabase-env"
import {
  loadMonthEndTemplate,
  type ReportFieldMapping,
  type TemplateCountryRow,
} from "@/lib/month-end-template"

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
  transactionDate?: string
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
  transaction_date?: string
  source_class: string
  source_internal_id: string
  source_row_index: number
  created_at?: string
}

const tableName = "month_end_master_records"
const localStorageKey = "actn-month-end-master-records-v1"
const masterRecordBatchSize = 500

export function masterTransactionDatesKey(countryId: string) {
  return `${countryId}__master_transaction_dates`
}

export function getMasterTransactionDateCheckedValues(
  records: MonthEndMasterRecord[]
) {
  const datesByCountry = new Map<string, Record<string, string>>()

  for (const record of records) {
    const transactionDate = record.transactionDate?.trim()

    if (!transactionDate) {
      continue
    }

    const countryDates = datesByCountry.get(record.countryId) ?? {}
    countryDates[record.id] = transactionDate
    datesByCountry.set(record.countryId, countryDates)
  }

  return Object.fromEntries(
    Array.from(datesByCountry, ([countryId, dates]) => [
      masterTransactionDatesKey(countryId),
      JSON.stringify(dates),
    ])
  )
}

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function findMasterTransactionDateIndex(headers: string[]) {
  const exactNames = new Set([
    "date",
    "transactiondate",
    "trandate",
    "invoicedate",
  ])
  const exactIndex = headers.findIndex((header) =>
    exactNames.has(normalizeCsvHeader(header))
  )

  return exactIndex >= 0 ? exactIndex : findCsvColumn(headers, ["date"])
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
    transactionDate: row.transaction_date ?? "",
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
    transaction_date: record.transactionDate ?? "",
    source_class: record.sourceClass,
    source_internal_id: record.sourceInternalId,
    source_row_index: record.sourceRowIndex,
  }
}

function withoutTransactionDate(row: MonthEndMasterRecordRow) {
  const { transaction_date: _transactionDate, ...rest } = row

  return rest
}

function isMissingTransactionDateColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.code === "42703" || error.code === "PGRST204") &&
    error.message.includes("transaction_date")
  )
}

async function upsertMasterRows(
  supabase: ReturnType<typeof getSupabaseClient>,
  rows: MonthEndMasterRecordRow[]
) {
  for (let index = 0; index < rows.length; index += masterRecordBatchSize) {
    const batch = rows.slice(index, index + masterRecordBatchSize)
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: "id" })

    if (!isMissingTransactionDateColumnError(error)) {
      if (error) {
        return error
      }

      continue
    }

    const { error: retryError } = await supabase
      .from(tableName)
      .upsert(batch.map(withoutTransactionDate), { onConflict: "id" })

    if (retryError) {
      return retryError
    }
  }

  return null
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

function upsertLocalMasterRecords(
  monthEndId: string,
  records: MonthEndMasterRecord[]
) {
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

function moveLocalMasterRecordsToCountry(
  monthEndId: string,
  recordIds: string[],
  countryId: string,
  countryName: string
) {
  const records = getLocalRecords()
  const recordIdSet = new Set(recordIds)
  const movedRecords: MonthEndMasterRecord[] = []
  const nextRecords = records.map((record) => {
    if (record.monthEndId !== monthEndId || !recordIdSet.has(record.id)) {
      return record
    }

    const movedRecord = {
      ...record,
      countryId,
      countryName,
      sourceClass: countryName,
    }

    movedRecords.push(movedRecord)
    return movedRecord
  })

  saveLocalRecords(nextRecords)
  return movedRecords
}

function countryRows(countries: TemplateCountryRow[]) {
  return countries.filter((country) => country.checkable !== false)
}

const groupedCountryRoutes: Record<string, string[]> = {
  africactnootprocessingfeeangola: ["angola-oot"],
  angolaoot: ["angola-oot"],
  democraticrepublicofcongo: ["frabemar-dr-congo"],
  drcongo: ["frabemar-dr-congo"],
  drc: ["frabemar-dr-congo"],
  congodemocraticrepublic: ["frabemar-dr-congo"],
  republicofcongo: ["republic-of-congo"],
  congobrazzaville: ["republic-of-congo"],
  centralafricanrepublic: ["antaser", "antaser-oot"],
  guineabissau: ["antaser", "antaser-oot"],
  niger: ["antaser", "antaser-oot"],
  burundi: ["antaser-afrique", "antaser-afrique-oot"],
  equatorialguinea: ["antaser-afrique", "antaser-afrique-oot"],
  southsudan: ["antaser-afrique", "antaser-afrique-oot"],
  togo: ["antaser-afrique", "antaser-afrique-oot"],
  foremost: ["foremost-chad"],
  foremostchad: ["foremost-chad"],
  sckchad: ["sck-chad"],
  scksierraleone: ["sck-sierra-leone"],
  chad: ["foremost-chad"],
  sierraleone: ["sck-sierra-leone"],
}

function getLinkedCountryRowsFromTemplate(
  countryId: string,
  countries: TemplateCountryRow[]
) {
  const linkedIds = new Set([countryId])
  let changed = true

  while (changed) {
    changed = false

    for (const country of countries) {
      const countryLinks = country.combinedWithCountryIds ?? []
      const isLinkedCountry = linkedIds.has(country.id)
      const isLinkedToKnownCountry = countryLinks.some((id) =>
        linkedIds.has(id)
      )

      if (!isLinkedCountry && !isLinkedToKnownCountry) {
        continue
      }

      if (!linkedIds.has(country.id)) {
        linkedIds.add(country.id)
        changed = true
      }

      for (const linkedId of countryLinks) {
        if (!linkedIds.has(linkedId)) {
          linkedIds.add(linkedId)
          changed = true
        }
      }
    }
  }

  return countries.filter((country) => linkedIds.has(country.id))
}

export function getLinkedCountryIds(
  countryId: string,
  countries: TemplateCountryRow[] = loadMonthEndTemplate().countries
) {
  const linkedRows = getLinkedCountryRowsFromTemplate(countryId, countries)

  return linkedRows.length
    ? linkedRows.map((country) => country.id)
    : [countryId]
}

export function getCanonicalCountryId(
  countryId: string,
  countries: TemplateCountryRow[] = loadMonthEndTemplate().countries
) {
  return getLinkedCountryIds(countryId, countries)[0] ?? countryId
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

  return (
    findCsvColumn(headers, ["createdfrom"]) >= 0 &&
    findCsvColumn(headers, ["billoflading"]) >= 0 &&
    findCsvColumn(headers, ["ctnnumber"]) >= 0 &&
    findCsvColumn(headers, ["ctnstatus"]) >= 0 &&
    findCsvColumn(headers, ["classnohierarchy", "class"]) >= 0
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
  const dateIndex = findMasterTransactionDateIndex(headers)
  const salesOrderIndex = findCsvColumn(headers, ["createdfrom"])
  const billOfLadingIndex = findCsvColumn(headers, ["billoflading"])
  const ctnIndex = findCsvColumn(headers, ["ctnnumber"])
  const statusIndex = findCsvColumn(headers, ["ctnstatus"])
  const classIndex = findCsvColumn(headers, ["classnohierarchy", "class"])
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
      transactionDate: dateIndex >= 0 ? (row[dateIndex]?.trim() ?? "") : "",
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
  const dateIndex = findMasterTransactionDateIndex(headers)
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
  const classIndex = findCsvColumn(headers, ["classnohierarchy", "class"])

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
    const sourceClass = classIndex >= 0 ? (row[classIndex]?.trim() ?? "") : ""
    const matchedCountries = sourceClass
      ? findCountries(sourceClass, targetCountries)
      : targetCountries
    const countriesToApply =
      sourceClass && matchedCountries.length
        ? [matchedCountries[0]]
        : targetCountries

    return countriesToApply.map((country) => ({
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
      transactionDate: dateIndex >= 0 ? (row[dateIndex]?.trim() ?? "") : "",
      sourceClass: sourceClass || country.name,
      sourceInternalId,
      sourceRowIndex,
    })) satisfies MonthEndMasterRecord[]
  })
}

function mappedColumnIndex(
  headers: string[],
  mapping: ReportFieldMapping,
  field: keyof ReportFieldMapping["fields"]
) {
  const header = mapping.fields[field]

  if (!header) {
    return -1
  }

  const columnMatch = header.match(/^Column\s+(\d+)$/i)

  if (columnMatch) {
    const index = Number(columnMatch[1]) - 1

    return Number.isInteger(index) && index >= 0 ? index : -1
  }

  return headers.findIndex((item) => item === header)
}

function usesGenericColumnMapping(mapping: ReportFieldMapping) {
  return Object.values(mapping.fields).some((value) =>
    /^Column\s+\d+$/i.test(value ?? "")
  )
}

export function parseMappedCountryMasterCsv({
  csvText,
  targetCountries,
  monthEndId,
  period,
  mapping,
}: {
  csvText: string
  targetCountries: TemplateCountryRow[]
  monthEndId: string
  period: string
  mapping?: ReportFieldMapping
}) {
  if (!mapping) {
    return undefined
  }

  const rows = parseCsv(csvText)
  const sampleRows = rows.slice(mapping.headerRowIndex)
  const genericColumnMapping = usesGenericColumnMapping(mapping)
  const headers = genericColumnMapping
    ? sampleRows[0]?.map((_, index) => `Column ${index + 1}`)
    : sampleRows[0]
  const dataRows = genericColumnMapping ? sampleRows : sampleRows.slice(1)

  if (!headers) {
    return []
  }

  const internalIdIndex = mappedColumnIndex(
    headers,
    mapping,
    "sourceInternalId"
  )
  const dateIndex = mappedColumnIndex(headers, mapping, "transactionDate")
  const salesOrderIndex = mappedColumnIndex(
    headers,
    mapping,
    "salesOrderNumber"
  )
  const billOfLadingIndex = mappedColumnIndex(
    headers,
    mapping,
    "billOfLadingNumber"
  )
  const ctnIndex = mappedColumnIndex(headers, mapping, "ctnNumber")
  const statusIndex = mappedColumnIndex(headers, mapping, "status")
  const amountIndex = mappedColumnIndex(headers, mapping, "amount")
  const classIndex = mappedColumnIndex(headers, mapping, "sourceClass")

  if (
    salesOrderIndex < 0 &&
    billOfLadingIndex < 0 &&
    ctnIndex < 0 &&
    statusIndex < 0
  ) {
    return []
  }

  return dataRows.flatMap((row, index) => {
    const sourceInternalId =
      internalIdIndex >= 0 ? (row[internalIdIndex]?.trim() ?? "") : ""
    const sourceRowIndex = mapping.headerRowIndex + index + 2
    const sourceClass = classIndex >= 0 ? (row[classIndex]?.trim() ?? "") : ""
    const matchedCountries = sourceClass
      ? findCountries(sourceClass, targetCountries)
      : targetCountries
    const countriesToApply =
      sourceClass && matchedCountries.length
        ? [matchedCountries[0]]
        : targetCountries

    return countriesToApply.map((country) => ({
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
      salesOrderNumber:
        salesOrderIndex >= 0
          ? cleanSalesOrder(row[salesOrderIndex]?.trim() ?? "")
          : "",
      billOfLadingNumber:
        billOfLadingIndex >= 0 ? (row[billOfLadingIndex]?.trim() ?? "") : "",
      ctnNumber: ctnIndex >= 0 ? (row[ctnIndex]?.trim() ?? "") : "",
      status: statusIndex >= 0 ? (row[statusIndex]?.trim() ?? "") : "",
      amount: amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0,
      transactionDate: dateIndex >= 0 ? (row[dateIndex]?.trim() ?? "") : "",
      sourceClass: sourceClass || country.name,
      sourceInternalId,
      sourceRowIndex,
    })) satisfies MonthEndMasterRecord[]
  })
}

export async function saveMonthEndMasterRecords(
  monthEndId: string,
  records: MonthEndMasterRecord[]
) {
  if (isLocalhostBrowser()) {
    upsertLocalMasterRecords(monthEndId, records)
  }

  try {
    const supabase = getSupabaseClient()
    const { data: existingRows, error: selectError } = await supabase
      .from(tableName)
      .select("id")
      .eq("month_end_id", monthEndId)

    if (selectError) {
      throw selectError
    }

    if (records.length) {
      const error = await upsertMasterRows(supabase, records.map(toRow))

      if (error) {
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

  if (isLocalhostBrowser()) {
    upsertLocalCountryMasterRecords(monthEndId, countryIds, records)
  }

  try {
    const supabase = getSupabaseClient()
    const { data: existingRows, error: selectError } = await supabase
      .from(tableName)
      .select("id")
      .eq("month_end_id", monthEndId)
      .in("country_id", countryIds)

    if (selectError) {
      throw selectError
    }

    if (records.length) {
      const error = await upsertMasterRows(supabase, records.map(toRow))

      if (error) {
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
      upsertLocalCountryMasterRecords(monthEndId, countryIds, records)
      return
    }

    throw error
  }
}

export async function moveMonthEndMasterRecordsToCountry({
  monthEndId,
  recordIds,
  countryId,
  countryName,
}: {
  monthEndId: string
  recordIds: string[]
  countryId: string
  countryName: string
}) {
  const uniqueRecordIds = Array.from(new Set(recordIds))

  if (!uniqueRecordIds.length) {
    return []
  }

  const localMovedRecords = isLocalhostBrowser()
    ? moveLocalMasterRecordsToCountry(
        monthEndId,
        uniqueRecordIds,
        countryId,
        countryName
      )
    : []

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(tableName)
      .update({
        country_id: countryId,
        country_name: countryName,
        source_class: countryName,
      })
      .eq("month_end_id", monthEndId)
      .in("id", uniqueRecordIds)
      .select("*")

    if (error) {
      throw error
    }

    const movedRecords = (data ?? []).map((row) =>
      toRecord(row as MonthEndMasterRecordRow)
    )

    return movedRecords.length ? movedRecords : localMovedRecords
  } catch (error) {
    if (isLocalhostBrowser()) {
      return localMovedRecords
    }

    throw error
  }
}

export function getLinkedCountryRows(
  countryId: string,
  countries: TemplateCountryRow[]
) {
  return getLinkedCountryRowsFromTemplate(countryId, countries)
}

export async function listMonthEndMasterRecords({
  monthEndId,
  countryId,
}: {
  monthEndId: string
  countryId?: string
}) {
  const countryIds = countryId ? getLinkedCountryIds(countryId) : []

  try {
    const supabase = getSupabaseClient()
    let query = supabase
      .from(tableName)
      .select("*")
      .eq("month_end_id", monthEndId)
      .order("sales_order_number", { ascending: true })

    if (countryId) {
      query = query.in("country_id", countryIds)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const remoteRecords = (data ?? []).map((row) =>
      toRecord(row as MonthEndMasterRecordRow)
    )

    if (!isLocalhostBrowser()) {
      return remoteRecords
    }

    const localRecords = getLocalRecords().filter(
      (record) =>
        record.monthEndId === monthEndId &&
        (!countryId || countryIds.includes(record.countryId))
    )
    const localIds = new Set(localRecords.map((record) => record.id))
    const remoteOnlyRecords = remoteRecords.filter(
      (record) => !localIds.has(record.id)
    )

    return [...remoteOnlyRecords, ...localRecords].sort((first, second) =>
      first.salesOrderNumber.localeCompare(second.salesOrderNumber)
    )
  } catch (error) {
    if (isLocalhostBrowser()) {
      return getLocalRecords()
        .filter(
          (record) =>
            record.monthEndId === monthEndId &&
            (!countryId || countryIds.includes(record.countryId))
        )
        .sort((first, second) =>
          first.salesOrderNumber.localeCompare(second.salesOrderNumber)
        )
    }

    throw error
  }
}
