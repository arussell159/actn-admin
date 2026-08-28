"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
  ListXIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getMonthEndRecord,
  getMonthEndTitle,
  type MonthEndRecord,
} from "@/lib/month-end-db"
import {
  getCanonicalCountryId,
  getLinkedCountryRows,
  listMonthEndMasterRecords,
  parseCountryMasterCsv,
  replaceMonthEndCountryMasterRecords,
  type MonthEndMasterRecord,
} from "@/lib/month-end-master-records"
import {
  getMonthEndTemplate,
  loadMonthEndTemplate,
  type TemplateCountryRow,
} from "@/lib/month-end-template"
import { parseCountryReportFile } from "@/lib/country-report-import"
import {
  antaserInvoiceParserKey,
  listMonthEndCountryReportRecords,
  makeCountryReportRecords,
  replaceMonthEndCountryReportRecords,
  type MonthEndCountryReportRecord,
} from "@/lib/month-end-country-report-records"

type SortKey =
  | "salesOrderNumber"
  | "billOfLadingNumber"
  | "ctnNumber"
  | "status"
  | "amount"

type SortDirection = "asc" | "desc"
type ReconciliationView =
  | "master"
  | "country"
  | "matched"
  | "missing-netsuite"
  | "missing-country"

const sortLabels: Record<SortKey, string> = {
  salesOrderNumber: "Sales Order",
  billOfLadingNumber: "Bill of Lading",
  ctnNumber: "CTN",
  status: "Status",
  amount: "Amount",
}

const reconciliationViews: {
  id: ReconciliationView
  fallbackLabel: string
  Icon: React.ElementType
}[] = [
  { id: "master", fallbackLabel: "NetSuite", Icon: DatabaseIcon },
  { id: "country", fallbackLabel: "Country", Icon: FileSpreadsheetIcon },
  { id: "matched", fallbackLabel: "Matched", Icon: ListChecksIcon },
  {
    id: "missing-netsuite",
    fallbackLabel: "Missing from NetSuite",
    Icon: ListXIcon,
  },
  {
    id: "missing-country",
    fallbackLabel: "Missing from Country",
    Icon: ListXIcon,
  },
]

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function hasField<T>(records: T[], getValue: (record: T) => string | undefined | null) {
  return records.some((record) => (getValue(record) ?? "").trim())
}

function isAntaserReportRecord(record: MonthEndCountryReportRecord) {
  return record.parserKey === antaserInvoiceParserKey
}

function matchesQuery(record: MonthEndMasterRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    record.salesOrderNumber,
    record.billOfLadingNumber,
    record.ctnNumber,
    record.status,
    String(record.amount),
  ].some((value) => (value ?? "").toLowerCase().includes(normalizedQuery))
}

function matchesCountryReportQuery(
  record: MonthEndCountryReportRecord,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    record.invoiceNumber,
    record.ctnNumber,
    record.billOfLadingNumber,
    record.reference,
    String(record.amount),
  ].some((value) => (value ?? "").toLowerCase().includes(normalizedQuery))
}

function normalizeMatchKey(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function masterMatchKeys(record: MonthEndMasterRecord) {
  return [
    record.ctnNumber,
    record.billOfLadingNumber,
    record.salesOrderNumber,
  ]
    .map(normalizeMatchKey)
    .filter(Boolean)
}

function countryMatchKeys(record: MonthEndCountryReportRecord) {
  return [record.ctnNumber, record.billOfLadingNumber, record.reference]
    .map(normalizeMatchKey)
    .filter(Boolean)
}

function sharedMatchKey(
  masterRecord: MonthEndMasterRecord,
  countryRecord: MonthEndCountryReportRecord
) {
  const countryKeys = new Set(countryMatchKeys(countryRecord))

  return masterMatchKeys(masterRecord).find((key) => countryKeys.has(key))
}

function reconcileRecords({
  masterRecords,
  countryRecords,
}: {
  masterRecords: MonthEndMasterRecord[]
  countryRecords: MonthEndCountryReportRecord[]
}) {
  const matchedMasterIds = new Set<string>()
  const matchedCountryIds = new Set<string>()
  const matched = countryRecords.flatMap((countryRecord) => {
    const masterRecord = masterRecords.find((item) => {
      if (matchedMasterIds.has(item.id)) {
        return false
      }

      return Boolean(sharedMatchKey(item, countryRecord))
    })

    if (!masterRecord) {
      return []
    }

    matchedMasterIds.add(masterRecord.id)
    matchedCountryIds.add(countryRecord.id)

    return [
      {
        id: `${masterRecord.id}__${countryRecord.id}`,
        masterRecord,
        countryRecord,
        matchKey: sharedMatchKey(masterRecord, countryRecord) ?? "",
      },
    ]
  })

  return {
    matched,
    missingFromNetSuite: countryRecords.filter(
      (record) => !matchedCountryIds.has(record.id)
    ),
    missingFromCountry: masterRecords.filter(
      (record) => !matchedMasterIds.has(record.id)
    ),
  }
}

function sortRecords(
  records: MonthEndMasterRecord[],
  sortKey: SortKey,
  sortDirection: SortDirection
) {
  return records.slice().sort((first, second) => {
    const modifier = sortDirection === "asc" ? 1 : -1

    if (sortKey === "amount") {
      return (first.amount - second.amount) * modifier
    }

    return first[sortKey].localeCompare(second[sortKey]) * modifier
  })
}

function MasterRecordCards({
  records,
  sortKey,
  sortDirection,
  onSort,
}: {
  records: MonthEndMasterRecord[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}) {
  return (
    <div className="grid gap-3 md:hidden">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={
              "h-9 shrink-0 rounded-full border px-3 text-sm font-medium " +
              (sortKey === key ? "bg-muted" : "bg-background")
            }
            onClick={() => onSort(key)}
          >
            {sortLabels[key]}
            {sortKey === key && sortDirection === "asc" ? (
              <ArrowDownIcon className="ml-1 inline size-3.5" />
            ) : null}
            {sortKey === key && sortDirection === "desc" ? (
              <ArrowUpIcon className="ml-1 inline size-3.5" />
            ) : null}
          </button>
        ))}
      </div>
      {records.map((record) => (
        <Card key={record.id} className="rounded-lg py-0 shadow-sm">
          <CardContent className="grid gap-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{record.salesOrderNumber}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {record.billOfLadingNumber}
                </div>
              </div>
              <span className="shrink-0 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                {record.status || "No status"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">CTN</div>
                <div className="mt-1 font-medium">{record.ctnNumber || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="mt-1 font-medium">
                  {formatAmount(record.amount)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SortableHead({
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  column: SortKey
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}) {
  return (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 font-medium"
        onClick={() => onSort(column)}
      >
        {sortLabels[column]}
        {sortKey === column && sortDirection === "asc" ? (
          <ArrowDownIcon className="size-3.5" />
        ) : null}
        {sortKey === column && sortDirection === "desc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : null}
      </button>
    </TableHead>
  )
}

function MasterRecordTable({
  records,
  sortKey,
  sortDirection,
  onSort,
}: {
  records: MonthEndMasterRecord[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table className="min-w-[840px]">
        <TableHeader>
          <TableRow>
            {(Object.keys(sortLabels) as SortKey[]).map((column) => (
              <SortableHead
                key={column}
                column={column}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-medium">
                {record.salesOrderNumber}
              </TableCell>
              <TableCell>{record.billOfLadingNumber}</TableCell>
              <TableCell>{record.ctnNumber}</TableCell>
              <TableCell>{record.status}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(record.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CountryReportCards({
  records,
}: {
  records: MonthEndCountryReportRecord[]
}) {
  const showBillOfLading = hasField(records, (record) => record.billOfLadingNumber)

  return (
    <div className="grid gap-3 md:hidden">
      {records.map((record) => (
        <Card key={record.id} className="rounded-lg py-0 shadow-sm">
          <CardContent className="grid gap-3 p-3">
            <div className="min-w-0">
              <div className="font-semibold">{record.reference}</div>
              <div className="mt-1 truncate text-sm text-muted-foreground">
                {record.ctnNumber}
              </div>
            </div>
            {showBillOfLading && record.billOfLadingNumber ? (
              <div className="text-sm text-muted-foreground">
                {record.billOfLadingNumber}
              </div>
            ) : null}
            <div className="text-sm font-medium">
              {formatAmount(record.amount)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CountryReportTable({
  records,
}: {
  records: MonthEndCountryReportRecord[]
}) {
  const showInvoice =
    hasField(records, (record) => record.invoiceNumber) &&
    !records.every(isAntaserReportRecord)
  const showBillOfLading = hasField(records, (record) => record.billOfLadingNumber)
  const tableWidth = showInvoice || showBillOfLading ? "min-w-[640px]" : "min-w-[420px]"

  return (
    <div className="hidden overflow-x-auto md:block">
      <Table className={tableWidth}>
        <TableHeader>
          <TableRow>
            {showInvoice ? <TableHead>Invoice</TableHead> : null}
            <TableHead>Reference</TableHead>
            <TableHead>CTN</TableHead>
            {showBillOfLading ? <TableHead>Bill of Lading</TableHead> : null}
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              {showInvoice ? (
                <TableCell className="font-medium">
                  {record.invoiceNumber}
                </TableCell>
              ) : null}
              <TableCell>{record.reference}</TableCell>
              <TableCell>{record.ctnNumber}</TableCell>
              {showBillOfLading ? (
                <TableCell>{record.billOfLadingNumber}</TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {formatAmount(record.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MatchedRecordTable({
  records,
}: {
  records: ReturnType<typeof reconcileRecords>["matched"]
}) {
  const showCountryBillOfLading = records.some(({ countryRecord }) =>
    (countryRecord.billOfLadingNumber ?? "").trim()
  )
  const tableWidth = showCountryBillOfLading ? "min-w-[940px]" : "min-w-[820px]"
  const netsuiteTotal = records.reduce(
    (total, { masterRecord }) => total + masterRecord.amount,
    0
  )
  const countryTotal = records.reduce(
    (total, { countryRecord }) => total + countryRecord.amount,
    0
  )
  const labelColumnSpan = showCountryBillOfLading ? 6 : 5

  return (
    <div className="overflow-x-auto">
      <Table className={tableWidth}>
        <TableHeader>
          <TableRow>
            <TableHead>NetSuite SO</TableHead>
            <TableHead>Country Ref</TableHead>
            <TableHead>NetSuite CTN</TableHead>
            <TableHead>Country CTN</TableHead>
            <TableHead>NetSuite BL</TableHead>
            {showCountryBillOfLading ? <TableHead>Country BL</TableHead> : null}
            <TableHead className="text-right">NetSuite Amount</TableHead>
            <TableHead className="text-right">Country Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map(({ id, masterRecord, countryRecord }) => (
            <TableRow key={id}>
              <TableCell className="font-medium">
                {masterRecord.salesOrderNumber}
              </TableCell>
              <TableCell>{countryRecord.reference}</TableCell>
              <TableCell>{masterRecord.ctnNumber}</TableCell>
              <TableCell>{countryRecord.ctnNumber}</TableCell>
              <TableCell>{masterRecord.billOfLadingNumber}</TableCell>
              {showCountryBillOfLading ? (
                <TableCell>{countryRecord.billOfLadingNumber}</TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {formatAmount(masterRecord.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(countryRecord.amount)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t bg-muted/40 font-semibold">
            <TableCell colSpan={labelColumnSpan}>Matched Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(netsuiteTotal)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(countryTotal)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

const HiddenFileInput = React.forwardRef<
  HTMLInputElement,
  {
    accept: string
    multiple?: boolean
    onFiles: (files: File[]) => void
  }
>(function HiddenFileInput({ accept, multiple = false, onFiles }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      className="sr-only"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])

        if (files.length) {
          onFiles(files)
        }

        event.currentTarget.value = ""
      }}
    />
  )
})

export function MonthEndCountryReconciliationView({
  period,
  countryId,
}: {
  period?: string
  countryId?: string
}) {
  const [record, setRecord] = React.useState<MonthEndRecord>()
  const [country, setCountry] = React.useState<TemplateCountryRow>()
  const [records, setRecords] = React.useState<MonthEndMasterRecord[]>([])
  const [countryReportRecords, setCountryReportRecords] = React.useState<
    MonthEndCountryReportRecord[]
  >([])
  const [query, setQuery] = React.useState("")
  const [activeView, setActiveView] =
    React.useState<ReconciliationView>("master")
  const [sortKey, setSortKey] =
    React.useState<SortKey>("salesOrderNumber")
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("asc")
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
  const [masterFileName, setMasterFileName] = React.useState("")
  const [countryReportFileName, setCountryReportFileName] = React.useState("")
  const [uploadError, setUploadError] = React.useState("")
  const [isUploadingMaster, setIsUploadingMaster] = React.useState(false)
  const [isUploadingCountryReport, setIsUploadingCountryReport] =
    React.useState(false)
  const masterInputRef = React.useRef<HTMLInputElement>(null)
  const countryReportInputRef = React.useRef<HTMLInputElement>(null)
  const activeCountryId = countryId ? getCanonicalCountryId(countryId) : undefined

  React.useEffect(() => {
    let isMounted = true

    async function load() {
      if (!period || !activeCountryId) {
        setHasLoaded(true)
        return
      }

      setLoadError("")

      try {
        const [monthEndRecord, template] = await Promise.all([
          getMonthEndRecord(period),
          getMonthEndTemplate(),
        ])
        const matchedCountry =
          template.countries.find((item) => item.id === activeCountryId) ??
          loadMonthEndTemplate().countries.find(
            (item) => item.id === activeCountryId
          )

        const [masterRecords, reportRecords] = monthEndRecord
          ? await Promise.all([
              listMonthEndMasterRecords({
                monthEndId: monthEndRecord.id,
                countryId: activeCountryId,
              }),
              listMonthEndCountryReportRecords({
                monthEndId: monthEndRecord.id,
                countryId: activeCountryId,
              }),
            ])
          : [[], []]

        if (!isMounted) {
          return
        }

        setRecord(monthEndRecord)
        setCountry(matchedCountry)
        setRecords(masterRecords)
        setCountryReportRecords(reportRecords)
      } catch {
        if (isMounted) {
          setLoadError("Could not load this country record.")
        }
      } finally {
        if (isMounted) {
          setHasLoaded(true)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [activeCountryId, countryId, period])

  const sortedRecords = React.useMemo(
    () =>
      sortRecords(
        records.filter((item) => matchesQuery(item, query)),
        sortKey,
        sortDirection
      ),
    [query, records, sortDirection, sortKey]
  )
  const filteredCountryReportRecords = React.useMemo(
    () =>
      countryReportRecords.filter((item) =>
        matchesCountryReportQuery(item, query)
      ),
    [countryReportRecords, query]
  )
  const reconciliation = React.useMemo(
    () =>
      reconcileRecords({
        masterRecords: records,
        countryRecords: countryReportRecords,
      }),
    [countryReportRecords, records]
  )
  const filteredMatchedRecords = React.useMemo(
    () =>
      reconciliation.matched.filter(
        ({ masterRecord, countryRecord }) =>
          matchesQuery(masterRecord, query) ||
          matchesCountryReportQuery(countryRecord, query)
      ),
    [query, reconciliation.matched]
  )
  const filteredMissingFromNetSuite = React.useMemo(
    () =>
      reconciliation.missingFromNetSuite.filter((item) =>
        matchesCountryReportQuery(item, query)
      ),
    [query, reconciliation.missingFromNetSuite]
  )
  const filteredMissingFromCountry = React.useMemo(
    () =>
      reconciliation.missingFromCountry.filter((item) =>
        matchesQuery(item, query)
      ),
    [query, reconciliation.missingFromCountry]
  )
  const activeViewCount =
    activeView === "master"
      ? records.length
      : activeView === "country"
        ? countryReportRecords.length
        : activeView === "matched"
          ? reconciliation.matched.length
          : activeView === "missing-netsuite"
            ? reconciliation.missingFromNetSuite.length
            : reconciliation.missingFromCountry.length

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(key)
    setSortDirection("asc")
  }

  async function uploadMasterFile(file: File) {
    if (!record || !activeCountryId) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    setIsUploadingMaster(true)
    setUploadError("")
    setMasterFileName(file.name)

    try {
      const template = await getMonthEndTemplate()
      const targetCountries = getLinkedCountryRows(
        activeCountryId,
        template.countries
      )
      const parsedRecords = parseCountryMasterCsv({
        csvText: await file.text(),
        targetCountries,
        monthEndId: record.id,
        period: record.period,
      })

      await replaceMonthEndCountryMasterRecords({
        monthEndId: record.id,
        countryId: activeCountryId,
        records: parsedRecords,
      })

      setRecords(
        parsedRecords.filter((item) => item.countryId === activeCountryId)
      )
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload that master CSV."
      )
    } finally {
      setIsUploadingMaster(false)
    }
  }

  async function uploadCountryReports(files: File[]) {
    if (!record || !country || !activeCountryId) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    setIsUploadingCountryReport(true)
    setCountryReportFileName(files.map((file) => file.name).join(", "))
    setUploadError("")

    try {
      const parsedGroups = await Promise.all(
        files.map((file) => parseCountryReportFile(file, { period: record.period }))
      )
      const parsedRecords = parsedGroups.flat()
      const reportRecords = makeCountryReportRecords({
        parsedRecords,
        monthEndId: record.id,
        period: record.period,
        countryId: activeCountryId,
        countryName: country.name,
      })

      await replaceMonthEndCountryReportRecords({
        monthEndId: record.id,
        countryId: activeCountryId,
        records: reportRecords,
      })

      setCountryReportRecords(reportRecords)
      setActiveView("country")
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload that country report."
      )
    } finally {
      setIsUploadingCountryReport(false)
    }
  }

  const title = country
    ? `${country.name} - ${record ? getMonthEndTitle(record) : "Month End"}`
    : "Country Records"
  const countryReportLabel = country ? `${country.name} Report` : "Country Report"
  const viewLabels: Record<ReconciliationView, string> = {
    master: "NetSuite",
    country: country?.name ?? "Country",
    matched: "Matched",
    "missing-netsuite": "Missing from NetSuite",
    "missing-country": "Missing from Country",
  }
  const backHref = period
    ? `/month-end?period=${encodeURIComponent(period)}`
    : "/month-end"

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title={title} />
          <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Back to month end"
                render={<AppLink href={backHref} />}
              >
                <ArrowLeftIcon />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="rounded-full" />
                  }
                >
                  <UploadIcon />
                  Upload
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuItem
                    onClick={() => masterInputRef.current?.click()}
                  >
                    <DatabaseIcon />
                    {isUploadingMaster
                      ? "Uploading NetSuite Report"
                      : "NetSuite Report"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => countryReportInputRef.current?.click()}
                  >
                    <FileSpreadsheetIcon />
                    {isUploadingCountryReport
                      ? `Uploading ${countryReportLabel}`
                      : countryReportLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="h-11 rounded-2xl pl-9 text-base md:h-9"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="flex h-auto min-h-11 w-max min-w-full flex-nowrap items-center gap-1 rounded-[1.375rem] bg-muted p-1 md:min-w-0">
                  {reconciliationViews.map(({ id, fallbackLabel, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        "flex h-9 flex-none items-center gap-2 rounded-[1.05rem] px-4 py-2 text-sm font-medium leading-none transition-colors " +
                        (activeView === id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground")
                      }
                      onClick={() => setActiveView(id)}
                    >
                      <Icon className="size-4" />
                      {viewLabels[id] ?? fallbackLabel}
                    </button>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                {activeViewCount}
              </div>
            </div>

            <HiddenFileInput
              ref={masterInputRef}
              accept=".csv,text/csv"
              onFiles={(files) => {
                const file = files[0]

                if (file) {
                  uploadMasterFile(file)
                }
              }}
            />
            <HiddenFileInput
              ref={countryReportInputRef}
              accept=".csv,.pdf,.xls,.xlsx,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              onFiles={uploadCountryReports}
            />

            {[masterFileName, countryReportFileName].filter(Boolean).length ? (
              <div className="truncate text-sm text-muted-foreground">
                {[masterFileName, countryReportFileName]
                  .filter(Boolean)
                  .join(" - ")}
              </div>
            ) : null}

            {uploadError ? (
              <p className="text-sm text-destructive">{uploadError}</p>
            ) : null}

            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : null}
            {!hasLoaded ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : activeView === "country" && filteredCountryReportRecords.length ? (
              <>
                <CountryReportCards records={filteredCountryReportRecords} />
                <CountryReportTable records={filteredCountryReportRecords} />
              </>
            ) : activeView === "matched" && filteredMatchedRecords.length ? (
              <MatchedRecordTable records={filteredMatchedRecords} />
            ) : activeView === "missing-netsuite" &&
              filteredMissingFromNetSuite.length ? (
              <>
                <CountryReportCards records={filteredMissingFromNetSuite} />
                <CountryReportTable records={filteredMissingFromNetSuite} />
              </>
            ) : activeView === "missing-country" &&
              filteredMissingFromCountry.length ? (
              <>
                <MasterRecordCards
                  records={filteredMissingFromCountry}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <MasterRecordTable
                  records={filteredMissingFromCountry}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </>
            ) : activeView !== "master" ? (
              <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                {records.length && countryReportRecords.length
                  ? "No records found in this reconciliation view."
                  : "Upload both reports to build this reconciliation view."}
              </div>
            ) : sortedRecords.length ? (
              <>
                <MasterRecordCards
                  records={sortedRecords}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <MasterRecordTable
                  records={sortedRecords}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </>
            ) : (
              <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                No master records found.
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
