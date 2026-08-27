"use client"

import * as React from "react"
import { FileSpreadsheetIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  exchangeRateKey,
  formatPeriod,
  getNextPeriod,
  listMonthEndRecords,
  saveMonthEndRecord,
  withMonthEndTitle,
  type MonthEndRecord,
  type MonthEndValue,
} from "@/lib/month-end-db"
import {
  getMonthEndTemplate,
  type TemplateCountryRow,
} from "@/lib/month-end-template"

const months = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

function defaultPeriodParts() {
  const date = new Date()
  date.setMonth(date.getMonth() - 1)

  return {
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear()),
  }
}

function periodParts(period: string) {
  const [year, month] = period.split("-")

  return { month, year }
}

function suggestedPeriod(existingRecords: MonthEndRecord[]) {
  const latestPeriod = existingRecords
    .map((record) => record.period)
    .filter((period) => /^\d{4}-\d{2}$/.test(period))
    .sort()
    .at(-1)

  return latestPeriod ? periodParts(getNextPeriod(latestPeriod)) : defaultPeriodParts()
}

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
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
      if (row.some((cell) => cell.trim())) {
        rows.push(row)
      }
      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.trim())) {
    rows.push(row)
  }

  return rows
}

function parseExchangeRates(csvText: string, countries: TemplateCountryRow[]) {
  const rows = parseCsv(csvText)
  const [headers, ...dataRows] = rows
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
    { country: TemplateCountryRow; date: number; rate: number }
  >()

  for (const csvRow of dataRows) {
    const account = csvRow[accountIndex]?.trim()
    const rawRate = csvRow[rateIndex]?.trim()

    if (!account || !rawRate) {
      continue
    }

    const countryName = account.split(":").at(-1)?.trim() ?? account
    const country = rowByName.get(normalizeMatch(countryName))
    const rate = Number(rawRate)

    if (!country || !Number.isFinite(rate)) {
      continue
    }

    const date = dateIndex >= 0 ? Date.parse(csvRow[dateIndex] ?? "") : 0
    const existing = latestByCountry.get(country.id)

    if (!existing || date >= existing.date) {
      latestByCountry.set(country.id, {
        country,
        date: Number.isNaN(date) ? 0 : date,
        rate: Math.round(rate * 100) / 100,
      })
    }
  }

  return Array.from(latestByCountry.values())
}

function getCreateErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not create month end."

  if (/row-level security|permission denied|violates row-level/i.test(message)) {
    return "Supabase blocked this month-end write. Make sure you are signed in and the month_end_records table allows authenticated users to insert and update."
  }

  if (/JWT|auth|unauthorized|not authenticated/i.test(message)) {
    return "You are not signed in with a valid Supabase session. Sign out, sign back in, and try again."
  }

  if (/Missing NEXT_PUBLIC_SUPABASE_URL|PUBLISHABLE_KEY/i.test(message)) {
    return "Supabase is not configured for this app."
  }

  return message
}

export function NewMonthEndForm({
  existingRecords,
  onCancel,
  onCreated,
}: {
  existingRecords: MonthEndRecord[]
  onCancel?: () => void
  onCreated: (record: MonthEndRecord) => void
}) {
  const defaults = React.useMemo(
    () => suggestedPeriod(existingRecords),
    [existingRecords]
  )
  const currentYear = Number(defaults.year)
  const years = React.useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => String(currentYear - 2 + index)),
    [currentYear]
  )
  const [month, setMonth] = React.useState(defaults.month)
  const [year, setYear] = React.useState(defaults.year)
  const [csvFileName, setCsvFileName] = React.useState("")
  const [csvText, setCsvText] = React.useState("")
  const [createError, setCreateError] = React.useState("")
  const period = `${year}-${month}`

  async function attachCsv(file?: File) {
    if (!file) {
      return
    }

    setCreateError("")
    setCsvFileName(file.name)
    setCsvText(await file.text())
  }

  async function createMonthEnd() {
    try {
      const freshRecords = await listMonthEndRecords()
      const knownRecords = [...existingRecords, ...freshRecords]

      if (knownRecords.some((record) => record.period === period)) {
        setCreateError(`${formatPeriod(period)} already exists.`)
        return
      }

      const template = await getMonthEndTemplate()
      const parsedRates = csvText
        ? parseExchangeRates(csvText, template.countries)
        : []
      const checked = parsedRates.reduce<Record<string, MonthEndValue>>(
        (nextChecked, item) => {
          nextChecked[exchangeRateKey(item.country.id)] = item.rate
          return nextChecked
        },
        {}
      )
      const now = new Date().toISOString()
      const title = formatPeriod(period)
      const record: MonthEndRecord = {
        id: period,
        period,
        checked: withMonthEndTitle(checked, title),
        status: "Open",
        createdAt: now,
        updatedAt: now,
      }

      await saveMonthEndRecord(record)
      window.dispatchEvent(new Event("month-end:records-updated"))
      onCreated(record)
    } catch (error) {
      setCreateError(getCreateErrorMessage(error))
    }
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle>Create Month End</CardTitle>
        <CardDescription>
          Choose the month and upload the prepaid exchange rate report if you
          have it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Month</Label>
            <Select
              value={month}
              onValueChange={(value) => {
                if (value) {
                  setMonth(value)
                }
              }}
            >
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {months.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Year</Label>
            <Select
              value={year}
              onValueChange={(value) => {
                if (value) {
                  setYear(value)
                }
              }}
            >
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {years.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-6 text-center transition-colors hover:bg-muted/50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            attachCsv(event.dataTransfer.files[0])
          }}
        >
          <UploadIcon className="size-6 text-muted-foreground" />
          <span className="font-medium">
            Drag and drop the prepaid exchange rate CSV
          </span>
          <span className="text-sm text-muted-foreground">
            {csvFileName || "or click to choose a file"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => attachCsv(event.target.files?.[0])}
          />
        </label>
        {createError ? (
          <p className="text-sm text-destructive">{createError}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button onClick={createMonthEnd}>
            <FileSpreadsheetIcon />
            Create Month End
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
