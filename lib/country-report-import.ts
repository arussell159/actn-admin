import { findCsvColumn, parseCsv } from "@/lib/csv"

export type ParsedCountryReportRecord = {
  invoiceNumber: string
  ctnNumber: string
  billOfLadingNumber: string
  reference: string
  amount: number
  sourceRowCount: number
}

function parseAmount(value: string | number | undefined) {
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
      ["amount", "price", "costofectn"].some((match) =>
        header.includes(match)
      )
    )
  )
}

function getCountryReportRows(csvText: string) {
  const rows = parseCsv(csvText)
  const headerIndex = rows.findIndex(rowHasCountryReportHeaders)

  return headerIndex >= 0 ? rows.slice(headerIndex) : rows
}

function getDatePeriod(value: string | undefined) {
  const rawValue = (value ?? "").trim()

  if (!rawValue) {
    return ""
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
    findExactCsvColumn(headers, ["besc"]) >= 0 &&
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

  const bescIndex = findExactCsvColumn(headers, ["besc"])
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
  return (value ?? "").match(/\bEntry\s+(.+?)\s+(?:submission fee|rejection refund)\b/i)?.[1] ?? ""
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

  for (const row of dataRows) {
    const reason = row[reasonIndex]?.trim().toUpperCase() ?? ""
    const referenceType = row[referenceTypeIndex]?.trim().toUpperCase() ?? ""
    const invoiceNumber = row[referenceIdIndex]?.trim() ?? ""
    const billOfLadingNumber = extractSckBalanceTransactionBillOfLading(
      row[descriptionIndex]
    )
    const transactionPeriod = getDatePeriod(row[dateIndex])

    if (
      referenceType !== "ENTRY" ||
      (reason !== "CONSUMPTION" && reason !== "REFUND") ||
      !invoiceNumber ||
      !billOfLadingNumber ||
      (options.period && transactionPeriod !== options.period)
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
      reference: mergeReportValues(existing?.reference ?? "", billOfLadingNumber),
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values()).filter(
    (record) => record.amount !== 0 || record.sourceRowCount === 1
  )
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

export function normalizeCountryReportReference(value: string | undefined | null) {
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
  const invoiceNumber = findNextNumber(lines, "Our ref:") || findNextNumber(lines, "Doc. number")
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

    const reference = normalizeCountryReportReference(itemLines[index + 1] ?? "")
    const dateOrDescription = itemLines[index + 3] ?? ""
    const price = itemLines[index + 4] ?? ""

    if (!/^\d{2}-\d{2}-\d{4}$/.test(dateOrDescription)) {
      continue
    }

    const key = [invoiceNumber, reference].join("__")
    const existing = grouped.get(key)
    const amount = parseAmount(price)

    grouped.set(key, {
      invoiceNumber,
      ctnNumber: mergeReportValues(existing?.ctnNumber ?? "", ctnNumber),
      billOfLadingNumber: "",
      reference,
      amount: (existing?.amount ?? 0) + amount,
      sourceRowCount: (existing?.sourceRowCount ?? 0) + 1,
    })
  }

  return Array.from(grouped.values())
}

export function parseIvoryCoastStatementText(text: string) {
  if (!/STATEMENT OF ACCOUNT/i.test(text) || !/Processing of BSC #/i.test(text)) {
    return []
  }

  const lines = compactLines(text)
  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (let index = 0; index < lines.length; index += 1) {
    const processingMatch = lines[index]?.match(/^Processing of BSC #\s*(CIIMP-\d+)/i)
    const cancellationMatch = lines[index]?.match(/^Cancel of Invoice#(CIIMP-\d+\/\d+)/i)

    if (!processingMatch && !cancellationMatch) {
      continue
    }

    const invoiceNumber =
      cancellationMatch?.[1] ??
      lines.slice(index + 1).find((line) => /^CIIMP-\d+\/\d+$/i.test(line)) ??
      ""
    const ctnNumber = processingMatch?.[1] ?? invoiceNumber.replace(/\/\d+$/i, "")
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

  const republicOfCongoRecords = parseRepublicOfCongoCtnExportCsv(rawRows, options)

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
    bescAmountIndexes[0] ??
    findCsvColumn(headers, ["amount", "price", "total"])

  if (
    ctnIndex === -1 ||
    referenceIndex === -1 ||
    (amountIndex === -1 && bescAmountIndexes.length === 0)
  ) {
    throw new Error("The country report CSV must include CTN, reference, and amount columns.")
  }

  const grouped = new Map<string, ParsedCountryReportRecord>()

  for (const row of dataRows) {
    const invoiceNumber = invoiceIndex >= 0 ? row[invoiceIndex]?.trim() ?? "" : ""
    const ctnNumber = row[ctnIndex]?.trim() ?? ""
    const billOfLadingNumber =
      billOfLadingIndex >= 0 ? row[billOfLadingIndex]?.trim() ?? "" : ""
    const reference = row[referenceIndex]?.trim() ?? ""
    const amount = bescAmountIndexes.length
      ? bescAmountIndexes.reduce((total, index) => total + parseAmount(row[index]), 0)
      : parseAmount(row[amountIndex])
    const key = [invoiceNumber, ctnNumber, billOfLadingNumber, reference].join("__")
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

async function extractPdfText(file: File) {
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

    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join("\n"))
  }

  return pages.join("\n")
}

async function extractWorkbookRows(file: File) {
  const xlsx = await import("xlsx")
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" })
  const sheetName = workbook.SheetNames[0]
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
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "pdf" || file.type === "application/pdf") {
    const text = await extractPdfText(file)
    const ivoryCoastRecords = parseIvoryCoastStatementText(text)

    return ivoryCoastRecords.length ? ivoryCoastRecords : parseAntaserInvoiceText(text)
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseCountryReportCsv(await extractWorkbookRows(file), options)
  }

  return parseCountryReportCsv(await file.text(), options)
}
