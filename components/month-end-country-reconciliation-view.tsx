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
  ClipboardPasteIcon,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  exchangeRateKey,
  getMonthEndRecord,
  getMonthEndTitle,
  type MonthEndRecord,
} from "@/lib/month-end-db"
import {
  getCanonicalCountryId,
  getLinkedCountryIds,
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
import {
  parseCountryReportText,
  parseCountryReportFile,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
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

function formatDate(value: string | undefined) {
  const rawValue = (value ?? "").trim()

  return rawValue || "-"
}

function parseExchangeRate(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : undefined

  return amount && Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function lineItemCountryName(value: string | undefined) {
  const countryName = (value ?? "").trim()

  return countryName && !countryName.includes("/") ? countryName : "-"
}

function mergeCountryReportRecords(records: MonthEndCountryReportRecord[]) {
  const recordsById = new Map<string, MonthEndCountryReportRecord>()

  for (const record of records) {
    recordsById.set(record.id, record)
  }

  return Array.from(recordsById.values())
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
    record.sourceCountryName,
    String(record.amount),
  ].some((value) => (value ?? "").toLowerCase().includes(normalizedQuery))
}

function normalizeMatchKey(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function matchCandidates(
  masterRecord: MonthEndMasterRecord,
  countryRecord: MonthEndCountryReportRecord
) {
  return [
    {
      label: "BL",
      masterValue: masterRecord.billOfLadingNumber,
      countryValues: [countryRecord.billOfLadingNumber, countryRecord.reference],
    },
    {
      label: "CTN",
      masterValue: masterRecord.ctnNumber,
      countryValues: [countryRecord.ctnNumber, countryRecord.reference],
    },
    {
      label: "Invoice",
      masterValue: masterRecord.salesOrderNumber,
      countryValues: [countryRecord.invoiceNumber, countryRecord.reference],
    },
  ]
}

function formatCombinedCountryName(countries: TemplateCountryRow[]) {
  const countryNames = Array.from(
    new Set(
      countries
        .filter((country) => country.checkable !== false)
        .map((country) => country.name.trim())
        .filter(Boolean)
    )
  )

  return countryNames.join(" / ")
}

function matchDetail(
  masterRecord: MonthEndMasterRecord,
  countryRecord: MonthEndCountryReportRecord
) {
  for (const candidate of matchCandidates(masterRecord, countryRecord)) {
    const masterKey = normalizeMatchKey(candidate.masterValue)

    if (!masterKey) {
      continue
    }

    const countryValue = candidate.countryValues.find(
      (value) => normalizeMatchKey(value) === masterKey
    )

    if (countryValue) {
      return {
        label: candidate.label,
        value: candidate.masterValue || countryValue,
      }
    }
  }

  return undefined
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

      return Boolean(matchDetail(item, countryRecord))
    })

    if (!masterRecord) {
      return []
    }

    const matchedOn = matchDetail(masterRecord, countryRecord)

    matchedMasterIds.add(masterRecord.id)
    matchedCountryIds.add(countryRecord.id)

    return [
      {
        id: `${masterRecord.id}__${countryRecord.id}`,
        masterRecord,
        countryRecord,
        matchedOn,
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
  showCountryColumn,
}: {
  records: MonthEndMasterRecord[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  showCountryColumn: boolean
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
              {showCountryColumn ? (
                <div>
                  <div className="text-xs text-muted-foreground">Country</div>
                  <div className="mt-1 font-medium">
                    {record.countryName || "-"}
                  </div>
                </div>
              ) : null}
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
  showCountryColumn,
}: {
  records: MonthEndMasterRecord[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  showCountryColumn: boolean
}) {
  const total = records.reduce((sum, record) => sum + record.amount, 0)

  return (
    <div className="hidden overflow-x-auto md:block">
      <Table className={showCountryColumn ? "min-w-[940px]" : "min-w-[840px]"}>
        <TableHeader>
          <TableRow>
            {showCountryColumn ? <TableHead>Country</TableHead> : null}
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
              {showCountryColumn ? (
                <TableCell>{record.countryName}</TableCell>
              ) : null}
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
        <TableFooter>
          <TableRow>
            <TableCell colSpan={showCountryColumn ? 5 : 4}>Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function CountryReportCards({
  records,
  showCountryColumn,
}: {
  records: MonthEndCountryReportRecord[]
  showCountryColumn: boolean
}) {
  const showBillOfLading = hasField(records, (record) => record.billOfLadingNumber)
  const showSourceCountry =
    showCountryColumn || hasField(records, (record) => record.sourceCountryName)

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
            {showSourceCountry && record.sourceCountryName ? (
              <div className="text-sm text-muted-foreground">
                {record.sourceCountryName}
              </div>
            ) : showSourceCountry ? (
              <div className="text-sm text-muted-foreground">
                {lineItemCountryName(record.countryName)}
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
  showCountryColumn,
}: {
  records: MonthEndCountryReportRecord[]
  showCountryColumn: boolean
}) {
  const showInvoice =
    hasField(records, (record) => record.invoiceNumber) &&
    !records.every(isAntaserReportRecord)
  const showBillOfLading = hasField(records, (record) => record.billOfLadingNumber)
  const showSourceCountry =
    showCountryColumn || hasField(records, (record) => record.sourceCountryName)
  const tableWidth =
    showInvoice || showBillOfLading || showSourceCountry
      ? "min-w-[720px]"
      : "min-w-[420px]"
  const total = records.reduce((sum, record) => sum + record.amount, 0)

  return (
    <div className="hidden overflow-x-auto md:block">
      <Table className={tableWidth}>
        <TableHeader>
          <TableRow>
            {showInvoice ? <TableHead>Invoice</TableHead> : null}
            <TableHead>Reference</TableHead>
            <TableHead>CTN</TableHead>
            {showBillOfLading ? <TableHead>Bill of Lading</TableHead> : null}
            {showSourceCountry ? <TableHead>Country</TableHead> : null}
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
              {showSourceCountry ? (
                <TableCell>
                  {record.sourceCountryName ||
                    lineItemCountryName(record.countryName)}
                </TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {formatAmount(record.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell
              colSpan={
                2 +
                (showInvoice ? 1 : 0) +
                (showBillOfLading ? 1 : 0) +
                (showSourceCountry ? 1 : 0)
              }
            >
              Total
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function MatchedRecordTable({
  records,
  exchangeRate,
  showCountryColumn,
}: {
  records: ReturnType<typeof reconcileRecords>["matched"]
  exchangeRate?: number
  showCountryColumn: boolean
}) {
  const tableWidth = showCountryColumn ? "min-w-[720px]" : "min-w-[620px]"
  const netsuiteTotal = records.reduce(
    (total, { masterRecord }) => total + masterRecord.amount,
    0
  )
  const countryAmount = (amount: number) =>
    exchangeRate ? amount * exchangeRate : amount
  const countryTotal = records.reduce(
    (total, { countryRecord }) => total + countryAmount(countryRecord.amount),
    0
  )

  return (
    <div className="overflow-x-auto">
      <Table className={tableWidth}>
        <TableHeader>
          <TableRow>
            {showCountryColumn ? <TableHead>Country</TableHead> : null}
            <TableHead>Date</TableHead>
            <TableHead>Matching Column</TableHead>
            <TableHead className="text-right">NetSuite Amount</TableHead>
            <TableHead className="text-right">
              {exchangeRate ? "Country Amount USD" : "Country Amount"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map(({ id, masterRecord, countryRecord, matchedOn }) => (
            <TableRow key={id}>
              {showCountryColumn ? (
                <TableCell>
                  {countryRecord.sourceCountryName ||
                    lineItemCountryName(masterRecord.countryName)}
                </TableCell>
              ) : null}
              <TableCell className="font-medium">
                {formatDate(masterRecord.transactionDate)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{matchedOn?.value ?? "-"}</div>
                <div className="text-xs text-muted-foreground">
                  {matchedOn?.label ?? "Matched"}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(masterRecord.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(countryAmount(countryRecord.amount))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={showCountryColumn ? 3 : 2}>Matched Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(netsuiteTotal)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(countryTotal)}
            </TableCell>
          </TableRow>
        </TableFooter>
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
  const [countryDisplayName, setCountryDisplayName] = React.useState("")
  const [linkedCountryIds, setLinkedCountryIds] = React.useState<string[]>([])
  const [canPasteReport, setCanPasteReport] = React.useState(false)
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
  const [isPasteReportOpen, setIsPasteReportOpen] = React.useState(false)
  const [pastedReportText, setPastedReportText] = React.useState("")
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
        const linkedCountryRows = getLinkedCountryRows(
          activeCountryId,
          template.countries
        )
        const linkedIds = linkedCountryRows.map((item) => item.id)
        const matchedCountry =
          linkedCountryRows[0] ??
          template.countries.find((item) => item.id === activeCountryId) ??
          loadMonthEndTemplate().countries.find(
            (item) => item.id === activeCountryId
          )
        const displayName =
          formatCombinedCountryName(linkedCountryRows) ||
          matchedCountry?.name ||
          ""
        const supportsPasteReport = linkedCountryRows.some(
          (item) => item.requiresPasteReport
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
        setCountryDisplayName(displayName)
        setLinkedCountryIds(linkedIds)
        setCanPasteReport(supportsPasteReport)
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

  React.useEffect(() => {
    if (!canPasteReport) {
      setIsPasteReportOpen(false)
      setPastedReportText("")
    }
  }, [canPasteReport])

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
  const exchangeRate = React.useMemo(() => {
    for (const linkedCountryId of linkedCountryIds) {
      const rate = parseExchangeRate(
        record?.checked[exchangeRateKey(linkedCountryId)]
      )

      if (rate) {
        return rate
      }
    }

    return undefined
  }, [linkedCountryIds, record])
  const showCountryColumn = linkedCountryIds.length > 1
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

      const linkedCountryIds = getLinkedCountryIds(activeCountryId)

      setRecords(
        parsedRecords.filter((item) => linkedCountryIds.includes(item.countryId))
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

  async function saveParsedCountryReportRecords({
    parsedRecords,
    sourceLabel,
  }: {
    parsedRecords: ParsedCountryReportRecord[]
    sourceLabel: string
  }) {
    if (!record || !country || !activeCountryId) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    const template = await getMonthEndTemplate()
    const linkedCountryNames = new Set(
      getLinkedCountryRows(activeCountryId, template.countries).map((item) =>
        normalizeMatchKey(item.name)
      )
    )
    const filteredRecords = parsedRecords.filter((item) => {
      const sourceCountryName = normalizeMatchKey(item.sourceCountryName)

      return (
        Boolean(item.targetCountryId) ||
        !sourceCountryName ||
        linkedCountryNames.has(sourceCountryName)
      )
    })
    const recordsByCountryId = filteredRecords.reduce(
      (groups, parsedRecord) => {
        const targetCountryId = parsedRecord.targetCountryId || activeCountryId
        const records = groups.get(targetCountryId) ?? []

        groups.set(targetCountryId, [...records, parsedRecord])

        return groups
      },
      new Map<string, ParsedCountryReportRecord[]>()
    )
    const savedRecordGroups = await Promise.all(
      Array.from(recordsByCountryId.entries()).map(
        async ([targetCountryId, countryParsedRecords]) => {
          const targetCountry =
            template.countries.find((item) => item.id === targetCountryId) ??
            country
          const reportRecords = makeCountryReportRecords({
            parsedRecords: countryParsedRecords,
            monthEndId: record.id,
            period: record.period,
            countryId: targetCountryId,
            countryName: targetCountry.name,
          })
          const recordsToSave =
            targetCountryId === activeCountryId
              ? reportRecords
              : mergeCountryReportRecords([
                  ...(await listMonthEndCountryReportRecords({
                    monthEndId: record.id,
                    countryId: targetCountryId,
                  })),
                  ...reportRecords,
                ])

          await replaceMonthEndCountryReportRecords({
            monthEndId: record.id,
            countryId: targetCountryId,
            records: recordsToSave,
          })

          return reportRecords
        }
      )
    )
    const reportRecords = savedRecordGroups.flat()

    setCountryReportFileName(sourceLabel)
    setCountryReportRecords(
      reportRecords.filter((item) => item.countryId === activeCountryId)
    )
    setActiveView("country")
  }

  async function uploadCountryReports(files: File[]) {
    setIsUploadingCountryReport(true)
    setCountryReportFileName(files.map((file) => file.name).join(", "))
    setUploadError("")

    try {
      const parsedGroups = await Promise.all(
        files.map((file) => parseCountryReportFile(file, { period: record?.period }))
      )

      await saveParsedCountryReportRecords({
        parsedRecords: parsedGroups.flat() as ParsedCountryReportRecord[],
        sourceLabel: files.map((file) => file.name).join(", "),
      })
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

  async function uploadPastedCountryReport() {
    if (!record) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    setIsUploadingCountryReport(true)
    setUploadError("")

    try {
      await saveParsedCountryReportRecords({
        parsedRecords: parseCountryReportText(pastedReportText, {
          period: record.period,
        }),
        sourceLabel: "Pasted report",
      })
      setPastedReportText("")
      setIsPasteReportOpen(false)
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload that pasted report."
      )
    } finally {
      setIsUploadingCountryReport(false)
    }
  }

  const title = country
    ? `${countryDisplayName || country.name} - ${record ? getMonthEndTitle(record) : "Month End"}`
    : "Country Records"
  const countryReportLabel = country
    ? `${countryDisplayName || country.name} Report`
    : "Country Report"
  const viewLabels: Record<ReconciliationView, string> = {
    master: "NetSuite",
    country: countryDisplayName || country?.name || "Country",
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
                  {canPasteReport ? (
                    <DropdownMenuItem onClick={() => setIsPasteReportOpen(true)}>
                      <ClipboardPasteIcon />
                      Paste Report
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isPasteReportOpen ? (
              <Card className="rounded-lg py-0 shadow-sm">
                <CardContent className="grid gap-3 p-3">
                  <Textarea
                    value={pastedReportText}
                    onChange={(event) => setPastedReportText(event.target.value)}
                    placeholder="Paste report data"
                    className="min-h-48 resize-y font-mono text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsPasteReportOpen(false)
                        setPastedReportText("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={uploadPastedCountryReport}
                      disabled={!pastedReportText.trim() || isUploadingCountryReport}
                    >
                      <ClipboardPasteIcon />
                      Import Paste
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

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
                <CountryReportCards
                  records={filteredCountryReportRecords}
                  showCountryColumn={showCountryColumn}
                />
                <CountryReportTable
                  records={filteredCountryReportRecords}
                  showCountryColumn={showCountryColumn}
                />
              </>
            ) : activeView === "matched" && filteredMatchedRecords.length ? (
              <MatchedRecordTable
                records={filteredMatchedRecords}
                exchangeRate={exchangeRate}
                showCountryColumn={showCountryColumn}
              />
            ) : activeView === "missing-netsuite" &&
              filteredMissingFromNetSuite.length ? (
              <>
                <CountryReportCards
                  records={filteredMissingFromNetSuite}
                  showCountryColumn={showCountryColumn}
                />
                <CountryReportTable
                  records={filteredMissingFromNetSuite}
                  showCountryColumn={showCountryColumn}
                />
              </>
            ) : activeView === "missing-country" &&
              filteredMissingFromCountry.length ? (
              <>
                <MasterRecordCards
                  records={filteredMissingFromCountry}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  showCountryColumn={showCountryColumn}
                />
                <MasterRecordTable
                  records={filteredMissingFromCountry}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  showCountryColumn={showCountryColumn}
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
                  showCountryColumn={showCountryColumn}
                />
                <MasterRecordTable
                  records={sortedRecords}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  showCountryColumn={showCountryColumn}
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
