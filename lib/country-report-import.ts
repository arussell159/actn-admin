import { findCsvColumn, parseCsv } from "@/lib/csv"

export type ParsedCountryReportRecord = {
  invoiceNumber: string
  ctnNumber: string
  billOfLadingNumber: string
  reference: string
  amount: number
  sourceRowCount: number
}

function parseAmount(value: string | undefined) {
  const normalized = (value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[$€]/g, "")
    .trim()
  const amount = Number(normalized)

  return Number.isFinite(amount) ? amount : 0
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

export function parseCountryReportCsv(csvText: string) {
  const rawRows = parseCsv(csvText)
  const creditsLedgerRecords = parseCreditsLedgerCsv(rawRows)

  if (creditsLedgerRecords) {
    return creditsLedgerRecords
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

export async function parseCountryReportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "pdf" || file.type === "application/pdf") {
    return parseAntaserInvoiceText(await extractPdfText(file))
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseCountryReportCsv(await extractWorkbookRows(file))
  }

  return parseCountryReportCsv(await file.text())
}
