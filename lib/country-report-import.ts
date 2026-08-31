import { findCsvColumn, parseCsv } from "@/lib/csv"
import type { ReportFieldMapping } from "@/lib/month-end-template"

export type ParsedCountryReportRecord = {
  invoiceNumber: string
  ctnNumber: string
  billOfLadingNumber: string
  reference: string
  amount: number
  sourceRowCount: number
  sourceCountryName?: string
  targetCountryId?: string
}

function parseAmount(value: string | number | undefined) {
  if (typeof value === "string") {
    value = value.replace(
      /(?:EUR|\u20ac|\u00e2\u201a\u00ac|\u00c3\u00a2\u00e2\u201a\u00ac\u00c5\u00a1\u00c3\u0082\u00c2\u00ac)/gi,
      ""
    )
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  const cleanValue = (value ?? "").replace(/[$€'\s]/g, "").trim()
  const lastCommaIndex = cleanValue.lastIndexOf(",")
  const lastPeriodIndex = cleanValue.lastIndexOf(".")
  const normalized =
    lastCommaIndex >= 0 && lastCommaIndex > lastPeriodIndex
      ? cleanValue.replace(/\./g, "").replace(",", ".")
      : cleanValue.replace(/,/g, "")
  const amount = Number(normalized)

  return Number.isFinite(amount) ? amount : 0
}

function findExactCsvColumn(headers: string[], matches: string[]) {
  return headers.findIndex((header) => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]+/g, "")

    return matches.includes(normalizedHeader)
  })
}

function getRowsFromHeader(
  rows: string[][],
  matchesHeader: (headers: string[]) => boolean
) {
  const headerIndex = rows.findIndex(matchesHeader)

  return headerIndex >= 0 ? rows.slice(headerIndex) : undefined
}

function rowHasCountryReportHeaders(row: string[]) {
  const normalizedHeaders = row.map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "")
  )

  return (
    normalizedHeaders.some((header) =>
      ["ctnnumber", "ctn", "ectnnumber", "ectn"].some((match) =>
        header.includes(match)
      )
    ) &&
    normalizedHeaders.some((header) =>
      [
        "reference",
        "salesorder",
        "salesordernumber",
        "blreference",
        "billoflading",
      ].some((match) => header.includes(match))
    ) &&
    normalizedHeaders.some((header) =>
      ["amount", "price", "costofectn"].some((match) => header.includes(match))
    )
  )
}

function getCountryReportRows(csvText: string) {
  const rows = parseCsv(csvText)
  const headerIndex = rows.findIndex(rowHasCountryReportHeaders)

  return headerIndex >= 0 ? rows.slice(headerIndex) : rows
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

  return headers.findIndex((item) => item === header)
}

export function parseMappedCountryReportCsv(
  csvText: string,
  mapping?: ReportFieldMapping
) {
  if (!mapping) {
    return undefined
  }

  const rows = parseCsv(csvText)
  const [headers, ...dataRows] = rows.slice(mapping.headerRowIndex)

  if (!headers) {
    return []
  }

  const invoiceIndex = mappedColumnIndex(headers, mapping, "invoiceNumber")
  const ctnIndex = mappedColumnIndex(headers, mapping, "ctnNumber")
  const billOfLadingIndex = mappedColumnIndex(
    headers,
    mapping,
    "billOfLadingNumber"
  )
  const referenceIndex = mappedColumnIndex(headers, mapping, "reference")
  const amountIndexes = [
    mappedColumnIndex(headers, mapping, "amount"),
    mappedColumnIndex(headers, mapping, "secondaryAmount"),
    mappedColumnIndex(headers, mapping, "tertiaryAmount"),
  ].filter((index) => index >= 0)
  const sourceCountryIndex = mappedColumnIndex(
    headers,
    mapping,
    "sourceCountryName"
  )

  if (ctnIndex < 0 && billOfLadingIndex < 0 && referenceIndex < 0) {
    return []
  }

  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const invoiceNumber =
      invoiceIndex >= 0 ? (row[invoiceIndex]?.trim() ?? "") : ""
    const ctnNumber = ctnIndex >= 0 ? (row[ctnIndex]?.trim() ?? "") : ""
    const billOfLadingNumber =
      billOfLadingIndex >= 0 ? (row[billOfLadingIndex]?.trim() ?? "") : ""
    const reference =
      referenceIndex >= 0 ? (row[referenceIndex]?.trim() ?? "") : ""
    const amount = amountIndexes.reduce(
      (total, index) => total + parseAmount(row[index]),
      0
    )
    const sourceCountryName =
      sourceCountryIndex >= 0 ? (row[sourceCountryIndex]?.trim() ?? "") : ""

    if (!ctnNumber && !billOfLadingNumber && !reference && !invoiceNumber) {
      continue
    }

    const key = [
      invoiceNumber,
      ctnNumber,
      billOfLadingNumber,
      reference,
      sourceCountryName,
    ].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(
        existing?.reference ?? "",
        reference || billOfLadingNumber || ctnNumber || invoiceNumber
      ),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
      sourceCountryName: mergeReportValues(
        existing?.sourceCountryName ?? "",
        sourceCountryName
      ),
    })
  }

  return Array.from(grouped.values())
}

function getDatePeriod(value: string | undefined) {
  const rawValue = (value ?? "").trim()

  if (!rawValue) {
    return ""
  }

  const slashDateMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)

  if (slashDateMatch) {
    const month = Number(slashDateMatch[1])
    const yearValue = Number(slashDateMatch[3])
    const year = yearValue < 100 ? 2000 + yearValue : yearValue

    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`
    }
  }

  const excelSerial = Number(rawValue)
  const date =
    Number.isFinite(excelSerial) && excelSerial > 30000
      ? new Date(Math.round((excelSerial - 25569) * 86400 * 1000))
      : new Date(rawValue.replace(/\s+tt\b/i, ""))

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function periodSheetName(period: string | undefined) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return ""
  }

  const [year, month] = period.split("-")

  return `${month}.${year}`
}

function splitStatementCtns(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter((item) => /^[A-Z0-9]+$/i.test(item))
    )
  )
}

function cleanSalesOrder(value: string) {
  return value.replace(/^Sales\s*Order\s*#\s*/i, "").trim()
}

function parseSenegalAmount(value: string | undefined) {
  const normalized = (value ?? "").replace(/\s+/g, "")
  const amount = Number(normalized)

  return Number.isFinite(amount) ? amount : 0
}

function parseSenegalPaymentText(text: string) {
  if (!/Règlement\s*-/i.test(text) && !/Reglement\s*-/i.test(text)) {
    return undefined
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const records: ParsedCountryReportRecord[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const description = lines[index]
    const paymentMatch = description.match(
      /^(?:Règlement|Reglement)\s*-\s*([^-]+?)\s*-\s*(.+)$/i
    )

    if (!paymentMatch) {
      continue
    }

    const date = lines[index + 1] ?? ""
    let amountLine = lines[index + 2] ?? ""

    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(date)) {
      continue
    }

    if (!/^[\d\s.,]+$/.test(amountLine) && /^[A-Z ]+$/i.test(amountLine)) {
      amountLine = lines[index + 3] ?? ""
    }

    const ctnNumber = paymentMatch[1]?.trim() ?? ""
    const billOfLadingNumber = paymentMatch[2]?.trim() ?? ""
    const amount = parseSenegalAmount(amountLine)

    if (!ctnNumber || !billOfLadingNumber || !amount) {
      continue
    }

    records.push({
      invoiceNumber: "",
      ctnNumber,
      billOfLadingNumber,
      reference: billOfLadingNumber,
      amount,
      sourceRowCount: 1,
      sourceCountryName: "Senegal",
    })
  }

  return records
}

function getBeninPaymentPeriod(value: string | undefined) {
  const match = (value ?? "").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})at\b/i)

  if (!match) {
    return ""
  }

  return `${match[1]}-${match[2].padStart(2, "0")}`
}

function parseBeninPaymentText(
  text: string,
  options: { period?: string } = {}
) {
  if (!/AfricaCTN LLC/i.test(text) || !/ECTN reference\s*:/i.test(text)) {
    return undefined
  }

  const entries = text
    .split(/(?=^\d{4}\/\d{2}\/\d{2}at\s+\d{2}:\d{2}:\d{2}\t)/m)
    .map((entry) => entry.trim())
    .filter(Boolean)
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const entry of entries) {
    if (
      !/AfricaCTN LLC/i.test(entry) ||
      !/\bApproved\b/i.test(entry) ||
      !/\b(?:ECTN Payment|Payment of correction request)\b/i.test(entry)
    ) {
      continue
    }

    const transactionDate = entry.match(
      /^(\d{4}\/\d{2}\/\d{2}at\s+\d{2}:\d{2}:\d{2})/i
    )?.[1]

    if (
      options.period &&
      getBeninPaymentPeriod(transactionDate) !== options.period
    ) {
      continue
    }

    const ctnNumber =
      entry.match(/\bECTN reference\s*:\s*([A-Z]{2}\d{2}[A-Z0-9]+)\b/i)?.[1] ??
      ""
    const amountText =
      entry.match(/[+-]\s*[\d\s.,]+(?:â‚¬|€|EUR|Ã¢â€šÂ¬)/i)?.[0] ?? ""
    const amount = Math.abs(parseAmount(amountText))

    if (!ctnNumber || !amount) {
      continue
    }

    const existing = grouped.get(ctnNumber)

    grouped.set(ctnNumber, {
      invoiceNumber: "",
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: "",
      reference: ctnNumber,
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
      sourceCountryName: "Benin",
    })
  }

  return Array.from(grouped.values())
}

function isCreditsLedger(headers: string[]) {
  const descriptionIndex = findCsvColumn(headers, ["description"])
  const transactionIndex = findCsvColumn(headers, ["transaction"])
  const pointsIndex = findCsvColumn(headers, ["points"])

  return descriptionIndex >= 0 && transactionIndex >= 0 && pointsIndex >= 0
}

function extractCreditLedgerCtn(value: string | undefined) {
  return (value ?? "").match(/\b[A-Z]{2}\d{2}[A-Z0-9]{4,}\b/i)?.[0] ?? ""
}

function parseCreditsLedgerCsv(rows: string[][]) {
  const [headers, ...dataRows] = rows

  if (!headers || !isCreditsLedger(headers)) {
    return undefined
  }

  const descriptionIndex = findCsvColumn(headers, ["description"])
  const transactionIndex = findCsvColumn(headers, ["transaction"])
  const pointsIndex = findCsvColumn(headers, ["points"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const transaction = row[transactionIndex]?.trim().toLowerCase() ?? ""

    if (transaction !== "ectn") {
      continue
    }

    const ctnNumber = extractCreditLedgerCtn(row[descriptionIndex])

    if (!ctnNumber) {
      continue
    }

    const amount = Math.abs(parseAmount(row[pointsIndex]))
    const existing = grouped.get(ctnNumber)

    grouped.set(ctnNumber, {
      invoiceNumber: "",
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: "",
      reference: ctnNumber,
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

function isFrabemarInvoice(headers: string[]) {
  return (
    findCsvColumn(headers, ["nfacture", "facture"]) >= 0 &&
    findCsvColumn(headers, ["nferi", "feri"]) >= 0 &&
    findCsvColumn(headers, ["nproforma", "proforma"]) >= 0 &&
    findCsvColumn(headers, ["numerobl", "numbl", "bl"]) >= 0 &&
    findExactCsvColumn(headers, ["totalfaceur", "totalfac"]) >= 0
  )
}

function parseFrabemarInvoiceCsv(rows: string[][]) {
  const [headers, ...dataRows] = rows

  if (!headers || !isFrabemarInvoice(headers)) {
    return undefined
  }

  const invoiceIndex = findCsvColumn(headers, ["nfacture", "facture"])
  const ctnIndex = findCsvColumn(headers, ["nferi", "feri"])
  const referenceIndex = findCsvColumn(headers, ["nproforma", "proforma"])
  const billOfLadingIndex = findCsvColumn(headers, ["numerobl", "numbl", "bl"])
  const totalFacIndex = findExactCsvColumn(headers, ["totalfaceur", "totalfac"])
  const amountIndex =
    totalFacIndex >= 0
      ? totalFacIndex
      : findCsvColumn(headers, ["totalfaceur", "totalfac", "total"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const invoiceNumber = row[invoiceIndex]?.trim() ?? ""
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const reference = row[referenceIndex]?.trim() ?? ""
    const amount = parseAmount(row[amountIndex])

    if (!ctnNumber && !reference && !billOfLadingNumber) {
      continue
    }

    const key = [invoiceNumber, ctnNumber, billOfLadingNumber, reference].join(
      "__"
    )
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(existing?.reference ?? "", reference),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

function isCertificateReport(headers: string[]) {
  return (
    findExactCsvColumn(headers, ["besc", "bescsfg"]) >= 0 &&
    findExactCsvColumn(headers, ["val"]) >= 0 &&
    findExactCsvColumn(headers, ["status"]) >= 0 &&
    findExactCsvColumn(headers, ["bl"]) >= 0
  )
}

function parseCertificateReportCsv(rows: string[][]) {
  const [headers, ...dataRows] = rows

  if (!headers || !isCertificateReport(headers)) {
    return undefined
  }

  const bescIndex = findExactCsvColumn(headers, ["besc", "bescsfg"])
  const validationIndex = findExactCsvColumn(headers, ["val"])
  const statusIndex = findExactCsvColumn(headers, ["status"])
  const billOfLadingIndex = findExactCsvColumn(headers, ["bl"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const ctnNumber = row[bescIndex]?.trim() ?? ""
    const invoiceNumber = row[validationIndex]?.trim() ?? ""
    const status = row[statusIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""

    if (!ctnNumber || !status || !billOfLadingNumber) {
      continue
    }

    const key = [invoiceNumber, ctnNumber, billOfLadingNumber].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(existing?.reference ?? "", ctnNumber),
      amount: existing?.amount ?? 0,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

function isAngolaCtnExport(headers: string[]) {
  return (
    findExactCsvColumn(headers, ["visumreferencenumber"]) >= 0 &&
    findExactCsvColumn(headers, ["ectnnumber"]) >= 0 &&
    findExactCsvColumn(headers, ["blnumber"]) >= 0 &&
    findExactCsvColumn(headers, ["visumdate"]) >= 0 &&
    findExactCsvColumn(headers, ["dnnumber"]) >= 0 &&
    findExactCsvColumn(headers, ["createdby"]) >= 0
  )
}

function parseAngolaCtnExportCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const reportRows = getRowsFromHeader(rows, isAngolaCtnExport)
  const [headers, ...dataRows] = reportRows ?? []

  if (!headers) {
    return undefined
  }

  const ctnIndex = findExactCsvColumn(headers, ["visumreferencenumber"])
  const billOfLadingIndex = findExactCsvColumn(headers, ["blnumber"])
  const visumDateIndex = findExactCsvColumn(headers, ["visumdate"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const visumDatePeriod = getDatePeriod(row[visumDateIndex])

    if (
      !ctnNumber ||
      !billOfLadingNumber ||
      (options.period && visumDatePeriod !== options.period)
    ) {
      continue
    }

    const key = [ctnNumber, billOfLadingNumber].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber: "",
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(existing?.reference ?? "", ctnNumber),
      amount: existing?.amount ?? 0,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
      sourceCountryName: "Angola",
      targetCountryId: "angola",
    })
  }

  return Array.from(grouped.values())
}

function isRepublicOfCongoCtnExport(headers: string[]) {
  return (
    findExactCsvColumn(headers, ["visumreferencenumber"]) >= 0 &&
    findExactCsvColumn(headers, ["ectnstatus"]) >= 0 &&
    findExactCsvColumn(headers, ["blnumber"]) >= 0
  )
}

function parseRepublicOfCongoCtnExportCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const reportRows = getRowsFromHeader(rows, isRepublicOfCongoCtnExport)
  const [headers, ...dataRows] = reportRows ?? []

  if (!headers) {
    return undefined
  }

  const ctnIndex = findExactCsvColumn(headers, ["visumreferencenumber"])
  const statusIndex = findExactCsvColumn(headers, ["ectnstatus"])
  const billOfLadingIndex = findExactCsvColumn(headers, ["blnumber"])
  const visumDateIndex = findExactCsvColumn(headers, ["visumdate"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const status = row[statusIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const visumDatePeriod =
      visumDateIndex >= 0 ? getDatePeriod(row[visumDateIndex]) : ""

    if (
      !ctnNumber ||
      !status ||
      !billOfLadingNumber ||
      (options.period && visumDatePeriod !== options.period)
    ) {
      continue
    }

    const key = [ctnNumber, billOfLadingNumber].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber: "",
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(existing?.reference ?? "", ctnNumber),
      amount: existing?.amount ?? 0,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

function isSckBalanceTransactionsExport(headers: string[]) {
  return (
    findExactCsvColumn(headers, ["date"]) >= 0 &&
    findExactCsvColumn(headers, ["reason"]) >= 0 &&
    findExactCsvColumn(headers, ["amount"]) >= 0 &&
    findExactCsvColumn(headers, ["referencetype"]) >= 0 &&
    findExactCsvColumn(headers, ["referenceid"]) >= 0 &&
    findExactCsvColumn(headers, ["description"]) >= 0
  )
}

function extractSckBalanceTransactionBillOfLading(value: string | undefined) {
  return (
    (value ?? "").match(
      /\bEntry\s+(.+?)\s+(?:submission fee|rejection refund)\b/i
    )?.[1] ?? ""
  )
}

function parseSckBalanceTransactionsCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const reportRows = getRowsFromHeader(rows, isSckBalanceTransactionsExport)
  const [headers, ...dataRows] = reportRows ?? []

  if (!headers) {
    return undefined
  }

  const dateIndex = findExactCsvColumn(headers, ["date"])
  const reasonIndex = findExactCsvColumn(headers, ["reason"])
  const amountIndex = findExactCsvColumn(headers, ["amount"])
  const referenceTypeIndex = findExactCsvColumn(headers, ["referencetype"])
  const referenceIdIndex = findExactCsvColumn(headers, ["referenceid"])
  const descriptionIndex = findExactCsvColumn(headers, ["description"])
  const grouped = new Map<string, ParsedCountryReportRecord>()
  const reportRowsByPeriod = dataRows.map((row) => ({
    row,
    period: getDatePeriod(row[dateIndex]),
  }))
  const matchingPeriodRows = options.period
    ? reportRowsByPeriod.filter(({ period }) => period === options.period)
    : reportRowsByPeriod
  const uniqueReportPeriods = Array.from(
    new Set(reportRowsByPeriod.map(({ period }) => period).filter(Boolean))
  )
  const rowsToImport =
    matchingPeriodRows.length || uniqueReportPeriods.length !== 1
      ? matchingPeriodRows
      : reportRowsByPeriod.filter(
          ({ period }) => period === uniqueReportPeriods[0]
        )

  for (const { row } of rowsToImport) {
    const reason = row[reasonIndex]?.trim().toUpperCase() ?? ""
    const referenceType = row[referenceTypeIndex]?.trim().toUpperCase() ?? ""
    const invoiceNumber = row[referenceIdIndex]?.trim() ?? ""
    const billOfLadingNumber = extractSckBalanceTransactionBillOfLading(
      row[descriptionIndex]
    )

    if (
      referenceType !== "ENTRY" ||
      (reason !== "CONSUMPTION" && reason !== "REFUND") ||
      !invoiceNumber ||
      !billOfLadingNumber
    ) {
      continue
    }

    const sign = reason === "REFUND" ? -1 : 1
    const amount = Math.abs(parseAmount(row[amountIndex])) * sign
    const key = [invoiceNumber, billOfLadingNumber].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: "",
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(
        existing?.reference ?? "",
        billOfLadingNumber
      ),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values()).filter(
    (record) => record.amount !== 0 || record.sourceRowCount === 1
  )
}

function parseSckStatementOfAccountCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const reportRows = getRowsFromHeader(rows, (headers) => {
    const countryIndex = findExactCsvColumn(headers, ["country"])
    const billOfLadingIndex = findExactCsvColumn(headers, [
      "blno",
      "billoflading",
      "blnumber",
    ])
    const bescIndex = findExactCsvColumn(headers, ["besc", "ctnnumber", "ctn"])
    const amountIndex = findExactCsvColumn(headers, ["amount"])
    const invoiceIndex = findExactCsvColumn(headers, [
      "invoicenumber",
      "invoice",
    ])
    const dateIndex = findExactCsvColumn(headers, ["date"])

    return (
      countryIndex >= 0 &&
      billOfLadingIndex >= 0 &&
      bescIndex >= 0 &&
      amountIndex >= 0 &&
      invoiceIndex >= 0 &&
      dateIndex >= 0
    )
  })
  const [headers, ...dataRows] = reportRows ?? []

  if (!headers) {
    return undefined
  }

  const countryIndex = findExactCsvColumn(headers, ["country"])
  const billOfLadingIndex = findExactCsvColumn(headers, [
    "blno",
    "billoflading",
    "blnumber",
  ])
  const bescIndex = findExactCsvColumn(headers, ["besc", "ctnnumber", "ctn"])
  const amountIndex = findExactCsvColumn(headers, ["amount"])
  const invoiceIndex = findExactCsvColumn(headers, ["invoicenumber", "invoice"])
  const dateIndex = findExactCsvColumn(headers, ["date"])
  const rowsToImport = options.period
    ? dataRows.filter((row) => getDatePeriod(row[dateIndex]) === options.period)
    : dataRows

  return rowsToImport.flatMap((row) => {
    const invoiceNumber = row[invoiceIndex]?.trim() ?? ""
    const ctnNumber = row[bescIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const sourceCountryName = row[countryIndex]?.trim() ?? ""

    if (!invoiceNumber && !ctnNumber && !billOfLadingNumber) {
      return []
    }

    return [
      {
        invoiceNumber,
        ctnNumber,
        billOfLadingNumber,
        reference: billOfLadingNumber || ctnNumber || invoiceNumber,
        amount: parseAmount(row[amountIndex]),
        sourceRowCount: 1,
        sourceCountryName,
      },
    ]
  })
}

function parseForemostStatementOfAccountCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const reportRows = getRowsFromHeader(rows, (headers) => {
    const normalizedHeaders = headers.map((header) =>
      header.toLowerCase().replace(/[^a-z0-9]+/g, "")
    )

    return (
      normalizedHeaders.includes("date") &&
      normalizedHeaders.includes("dnno") &&
      normalizedHeaders.includes("ectnno") &&
      normalizedHeaders.some((header) => header.includes("chargesdr"))
    )
  })
  const [headers, ...dataRows] = reportRows ?? []

  if (!headers) {
    return undefined
  }

  const dateIndex = findExactCsvColumn(headers, ["date"])
  const documentIndex = findExactCsvColumn(headers, ["dnno"])
  const ectnIndex = findExactCsvColumn(headers, ["ectnno"])
  const chargeIndex = headers.findIndex((header) =>
    header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .includes("chargesdr")
  )

  return dataRows.flatMap((row) => {
    const transactionDate = row[dateIndex]?.trim() ?? ""
    const documentNumber = row[documentIndex]?.trim() ?? ""
    const ectnValue = row[ectnIndex]?.trim() ?? ""
    const amount = parseAmount(row[chargeIndex])

    if (
      !transactionDate ||
      getDatePeriod(transactionDate) !== options.period ||
      !documentNumber ||
      !amount ||
      /^(balance|total amount)$/i.test(transactionDate) ||
      /received payment|bank charges|balance/i.test(ectnValue)
    ) {
      return []
    }

    const isAngolaRow = /^ARCCLA\b/i.test(documentNumber)
    const billOfLadingNumber =
      ectnValue.match(/\bBL\s*-\s*(.+?)(?:\s+CANCELLED)?$/i)?.[1]?.trim() ?? ""
    const ctnNumbers = isAngolaRow ? [""] : splitStatementCtns(ectnValue)
    const splitAmount = ctnNumbers.length ? amount / ctnNumbers.length : amount

    return ctnNumbers.map((ctnNumber) => ({
      invoiceNumber: documentNumber,
      ctnNumber,
      billOfLadingNumber,
      reference: isAngolaRow
        ? billOfLadingNumber || documentNumber
        : ctnNumber || documentNumber,
      amount: splitAmount,
      sourceRowCount: 1,
      sourceCountryName: isAngolaRow ? "Angola" : "Chad",
      targetCountryId: isAngolaRow ? "angola" : undefined,
    }))
  })
}

function parseNetsuiteCountryReportCsv(
  rows: string[][],
  options: { period?: string } = {}
) {
  const [headers, ...dataRows] = rows

  if (!headers) {
    return undefined
  }

  const dateIndex = findExactCsvColumn(headers, ["date"])
  const billOfLadingIndex = findExactCsvColumn(headers, ["billoflading"])
  const ctnIndex = findExactCsvColumn(headers, ["ctnnumber"])
  const statusIndex = findExactCsvColumn(headers, ["ctnstatus"])
  const salesOrderIndex = findExactCsvColumn(headers, ["createdfrom"])
  const classIndex = findExactCsvColumn(headers, ["classnohierarchy", "class"])
  const amountIndex = findExactCsvColumn(headers, ["amount"])

  if (
    dateIndex === -1 ||
    billOfLadingIndex === -1 ||
    ctnIndex === -1 ||
    statusIndex === -1 ||
    salesOrderIndex === -1 ||
    classIndex === -1 ||
    amountIndex === -1
  ) {
    return undefined
  }

  return dataRows.flatMap((row) => {
    const date = row[dateIndex]?.trim() ?? ""

    if (options.period && getDatePeriod(date) !== options.period) {
      return []
    }

    const invoiceNumber = cleanSalesOrder(row[salesOrderIndex]?.trim() ?? "")
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const amount = parseAmount(row[amountIndex])
    const sourceCountryName = row[classIndex]?.trim() ?? ""

    if (!invoiceNumber && !ctnNumber && !billOfLadingNumber) {
      return []
    }

    return [
      {
        invoiceNumber,
        ctnNumber,
        billOfLadingNumber,
        reference: billOfLadingNumber || ctnNumber || invoiceNumber,
        amount,
        sourceRowCount: 1,
        sourceCountryName,
      },
    ]
  })
}

function isLiberiaInvoiceExport(headers: string[]) {
  return (
    findExactCsvColumn(headers, ["invoice"]) >= 0 &&
    findExactCsvColumn(headers, ["bl"]) >= 0 &&
    findExactCsvColumn(headers, ["booking"]) >= 0 &&
    findExactCsvColumn(headers, ["total"]) >= 0 &&
    findExactCsvColumn(headers, ["ctnnet"]) >= 0
  )
}

function parseLiberiaInvoiceExportCsv(rows: string[][]) {
  const [headers, ...dataRows] = rows

  if (!headers || !isLiberiaInvoiceExport(headers)) {
    return undefined
  }

  const invoiceIndex = findExactCsvColumn(headers, ["invoice"])
  const billOfLadingIndex = findExactCsvColumn(headers, ["bl"])
  const bookingIndex = findExactCsvColumn(headers, ["booking"])
  const totalIndex = findExactCsvColumn(headers, ["total"])
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const invoiceNumber = row[invoiceIndex]?.trim() ?? ""
    const billOfLadingNumber = row[billOfLadingIndex]?.trim() ?? ""
    const bookingNumber = row[bookingIndex]?.trim() ?? ""
    const amount = parseAmount(row[totalIndex])

    if (!invoiceNumber && !billOfLadingNumber && !bookingNumber) {
      continue
    }

    const key = [invoiceNumber, billOfLadingNumber, bookingNumber].join("__")
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", bookingNumber),
      billOfLadingNumber: mergeReportValues(
        existing?.billOfLadingNumber ?? "",
        billOfLadingNumber
      ),
      reference: mergeReportValues(
        existing?.reference ?? "",
        billOfLadingNumber || bookingNumber
      ),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

export function normalizeCountryReportReference(
  value: string | undefined | null
) {
  const trimmed = (value ?? "").trim()

  return trimmed.replace(/^(\d+)[A-Z]+$/i, "$1")
}

export function mergeReportValues(
  existing: string | undefined | null,
  next: string | undefined | null
) {
  const values = [existing, next]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)

  return Array.from(new Set(values)).join(", ")
}

function compactLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function findNextNumber(lines: string[], label: string) {
  const labelIndex = lines.findIndex((line) => line === label)

  if (labelIndex === -1) {
    return ""
  }

  return lines.slice(labelIndex + 1).find((line) => /^\d+$/.test(line)) ?? ""
}

export function parseAntaserInvoiceText(text: string) {
  const lines = compactLines(text)
  const invoiceNumber =
    findNextNumber(lines, "Our ref:") || findNextNumber(lines, "Doc. number")
  const startIndex = lines.findIndex((line) => line === "Price") + 1
  const endIndex = lines.findIndex((line) =>
    /^Vrijstelling|^Exemption|^VAT$|^Subtotal$/i.test(line)
  )
  const itemLines =
    startIndex > 0
      ? lines.slice(startIndex, endIndex > startIndex ? endIndex : undefined)
      : lines
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (let index = 0; index < itemLines.length; index += 1) {
    const ctnNumber = itemLines[index] ?? ""

    if (!/^BE\/[A-Z]{2}\/\d{2}\/\d+/i.test(ctnNumber)) {
      continue
    }

    const reference = normalizeCountryReportReference(
      itemLines[index + 1] ?? ""
    )
    const dateOrDescription = itemLines[index + 3] ?? ""
    const price = itemLines[index + 4] ?? ""

    if (!/^\d{2}-\d{2}-\d{4}$/.test(dateOrDescription)) {
      continue
    }

    const key = [invoiceNumber, reference].join("__")
    const existing = grouped.get(key)
    const amount = parseAmount(price)
    const countryCode = ctnNumber.match(/^BE\/([A-Z]{2})\//i)?.[1]
    const sourceCountryName = countryCode
      ? antaserCountryNameByCode[countryCode.toUpperCase()]
      : undefined

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: "",
      reference,
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
      sourceCountryName,
    })
  }

  return Array.from(grouped.values())
}

const antaserCountryNameByCode: Record<string, string> = {
  BI: "Burundi",
  CF: "Central African Republic",
  GQ: "Equatorial Guinea",
  GW: "Guinea-Bissau",
  NE: "Niger",
  SS: "South Sudan",
  TG: "Togo",
}

export type AntaserJournalDocumentKind =
  "regular-invoice" | "regular-overview" | "oot-invoice" | "commission"

export type AntaserJournalDocument = {
  kind: AntaserJournalDocumentKind
  documentNumber: string
  countryTotals: Record<string, number>
  sourceFileName?: string
}

function antaserDocumentNumber(lines: string[]) {
  return (
    findNextNumber(lines, "Our ref:") || findNextNumber(lines, "Doc. number")
  )
}

function parseAntaserCountrySectionTotals(
  lines: string[],
  totalLabel: "Total:" | "Subtotal"
) {
  const normalizeCountryHeading = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
  const countryNames = Object.values(antaserCountryNameByCode)
  const countryNameByKey = new Map(
    countryNames.map((countryName) => [
      normalizeCountryHeading(countryName),
      countryName,
    ])
  )
  const totals: Record<string, number> = {}

  for (let index = 0; index < lines.length; index += 1) {
    const countryName = countryNameByKey.get(
      normalizeCountryHeading(lines[index] ?? "")
    )

    if (!countryName) {
      continue
    }

    const nextCountryOffset = lines
      .slice(index + 1)
      .findIndex((line) => countryNameByKey.has(normalizeCountryHeading(line)))
    const endIndex =
      nextCountryOffset >= 0 ? index + 1 + nextCountryOffset : lines.length
    const sectionLines = lines.slice(index + 1, endIndex)
    const totalIndex = sectionLines.findIndex((line) => line === totalLabel)

    if (totalIndex >= 0) {
      totals[countryName] = parseAmount(sectionLines[totalIndex + 1])
    }
  }

  return totals
}

export function parseAntaserJournalDocumentText(
  text: string
): AntaserJournalDocument | undefined {
  if (!/Antaser(?: Afrique)? BV/i.test(text)) {
    return undefined
  }

  const lines = compactLines(text)
  const documentNumber = antaserDocumentNumber(lines)

  if (/COMMISSION NOTE/i.test(text)) {
    return {
      kind: "commission",
      documentNumber,
      countryTotals: parseAntaserCountrySectionTotals(lines, "Subtotal"),
    }
  }

  if (!/\bINVOICE\b/i.test(text)) {
    return undefined
  }

  const invoiceRecords = parseAntaserInvoiceText(text)

  if (/JACR\s*Shipping\d*/i.test(text)) {
    const countryTotals: Record<string, number> = {}

    for (const record of invoiceRecords) {
      const countryCode = record.ctnNumber.match(/^BE\/([A-Z]{2})\//i)?.[1]
      const countryName = countryCode
        ? antaserCountryNameByCode[countryCode.toUpperCase()]
        : undefined

      if (countryName) {
        countryTotals[countryName] =
          (countryTotals[countryName] ?? 0) + record.amount
      }
    }

    return {
      kind: "oot-invoice",
      documentNumber,
      countryTotals,
    }
  }

  if (/Commercial Intl\.? Services/i.test(text) && !invoiceRecords.length) {
    return {
      kind: "regular-overview",
      documentNumber,
      countryTotals: parseAntaserCountrySectionTotals(lines, "Total:"),
    }
  }

  if (/Commercial Intl\.? Services/i.test(text) && invoiceRecords.length) {
    return {
      kind: "regular-invoice",
      documentNumber,
      countryTotals: {},
    }
  }

  return undefined
}

export function parseIvoryCoastStatementText(text: string) {
  if (
    !/STATEMENT OF ACCOUNT/i.test(text) ||
    !/Processing of BSC #/i.test(text)
  ) {
    return []
  }

  const lines = compactLines(text)
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (let index = 0; index < lines.length; index += 1) {
    const processingMatch = lines[index]?.match(
      /^Processing of BSC #\s*(CIIMP-\d+)/i
    )
    const cancellationMatch = lines[index]?.match(
      /^Cancel of Invoice#(CIIMP-\d+\/\d+)/i
    )

    if (!processingMatch && !cancellationMatch) {
      continue
    }

    const invoiceNumber =
      cancellationMatch?.[1] ??
      lines.slice(index + 1).find((line) => /^CIIMP-\d+\/\d+$/i.test(line)) ??
      ""
    const ctnNumber =
      processingMatch?.[1] ?? invoiceNumber.replace(/\/\d+$/i, "")
    const amountLine = lines
      .slice(index + 1, index + 6)
      .find((line) => /^[+-]\s*[\d'.,]+\s*(?:€|EUR|â‚¬)?$/i.test(line))

    if (!invoiceNumber || !ctnNumber || !amountLine) {
      continue
    }

    const sign = amountLine.trim().startsWith("+") ? -1 : 1
    const amount = Math.abs(parseAmount(amountLine)) * sign
    const existing = grouped.get(invoiceNumber)

    grouped.set(invoiceNumber, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: "",
      reference: mergeReportValues(existing?.reference ?? "", ctnNumber),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values()).filter(
    (record) => record.amount !== 0 || record.sourceRowCount === 1
  )
}

export function parseCountryReportCsv(
  csvText: string,
  options: { period?: string } = {}
) {
  const rawRows = parseCsv(csvText)
  const creditsLedgerRecords = parseCreditsLedgerCsv(rawRows)

  if (creditsLedgerRecords) {
    return creditsLedgerRecords
  }

  const frabemarInvoiceRecords = parseFrabemarInvoiceCsv(rawRows)

  if (frabemarInvoiceRecords) {
    return frabemarInvoiceRecords
  }

  const certificateRecords = parseCertificateReportCsv(rawRows)

  if (certificateRecords) {
    return certificateRecords
  }

  const angolaRecords = parseAngolaCtnExportCsv(rawRows, options)

  if (angolaRecords) {
    return angolaRecords
  }

  const republicOfCongoRecords = parseRepublicOfCongoCtnExportCsv(
    rawRows,
    options
  )

  if (republicOfCongoRecords) {
    return republicOfCongoRecords
  }

  const sckBalanceTransactionRecords = parseSckBalanceTransactionsCsv(
    rawRows,
    options
  )

  if (sckBalanceTransactionRecords) {
    return sckBalanceTransactionRecords
  }

  const sckStatementOfAccountRecords = parseSckStatementOfAccountCsv(
    rawRows,
    options
  )

  if (sckStatementOfAccountRecords) {
    return sckStatementOfAccountRecords
  }

  const foremostStatementRecords = parseForemostStatementOfAccountCsv(
    rawRows,
    options
  )

  if (foremostStatementRecords) {
    return foremostStatementRecords
  }

  const netsuiteCountryReportRecords = parseNetsuiteCountryReportCsv(
    rawRows,
    options
  )

  if (netsuiteCountryReportRecords) {
    return netsuiteCountryReportRecords
  }

  const liberiaInvoiceRecords = parseLiberiaInvoiceExportCsv(rawRows)

  if (liberiaInvoiceRecords) {
    return liberiaInvoiceRecords
  }

  const rows = getCountryReportRows(csvText)
  const [headers, ...dataRows] = rows

  if (!headers) {
    return []
  }

  const invoiceIndex = findCsvColumn(headers, ["invoice", "docnumber"])
  const ctnIndex = findCsvColumn(headers, [
    "ctnnumber",
    "ectnnumber",
    "ctn",
    "ectn",
  ])
  const billOfLadingIndex = findCsvColumn(headers, [
    "billoflading",
    "blreference",
    "bol",
    "bl",
    "blnumber",
  ])
  const referenceIndex = findCsvColumn(headers, [
    "reference",
    "blreference",
    "billoflading",
    "salesorder",
    "salesordernumber",
  ])
  const bescAmountIndexes = [
    findCsvColumn(headers, ["costofectn"]),
    findCsvColumn(headers, ["costofcorrections"]),
    findCsvColumn(headers, ["costofthepenaltycfa", "penalty"]),
  ].filter((index) => index >= 0)
  const amountIndex =
    bescAmountIndexes[0] ?? findCsvColumn(headers, ["amount", "price", "total"])

  if (
    ctnIndex === -1 ||
    referenceIndex === -1 ||
    (amountIndex === -1 && bescAmountIndexes.length === 0)
  ) {
    throw new Error(
      "The country report CSV must include CTN, reference, and amount columns."
    )
  }

  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const invoiceNumber =
      invoiceIndex >= 0 ? (row[invoiceIndex]?.trim() ?? "") : ""
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const billOfLadingNumber =
      billOfLadingIndex >= 0 ? (row[billOfLadingIndex]?.trim() ?? "") : ""
    const reference = row[referenceIndex]?.trim() ?? ""
    const amount = bescAmountIndexes.length
      ? bescAmountIndexes.reduce(
          (total, index) => total + parseAmount(row[index]),
          0
        )
      : parseAmount(row[amountIndex])
    const key = [invoiceNumber, ctnNumber, billOfLadingNumber, reference].join(
      "__"
    )
    const existing = grouped.get(key)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber,
      billOfLadingNumber,
      reference,
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values()).filter(
    (record) => record.ctnNumber || record.reference
  )
}

export function parseCountryReportText(
  text: string,
  options: { period?: string } = {}
) {
  const beninPaymentRecords = parseBeninPaymentText(text, options)

  if (beninPaymentRecords) {
    return beninPaymentRecords
  }

  const senegalPaymentRecords = parseSenegalPaymentText(text)

  if (senegalPaymentRecords) {
    return senegalPaymentRecords
  }

  return parseCountryReportCsv(text, options)
}

export async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  const document = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()

    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join("\n")
    )
  }

  return pages.join("\n")
}

export async function extractWorkbookRows(
  file: File,
  options: { period?: string } = {}
) {
  const xlsx = await import("xlsx")
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" })
  const targetSheetName = periodSheetName(options.period)
  const sheetName =
    workbook.SheetNames.find(
      (name) => name.trim().toLowerCase() === targetSheetName.toLowerCase()
    ) ?? workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined

  if (!sheet) {
    return ""
  }

  return xlsx.utils.sheet_to_csv(sheet)
}

export async function parseCountryReportFile(
  file: File,
  options: { period?: string } = {}
) {
  return (await parseCountryReportUploadFile(file, options)).records
}

export async function parseCountryReportUploadFile(
  file: File,
  options: { period?: string } = {}
) {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "pdf" || file.type === "application/pdf") {
    const text = await extractPdfText(file)
    const ivoryCoastRecords = parseIvoryCoastStatementText(text)
    const antaserJournalDocument = parseAntaserJournalDocumentText(text)
    const records = ivoryCoastRecords.length
      ? ivoryCoastRecords
      : parseAntaserInvoiceText(text)

    return {
      records,
      antaserJournalDocument: antaserJournalDocument
        ? { ...antaserJournalDocument, sourceFileName: file.name }
        : undefined,
    }
  }

  if (extension === "xlsx" || extension === "xls") {
    return {
      records: parseCountryReportCsv(
        await extractWorkbookRows(file, options),
        options
      ),
    }
  }

  return { records: parseCountryReportText(await file.text(), options) }
}
