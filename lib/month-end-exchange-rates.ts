import { parseCsv } from "@/lib/csv"
import {
  normalizeExchangeRateText,
  parseExchangeRate,
} from "@/lib/exchange-rate"
import type { TemplateCountryRow } from "@/lib/month-end-template"

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function parseExchangeRates(
  csvText: string,
  countries: TemplateCountryRow[]
) {
  const rows = parseCsv(csvText)
  const [headers, ...dataRows] = rows

  if (!headers) {
    throw new Error("The exchange rate CSV is empty.")
  }

  const accountIndex = headers.findIndex((header) =>
    normalizeMatch(header).includes("account")
  )
  const rateIndex = headers.findIndex((header) =>
    normalizeMatch(header).includes("exchangerate")
  )
  const dateIndex = headers.findIndex((header) =>
    normalizeMatch(header).includes("date")
  )

  if (accountIndex === -1 || rateIndex === -1) {
    throw new Error("The CSV must include Account and Exchange Rate columns.")
  }

  const rowByName = new Map(
    countries
      .filter((country) => country.checkable !== false)
      .map((country) => [normalizeMatch(country.name), country])
  )
  const latestByCountry = new Map<
    string,
    { country: TemplateCountryRow; date: number; rate: number; display: string }
  >()

  for (const csvRow of dataRows) {
    const account = csvRow[accountIndex]?.trim()
    const rawRate = csvRow[rateIndex]?.trim()

    if (!account || !rawRate) {
      continue
    }

    const countryName = account.split(":").at(-1)?.trim() ?? account
    const country = rowByName.get(normalizeMatch(countryName))
    const rate = parseExchangeRate(rawRate)

    if (!country || rate === undefined) {
      continue
    }

    const parsedDate = dateIndex >= 0 ? Date.parse(csvRow[dateIndex] ?? "") : 0
    const date = Number.isNaN(parsedDate) ? 0 : parsedDate
    const existing = latestByCountry.get(country.id)

    if (!existing || date >= existing.date) {
      latestByCountry.set(country.id, {
        country,
        date,
        rate,
        display: normalizeExchangeRateText(rawRate),
      })
    }
  }

  return Array.from(latestByCountry.values())
}
