import type { QuoteCatalogItem } from "@/lib/quote-items-catalog"

const requiredColumns = [
  "Internal ID",
  "Name",
  "Class (no hierarchy)",
  "Description",
  "Base Price",
  "Tariff in USD",
  "Tariff in Euros",
  "Pricing Group",
  "Sorting Field",
  "Bulk Units",
  "Zone EA",
  "Country Name",
]

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const nextChar = csv[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }

      row.push(field)
      if (row.some((value) => value.trim())) {
        rows.push(row)
      }
      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((value) => value.trim())) {
    rows.push(row)
  }

  return rows
}

function csvNumber(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseQuotePricingCsv(csv: string) {
  const rows = parseCsvRows(csv)
  const headers = rows[0]?.map((header) => header.trim()) ?? []
  const missingColumns = requiredColumns.filter(
    (column) => !headers.includes(column)
  )

  if (missingColumns.length) {
    throw new Error(`Missing columns: ${missingColumns.join(", ")}`)
  }

  const headerIndex = new Map(headers.map((header, index) => [header, index]))
  const value = (row: string[], header: string) =>
    row[headerIndex.get(header) ?? -1]?.trim() ?? ""

  return rows
    .slice(1)
    .map((row): QuoteCatalogItem => {
      const zone = value(row, "Zone EA")

      return {
        internalId: value(row, "Internal ID"),
        name: value(row, "Name"),
        className: value(row, "Class (no hierarchy)"),
        description: value(row, "Description"),
        basePrice: csvNumber(value(row, "Base Price")),
        tariffUsd: csvNumber(value(row, "Tariff in USD")),
        tariffEur: csvNumber(value(row, "Tariff in Euros")),
        pricingGroup: value(row, "Pricing Group"),
        sortingField: value(row, "Sorting Field"),
        bulkUnits: value(row, "Bulk Units"),
        zone: zone || "ROW",
        countryName: value(row, "Country Name"),
      }
    })
    .filter((item) => item.internalId && item.name && item.countryName)
}
