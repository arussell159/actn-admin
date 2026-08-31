"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FileSpreadsheetIcon,
  FileOutputIcon,
  ListChecksIcon,
  ClipboardPasteIcon,
  UploadIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { CountryReconciliationSkeleton } from "@/components/page-skeletons"
import { SiteHeader } from "@/components/site-header"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  exchangeRateKey,
  getMonthEndRecord,
  getMonthEndTitle,
  saveMonthEndRecord,
  type MonthEndRecord,
} from "@/lib/month-end-db"
import {
  getCanonicalCountryId,
  getLinkedCountryIds,
  getLinkedCountryRows,
  getMasterTransactionDateCheckedValues,
  listMonthEndMasterRecords,
  masterTransactionDatesKey,
  moveMonthEndMasterRecordsToCountry,
  parseMappedCountryMasterCsv,
  parseCountryMasterCsv,
  replaceMonthEndCountryMasterRecords,
  type MonthEndMasterRecord,
} from "@/lib/month-end-master-records"
import {
  getMonthEndTemplate,
  isDefaultCountryReportMapping,
  isDefaultMasterReportMapping,
  loadMonthEndTemplate,
  type TemplateCountryRow,
} from "@/lib/month-end-template"
import {
  extractWorkbookRows,
  parseMappedCountryReportCsv,
  parseCountryReportUploadFile,
  parseCountryReportText,
  type AntaserJournalDocument,
  type AntaserJournalDocumentKind,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
import {
  listMonthEndCountryReportRecords,
  makeCountryReportRecords,
  replaceMonthEndCountryReportRecords,
  type MonthEndCountryReportRecord,
} from "@/lib/month-end-country-report-records"
import {
  leftInvoiceKey,
  parseApprovedInternalIds,
  rollApprovalKey,
  serializeApprovedInternalIds,
} from "@/lib/month-end-roll-invoices"

const ANGOLA_OOT_COUNTRY_ID = "angola-oot"
const ANGOLA_OOT_COUNTRY_NAME = "Angola OOT"

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatTransactionDate(value: string | undefined) {
  const rawValue = (value ?? "").trim()

  if (!rawValue) {
    return "-"
  }

  const isoDate = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)

  if (isoDate) {
    return `${Number(isoDate[2])}/${Number(isoDate[3])}/${isoDate[1]}`
  }

  const slashDate = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)

  if (slashDate) {
    return `${Number(slashDate[1])}/${Number(slashDate[2])}/${slashDate[3]}`
  }

  const parsedDate = new Date(rawValue)

  return Number.isNaN(parsedDate.getTime())
    ? rawValue
    : `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function sourceFileNameKey(rowId: string, source: "master" | "country") {
  return `${rowId}__${source}_source_file`
}

function antaserJournalDocumentsKey(rowId: string) {
  return `${rowId}__antaser_journal_documents`
}

function journalEntrySnapshotKey(rowId: string) {
  return `${rowId}__journal_entry_snapshot`
}

type CountryDashboardSection = "netsuite" | "country" | "left" | "rolled"

function countryDashboardSectionKey(rowId: string) {
  return `${rowId}__country_dashboard_section`
}

function parseCountryDashboardSection(value: unknown): CountryDashboardSection {
  return value === "country" || value === "left" || value === "rolled"
    ? value
    : "netsuite"
}

function parseAntaserJournalDocuments(value: unknown) {
  if (typeof value !== "string" || !value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    return Array.isArray(parsed) ? (parsed as AntaserJournalDocument[]) : []
  } catch {
    return []
  }
}

function parseMasterTransactionDates(value: unknown) {
  if (typeof value !== "string" || !value) {
    return new Map<string, string>()
  }

  try {
    const parsed = JSON.parse(value)

    if (typeof parsed === "object" && parsed !== null) {
      return new Map(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    }
  } catch {}

  return new Map<string, string>()
}

function monthEndTaskKey(rowId: string, taskId: "reconcile" | "journal") {
  return `${rowId}__${taskId}`
}

function getUploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return fallback
}

async function reportFileToCsvText(file: File, period?: string) {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "xlsx" || extension === "xls") {
    return extractWorkbookRows(file, { period })
  }

  return file.text()
}

function lineItemCountryName(value: string | undefined) {
  const countryName = (value ?? "").trim()

  return countryName && !countryName.includes("/") ? countryName : ""
}

function mergeCountryReportRecords(records: MonthEndCountryReportRecord[]) {
  const recordsById = new Map<string, MonthEndCountryReportRecord>()

  for (const record of records) {
    recordsById.set(record.id, record)
  }

  return Array.from(recordsById.values())
}

function normalizeMatchKey(value: string | undefined | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function matchCandidates(
  masterRecord: MonthEndMasterRecord,
  countryRecord: MonthEndCountryReportRecord
) {
  return [
    {
      label: "BL",
      masterValue: masterRecord.billOfLadingNumber,
      countryValues: [
        countryRecord.billOfLadingNumber,
        countryRecord.reference,
      ],
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

function masterReferenceCandidates(masterRecord: MonthEndMasterRecord) {
  return [
    { label: "BL", value: masterRecord.billOfLadingNumber },
    { label: "CTN", value: masterRecord.ctnNumber },
    { label: "Invoice", value: masterRecord.salesOrderNumber },
  ].flatMap((candidate) => {
    const normalizedValue = normalizeMatchKey(candidate.value)

    return normalizedValue
      ? [{ ...candidate, key: `${candidate.label}:${normalizedValue}` }]
      : []
  })
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
  const masterReferenceCounts = new Map<string, number>()

  for (const masterRecord of masterRecords) {
    for (const reference of masterReferenceCandidates(masterRecord)) {
      masterReferenceCounts.set(
        reference.key,
        (masterReferenceCounts.get(reference.key) ?? 0) + 1
      )
    }
  }

  const matchedCountryByReference = new Map<
    string,
    MonthEndCountryReportRecord
  >()

  for (const match of matched) {
    for (const reference of masterReferenceCandidates(match.masterRecord)) {
      matchedCountryByReference.set(reference.key, match.countryRecord)
    }
  }

  const linkedMasterRecordIds = new Set<string>()
  const linkedReferenceMatches = masterRecords.flatMap((masterRecord) => {
    if (matchedMasterIds.has(masterRecord.id)) {
      return []
    }

    const linkedReference = masterReferenceCandidates(masterRecord).find(
      (reference) =>
        (masterReferenceCounts.get(reference.key) ?? 0) > 1 &&
        matchedCountryByReference.has(reference.key)
    )
    const countryRecord = linkedReference
      ? matchedCountryByReference.get(linkedReference.key)
      : undefined

    if (!linkedReference || !countryRecord) {
      return []
    }

    matchedMasterIds.add(masterRecord.id)
    linkedMasterRecordIds.add(masterRecord.id)

    return [
      {
        id: `${masterRecord.id}__${countryRecord.id}`,
        masterRecord,
        countryRecord,
        matchedOn: {
          label: `Linked ${linkedReference.label}`,
          value: linkedReference.value,
        },
      },
    ]
  })

  return {
    matched: [...matched, ...linkedReferenceMatches],
    linkedMasterRecordIds,
    missingFromNetSuite: countryRecords.filter(
      (record) => !matchedCountryIds.has(record.id)
    ),
    missingFromCountry: masterRecords.filter(
      (record) => !matchedMasterIds.has(record.id)
    ),
  }
}

function ReconciliationWorkbench({
  countryRecords,
  masterRecords,
  matchedRecords,
  missingCountryRecordIds,
  missingMasterRecordIds,
  rolledInternalIds,
  leftInvoiceRecordIds,
  showCountryColumn,
  onDropMasterFile,
  onDropCountryFiles,
  canEditCountryData = true,
  isReadOnly = false,
  countryId,
  countryName,
  countryRecordCount,
  masterRecordCount,
  matchedCountryCount,
  matchedMasterCount,
  onRollInvoices,
  onLeaveInvoices,
  onMoveInvoicesToOot,
}: {
  countryRecords: MonthEndCountryReportRecord[]
  masterRecords: MonthEndMasterRecord[]
  matchedRecords: ReturnType<typeof reconcileRecords>["matched"]
  missingCountryRecordIds: Set<string>
  missingMasterRecordIds: Set<string>
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  showCountryColumn: boolean
  onDropMasterFile: (file: File) => void
  onDropCountryFiles: (files: File[]) => void
  canEditCountryData?: boolean
  isReadOnly?: boolean
  countryId?: string
  countryName: string
  countryRecordCount: number
  masterRecordCount: number
  matchedCountryCount: number
  matchedMasterCount: number
  onRollInvoices: (
    records: MonthEndMasterRecord[]
  ) => Promise<{ savedCount: number; excludedCount: number }>
  onLeaveInvoices: (records: MonthEndMasterRecord[]) => Promise<void>
  onMoveInvoicesToOot?: (
    records: MonthEndMasterRecord[]
  ) => Promise<{ movedCount: number }>
}) {
  const [selectedMasterRecordIds, setSelectedMasterRecordIds] = React.useState(
    () => new Set<string>()
  )
  const [isRollingInvoices, setIsRollingInvoices] = React.useState(false)
  const [isMovingInvoicesToOot, setIsMovingInvoicesToOot] =
    React.useState(false)
  const [rollInvoiceMessage, setRollInvoiceMessage] = React.useState("")
  const [hiddenMasterRecordIds, setHiddenMasterRecordIds] = React.useState(
    () => new Set<string>()
  )
  const [dragTarget, setDragTarget] = React.useState<
    "country" | "master" | null
  >(null)
  const visibleCountryIds = new Set(countryRecords.map((record) => record.id))
  const visibleMasterIds = new Set(masterRecords.map((record) => record.id))
  const rolledInternalIdSet = new Set(rolledInternalIds)
  const leftInvoiceRecordIdSet = new Set(leftInvoiceRecordIds)
  const countryRows = countryRecords
    .filter((record) => missingCountryRecordIds.has(record.id))
    .map((record) => ({
      record,
    }))
    .sort((first, second) => {
      return (first.record.reference || first.record.ctnNumber).localeCompare(
        second.record.reference || second.record.ctnNumber
      )
    })
  const masterRows = masterRecords
    .filter(
      (record) =>
        missingMasterRecordIds.has(record.id) &&
        !leftInvoiceRecordIdSet.has(record.id) &&
        !hiddenMasterRecordIds.has(record.id) &&
        (!record.sourceInternalId ||
          !rolledInternalIdSet.has(record.sourceInternalId))
    )
    .map((record) => ({
      record,
    }))
    .sort((first, second) => {
      return first.record.salesOrderNumber.localeCompare(
        second.record.salesOrderNumber
      )
    })
  const matchedRows = matchedRecords
    .filter(
      (match) =>
        visibleCountryIds.has(match.countryRecord.id) &&
        visibleMasterIds.has(match.masterRecord.id)
    )
    .sort((first, second) =>
      first.masterRecord.salesOrderNumber.localeCompare(
        second.masterRecord.salesOrderNumber
      )
    )
  const matchedRowCount = new Set(
    matchedRows.map(({ countryRecord }) => countryRecord.id)
  ).size
  const billOfLadingMatchCount = matchedRecords.filter(({ matchedOn }) =>
    matchedOn?.label.includes("BL")
  ).length
  const ctnMatchCount = matchedRecords.filter(({ matchedOn }) =>
    matchedOn?.label.includes("CTN")
  ).length
  const countryBillOfLadingCount = countryRecords.filter(
    (record) => normalizeMatchKey(record.billOfLadingNumber).length > 0
  ).length
  const countryCtnCount = countryRecords.filter(
    (record) => normalizeMatchKey(record.ctnNumber).length > 0
  ).length
  const showCtnReference =
    ctnMatchCount > billOfLadingMatchCount ||
    (ctnMatchCount === billOfLadingMatchCount &&
      countryCtnCount > countryBillOfLadingCount)
  const masterReferenceLabel = showCtnReference ? "CTN" : "Bill of Lading"
  const showAngolaNetSuiteReferences = countryId === "angola"
  const countryTotal = countryRows.reduce(
    (sum, { record }) => sum + record.amount,
    0
  )
  const masterTotal = masterRows.reduce(
    (sum, { record }) => sum + record.amount,
    0
  )
  const allMasterRowsSelected =
    masterRows.length > 0 &&
    masterRows.every(({ record }) => selectedMasterRecordIds.has(record.id))
  const selectedMasterRecords = masterRows
    .map(({ record }) => record)
    .filter((record) => selectedMasterRecordIds.has(record.id))

  function countryCellLabel(record: MonthEndCountryReportRecord) {
    return (
      record.sourceCountryName ||
      lineItemCountryName(record.countryName) ||
      countryName
    )
  }

  function toggleAllMasterRows(checked: boolean) {
    setSelectedMasterRecordIds((current) => {
      const next = new Set(current)

      for (const { record } of masterRows) {
        if (checked) {
          next.add(record.id)
        } else {
          next.delete(record.id)
        }
      }

      return next
    })
  }

  function toggleMasterRow(recordId: string, checked: boolean) {
    setSelectedMasterRecordIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(recordId)
      } else {
        next.delete(recordId)
      }

      return next
    })
  }

  function toggleMasterRowSelection(recordId: string) {
    setSelectedMasterRecordIds((current) => {
      const next = new Set(current)

      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }

      return next
    })
  }

  async function rollSelectedInvoices() {
    const rollingRecordIds = selectedMasterRecords.map((record) => record.id)

    setIsRollingInvoices(true)
    setRollInvoiceMessage("")
    setHiddenMasterRecordIds((current) => {
      const next = new Set(current)

      for (const recordId of rollingRecordIds) {
        next.add(recordId)
      }

      return next
    })
    setSelectedMasterRecordIds(new Set())

    try {
      const result = await onRollInvoices(selectedMasterRecords)
      const savedLabel = `${result.savedCount} invoice${result.savedCount === 1 ? "" : "s"} added`
      const excludedLabel = result.excludedCount
        ? ` ${result.excludedCount} selected record${result.excludedCount === 1 ? " was" : "s were"} excluded because no Internal ID was provided by NetSuite.`
        : ""

      setRollInvoiceMessage(`${savedLabel}.${excludedLabel}`)
    } catch (error) {
      setHiddenMasterRecordIds((current) => {
        const next = new Set(current)

        for (const recordId of rollingRecordIds) {
          next.delete(recordId)
        }

        return next
      })
      setRollInvoiceMessage("Could not save the selected invoice IDs.")
    } finally {
      setIsRollingInvoices(false)
    }
  }

  async function leaveSelectedInvoices() {
    const leavingRecordIds = selectedMasterRecords.map((record) => record.id)

    if (!leavingRecordIds.length) {
      return
    }

    setRollInvoiceMessage("")
    setHiddenMasterRecordIds((current) => {
      const next = new Set(current)

      for (const recordId of leavingRecordIds) {
        next.add(recordId)
      }

      return next
    })
    setSelectedMasterRecordIds(new Set())

    try {
      await onLeaveInvoices(selectedMasterRecords)
      setRollInvoiceMessage(
        `${leavingRecordIds.length} invoice${leavingRecordIds.length === 1 ? "" : "s"} left in month end.`
      )
    } catch {
      setHiddenMasterRecordIds((current) => {
        const next = new Set(current)

        for (const recordId of leavingRecordIds) {
          next.delete(recordId)
        }

        return next
      })
      setRollInvoiceMessage("Could not save the selected left invoices.")
    }
  }

  function getDroppedFiles(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragTarget(null)

    return Array.from(event.dataTransfer.files ?? [])
  }

  async function moveSelectedInvoicesToOot() {
    if (!onMoveInvoicesToOot || !selectedMasterRecords.length) {
      return
    }

    const movingRecordIds = selectedMasterRecords.map((record) => record.id)

    setIsMovingInvoicesToOot(true)
    setRollInvoiceMessage("")
    setHiddenMasterRecordIds((current) => {
      const next = new Set(current)

      for (const recordId of movingRecordIds) {
        next.add(recordId)
      }

      return next
    })
    setSelectedMasterRecordIds(new Set())

    try {
      const result = await onMoveInvoicesToOot(selectedMasterRecords)
      setRollInvoiceMessage(
        `${result.movedCount} invoice${result.movedCount === 1 ? "" : "s"} moved to ${ANGOLA_OOT_COUNTRY_NAME}.`
      )
    } catch (error) {
      setHiddenMasterRecordIds((current) => {
        const next = new Set(current)

        for (const recordId of movingRecordIds) {
          next.delete(recordId)
        }

        return next
      })
      setRollInvoiceMessage(
        getUploadErrorMessage(
          error,
          `Could not move the selected invoices to ${ANGOLA_OOT_COUNTRY_NAME}.`
        )
      )
    } finally {
      setIsMovingInvoicesToOot(false)
    }
  }

  return (
    <div className="grid min-h-0 gap-3 xl:gap-4">
      <div className="grid min-h-0 items-stretch gap-4 lg:min-h-[calc(100svh-var(--header-height)-5.5rem)] lg:grid-cols-2">
        <section
          className={
            "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background p-3 transition-colors " +
            (dragTarget === "country" ? "border-primary bg-primary/5" : "")
          }
          onDragOver={(event) => {
            if (isReadOnly || !canEditCountryData) {
              return
            }

            event.preventDefault()
            setDragTarget("country")
          }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(event) => {
            if (isReadOnly || !canEditCountryData) {
              return
            }

            const files = getDroppedFiles(event)

            if (files.length) {
              onDropCountryFiles(files)
            }
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal">Country</h2>
          </div>
          <div className="grid min-h-0 gap-2 overflow-y-auto pb-3 md:hidden">
            {countryRows.length ? (
              countryRows.map(({ record }) => (
                <article
                  key={record.id}
                  className="rounded-lg border bg-muted/20 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold break-words">
                        {record.ctnNumber || "-"}
                      </div>
                      <div className="mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 text-xs">
                        <span className="text-muted-foreground">BL</span>
                        <span className="break-words">
                          {record.billOfLadingNumber || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatAmount(record.amount)}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No country-only records.
              </div>
            )}
          </div>
          <div className="hidden min-h-0 overflow-x-hidden overflow-y-auto pb-3 md:block">
            <Table
              className="w-full table-fixed text-xs"
              containerClassName="overflow-x-hidden"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Country</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>CTN</TableHead>
                  <TableHead>Bill of Lading</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countryRows.length ? (
                  countryRows.map(({ record }) => (
                    <TableRow key={record.id} className="h-12">
                      <TableCell className="min-w-0">
                        <span
                          className="block truncate"
                          title={countryCellLabel(record)}
                        >
                          {countryCellLabel(record)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium break-words">
                        {record.reference || record.invoiceNumber || "-"}
                      </TableCell>
                      <TableCell className="break-words">
                        {record.ctnNumber || "-"}
                      </TableCell>
                      <TableCell className="break-words">
                        {record.billOfLadingNumber || "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(record.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No country-only records.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="-mx-3 -mb-3 flex h-12 items-center justify-between border-t bg-muted/50 px-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span>Matched</span>
              <span className="rounded-full border bg-background px-2 py-0.5 tabular-nums">
                {matchedCountryCount} / {countryRecordCount}
              </span>
            </div>
            <span className="text-muted-foreground tabular-nums">
              Open {formatAmount(countryTotal)}
            </span>
          </div>
        </section>
        <section
          className={
            "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background p-3 transition-colors " +
            (dragTarget === "master" ? "border-primary bg-primary/5" : "")
          }
          onDragOver={(event) => {
            if (isReadOnly) {
              return
            }

            event.preventDefault()
            setDragTarget("master")
          }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(event) => {
            if (isReadOnly) {
              return
            }

            const [file] = getDroppedFiles(event)

            if (file) {
              onDropMasterFile(file)
            }
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal">NetSuite</h2>
            <div className="flex items-center gap-2">
              {!isReadOnly &&
              showAngolaNetSuiteReferences &&
              selectedMasterRecords.length &&
              onMoveInvoicesToOot ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={isRollingInvoices || isMovingInvoicesToOot}
                  onClick={moveSelectedInvoicesToOot}
                >
                  <ArrowRightIcon />
                  Move to OOT
                </Button>
              ) : null}
              {!isReadOnly && selectedMasterRecords.length ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={isRollingInvoices || isMovingInvoicesToOot}
                    onClick={leaveSelectedInvoices}
                  >
                    <ArrowRightIcon />
                    Leave Invoices ({selectedMasterRecords.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={isRollingInvoices || isMovingInvoicesToOot}
                    onClick={rollSelectedInvoices}
                  >
                    <FileOutputIcon />
                    Roll Invoices ({selectedMasterRecords.length})
                  </Button>
                </>
              ) : !isReadOnly && masterRows.length === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={isRollingInvoices || isMovingInvoicesToOot}
                  onClick={rollSelectedInvoices}
                >
                  <ArrowRightIcon />
                  Proceed
                </Button>
              ) : null}
            </div>
          </div>
          {masterRecords.length ? (
            <>
              <div className="grid min-h-0 gap-2 overflow-y-auto pb-3 md:hidden">
                {masterRows.length ? (
                  masterRows.map(({ record }) => (
                    <article
                      key={record.id}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={selectedMasterRecordIds.has(record.id)}
                      className={
                        "rounded-lg border bg-muted/20 p-3 text-sm transition-colors " +
                        (isReadOnly
                          ? ""
                          : selectedMasterRecordIds.has(record.id)
                            ? "cursor-pointer border-primary bg-primary/5"
                            : "cursor-pointer hover:bg-muted/40")
                      }
                      onClick={() => {
                        if (!isReadOnly) {
                          toggleMasterRowSelection(record.id)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (isReadOnly) {
                          return
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          toggleMasterRowSelection(record.id)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedMasterRecordIds.has(record.id)}
                          onCheckedChange={(checked) =>
                            toggleMasterRow(record.id, checked === true)
                          }
                          aria-label={`Select NetSuite record ${record.salesOrderNumber || record.id}`}
                          className="mt-0.5 shrink-0"
                          disabled={isReadOnly}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-muted-foreground">
                                {formatTransactionDate(record.transactionDate)}
                              </div>
                              <div className="font-semibold break-words">
                                {showAngolaNetSuiteReferences
                                  ? record.billOfLadingNumber || "-"
                                  : record.salesOrderNumber || "-"}
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                              {formatAmount(record.amount)}
                            </div>
                          </div>
                          <dl className="mt-3 grid gap-2 text-xs">
                            {showAngolaNetSuiteReferences ? (
                              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                                <dt className="text-muted-foreground">CTN</dt>
                                <dd className="break-words">
                                  {record.ctnNumber || "-"}
                                </dd>
                              </div>
                            ) : (
                              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                                <dt className="text-muted-foreground">
                                  {masterReferenceLabel}
                                </dt>
                                <dd className="break-words">
                                  {(showCtnReference
                                    ? record.ctnNumber
                                    : record.billOfLadingNumber) || "-"}
                                </dd>
                              </div>
                            )}
                            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                              <dt className="text-muted-foreground">Status</dt>
                              <dd className="break-words">
                                {record.status || "-"}
                              </dd>
                            </div>
                            {showCountryColumn ? (
                              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                                <dt className="text-muted-foreground">
                                  Country
                                </dt>
                                <dd className="break-words">
                                  {record.countryName || "-"}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No NetSuite-only records.
                  </div>
                )}
              </div>
              <div className="hidden min-h-0 overflow-x-hidden overflow-y-auto pb-3 md:block">
                <Table
                  className="w-full table-fixed text-xs"
                  containerClassName="overflow-x-hidden"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={allMasterRowsSelected}
                          onCheckedChange={(checked) =>
                            toggleAllMasterRows(checked === true)
                          }
                          aria-label="Select all unmatched NetSuite records"
                        />
                      </TableHead>
                      <TableHead className="w-24">Date</TableHead>
                      {showAngolaNetSuiteReferences ? (
                        <>
                          <TableHead>Bill of Lading</TableHead>
                          <TableHead>CTN</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Sales Order</TableHead>
                          <TableHead>{masterReferenceLabel}</TableHead>
                        </>
                      )}
                      <TableHead className="w-[18%]">Status</TableHead>
                      <TableHead className="w-24 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRows.length ? (
                      masterRows.map(({ record }) => (
                        <TableRow
                          key={record.id}
                          aria-selected={selectedMasterRecordIds.has(record.id)}
                          className={
                            "h-12 " + (isReadOnly ? "" : "cursor-pointer")
                          }
                          onClick={() => {
                            if (!isReadOnly) {
                              toggleMasterRowSelection(record.id)
                            }
                          }}
                          onKeyDown={(event) => {
                            if (isReadOnly) {
                              return
                            }

                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              toggleMasterRowSelection(record.id)
                            }
                          }}
                          tabIndex={0}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedMasterRecordIds.has(record.id)}
                              onCheckedChange={(checked) =>
                                toggleMasterRow(record.id, checked === true)
                              }
                              aria-label={`Select NetSuite record ${record.salesOrderNumber || record.id}`}
                              disabled={isReadOnly}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="break-words tabular-nums">
                            {formatTransactionDate(record.transactionDate)}
                          </TableCell>
                          {showAngolaNetSuiteReferences ? (
                            <>
                              <TableCell className="break-words">
                                {record.billOfLadingNumber || "-"}
                              </TableCell>
                              <TableCell className="break-words">
                                {record.ctnNumber || "-"}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-medium break-words">
                                {record.salesOrderNumber || "-"}
                              </TableCell>
                              <TableCell className="break-words">
                                {(showCtnReference
                                  ? record.ctnNumber
                                  : record.billOfLadingNumber) || "-"}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="break-words">
                            {record.status || "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatAmount(record.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          No NetSuite-only records.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Upload or replace the NetSuite report from the Upload menu.
            </div>
          )}
          {rollInvoiceMessage ? (
            <p className="px-1 pb-2 text-xs text-muted-foreground">
              {rollInvoiceMessage}
            </p>
          ) : null}
          <div className="-mx-3 -mb-3 flex h-12 items-center justify-between border-t bg-muted/50 px-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span>Matched</span>
              <span className="rounded-full border bg-background px-2 py-0.5 tabular-nums">
                {matchedMasterCount} / {masterRecordCount}
              </span>
            </div>
            <span className="text-muted-foreground tabular-nums">
              Open {formatAmount(masterTotal)}
            </span>
          </div>
        </section>
      </div>
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-normal">Matched</h2>
          <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {matchedRowCount} matched
          </span>
        </div>
        <div className="grid min-h-0 gap-2 overflow-y-auto pb-3 md:hidden">
          {matchedRows.length ? (
            matchedRows.map(
              ({ id, countryRecord, masterRecord, matchedOn }) => (
                <article
                  key={id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900/70 dark:bg-emerald-950/20"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-muted-foreground">
                            Country record
                          </div>
                          <div className="font-semibold break-words">
                            {countryRecord.reference ||
                              countryRecord.invoiceNumber ||
                              "-"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                          {formatAmount(countryRecord.amount)}
                        </div>
                      </div>
                      <dl className="mt-3 grid gap-2 text-xs">
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                          <dt className="text-muted-foreground">NetSuite</dt>
                          <dd className="break-words">
                            {masterRecord.salesOrderNumber || "-"}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                          <dt className="text-muted-foreground">Match</dt>
                          <dd className="break-words">
                            {matchedOn
                              ? `${matchedOn.label}: ${matchedOn.value}`
                              : "-"}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                          <dt className="text-muted-foreground">CTN</dt>
                          <dd className="break-words">
                            {countryRecord.ctnNumber ||
                              masterRecord.ctnNumber ||
                              "-"}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                          <dt className="text-muted-foreground">Bill</dt>
                          <dd className="break-words">
                            {countryRecord.billOfLadingNumber ||
                              masterRecord.billOfLadingNumber ||
                              "-"}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                          <dt className="text-muted-foreground">NS amount</dt>
                          <dd className="break-words tabular-nums">
                            {formatAmount(masterRecord.amount)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </article>
              )
            )
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No matched records.
            </div>
          )}
        </div>
        <div className="hidden min-h-0 overflow-auto pb-3 md:block">
          <Table
            className="min-w-[58rem] table-fixed text-xs"
            containerClassName="overflow-visible"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Country</TableHead>
                <TableHead>NetSuite</TableHead>
                <TableHead className="w-44">Matched By</TableHead>
                <TableHead className="w-40 text-right">Amounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchedRows.length ? (
                matchedRows.map(
                  ({ id, countryRecord, masterRecord, matchedOn }) => {
                    return (
                      <TableRow
                        key={id}
                        className="bg-emerald-50/60 transition-colors hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                      >
                        <TableCell className="align-top">
                          <CheckCircle2Icon className="size-4 text-emerald-600" />
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1.5 text-muted-foreground">
                            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
                              <span>CTN Num</span>
                              <span className="break-words text-foreground">
                                {countryRecord.ctnNumber || "-"}
                              </span>
                            </div>
                            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
                              <span>BL Num</span>
                              <span className="break-words text-foreground">
                                {countryRecord.billOfLadingNumber || "-"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1.5 text-muted-foreground">
                            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
                              <span>CTN Num</span>
                              <span className="break-words text-foreground">
                                {masterRecord.ctnNumber || "-"}
                              </span>
                            </div>
                            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
                              <span>BL Num</span>
                              <span className="break-words text-foreground">
                                {masterRecord.billOfLadingNumber || "-"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {matchedOn ? (
                            <div className="grid gap-1">
                              <span className="text-[0.7rem] font-medium text-muted-foreground">
                                {matchedOn.label}
                              </span>
                              <span className="font-medium break-words">
                                {matchedOn.value}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          <div className="grid gap-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Country
                              </span>
                              <span className="font-semibold">
                                {formatAmount(countryRecord.amount)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">NS</span>
                              <span>{formatAmount(masterRecord.amount)}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No matched records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
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

function CountryReportUploadStep({
  countryReportLabel,
  masterCount,
  isUploading,
  canPasteReport,
  isAntaserPackage,
  onChooseFile,
  onPasteReport,
  onFiles,
}: {
  countryReportLabel: string
  masterCount: number
  isUploading: boolean
  canPasteReport: boolean
  isAntaserPackage?: boolean
  onChooseFile: () => void
  onPasteReport: () => void
  onFiles: (files: File[]) => void
}) {
  const [isDragging, setIsDragging] = React.useState(false)

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    const files = Array.from(event.dataTransfer.files ?? [])

    if (files.length) {
      onFiles(files)
    }
  }

  return (
    <section
      role="button"
      tabIndex={0}
      className={
        "grid min-h-[22rem] cursor-pointer place-items-center rounded-xl border border-dashed bg-background p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[26rem] " +
        (isDragging ? "border-primary bg-muted/60" : "hover:bg-muted/40")
      }
      onClick={onChooseFile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onChooseFile()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="grid max-w-xl gap-4">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          <UploadIcon className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">
            {isAntaserPackage
              ? "Upload Antaser Documents"
              : `Upload ${countryReportLabel}`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAntaserPackage
              ? "Select the CIS invoice, CIS overview, JACR invoice, and commission note together."
              : "Drop the country report here, or choose the file you downloaded from the country portal. After import, this page will move you to the records that still need to be found in NetSuite."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChooseFile()
            }}
            disabled={isUploading}
          >
            <FileSpreadsheetIcon />
            {isUploading
              ? "Uploading"
              : isAntaserPackage
                ? "Choose 4 PDFs"
                : "Choose Report"}
          </Button>
          {canPasteReport ? (
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation()
                onPasteReport()
              }}
            >
              <ClipboardPasteIcon />
              Paste Report
            </Button>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          NetSuite master: {pluralize(masterCount, "record")} loaded
        </div>
      </div>
    </section>
  )
}

function DashboardMasterTable({
  sections,
}: {
  sections: { label: string; records: MonthEndMasterRecord[] }[]
}) {
  const records = sections.flatMap((section) => section.records)
  const total = records.reduce((sum, record) => sum + record.amount, 0)

  return (
    <div className="h-full min-h-0 overflow-auto md:overflow-x-hidden md:overflow-y-auto">
      <Table
        className="min-w-[44rem] table-fixed text-xs md:w-full md:min-w-0"
        containerClassName="overflow-visible md:overflow-x-hidden"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">
              <span className="block pl-4">Date</span>
            </TableHead>
            <TableHead>Sales Order</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="w-[18%]">Status</TableHead>
            <TableHead className="w-24 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length ? (
            <>
              {records.map((record) => (
                <TableRow key={record.id} className="h-12">
                  <TableCell className="tabular-nums">
                    <span className="block pl-4">
                      {formatTransactionDate(record.transactionDate)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium break-words">
                    {record.salesOrderNumber || "-"}
                  </TableCell>
                  <TableCell className="break-words">
                    {record.billOfLadingNumber
                      ? `BL: ${record.billOfLadingNumber}`
                      : record.ctnNumber
                        ? `CTN: ${record.ctnNumber}`
                        : "-"}
                  </TableCell>
                  <TableCell className="break-words">
                    {record.status || "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(record.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="h-12 bg-muted/50 font-semibold hover:bg-muted/50">
                <TableCell colSpan={4}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(total)}
                </TableCell>
              </TableRow>
            </>
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function DashboardCountryTable({
  records,
  countryName,
}: {
  records: MonthEndCountryReportRecord[]
  countryName: string
}) {
  const total = records.reduce((sum, record) => sum + record.amount, 0)

  function countryCellLabel(record: MonthEndCountryReportRecord) {
    return (
      record.sourceCountryName ||
      lineItemCountryName(record.countryName) ||
      countryName
    )
  }

  return (
    <div className="h-full min-h-0 overflow-auto md:overflow-x-hidden md:overflow-y-auto">
      <Table
        className="min-w-[44rem] table-fixed text-xs md:w-full md:min-w-0"
        containerClassName="overflow-visible md:overflow-x-hidden"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">Country</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>CTN</TableHead>
            <TableHead>Bill of Lading</TableHead>
            <TableHead className="w-24 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length ? (
            <>
              {records.map((record) => (
                <TableRow key={record.id} className="h-12">
                  <TableCell className="min-w-0">
                    <span
                      className="block truncate"
                      title={countryCellLabel(record)}
                    >
                      {countryCellLabel(record)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium break-words">
                    {record.reference || record.invoiceNumber || "-"}
                  </TableCell>
                  <TableCell className="break-words">
                    {record.ctnNumber || "-"}
                  </TableCell>
                  <TableCell className="break-words">
                    {record.billOfLadingNumber || "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(record.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="h-12 bg-muted/50 font-semibold hover:bg-muted/50">
                <TableCell colSpan={4}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(total)}
                </TableCell>
              </TableRow>
            </>
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function DashboardDataTableSkeleton() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <Table
        className="min-w-[44rem] table-fixed text-xs md:w-full md:min-w-0"
        containerClassName="overflow-hidden"
      >
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-20 rounded-md" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24 rounded-md" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20 rounded-md" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-28 rounded-md" />
            </TableHead>
            <TableHead>
              <Skeleton className="ml-auto h-4 w-16 rounded-md" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <TableRow key={rowIndex} className="h-12">
              {Array.from({ length: 5 }).map((__, columnIndex) => (
                <TableCell key={columnIndex}>
                  <Skeleton
                    className={
                      "h-4 rounded-md " +
                      (columnIndex === 4
                        ? "ml-auto w-16"
                        : columnIndex === 1 || columnIndex === 3
                          ? "w-28"
                          : "w-20")
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="h-12 bg-muted/50 hover:bg-muted/50">
            <TableCell colSpan={4}>
              <Skeleton className="h-4 w-12 rounded-md" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-20 rounded-md" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function escapeDashboardCsvValue(value: string | number | undefined) {
  const text = String(value ?? "")

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function dashboardCsvFileName(countryName: string, sectionLabel: string) {
  const slug = `${countryName}-${sectionLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `${slug || "country-dashboard"}.csv`
}

function downloadDashboardCsv({
  fileName,
  csv,
}: {
  fileName: string
  csv: string
}) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function createDashboardMasterCsv(records: MonthEndMasterRecord[]) {
  const rows = records.map((record) => [
    formatTransactionDate(record.transactionDate),
    record.salesOrderNumber,
    record.billOfLadingNumber,
    record.ctnNumber,
    record.status,
    record.countryName,
    formatAmount(record.amount),
  ])

  return [
    [
      "Date",
      "Sales Order",
      "Bill of Lading",
      "CTN Number",
      "Status",
      "Country",
      "Amount",
    ],
    ...rows,
  ]
    .map((row) => row.map(escapeDashboardCsvValue).join(","))
    .join("\r\n")
}

function createDashboardCountryCsv(records: MonthEndCountryReportRecord[]) {
  const rows = records.map((record) => [
    record.sourceCountryName || record.countryName,
    record.reference || record.invoiceNumber,
    record.ctnNumber,
    record.billOfLadingNumber,
    formatAmount(record.amount),
  ])

  return [
    ["Country", "Reference", "CTN Number", "Bill of Lading", "Amount"],
    ...rows,
  ]
    .map((row) => row.map(escapeDashboardCsvValue).join(","))
    .join("\r\n")
}

function CountryNavigationButtons({
  onPrevious,
  onNext,
}: {
  onPrevious?: () => void
  onNext?: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="icon-sm"
        className="h-9 w-9 rounded-full md:h-9 md:w-9"
        aria-label="Previous country"
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <ArrowLeftIcon />
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        className="h-9 w-9 rounded-full md:h-9 md:w-9"
        aria-label="Next country"
        disabled={!onNext}
        onClick={onNext}
      >
        <ArrowRightIcon />
      </Button>
    </div>
  )
}

function CountryProcessBreadcrumb({
  activeView,
  reconciliationHref,
  journalHref,
  dashboardHref,
}: {
  activeView: "reconciliation" | "journal" | "dashboard"
  reconciliationHref: string
  journalHref: string
  dashboardHref: string
}) {
  const steps = [
    {
      value: "reconciliation",
      label: "Reconciliation",
      href: reconciliationHref,
    },
    {
      value: "journal",
      label: "Journal Entry",
      href: journalHref,
    },
    {
      value: "dashboard",
      label: "Country Dashboard",
      href: dashboardHref,
    },
  ] as const

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 text-xs sm:text-sm">
        {steps.map((step, index) => {
          const isActive = activeView === step.value

          return (
            <React.Fragment key={step.value}>
              {index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
              <BreadcrumbItem className="min-w-0 shrink-0">
                {isActive ? (
                  <BreadcrumbPage className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                    {step.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<AppLink href={step.href} />}
                    className="rounded-full px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {step.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function CountryReconciliationDashboard({
  countryName,
  masterRecords,
  countryRecords,
  reconciliation,
  reconciledCount,
  rolledInternalIds,
  leftInvoiceRecordIds,
  activeSection,
  onActiveSectionChange,
  onBack,
  onPreviousCountry,
  onNextCountry,
  reconciliationHref,
  journalHref,
  dashboardHref,
}: {
  countryName: string
  masterRecords: MonthEndMasterRecord[]
  countryRecords: MonthEndCountryReportRecord[]
  reconciliation: ReturnType<typeof reconcileRecords>
  reconciledCount: number
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  activeSection: CountryDashboardSection
  onActiveSectionChange: (
    section: CountryDashboardSection
  ) => Promise<void> | void
  onBack: () => void
  onPreviousCountry?: () => void
  onNextCountry?: () => void
  reconciliationHref: string
  journalHref: string
  dashboardHref: string
}) {
  const [displaySection, setDisplaySection] =
    React.useState<CountryDashboardSection>(activeSection)
  const [isTableLoading, setIsTableLoading] = React.useState(false)
  const reconciledMasterIds = new Set(
    reconciliation.matched.map(({ masterRecord }) => masterRecord.id)
  )
  const rolledInternalIdSet = new Set(rolledInternalIds)
  const leftInvoiceRecordIdSet = new Set(leftInvoiceRecordIds)
  const reconciledRecords = masterRecords.filter((record) =>
    reconciledMasterIds.has(record.id)
  )
  const rolledRecords = masterRecords.filter(
    (record) =>
      !reconciledMasterIds.has(record.id) &&
      Boolean(record.sourceInternalId) &&
      rolledInternalIdSet.has(record.sourceInternalId)
  )
  const rolledRecordIds = new Set(rolledRecords.map((record) => record.id))
  const leftInMonthRecords = masterRecords.filter(
    (record) =>
      !reconciledMasterIds.has(record.id) &&
      !rolledRecordIds.has(record.id) &&
      (leftInvoiceRecordIdSet.size === 0 ||
        leftInvoiceRecordIdSet.has(record.id))
  )
  const dashboardSections: {
    value: CountryDashboardSection
    label: string
    count: number
    records: MonthEndMasterRecord[] | MonthEndCountryReportRecord[]
  }[] = [
    {
      value: "netsuite",
      label: "NetSuite",
      count: masterRecords.length,
      records: masterRecords,
    },
    {
      value: "country",
      label: "Country",
      count: countryRecords.length,
      records: countryRecords,
    },
    {
      value: "left",
      label: "Left in Current Month",
      count: leftInMonthRecords.length,
      records: leftInMonthRecords,
    },
    {
      value: "rolled",
      label: "Rolled",
      count: rolledRecords.length,
      records: rolledRecords,
    },
  ]
  const activeDashboardSection =
    dashboardSections.find((section) => section.value === displaySection) ??
    dashboardSections[0]

  React.useEffect(() => {
    setDisplaySection(activeSection)
  }, [activeSection])

  async function chooseDashboardSection(section: CountryDashboardSection) {
    if (section === displaySection && !isTableLoading) {
      return
    }

    setDisplaySection(section)
    setIsTableLoading(true)

    try {
      await onActiveSectionChange(section)
    } finally {
      setIsTableLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="grid min-h-9 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="h-9 w-9 rounded-full md:h-9 md:w-9"
          aria-label="Back to month end"
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <CountryProcessBreadcrumb
          activeView="dashboard"
          reconciliationHref={reconciliationHref}
          journalHref={journalHref}
          dashboardHref={dashboardHref}
        />
        <div className="flex items-center gap-2">
          <CountryNavigationButtons
            onPrevious={onPreviousCountry}
            onNext={onNextCountry}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {dashboardSections.map((section) => {
          const isActive = activeDashboardSection.value === section.value
          const sectionCsv =
            section.value === "country"
              ? createDashboardCountryCsv(
                  section.records as MonthEndCountryReportRecord[]
                )
              : createDashboardMasterCsv(
                  section.records as MonthEndMasterRecord[]
                )

          return (
            <div key={section.value} className="group relative min-w-0">
              <button
                type="button"
                className={
                  "h-full w-full rounded-lg border bg-background p-3 pr-10 text-left transition-colors duration-0 md:p-4 md:pr-10 " +
                  (isActive
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/40")
                }
                onClick={() => chooseDashboardSection(section.value)}
              >
                <div className="text-[0.7rem] leading-tight font-medium text-muted-foreground sm:text-sm">
                  {section.label}
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums sm:text-3xl">
                  {section.count}
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      aria-label={`${section.label} actions`}
                    />
                  }
                >
                  <EllipsisVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem
                    onClick={() =>
                      downloadDashboardCsv({
                        fileName: dashboardCsvFileName(
                          countryName,
                          section.label
                        ),
                        csv: sectionCsv,
                      })
                    }
                  >
                    <DownloadIcon />
                    Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        {isTableLoading ? (
          <DashboardDataTableSkeleton />
        ) : activeDashboardSection.value === "country" ? (
          <DashboardCountryTable
            records={countryRecords}
            countryName={countryName}
          />
        ) : (
          <DashboardMasterTable
            sections={[
              {
                label: activeDashboardSection.label,
                records:
                  activeDashboardSection.records as MonthEndMasterRecord[],
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}

type JournalEntryRow = {
  account: string
  debit?: number
  credit?: number
  lineDescription?: string
  className?: string
}

type JournalEntrySnapshot = {
  createdAt: string
  entries: {
    countryName: string
    countryTotal: number
    exchangeRate?: number
    journalTotal: number
  }[]
  rows?: JournalEntryRow[]
  sourceDocumentCount?: number
}

function parseJournalEntrySnapshot(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as JournalEntrySnapshot

    return Array.isArray(parsed.entries) ? parsed : undefined
  } catch {
    return undefined
  }
}

function JournalEntryPreview({
  countryName,
  entries,
  journalRows,
  sourceDocumentCount,
  onBack,
  onPreviousCountry,
  onNextCountry,
  reconciliationHref,
  journalHref,
  dashboardHref,
  onMakeJournalEntry,
}: {
  countryName: string
  entries: {
    countryName: string
    countryTotal: number
    exchangeRate?: number
    journalTotal: number
  }[]
  journalRows?: JournalEntryRow[]
  sourceDocumentCount?: number
  onBack: () => void
  onPreviousCountry?: () => void
  onNextCountry?: () => void
  reconciliationHref: string
  journalHref: string
  dashboardHref: string
  onMakeJournalEntry: () => Promise<void>
}) {
  const [isSaving, setIsSaving] = React.useState(false)
  const countryTotal = entries.reduce(
    (sum, entry) => sum + entry.countryTotal,
    0
  )
  const journalTotal = entries.reduce(
    (sum, entry) => sum + entry.journalTotal,
    0
  )
  const journalDebitTotal = journalRows?.reduce(
    (sum, row) => sum + (row.debit ?? 0),
    0
  )
  const journalCreditTotal = journalRows?.reduce(
    (sum, row) => sum + (row.credit ?? 0),
    0
  )
  const hasDetailedJournal = Boolean(journalRows?.length)
  const exchangeRateLabel =
    entries.length === 1
      ? entries[0]?.exchangeRate?.toFixed(4) || "Not applied"
      : "By country"

  async function makeJournalEntry() {
    setIsSaving(true)

    try {
      await onMakeJournalEntry()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="grid min-h-9 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="h-9 w-9 rounded-full md:h-9 md:w-9"
          aria-label="Back to reconciliation report"
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <CountryProcessBreadcrumb
          activeView="journal"
          reconciliationHref={reconciliationHref}
          journalHref={journalHref}
          dashboardHref={dashboardHref}
        />
        <div className="flex items-center gap-2">
          <CountryNavigationButtons
            onPrevious={onPreviousCountry}
            onNext={onNextCountry}
          />
        </div>
      </div>

      <div className="grid flex-1 place-items-start md:place-items-center">
        <section
          role="dialog"
          aria-labelledby="journal-entry-title"
          className={`w-full overflow-hidden rounded-lg border bg-background ${
            hasDetailedJournal ? "max-w-6xl" : "max-w-3xl"
          }`}
        >
          <div className="border-b p-5">
            <h2
              id="journal-entry-title"
              className="text-xl font-semibold tracking-normal"
            >
              Create Journal Entry
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{countryName}</p>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {hasDetailedJournal ? (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Source documents
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {sourceDocumentCount ?? 0} / 4
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Total debit
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {formatAmount(journalDebitTotal ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Total credit
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {formatAmount(journalCreditTotal ?? 0)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Country report total
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {formatAmount(countryTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Exchange rate
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {exchangeRateLabel}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Journal total
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {formatAmount(journalTotal)}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table
                className={
                  hasDetailedJournal ? "table-fixed text-xs" : undefined
                }
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-32 text-right">Debit</TableHead>
                    <TableHead className="w-32 text-right">Credit</TableHead>
                    {hasDetailedJournal ? (
                      <>
                        <TableHead className="w-[20%]">
                          Line Description
                        </TableHead>
                        <TableHead className="w-[30%]">Class</TableHead>
                      </>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasDetailedJournal
                    ? journalRows?.map((row, index) => (
                        <TableRow
                          key={`${row.account}-${row.className}-${index}`}
                        >
                          <TableCell className="font-medium break-words whitespace-normal">
                            {row.account}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.debit === undefined
                              ? ""
                              : formatAmount(row.debit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.credit === undefined
                              ? ""
                              : formatAmount(row.credit)}
                          </TableCell>
                          <TableCell className="break-words whitespace-normal">
                            {row.lineDescription || ""}
                          </TableCell>
                          <TableCell className="break-words whitespace-normal">
                            {row.className || ""}
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                  {!hasDetailedJournal ? (
                    <TableRow>
                      <TableCell className="font-medium">Income</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(journalTotal)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!hasDetailedJournal
                    ? entries.map((entry) => (
                        <TableRow key={entry.countryName}>
                          <TableCell className="font-medium">
                            <div>{entry.countryName}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              {formatAmount(entry.countryTotal)}
                              {entry.exchangeRate
                                ? ` x ${entry.exchangeRate.toFixed(4)}`
                                : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            -
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatAmount(entry.journalTotal)}
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(
                        hasDetailedJournal
                          ? (journalDebitTotal ?? 0)
                          : journalTotal
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(
                        hasDetailedJournal
                          ? (journalCreditTotal ?? 0)
                          : journalTotal
                      )}
                    </TableCell>
                    {hasDetailedJournal ? <TableCell colSpan={2} /> : null}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={makeJournalEntry} disabled={isSaving}>
              Make Journal Entry
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

export function MonthEndCountryReconciliationView({
  period,
  countryId,
  view = "auto",
}: {
  period?: string
  countryId?: string
  view?: "auto" | "dashboard" | "reconciliation" | "journal"
}) {
  const router = useRouter()
  const [record, setRecord] = React.useState<MonthEndRecord>()
  const [country, setCountry] = React.useState<TemplateCountryRow>()
  const [countryDisplayName, setCountryDisplayName] = React.useState("")
  const [linkedCountries, setLinkedCountries] = React.useState<
    TemplateCountryRow[]
  >([])
  const [linkedCountryIds, setLinkedCountryIds] = React.useState<string[]>([])
  const [countryNavigationIds, setCountryNavigationIds] = React.useState<
    string[]
  >([])
  const [canPasteReport, setCanPasteReport] = React.useState(false)
  const [records, setRecords] = React.useState<MonthEndMasterRecord[]>([])
  const [countryReportRecords, setCountryReportRecords] = React.useState<
    MonthEndCountryReportRecord[]
  >([])
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
  const [isPasteReportOpen, setIsPasteReportOpen] = React.useState(false)
  const [pastedReportText, setPastedReportText] = React.useState("")
  const [uploadError, setUploadError] = React.useState("")
  const [isUploadingCountryReport, setIsUploadingCountryReport] =
    React.useState(false)
  const masterInputRef = React.useRef<HTMLInputElement>(null)
  const countryReportInputRef = React.useRef<HTMLInputElement>(null)
  const activeCountryId = countryId
    ? getCanonicalCountryId(countryId)
    : undefined

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
        const navigationIds = Array.from(
          new Set(
            template.countries
              .filter((item) => item.checkable !== false)
              .map((item) => getCanonicalCountryId(item.id, template.countries))
          )
        )
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
        setLinkedCountries(linkedCountryRows)
        setLinkedCountryIds(linkedIds)
        setCountryNavigationIds(navigationIds)
        setCanPasteReport(supportsPasteReport)
        const transactionDates = new Map<string, string>()

        for (const linkedCountryId of linkedIds.length
          ? linkedIds
          : [activeCountryId]) {
          for (const [recordId, transactionDate] of parseMasterTransactionDates(
            monthEndRecord?.checked[masterTransactionDatesKey(linkedCountryId)]
          )) {
            transactionDates.set(recordId, transactionDate)
          }
        }

        setRecords(
          masterRecords.map((masterRecord) => ({
            ...masterRecord,
            transactionDate:
              masterRecord.transactionDate ||
              transactionDates.get(masterRecord.id) ||
              "",
          }))
        )
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
      records
        .slice()
        .sort((first, second) =>
          first.salesOrderNumber.localeCompare(second.salesOrderNumber)
        ),
    [records]
  )
  const reconciliation = React.useMemo(
    () =>
      reconcileRecords({
        masterRecords: records,
        countryRecords: countryReportRecords,
      }),
    [countryReportRecords, records]
  )
  const reconciliationCounts = React.useMemo(
    () => ({
      country: new Set(
        reconciliation.matched.map(({ countryRecord }) => countryRecord.id)
      ).size,
      master:
        reconciliation.matched.length -
        reconciliation.linkedMasterRecordIds.size,
    }),
    [reconciliation.linkedMasterRecordIds.size, reconciliation.matched]
  )
  const showCountryColumn = linkedCountryIds.length > 1
  const missingCountryRecordIds = React.useMemo(
    () => new Set(reconciliation.missingFromNetSuite.map((item) => item.id)),
    [reconciliation.missingFromNetSuite]
  )
  const missingMasterRecordIds = React.useMemo(
    () => new Set(reconciliation.missingFromCountry.map((item) => item.id)),
    [reconciliation.missingFromCountry]
  )
  const hasCountryReport = countryReportRecords.length > 0
  const hasMasterRecords = records.length > 0
  const requiresCountryReport = activeCountryId !== ANGOLA_OOT_COUNTRY_ID

  function openMasterFilePicker() {
    window.setTimeout(() => masterInputRef.current?.click(), 0)
  }

  function openCountryReportFilePicker() {
    window.setTimeout(() => countryReportInputRef.current?.click(), 0)
  }

  async function saveMasterWorkflowState(
    fileName: string,
    masterRecords: MonthEndMasterRecord[]
  ) {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const sourceKey = sourceFileNameKey(activeCountryId, "master")
    const checked = { ...latestRecord.checked }

    if (fileName) {
      checked[sourceKey] = fileName
    } else {
      delete checked[sourceKey]
    }

    for (const countryId of new Set([
      activeCountryId,
      ...linkedCountryIds,
      ...masterRecords.map((masterRecord) => masterRecord.countryId),
    ])) {
      delete checked[masterTransactionDatesKey(countryId)]
    }
    Object.assign(checked, getMasterTransactionDateCheckedValues(masterRecords))

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function saveCountryReportWorkflowState(
    fileName: string,
    antaserDocuments?: AntaserJournalDocument[]
  ) {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    const sourceKey = sourceFileNameKey(activeCountryId, "country")
    const journalDocumentsKey = antaserJournalDocumentsKey(activeCountryId)

    if (fileName) {
      checked[sourceKey] = fileName
    } else {
      delete checked[sourceKey]
    }

    if (antaserDocuments) {
      if (antaserDocuments.length) {
        checked[journalDocumentsKey] = JSON.stringify(antaserDocuments)
      } else {
        delete checked[journalDocumentsKey]
      }
    }

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function rollInvoices(selectedRecords: MonthEndMasterRecord[]) {
    if (!record || !activeCountryId) {
      return { savedCount: 0, excludedCount: selectedRecords.length }
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const internalIds = selectedRecords
      .map((item) => item.sourceInternalId.trim())
      .filter(Boolean)
    const excludedCount = selectedRecords.length - internalIds.length
    const approvalKey = rollApprovalKey(activeCountryId)
    const existingInternalIds = parseApprovedInternalIds(
      latestRecord.checked[approvalKey]
    )
    const existingInternalIdSet = new Set(existingInternalIds)
    const newInternalIds = Array.from(
      new Set(internalIds.filter((item) => !existingInternalIdSet.has(item)))
    )
    const approvedInternalIds = Array.from(
      new Set([...existingInternalIds, ...internalIds])
    )
    const checked = {
      ...latestRecord.checked,
      [approvalKey]: serializeApprovedInternalIds(approvedInternalIds),
    }

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      checked[monthEndTaskKey(linkedCountryId, "reconcile")] = true
    }
    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(
      country?.invoiceRequired === true
        ? countryDashboardHref
        : journalEntryHref
    )

    return {
      savedCount: newInternalIds.length,
      excludedCount,
    }
  }

  async function leaveInvoices(selectedRecords: MonthEndMasterRecord[]) {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const recordIds = selectedRecords.map((item) => item.id).filter(Boolean)
    const leaveKey = leftInvoiceKey(activeCountryId)
    const existingRecordIds = parseApprovedInternalIds(
      latestRecord.checked[leaveKey]
    )
    const leftRecordIds = Array.from(
      new Set([...existingRecordIds, ...recordIds])
    )
    const checked = {
      ...latestRecord.checked,
      [leaveKey]: serializeApprovedInternalIds(leftRecordIds),
    }

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function moveInvoicesToAngolaOot(
    selectedRecords: MonthEndMasterRecord[]
  ) {
    if (!record || activeCountryId !== "angola") {
      return { movedCount: 0 }
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const selectedRecordIds = new Set(selectedRecords.map((item) => item.id))
    const existingAngolaDates = parseMasterTransactionDates(
      latestRecord.checked[masterTransactionDatesKey(activeCountryId)]
    )
    const existingOotDates = parseMasterTransactionDates(
      latestRecord.checked[masterTransactionDatesKey(ANGOLA_OOT_COUNTRY_ID)]
    )
    const selectedDateByRecordId = new Map(
      selectedRecords
        .map((item) => [
          item.id,
          item.transactionDate ||
            existingAngolaDates.get(item.id) ||
            existingOotDates.get(item.id) ||
            "",
        ])
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
    )
    const movedRecords = await moveMonthEndMasterRecordsToCountry({
      monthEndId: record.id,
      recordIds: Array.from(selectedRecordIds),
      countryId: ANGOLA_OOT_COUNTRY_ID,
      countryName: ANGOLA_OOT_COUNTRY_NAME,
    })

    if (movedRecords.length !== selectedRecordIds.size) {
      throw new Error(
        `${movedRecords.length} of ${selectedRecordIds.size} selected invoices moved to ${ANGOLA_OOT_COUNTRY_NAME}.`
      )
    }

    const [remainingAngolaRecords, nextOotRecords, nextMasterRecords] =
      await Promise.all([
        listMonthEndMasterRecords({
          monthEndId: record.id,
          countryId: activeCountryId,
        }),
        listMonthEndMasterRecords({
          monthEndId: record.id,
          countryId: ANGOLA_OOT_COUNTRY_ID,
        }),
        listMonthEndMasterRecords({
          monthEndId: record.id,
        }),
      ])

    const checked = { ...latestRecord.checked }
    const nextAngolaDates = new Map(existingAngolaDates)
    const nextOotDates = new Map(existingOotDates)

    for (const recordId of selectedRecordIds) {
      nextAngolaDates.delete(recordId)
      const transactionDate = selectedDateByRecordId.get(recordId)

      if (transactionDate) {
        nextOotDates.set(recordId, transactionDate)
      }
    }

    checked[masterTransactionDatesKey(activeCountryId)] = JSON.stringify(
      Object.fromEntries(nextAngolaDates)
    )
    checked[masterTransactionDatesKey(ANGOLA_OOT_COUNTRY_ID)] = JSON.stringify(
      Object.fromEntries(nextOotDates)
    )
    delete checked[journalEntrySnapshotKey(activeCountryId)]
    delete checked[journalEntrySnapshotKey(ANGOLA_OOT_COUNTRY_ID)]
    delete checked[monthEndTaskKey(ANGOLA_OOT_COUNTRY_ID, "reconcile")]
    delete checked[monthEndTaskKey(ANGOLA_OOT_COUNTRY_ID, "journal")]

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    setRecords(remainingAngolaRecords)
    window.dispatchEvent(new Event("month-end:records-updated"))

    return { movedCount: movedRecords.length }
  }

  async function reopenReconciliation() {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }

    for (const linkedCountryId of workflowCountryIds) {
      delete checked[monthEndTaskKey(linkedCountryId, "reconcile")]
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
    }

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(reconciliationReportHref)
  }

  async function clearReconciliationAndStartOver() {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }

    for (const linkedCountryId of workflowCountryIds) {
      delete checked[monthEndTaskKey(linkedCountryId, "reconcile")]
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
      delete checked[rollApprovalKey(linkedCountryId)]
      delete checked[leftInvoiceKey(linkedCountryId)]
      delete checked[journalEntrySnapshotKey(linkedCountryId)]
    }

    delete checked[rollApprovalKey(activeCountryId)]
    delete checked[leftInvoiceKey(activeCountryId)]
    delete checked[journalEntrySnapshotKey(activeCountryId)]

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(reconciliationReportHref)
  }

  async function saveCountryDashboardSection(section: CountryDashboardSection) {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = {
      ...latestRecord.checked,
      [countryDashboardSectionKey(activeCountryId)]: section,
    }
    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function makeJournalEntry() {
    if (!record || !activeCountryId) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    const snapshot: JournalEntrySnapshot = {
      createdAt: new Date().toISOString(),
      entries: displayedJournalEntries,
      rows: displayedJournalRows.length ? displayedJournalRows : undefined,
      sourceDocumentCount: displayedSourceDocumentCount || undefined,
    }

    checked[journalEntrySnapshotKey(activeCountryId)] = JSON.stringify(snapshot)

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      checked[monthEndTaskKey(linkedCountryId, "journal")] = true
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(countryDashboardHref)
  }

  async function uploadMasterFile(file: File) {
    if (!record || !activeCountryId) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    setUploadError("")

    try {
      const template = await getMonthEndTemplate()
      const targetCountries = getLinkedCountryRows(
        activeCountryId,
        template.countries
      )
      const activeCountry = template.countries.find(
        (item) => item.id === activeCountryId
      )
      const csvText = await reportFileToCsvText(file, record.period)
      const mappedRecords = isDefaultMasterReportMapping(
        activeCountry?.masterReportMapping
      )
        ? undefined
        : parseMappedCountryMasterCsv({
            csvText,
            targetCountries,
            monthEndId: record.id,
            period: record.period,
            mapping: activeCountry?.masterReportMapping,
          })
      const parsedRecords = mappedRecords?.length
        ? mappedRecords
        : parseCountryMasterCsv({
            csvText,
            targetCountries,
            monthEndId: record.id,
            period: record.period,
          })

      await replaceMonthEndCountryMasterRecords({
        monthEndId: record.id,
        countryId: activeCountryId,
        records: parsedRecords,
      })
      await saveMasterWorkflowState(file.name, parsedRecords)

      const linkedCountryIds = getLinkedCountryIds(activeCountryId)

      setRecords(
        parsedRecords.filter((item) =>
          linkedCountryIds.includes(item.countryId)
        )
      )
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not upload that master CSV.")
      )
    }
  }

  async function saveParsedCountryReportRecords({
    parsedRecords,
    sourceLabel,
    antaserDocuments,
  }: {
    parsedRecords: ParsedCountryReportRecord[]
    sourceLabel: string
    antaserDocuments?: AntaserJournalDocument[]
  }) {
    if (!record || !country || !activeCountryId) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    const template = await getMonthEndTemplate()
    const linkedCountryRows = getLinkedCountryRows(
      activeCountryId,
      template.countries
    )
    const linkedCountryNames = new Set(
      linkedCountryRows.map((item) => normalizeMatchKey(item.name))
    )
    const filteredRecords = parsedRecords.filter((item) => {
      const sourceCountryName = normalizeMatchKey(item.sourceCountryName)

      return (
        activeCountryId.startsWith("antaser") ||
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
    const replacementCountryIds = new Set([
      activeCountryId,
      ...linkedCountryRows.map((item) => item.id),
      ...recordsByCountryId.keys(),
    ])
    const savedRecordGroups = await Promise.all(
      Array.from(replacementCountryIds).map(
        async (targetCountryId) => {
          const countryParsedRecords = recordsByCountryId.get(targetCountryId) ?? []
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

          await replaceMonthEndCountryReportRecords({
            monthEndId: record.id,
            countryId: targetCountryId,
            records: reportRecords,
          })

          return reportRecords
        }
      )
    )
    const reportRecords = savedRecordGroups.flat()

    await saveCountryReportWorkflowState(sourceLabel, antaserDocuments)
    setCountryReportRecords(
      reportRecords.filter((item) => item.countryId === activeCountryId)
    )
  }

  async function deleteMasterRecords() {
    if (!record || !activeCountryId) {
      return
    }

    setUploadError("")

    try {
      await replaceMonthEndCountryMasterRecords({
        monthEndId: record.id,
        countryId: activeCountryId,
        records: [],
      })
      await saveMasterWorkflowState("", [])
      setRecords([])
    } catch {
      setUploadError("Could not delete the NetSuite master records.")
    }
  }

  async function deleteCountryReportRecords() {
    if (!record || !activeCountryId) {
      return
    }

    setUploadError("")

    try {
      await replaceMonthEndCountryReportRecords({
        monthEndId: record.id,
        countryId: activeCountryId,
        records: [],
      })
      await saveCountryReportWorkflowState("", [])
      setCountryReportRecords([])
    } catch {
      setUploadError("Could not delete the country report records.")
    }
  }

  async function uploadCountryReports(files: File[]) {
    setIsUploadingCountryReport(true)
    setUploadError("")

    try {
      const template = await getMonthEndTemplate()
      const activeCountry = activeCountryId
        ? template.countries.find((item) => item.id === activeCountryId)
        : undefined
      const parsedGroups = await Promise.all(
        files.map(async (file) => {
          const mappedRecords = isDefaultCountryReportMapping(
            activeCountry?.countryReportMapping
          )
            ? undefined
            : parseMappedCountryReportCsv(
                await reportFileToCsvText(file, record?.period),
                activeCountry?.countryReportMapping
              )

          if (mappedRecords?.length) {
            return { records: mappedRecords }
          }

          return parseCountryReportUploadFile(file, { period: record?.period })
        })
      )
      const antaserDocuments = parsedGroups.flatMap((group) =>
        group.antaserJournalDocument ? [group.antaserJournalDocument] : []
      )
      const parsedRecords = parsedGroups.flatMap((group) => group.records)

      if (!parsedRecords.length) {
        throw new Error(
          `No country report rows were found for ${record?.period ?? "this month end"}. Make sure the report period matches the open month end.`
        )
      }

      if (activeCountryId?.startsWith("antaser")) {
        const documentKinds = new Set(
          antaserDocuments.map((document) => document.kind)
        )
        const requiredDocuments: {
          kind: AntaserJournalDocumentKind
          label: string
        }[] = [
          { kind: "regular-invoice", label: "CIS invoice" },
          { kind: "regular-overview", label: "CIS overview" },
          { kind: "oot-invoice", label: "JACR invoice" },
          { kind: "commission", label: "commission note" },
        ]
        const missingDocuments = requiredDocuments
          .filter((document) => !documentKinds.has(document.kind))
          .map((document) => document.label)

        if (missingDocuments.length) {
          throw new Error(
            `Select all four Antaser PDFs together. Missing: ${missingDocuments.join(
              ", "
            )}.`
          )
        }
      }

      await saveParsedCountryReportRecords({
        parsedRecords,
        sourceLabel: files.map((file) => file.name).join(", "),
        antaserDocuments: activeCountryId?.startsWith("antaser")
          ? antaserDocuments
          : undefined,
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
  const backHref = period
    ? `/month-end?period=${encodeURIComponent(period)}`
    : "/month-end"
  const countryRouteQuery = new URLSearchParams()

  if (period) {
    countryRouteQuery.set("period", period)
  }

  if (activeCountryId) {
    countryRouteQuery.set("country", activeCountryId)
  }

  const countryRouteSearch = countryRouteQuery.toString()
  const countryRouteHref = countryRouteSearch
    ? `/month-end/country?${countryRouteSearch}`
    : "/month-end/country"
  const countryRouteSeparator = countryRouteSearch ? "&" : "?"
  const countryDashboardHref = `${countryRouteHref}${countryRouteSeparator}view=dashboard`
  const reconciliationReportHref = `${countryRouteHref}${countryRouteSeparator}view=reconciliation`
  const journalEntryHref = `${countryRouteHref}${countryRouteSeparator}view=journal`
  const activeCountryNavigationIndex = activeCountryId
    ? countryNavigationIds.indexOf(activeCountryId)
    : -1
  const previousCountryId =
    activeCountryNavigationIndex > 0
      ? countryNavigationIds[activeCountryNavigationIndex - 1]
      : undefined
  const nextCountryId =
    activeCountryNavigationIndex >= 0 &&
    activeCountryNavigationIndex < countryNavigationIds.length - 1
      ? countryNavigationIds[activeCountryNavigationIndex + 1]
      : undefined

  function countryPageHref(targetCountryId: string) {
    const navigationQuery = new URLSearchParams()

    if (period) {
      navigationQuery.set("period", period)
    }

    navigationQuery.set("country", targetCountryId)

    return `/month-end/country?${navigationQuery.toString()}`
  }

  const previousCountryHref = previousCountryId
    ? countryPageHref(previousCountryId)
    : undefined
  const nextCountryHref = nextCountryId
    ? countryPageHref(nextCountryId)
    : undefined
  const rolledInternalIds = activeCountryId
    ? parseApprovedInternalIds(
        record?.checked[rollApprovalKey(activeCountryId)]
      )
    : []
  const leftInvoiceRecordIds = activeCountryId
    ? parseApprovedInternalIds(record?.checked[leftInvoiceKey(activeCountryId)])
    : []
  const activeDashboardSection = activeCountryId
    ? parseCountryDashboardSection(
        record?.checked[countryDashboardSectionKey(activeCountryId)]
      )
    : "netsuite"
  const workflowCountryIds = linkedCountryIds.length
    ? linkedCountryIds
    : activeCountryId
      ? [activeCountryId]
      : []
  const isReconciliationComplete =
    workflowCountryIds.length > 0 &&
    workflowCountryIds.every(
      (linkedCountryId) =>
        record?.checked[monthEndTaskKey(linkedCountryId, "reconcile")] === true
    )
  const resolvedView =
    view === "auto"
      ? isReconciliationComplete
        ? "dashboard"
        : "reconciliation"
      : view
  const journalCountries = linkedCountries.length
    ? linkedCountries
    : country
      ? [country]
      : []
  const journalTotalsByCountryId = new Map(
    journalCountries.map((item) => [item.id, 0])
  )

  for (const reportRecord of countryReportRecords) {
    const reportCountryName = normalizeMatchKey(
      reportRecord.sourceCountryName || reportRecord.countryName
    )
    const matchedJournalCountry = journalCountries.find((item) => {
      const countryName = normalizeMatchKey(item.name)

      return (
        reportCountryName === countryName ||
        reportCountryName.includes(countryName) ||
        countryName.includes(reportCountryName)
      )
    })
    const targetCountry = matchedJournalCountry ?? journalCountries[0]

    if (targetCountry) {
      journalTotalsByCountryId.set(
        targetCountry.id,
        (journalTotalsByCountryId.get(targetCountry.id) ?? 0) +
          reportRecord.amount
      )
    }
  }

  const journalEntries = journalCountries.map((item) => {
    const countryTotal = journalTotalsByCountryId.get(item.id) ?? 0
    const exchangeRateValue = record?.checked[exchangeRateKey(item.id)]
    const exchangeRate =
      typeof exchangeRateValue === "number" &&
      Number.isFinite(exchangeRateValue) &&
      exchangeRateValue > 0
        ? exchangeRateValue
        : undefined

    return {
      countryName: item.name,
      countryTotal,
      exchangeRate,
      journalTotal: countryTotal * (exchangeRate ?? 1),
    }
  })
  const antaserJournalDocuments = activeCountryId?.startsWith("antaser")
    ? parseAntaserJournalDocuments(
        record?.checked[antaserJournalDocumentsKey(activeCountryId)]
      )
    : []
  const regularAntaserCountry = journalCountries.find(
    (item) => !item.id.endsWith("-oot")
  )
  const ootAntaserCountry = journalCountries.find((item) =>
    item.id.endsWith("-oot")
  )
  const regularAntaserRateValue = regularAntaserCountry
    ? record?.checked[exchangeRateKey(regularAntaserCountry.id)]
    : undefined
  const ootAntaserRateValue = ootAntaserCountry
    ? record?.checked[exchangeRateKey(ootAntaserCountry.id)]
    : undefined
  const regularAntaserRate =
    typeof regularAntaserRateValue === "number" && regularAntaserRateValue > 0
      ? regularAntaserRateValue
      : 1
  const ootAntaserRate =
    typeof ootAntaserRateValue === "number" && ootAntaserRateValue > 0
      ? ootAntaserRateValue
      : 1
  const antaserCountryNames = activeCountryId?.startsWith("antaser-afrique")
    ? ["Burundi", "Equatorial Guinea", "South Sudan", "Togo"]
    : ["Central African Republic", "Guinea-Bissau", "Niger"]
  const regularOverviewDocument = antaserJournalDocuments.find(
    (document) => document.kind === "regular-overview"
  )
  const commissionDocument = antaserJournalDocuments.find(
    (document) => document.kind === "commission"
  )
  const ootInvoiceDocument = antaserJournalDocuments.find(
    (document) => document.kind === "oot-invoice"
  )
  const antaserFamilyName =
    regularAntaserCountry?.name ??
    (activeCountryId?.startsWith("antaser-afrique")
      ? "Antaser Afrique"
      : "Antaser")
  const roundJournalAmount = (amount: number) =>
    Math.round((amount + Number.EPSILON) * 100) / 100
  const regularCountryAmounts = antaserCountryNames.map((countryName) => ({
    countryName,
    amount: roundJournalAmount(
      (regularOverviewDocument?.countryTotals[countryName] ?? 0) *
        regularAntaserRate
    ),
  }))
  const commissionCountryAmounts = antaserCountryNames.map((countryName) => ({
    countryName,
    amount: roundJournalAmount(
      (commissionDocument?.countryTotals[countryName] ?? 0) * regularAntaserRate
    ),
  }))
  const ootCountryAmounts = antaserCountryNames.map((countryName) => ({
    countryName,
    amount: roundJournalAmount(
      (ootInvoiceDocument?.countryTotals[countryName] ?? 0) * ootAntaserRate
    ),
  }))

  function antaserClassName(countryName: string) {
    const normalizedCountryName = normalizeMatchKey(countryName)
    const sourceClass = records.find((masterRecord) =>
      normalizeMatchKey(masterRecord.sourceClass).includes(
        normalizedCountryName
      )
    )?.sourceClass

    return (
      sourceClass ||
      `${antaserFamilyName} : ${antaserFamilyName} ACTN2 : ${countryName}`
    )
  }

  function sumJournalAmounts(
    amounts: { countryName: string; amount: number }[]
  ) {
    return roundJournalAmount(
      amounts.reduce((sum, item) => sum + item.amount, 0)
    )
  }

  const regularJournalTotal = sumJournalAmounts(regularCountryAmounts)
  const commissionJournalTotal = sumJournalAmounts(commissionCountryAmounts)
  const ootJournalTotal = sumJournalAmounts(ootCountryAmounts)
  const antaserJournalRows: JournalEntryRow[] = antaserJournalDocuments.length
    ? [
        {
          account: `Prepaid Accounts : ${antaserFamilyName} General : ${antaserFamilyName}`,
          credit: regularJournalTotal,
          lineDescription: "Credit Prepaid Account",
        },
        ...regularCountryAmounts.map((item) => ({
          account: "Income",
          debit: item.amount,
          className: antaserClassName(item.countryName),
        })),
        {
          account: `Prepaid Accounts : ${antaserFamilyName} General : ${antaserFamilyName}`,
          debit: commissionJournalTotal,
          lineDescription: "Debit Commissions",
        },
        ...commissionCountryAmounts.map((item) => ({
          account: "Income",
          credit: item.amount,
          className: antaserClassName(item.countryName),
        })),
        {
          account: `Prepaid Accounts : ${antaserFamilyName} General : ${antaserFamilyName} OOT`,
          credit: ootJournalTotal,
          lineDescription: "Credit ROW Prepaid Account",
        },
        ...ootCountryAmounts.map((item) => ({
          account: "Income",
          debit: item.amount,
          className: antaserClassName(item.countryName),
        })),
      ]
    : []
  const savedJournalEntry = activeCountryId
    ? parseJournalEntrySnapshot(
        record?.checked[journalEntrySnapshotKey(activeCountryId)]
      )
    : undefined
  const displayedJournalEntries = savedJournalEntry?.entries ?? journalEntries
  const displayedJournalRows = savedJournalEntry?.rows ?? antaserJournalRows
  const displayedSourceDocumentCount =
    savedJournalEntry?.sourceDocumentCount ?? antaserJournalDocuments.length

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
      <SidebarInset className="md:overflow-y-auto">
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title={title} />
          {!hasLoaded ? (
            <CountryReconciliationSkeleton />
          ) : resolvedView === "dashboard" ? (
            <CountryReconciliationDashboard
              countryName={
                countryDisplayName || country?.name || "Unknown country"
              }
              masterRecords={records}
              countryRecords={countryReportRecords}
              reconciliation={reconciliation}
              reconciledCount={reconciliationCounts.country}
              rolledInternalIds={rolledInternalIds}
              leftInvoiceRecordIds={leftInvoiceRecordIds}
              activeSection={activeDashboardSection}
              onActiveSectionChange={saveCountryDashboardSection}
              onBack={() => router.push(backHref)}
              onPreviousCountry={
                previousCountryHref
                  ? () => router.push(previousCountryHref)
                  : undefined
              }
              onNextCountry={
                nextCountryHref ? () => router.push(nextCountryHref) : undefined
              }
              reconciliationHref={reconciliationReportHref}
              journalHref={journalEntryHref}
              dashboardHref={countryDashboardHref}
            />
          ) : resolvedView === "journal" ? (
            <JournalEntryPreview
              countryName={
                countryDisplayName || country?.name || "Unknown country"
              }
              entries={displayedJournalEntries}
              journalRows={displayedJournalRows}
              sourceDocumentCount={displayedSourceDocumentCount}
              onBack={() => router.push(reconciliationReportHref)}
              onPreviousCountry={
                previousCountryHref
                  ? () => router.push(previousCountryHref)
                  : undefined
              }
              onNextCountry={
                nextCountryHref ? () => router.push(nextCountryHref) : undefined
              }
              reconciliationHref={reconciliationReportHref}
              journalHref={journalEntryHref}
              dashboardHref={countryDashboardHref}
              onMakeJournalEntry={makeJournalEntry}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
              <div className="grid min-h-9 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9 rounded-full md:h-9 md:w-9"
                  aria-label="Back to month end"
                  render={<AppLink href={backHref} />}
                >
                  <ArrowLeftIcon />
                </Button>
                <CountryProcessBreadcrumb
                  activeView="reconciliation"
                  reconciliationHref={reconciliationReportHref}
                  journalHref={journalEntryHref}
                  dashboardHref={countryDashboardHref}
                />
                <div className="flex items-center gap-2">
                  <CountryNavigationButtons
                    onPrevious={
                      previousCountryHref
                        ? () => router.push(previousCountryHref)
                        : undefined
                    }
                    onNext={
                      nextCountryHref
                        ? () => router.push(nextCountryHref)
                        : undefined
                    }
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-9 w-9 rounded-full md:h-9 md:w-9"
                          aria-label="More actions"
                        />
                      }
                    >
                      <EllipsisVerticalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-64">
                      {isReconciliationComplete ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={reopenReconciliation}
                        >
                          <ListChecksIcon />
                          Reopen Reconciliation
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={clearReconciliationAndStartOver}
                        >
                          <ListChecksIcon />
                          Clear Recon and Start Over
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {isPasteReportOpen ? (
                <Card className="rounded-lg py-0 shadow-sm">
                  <CardContent className="grid gap-3 p-3">
                    <Textarea
                      value={pastedReportText}
                      onChange={(event) =>
                        setPastedReportText(event.target.value)
                      }
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
                        disabled={
                          !pastedReportText.trim() || isUploadingCountryReport
                        }
                      >
                        <ClipboardPasteIcon />
                        Import Paste
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

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

              {uploadError ? (
                <p className="text-sm text-destructive">{uploadError}</p>
              ) : null}

              {loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : null}

              {!hasLoaded ? (
                <CountryReconciliationSkeleton />
              ) : requiresCountryReport && !hasCountryReport ? (
                <CountryReportUploadStep
                  countryReportLabel={countryReportLabel}
                  masterCount={records.length}
                  isUploading={isUploadingCountryReport}
                  canPasteReport={canPasteReport}
                  isAntaserPackage={activeCountryId?.startsWith("antaser")}
                  onChooseFile={openCountryReportFilePicker}
                  onPasteReport={() => setIsPasteReportOpen(true)}
                  onFiles={uploadCountryReports}
                />
              ) : hasCountryReport || hasMasterRecords ? (
                <ReconciliationWorkbench
                  countryRecords={countryReportRecords}
                  masterRecords={sortedRecords}
                  matchedRecords={reconciliation.matched}
                  missingCountryRecordIds={missingCountryRecordIds}
                  missingMasterRecordIds={missingMasterRecordIds}
                  rolledInternalIds={rolledInternalIds}
                  leftInvoiceRecordIds={leftInvoiceRecordIds}
                  showCountryColumn={showCountryColumn}
                  onDropMasterFile={uploadMasterFile}
                  onDropCountryFiles={uploadCountryReports}
                  canEditCountryData={requiresCountryReport}
                  isReadOnly={isReconciliationComplete}
                  countryId={activeCountryId}
                  countryName={
                    countryDisplayName || country?.name || "Unknown country"
                  }
                  countryRecordCount={countryReportRecords.length}
                  masterRecordCount={
                    records.length - reconciliation.linkedMasterRecordIds.size
                  }
                  matchedCountryCount={reconciliationCounts.country}
                  matchedMasterCount={reconciliationCounts.master}
                  onRollInvoices={rollInvoices}
                  onLeaveInvoices={leaveInvoices}
                  onMoveInvoicesToOot={
                    activeCountryId === "angola"
                      ? moveInvoicesToAngolaOot
                      : undefined
                  }
                />
              ) : (
                <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                  Upload both reports to build this reconciliation view.
                </div>
              )}
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
