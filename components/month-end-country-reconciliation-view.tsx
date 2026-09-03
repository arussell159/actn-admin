"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileOutputIcon,
  ListChecksIcon,
  ClipboardPasteIcon,
  UploadIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { CountryTableFilters } from "@/components/country-table-filters"
import { HeaderActionMenuTrigger } from "@/components/header-action-menu-trigger"
import { CountryReconciliationSkeleton } from "@/components/page-skeletons"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
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
  formatPeriod,
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
  type ReportFieldMapping,
  type TemplateCountryRow,
} from "@/lib/month-end-template"
import {
  extractPdfText,
  extractWorkbookRows,
  getCameroonCountryReportTotals,
  parseCameroonCountryReportCsv,
  parseMappedCountryReportCsv,
  parseGabonCountryReportCsv,
  parseCountryReportUploadFile,
  parseCountryReportText,
  type AntaserJournalDocument,
  type AntaserJournalDocumentKind,
  type CameroonCountryReportTotals,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
import {
  listMonthEndCountryReportRecords,
  makeCountryReportRecords,
  replaceMonthEndCountryReportRecords,
  type MonthEndCountryReportRecord,
} from "@/lib/month-end-country-report-records"
import {
  deleteMonthEndCountryReconciliation,
  getMonthEndCountryReconciliation,
  saveMonthEndCountryReconciliation,
} from "@/lib/month-end-country-reconciliations"
import {
  leftInvoiceKey,
  parseApprovedInternalIds,
  rollApprovalKey,
  serializeApprovedInternalIds,
} from "@/lib/month-end-roll-invoices"
import {
  markMonthEndReturnIntent,
  readMonthEndReturnPoint,
} from "@/lib/month-end-return-point"
import { normalizeCsvHeader, parseCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"

const ANGOLA_OOT_COUNTRY_ID = "angola-oot"
const ANGOLA_OOT_COUNTRY_NAME = "Angola OOT"
const FRABEMAR_COUNTRY_ID = "frabemar"
const FRABEMAR_CHILD_COUNTRY_IDS = [
  "frabemar-gabon",
  "frabemar-dr-congo",
  "frabemar-mali",
  "frabemar-republic-of-guinea",
]
const FRABEMAR_CHILD_COUNTRIES = [
  {
    id: "frabemar-dr-congo",
    accountName: "Frabemar : DR Congo",
    aliases: ["rdc", "drcongo", "dr congo", "congo", "drc"],
    shortCode: "RDC",
    hasCommission: true,
  },
  {
    id: "frabemar-gabon",
    accountName: "Frabemar : Gabon",
    aliases: ["gabon"],
    shortCode: "GA",
    hasCommission: true,
  },
  {
    id: "frabemar-mali",
    accountName: "Frabemar : Mali",
    aliases: ["mali"],
    shortCode: "ML",
    hasCommission: true,
  },
  {
    id: "frabemar-republic-of-guinea",
    accountName: "Frabemar : Republic of Guinea",
    aliases: ["guinea", "republicofguinea", "republic of guinea"],
    shortCode: "GN",
    hasCommission: false,
  },
] satisfies {
  id: (typeof FRABEMAR_CHILD_COUNTRY_IDS)[number]
  accountName: string
  aliases: string[]
  shortCode: string
  hasCommission: boolean
}[]

const countryReportAiFields = [
  {
    id: "invoiceNumber",
    label: "Invoice Number",
    aliases: ["invoice", "invoicenumber", "salesorder", "salesordernumber"],
  },
  {
    id: "ctnNumber",
    label: "CTN / ECTN Number",
    aliases: ["ctn", "ectn", "besc", "ctnnumber", "ectnnumber"],
  },
  {
    id: "billOfLadingNumber",
    label: "Bill of Lading Number",
    aliases: ["billoflading", "billofladingnumber", "bl", "blnumber"],
  },
  {
    id: "reference",
    label: "Country Report Reference",
    aliases: ["reference", "documentnumber", "bookingnumber"],
  },
  {
    id: "amount",
    label: "Primary Country Amount",
    aliases: ["amount", "price", "total", "debit", "credit"],
  },
  {
    id: "secondaryAmount",
    label: "Secondary Country Amount",
    aliases: ["amount2", "secondaryamount", "fees", "fee"],
  },
  {
    id: "tertiaryAmount",
    label: "Third Country Amount",
    aliases: ["amount3", "tertiaryamount", "tax", "vat"],
  },
  {
    id: "status",
    label: "Country Report Status",
    aliases: ["status", "notes", "note"],
  },
  {
    id: "transactionDate",
    label: "Validation Date",
    aliases: ["validationdate", "validatedat", "date"],
  },
  {
    id: "sellingDate",
    label: "Selling Date",
    aliases: ["sellingdate", "solddate", "saleDate"],
  },
  {
    id: "sourceCountryName",
    label: "Source Country Name",
    aliases: ["country", "countryname", "sourcecountry"],
  },
] satisfies {
  id: keyof ReportFieldMapping["fields"]
  label: string
  aliases: string[]
}[]

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function roundMoneyAmount(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function formatCurrencyAmount(amount: number, currency: "EUR" | "USD") {
  const symbol = currency === "EUR" ? "EUR " : "$"

  return `${symbol}${formatAmount(amount)}`
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

function datePeriodKey(value: string | undefined, dayFirst = false) {
  const rawValue = (value ?? "").trim()

  if (!rawValue) {
    return ""
  }

  const slashDate = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/)

  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const yearValue = Number(slashDate[3])
    const year = yearValue < 100 ? 2000 + yearValue : yearValue
    const month = dayFirst || first > 12 ? second : first

    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`
    }
  }

  const parsedDate = new Date(rawValue.replace(/\s+tt\b/i, ""))

  return Number.isNaN(parsedDate.getTime())
    ? ""
    : `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function sourceFileNameKey(
  rowId: string,
  source: "master" | "country" | "invoice"
) {
  return `${rowId}__${source}_source_file`
}

function antaserJournalDocumentsKey(rowId: string) {
  return `${rowId}__antaser_journal_documents`
}

function journalEntrySnapshotKey(rowId: string) {
  return `${rowId}__journal_entry_snapshot`
}

type CountryDashboardSection = "matched" | "left" | "rolled"

function countryDashboardSectionKey(rowId: string) {
  return `${rowId}__country_dashboard_section`
}

function resolvedCountryReportRowsKey(rowId: string) {
  return `${rowId}__resolved_country_report_rows`
}

function reconciliationSnapshotKey(rowId: string) {
  return `${rowId}__reconciliation_snapshot`
}

function cameroonDmiMappingKey(rowId: string) {
  return `${rowId}__cameroon_dmi_mapping`
}

function cameroonCommissionTotalKey(rowId: string) {
  return `${rowId}__cameroon_commission_total`
}

function cameroonReportTotalKey(rowId: string) {
  return `${rowId}__cameroon_report_total`
}

type ResolvedCountryReportRow = {
  id: string
  reason: string
  note: string
  resolvedAt: string
}

type ReconciliationSnapshot = {
  countryId: string
  period: string
  savedAt: string
  matched: {
    masterRecordId: string
    countryRecordId: string
    matchedOn?: string
    matchedValue?: string
  }[]
  linkedMasterRecordIds: string[]
  autoRolledMasterRecordIds: string[]
  autoRolledInternalIds: string[]
  autoLeftMasterRecordIds: string[]
  autoLeftInternalIds: string[]
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  leftInvoiceInternalIds: string[]
  resolvedCountryReportRows: ResolvedCountryReportRow[]
  missingCountryRecordIds: string[]
  missingMasterRecordIds: string[]
}

type CameroonDmiMapping = {
  miNumber: string
  dmiNumber: string
  sourceRowIndex: number
}

type InvoiceDocument = {
  fileName: string
  fileNames?: string[]
  fileSize: number
  fileType: string
  uploadedAt: string
}

type CongoInvoiceJournalValues = {
  invoiceVisaPointsTotal: number
  invoiceCommission: number
  invoiceBankCharges: number
  wireFee: number
  visaUsed: number
  visaUsedCommission: number
  visaUsedIncome: number
  invoiceFileName: string
  savedAt: string
}

type FrabemarInvoicePackage = {
  invoices: InvoiceDocument[]
  countryValues: Record<
    string,
    {
      invoiceTotal: number
      commission: number
      invoiceFileName: string
      invoiceNumber: string
      commissionInvoiceNumber: string
    }
  >
  pastedReportText: string
  savedAt: string
}

type FrabemarCountryJournalValues = {
  invoiceTotal: number
  commission: number
  invoiceFileName: string
  invoiceNumber: string
  commissionInvoiceNumber: string
  savedAt: string
}

const countryReportReconcileReasonOptions = [
  "Validated in previous month",
  "Already rolled",
  "Other",
]

function parseResolvedCountryReportRows(value: unknown) {
  if (typeof value !== "string" || !value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is ResolvedCountryReportRow =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string"
    )
  } catch {}

  return []
}

function parseReconciliationSnapshot(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "countryId" in parsed &&
      typeof parsed.countryId === "string"
    ) {
      return parsed as ReconciliationSnapshot
    }
  } catch {}

  return undefined
}

function parseInvoiceDocument(value: unknown): InvoiceDocument | undefined {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "fileName" in parsed &&
      typeof parsed.fileName === "string"
    ) {
      return {
        fileName: parsed.fileName,
        fileNames:
          "fileNames" in parsed && Array.isArray(parsed.fileNames)
            ? (parsed.fileNames as unknown[]).filter(
                (fileName): fileName is string => typeof fileName === "string"
              )
            : undefined,
        fileSize:
          "fileSize" in parsed && typeof parsed.fileSize === "number"
            ? parsed.fileSize
            : 0,
        fileType:
          "fileType" in parsed && typeof parsed.fileType === "string"
            ? parsed.fileType
            : "",
        uploadedAt:
          "uploadedAt" in parsed && typeof parsed.uploadedAt === "string"
            ? parsed.uploadedAt
            : "",
      }
    }
  } catch {}

  return undefined
}

function parseCongoInvoiceJournalValues(
  value: unknown
): CongoInvoiceJournalValues | undefined {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)

    if (typeof parsed !== "object" || parsed === null) {
      return undefined
    }

    const invoiceVisaPointsTotal =
      "invoiceVisaPointsTotal" in parsed &&
      typeof parsed.invoiceVisaPointsTotal === "number"
        ? parsed.invoiceVisaPointsTotal
        : 0
    const visaUsed =
      "visaUsed" in parsed && typeof parsed.visaUsed === "number"
        ? parsed.visaUsed
        : 0

    if (invoiceVisaPointsTotal <= 0) {
      return undefined
    }

    return {
      invoiceVisaPointsTotal,
      invoiceCommission:
        "invoiceCommission" in parsed &&
        typeof parsed.invoiceCommission === "number"
          ? parsed.invoiceCommission
          : 0,
      invoiceBankCharges:
        "invoiceBankCharges" in parsed &&
        typeof parsed.invoiceBankCharges === "number"
          ? parsed.invoiceBankCharges
          : 0,
      wireFee:
        "wireFee" in parsed && typeof parsed.wireFee === "number"
          ? parsed.wireFee
          : 16,
      visaUsed,
      visaUsedCommission:
        "visaUsedCommission" in parsed &&
        typeof parsed.visaUsedCommission === "number"
          ? parsed.visaUsedCommission
          : 0,
      visaUsedIncome:
        "visaUsedIncome" in parsed && typeof parsed.visaUsedIncome === "number"
          ? parsed.visaUsedIncome
          : 0,
      invoiceFileName:
        "invoiceFileName" in parsed &&
        typeof parsed.invoiceFileName === "string"
          ? parsed.invoiceFileName
          : "",
      savedAt:
        "savedAt" in parsed && typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : "",
    }
  } catch {}

  return undefined
}

function parseFrabemarInvoicePackage(
  value: unknown
): FrabemarInvoicePackage | undefined {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(value)

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "invoices" in parsed &&
      Array.isArray(parsed.invoices)
    ) {
      const invoices = parsed.invoices as unknown[]

      return {
        invoices: invoices.filter(
          (invoice): invoice is InvoiceDocument =>
            typeof invoice === "object" &&
            invoice !== null &&
            "fileName" in invoice &&
            typeof invoice.fileName === "string"
        ),
        countryValues:
          "countryValues" in parsed &&
          typeof parsed.countryValues === "object" &&
          parsed.countryValues !== null
            ? Object.fromEntries(
                Object.entries(parsed.countryValues).flatMap(
                  ([countryId, countryValue]) => {
                    if (
                      typeof countryValue !== "object" ||
                      countryValue === null
                    ) {
                      return []
                    }

                    return [
                      [
                        countryId,
                        {
                          invoiceTotal:
                            "invoiceTotal" in countryValue &&
                            typeof countryValue.invoiceTotal === "number"
                              ? countryValue.invoiceTotal
                              : 0,
                          commission:
                            "commission" in countryValue &&
                            typeof countryValue.commission === "number"
                              ? countryValue.commission
                              : 0,
                          invoiceFileName:
                            "invoiceFileName" in countryValue &&
                            typeof countryValue.invoiceFileName === "string"
                              ? countryValue.invoiceFileName
                              : "",
                          invoiceNumber:
                            "invoiceNumber" in countryValue &&
                            typeof countryValue.invoiceNumber === "string"
                              ? countryValue.invoiceNumber
                              : "",
                          commissionInvoiceNumber:
                            "commissionInvoiceNumber" in countryValue &&
                            typeof countryValue.commissionInvoiceNumber ===
                              "string"
                              ? countryValue.commissionInvoiceNumber
                              : "",
                        },
                      ],
                    ]
                  }
                )
              )
            : {},
        pastedReportText:
          "pastedReportText" in parsed &&
          typeof parsed.pastedReportText === "string"
            ? parsed.pastedReportText
            : "",
        savedAt:
          "savedAt" in parsed && typeof parsed.savedAt === "string"
            ? parsed.savedAt
            : "",
      }
    }
  } catch {}

  return undefined
}

function parseFrabemarCountryJournalValues(
  value: unknown
): FrabemarCountryJournalValues | undefined {
  if (typeof value !== "string" || !value) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(value)

    if (typeof parsed !== "object" || parsed === null) {
      return undefined
    }

    const invoiceTotal =
      "invoiceTotal" in parsed && typeof parsed.invoiceTotal === "number"
        ? parsed.invoiceTotal
        : 0
    const commission =
      "commission" in parsed && typeof parsed.commission === "number"
        ? parsed.commission
        : 0

    if (invoiceTotal <= 0 && commission <= 0) {
      return undefined
    }

    return {
      invoiceTotal,
      commission,
      invoiceFileName:
        "invoiceFileName" in parsed &&
        typeof parsed.invoiceFileName === "string"
          ? parsed.invoiceFileName
          : "",
      invoiceNumber:
        "invoiceNumber" in parsed && typeof parsed.invoiceNumber === "string"
          ? parsed.invoiceNumber
          : "",
      commissionInvoiceNumber:
        "commissionInvoiceNumber" in parsed &&
        typeof parsed.commissionInvoiceNumber === "string"
          ? parsed.commissionInvoiceNumber
          : "",
      savedAt:
        "savedAt" in parsed && typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : "",
    }
  } catch {}

  return undefined
}

function reconciliationSnapshotComparable(
  snapshot: ReconciliationSnapshot | undefined
) {
  if (!snapshot) {
    return ""
  }

  const content: Partial<ReconciliationSnapshot> = { ...snapshot }

  delete content.savedAt

  return JSON.stringify(content)
}

function approvedIdsMatch(value: unknown, ids: string[]) {
  return (
    serializeApprovedInternalIds(parseApprovedInternalIds(value)) ===
    serializeApprovedInternalIds(ids)
  )
}
function masterRecordApprovalIds(record: MonthEndMasterRecord) {
  return [record.id, record.sourceInternalId.trim()].filter(Boolean)
}

function isApprovedMasterRecord(
  record: MonthEndMasterRecord,
  approvedIds: Set<string>
) {
  return masterRecordApprovalIds(record).some((id) => approvedIds.has(id))
}

function mergeSnapshotLeftInvoiceIds(
  snapshot: ReconciliationSnapshot,
  leftInvoiceRecordIds: string[],
  selectedRecords: MonthEndMasterRecord[]
): ReconciliationSnapshot {
  return {
    ...snapshot,
    savedAt: new Date().toISOString(),
    leftInvoiceRecordIds,
    leftInvoiceInternalIds: Array.from(
      new Set([
        ...(snapshot.leftInvoiceInternalIds ?? []),
        ...selectedRecords
          .map((record) => record.sourceInternalId.trim())
          .filter(Boolean),
      ])
    ),
  }
}

function withoutSetValue(values: Set<string>, value: string) {
  return new Set(Array.from(values).filter((item) => item !== value))
}

function addManualReconciliationMatch({
  reconciliation,
  masterRecord,
  countryRecord,
}: {
  reconciliation: ReturnType<typeof reconcileRecords>
  masterRecord: MonthEndMasterRecord
  countryRecord: MonthEndCountryReportRecord
}): ReturnType<typeof reconcileRecords> {
  const matchedValue =
    countryRecord.reference ||
    countryRecord.invoiceNumber ||
    countryRecord.ctnNumber ||
    countryRecord.billOfLadingNumber ||
    masterRecord.salesOrderNumber ||
    masterRecord.ctnNumber ||
    masterRecord.billOfLadingNumber

  return {
    ...reconciliation,
    matched: [
      ...reconciliation.matched.filter(
        (match) =>
          match.masterRecord.id !== masterRecord.id &&
          match.countryRecord.id !== countryRecord.id
      ),
      {
        id: `${masterRecord.id}__${countryRecord.id}`,
        masterRecord,
        countryRecord,
        matchedOn: {
          label: "Manual",
          value: matchedValue,
        },
      },
    ],
    linkedMasterRecordIds: withoutSetValue(
      reconciliation.linkedMasterRecordIds,
      masterRecord.id
    ),
    autoRolledMasterIds: withoutSetValue(
      reconciliation.autoRolledMasterIds,
      masterRecord.id
    ),
    autoLeftMasterIds: withoutSetValue(
      reconciliation.autoLeftMasterIds,
      masterRecord.id
    ),
    missingFromNetSuite: reconciliation.missingFromNetSuite.filter(
      (record) => record.id !== countryRecord.id
    ),
    missingFromCountry: reconciliation.missingFromCountry.filter(
      (record) => record.id !== masterRecord.id
    ),
  }
}

type MatchedDisplayRow =
  | (ReturnType<typeof reconcileRecords>["matched"][number] & {
      kind: "matched"
    })
  | {
      id: string
      kind: "cleared"
      countryRecord: MonthEndCountryReportRecord
      resolvedRow: ResolvedCountryReportRow
    }

function removeReconciliationMatches({
  reconciliation,
  countryRecords,
  masterRecords,
}: {
  reconciliation: ReturnType<typeof reconcileRecords>
  countryRecords: MonthEndCountryReportRecord[]
  masterRecords: MonthEndMasterRecord[]
}): ReturnType<typeof reconcileRecords> {
  const countryRecordIds = new Set(countryRecords.map((record) => record.id))
  const masterRecordIds = new Set(masterRecords.map((record) => record.id))
  const missingCountryById = new Map(
    reconciliation.missingFromNetSuite.map((record) => [record.id, record])
  )
  const missingMasterById = new Map(
    reconciliation.missingFromCountry.map((record) => [record.id, record])
  )

  for (const record of countryRecords) {
    missingCountryById.set(record.id, record)
  }

  for (const record of masterRecords) {
    missingMasterById.set(record.id, record)
  }

  return {
    ...reconciliation,
    matched: reconciliation.matched.filter(
      (match) =>
        !countryRecordIds.has(match.countryRecord.id) &&
        !masterRecordIds.has(match.masterRecord.id)
    ),
    linkedMasterRecordIds: new Set(
      Array.from(reconciliation.linkedMasterRecordIds).filter(
        (recordId) => !masterRecordIds.has(recordId)
      )
    ),
    autoRolledMasterIds: new Set(
      Array.from(reconciliation.autoRolledMasterIds).filter(
        (recordId) => !masterRecordIds.has(recordId)
      )
    ),
    autoLeftMasterIds: new Set(
      Array.from(reconciliation.autoLeftMasterIds).filter(
        (recordId) => !masterRecordIds.has(recordId)
      )
    ),
    missingFromNetSuite: Array.from(missingCountryById.values()),
    missingFromCountry: Array.from(missingMasterById.values()),
  }
}

function parseCountryDashboardSection(value: unknown): CountryDashboardSection {
  return value === "matched" || value === "left" || value === "rolled"
    ? value
    : "matched"
}

function countryIdFallbackName(countryId?: string) {
  return countryId
    ?.split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
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

function invoiceDocumentKey(rowId: string) {
  return `${rowId}__invoice_document`
}

function congoInvoiceJournalValuesKey(rowId: string) {
  return `${rowId}__congo_invoice_journal_values`
}

function frabemarInvoicePackageKey(rowId = FRABEMAR_COUNTRY_ID) {
  return `${rowId}__frabemar_invoice_package`
}

function frabemarCountryJournalValuesKey(rowId: string) {
  return `${rowId}__frabemar_country_journal_values`
}

function exchangeRateDisplayKey(rowId: string) {
  return `${rowId}__exchange_rate_display`
}

function monthEndTaskKey(
  rowId: string,
  taskId: "invoice" | "reconcile" | "journal"
) {
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

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function tableToCsv(columns: string[], rows: string[][]) {
  return [columns, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(","))
    .join("\r\n")
}

function reportTextLines(csvText: string) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

async function parseCountryReportWithAiMapping({
  csvText,
  fileName,
  mapping,
}: {
  csvText: string
  fileName: string
  mapping: ReportFieldMapping
}) {
  const response = await fetch("/api/report-mapping/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mappingKind: "countryReport",
      fields: countryReportAiFields,
      sampleFields: [],
      savedAssignments: mapping.fields,
      trainingExamples: mapping.aiTrainingExamples ?? [],
      preview: {
        fileName,
        fileType: "Country report upload",
        textLines: reportTextLines(csvText),
        rows: parseCsv(csvText),
      },
    }),
  })

  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as {
    suggestions?: ReportFieldMapping["fields"]
    table?: {
      columns?: string[]
      rows?: string[][]
    }
  }
  const columns = payload.table?.columns ?? []
  const rows = payload.table?.rows ?? []

  if (!columns.length || !rows.length) {
    return []
  }

  return (
    parseMappedCountryReportCsv(tableToCsv(columns, rows), {
      ...mapping,
      headerRowIndex: 0,
      fields: {
        ...mapping.fields,
        ...(payload.suggestions ?? {}),
      },
    }) ?? []
  )
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

function normalizeCameroonDocumentNumber(value: string | undefined | null) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
}

function cameroonOriginalMiStatusValue(value: string | undefined | null) {
  return value?.match(/Cameroon MI:\s*(MI\s*\d+)/i)?.[1] ?? ""
}

function cameroonOriginalMiRecordValue(record: MonthEndCountryReportRecord) {
  return (
    (
      record as MonthEndCountryReportRecord & {
        cameroonOriginalMiNumber?: string
      }
    ).cameroonOriginalMiNumber ??
    cameroonOriginalMiStatusValue(record.status) ??
    ""
  )
}

function parseCameroonDmiMappings(value: unknown): CameroonDmiMapping[] {
  if (typeof value !== "string" || !value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return undefined
        }

        const miNumber =
          "miNumber" in item && typeof item.miNumber === "string"
            ? normalizeCameroonDocumentNumber(item.miNumber)
            : ""
        const dmiNumber =
          "dmiNumber" in item && typeof item.dmiNumber === "string"
            ? normalizeCameroonDocumentNumber(item.dmiNumber)
            : ""

        if (!miNumber || !dmiNumber) {
          return undefined
        }

        return {
          miNumber,
          dmiNumber,
          sourceRowIndex:
            "sourceRowIndex" in item && typeof item.sourceRowIndex === "number"
              ? item.sourceRowIndex
              : 0,
        }
      })
      .filter((item): item is CameroonDmiMapping => Boolean(item))
  } catch {}

  return []
}

function serializeCameroonDmiMappings(mappings: CameroonDmiMapping[]) {
  return JSON.stringify(
    mappings.map((mapping) => ({
      ...mapping,
      miNumber: normalizeCameroonDocumentNumber(mapping.miNumber),
      dmiNumber: normalizeCameroonDocumentNumber(mapping.dmiNumber),
    }))
  )
}

function sumCameroonCommissionTotal(records: ParsedCountryReportRecord[]) {
  return records.reduce(
    (total, record) => total + (record.secondaryAmount ?? 0),
    0
  )
}

function sumCameroonReportTotal(records: ParsedCountryReportRecord[]) {
  return records.reduce((total, record) => total + record.amount, 0)
}

function parseStoredNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function parseCongoMoneyValue(value: string) {
  const rawValue = value.trim()

  if (!rawValue) {
    return 0
  }

  const isNegative = rawValue.includes("-") || /^\(.*\)$/.test(rawValue)
  const numericValue = rawValue.replace(/[^\d.,]/g, "")

  if (!numericValue) {
    return 0
  }

  const commaIndex = numericValue.lastIndexOf(",")
  const dotIndex = numericValue.lastIndexOf(".")
  const decimalIndex = Math.max(commaIndex, dotIndex)
  let normalized = numericValue

  if (commaIndex >= 0 && dotIndex >= 0) {
    const integerPart = numericValue.slice(0, decimalIndex).replace(/[.,]/g, "")
    const decimalPart = numericValue.slice(decimalIndex + 1)

    normalized = `${integerPart}.${decimalPart}`
  } else if (commaIndex >= 0) {
    const decimals = numericValue.length - commaIndex - 1

    normalized =
      decimals === 2
        ? numericValue.replace(/\./g, "").replace(",", ".")
        : numericValue.replace(/,/g, "")
  } else if (dotIndex >= 0) {
    const decimals = numericValue.length - dotIndex - 1

    normalized = decimals === 3 ? numericValue.replace(/\./g, "") : numericValue
  }

  const amount = Number(normalized)

  return Number.isFinite(amount) ? Math.abs(isNegative ? -amount : amount) : 0
}

function parseFrabemarExchangeRate(value: string) {
  const normalizedValue = value.trim().replace(",", ".")

  if (!/^\d+(?:\.\d{1,4})?$/.test(normalizedValue)) {
    return undefined
  }

  const exchangeRate = Number(normalizedValue)

  return Number.isFinite(exchangeRate) && exchangeRate > 0
    ? exchangeRate
    : undefined
}

function formatFrabemarExchangeRate(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    useGrouping: false,
  })
}

function congoMoneyValuesFromLine(line: string) {
  return Array.from(
    line.matchAll(
      /-?\(?\s*\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})\)?|-?\(?\s*\d+(?:[,.]\d{2})\)?/g
    ),
    (match) => parseCongoMoneyValue(match[0])
  ).filter((amount) => amount > 0)
}

function congoLineAfterLabelAmount(text: string, labelPattern: RegExp) {
  const normalizedText = text.replace(/\r/g, "\n")
  const match = normalizedText.match(labelPattern)

  if (!match || match.index === undefined) {
    return 0
  }

  const afterLabel = normalizedText.slice(match.index + match[0].length)
  const amountMatch = afterLabel.match(
    /-?\(?\s*\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})\)?|-?\(?\s*\d+(?:[,.]\d{2})\)?/
  )

  return amountMatch ? parseCongoMoneyValue(amountMatch[0]) : 0
}

function congoVisaPointsFromTcAndTLine(line: string) {
  const dateMatch = line.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)
  const amountText =
    dateMatch && dateMatch.index !== undefined
      ? line.slice(dateMatch.index + dateMatch[0].length)
      : line
  const values = congoMoneyValuesFromLine(amountText)

  return values[0] ?? 0
}

function congoAmountFromLineItem(lines: string[], labelPattern: RegExp) {
  const labelIndex = lines.findIndex((line) =>
    labelPattern.test(line.replace(/\s+/g, ""))
  )

  if (labelIndex < 0) {
    return 0
  }

  for (const line of lines.slice(labelIndex, labelIndex + 5)) {
    const values = congoMoneyValuesFromLine(line)
    const amount = values.at(-1) ?? 0

    if (amount > 0) {
      return amount
    }
  }

  return 0
}

function parseCongoInvoiceText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const visaPointsFromTotal = congoLineAfterLabelAmount(
    text,
    /total\s+number\s+of\s+visa\s+points\s*:/i
  )
  const visaPointsFromLines = lines
    .filter((line) => /^\s*TC&T\b/i.test(line))
    .reduce((total, line) => total + congoVisaPointsFromTcAndTLine(line), 0)
  const bankCharges = congoAmountFromLineItem(lines, /bankcharges?/i)

  return {
    visaPointsTotal: visaPointsFromTotal || visaPointsFromLines,
    bankCharges,
  }
}

function findFrabemarCountryId(value: string) {
  const normalizedValue = normalizeMatchKey(value)

  return FRABEMAR_CHILD_COUNTRIES.find((country) =>
    country.aliases.some((alias) =>
      normalizedValue.includes(normalizeMatchKey(alias))
    )
  )?.id
}

function parseFrabemarCommissionReport(text: string) {
  const commissions = new Map<string, number>()
  const normalizedText = text.replace(/\r/g, "\n")

  for (const country of FRABEMAR_CHILD_COUNTRIES) {
    if (!country.hasCommission) {
      continue
    }

    const aliasPattern = country.aliases
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")
    const match = normalizedText.match(
      new RegExp(
        `(?:${aliasPattern})[\\s\\S]{0,260}?total\\s+amount\\s+of\\s*(?:\\u20ac|EUR)?\\s*([\\d.,'\\s]+)`,
        "i"
      )
    )

    if (match?.[1]) {
      commissions.set(country.id, parseCongoMoneyValue(match[1]))
    }
  }

  return commissions
}

function parseFrabemarInvoiceTotal(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const totalLine = [...lines]
    .reverse()
    .find(
      (line) => /\btotal\b/i.test(line) && congoMoneyValuesFromLine(line).length
    )

  if (totalLine) {
    return congoMoneyValuesFromLine(totalLine).at(-1) ?? 0
  }

  const amountValues = congoMoneyValuesFromLine(text)

  return amountValues.at(-1) ?? 0
}

function parseFrabemarInvoiceNumber(text: string, fileName: string) {
  const candidates = [fileName, text]

  for (const candidate of candidates) {
    const match = candidate.match(/\b(\d{2,6})\s*EST\b/i)

    if (match?.[1]) {
      return `${match[1]}EST`
    }
  }

  return ""
}

function previousMonthEndMmddyy(period: string) {
  const match = period.match(/^(\d{4})-(\d{2})$/)

  if (!match) {
    return ""
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const date = new Date(year, month - 1, 0)
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const yy = String(date.getFullYear()).slice(-2)

  return `${mm}${dd}${yy}`
}

function frabemarCommissionInvoiceNumber(period: string, countryId: string) {
  const countryConfig = FRABEMAR_CHILD_COUNTRIES.find(
    (country) => country.id === countryId
  )
  const datePrefix = previousMonthEndMmddyy(period)

  return datePrefix && countryConfig
    ? `${datePrefix}-${countryConfig.shortCode}`
    : ""
}

function encodePdfString(value: string) {
  return value.replace(/[^\x00-\x7F]/g, "")
}

function loadInvoiceLogoImage() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load invoice logo."))
    image.src = "/africactn-logo.png"
  })
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? ""
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function pdfText(value: string) {
  return encodePdfString(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ")
}

function makePdfContentStream() {
  const commands: string[] = []

  return {
    text({
      x,
      y,
      size,
      value,
      bold = false,
      align = "left",
    }: {
      x: number
      y: number
      size: number
      value: string
      bold?: boolean
      align?: "left" | "right"
    }) {
      const escapedValue = pdfText(value)
      const width = escapedValue.length * size * 0.48
      const adjustedX = align === "right" ? x - width : x

      commands.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${adjustedX.toFixed(
          2
        )} ${y.toFixed(2)} Td (${escapedValue}) Tj ET`
      )
    },
    rect({
      x,
      y,
      width,
      height,
      gray = 0.9,
    }: {
      x: number
      y: number
      width: number
      height: number
      gray?: number
    }) {
      commands.push(`${gray} g ${x} ${y} ${width} ${height} re f 0 g`)
    },
    line({
      x1,
      y1,
      x2,
      y2,
      gray = 0.78,
    }: {
      x1: number
      y1: number
      x2: number
      y2: number
      gray?: number
    }) {
      commands.push(`${gray} G 0.75 w ${x1} ${y1} m ${x2} ${y2} l S 0 G`)
    },
    image({ x, y, size }: { x: number; y: number; size: number }) {
      commands.push(`q ${size} 0 0 ${size} ${x} ${y} cm /Logo Do Q`)
    },
    content() {
      return commands.join("\n")
    },
  }
}

function createCommissionInvoicePdfBlob({
  content,
  logoBytes,
}: {
  content: string
  logoBytes: Uint8Array
}) {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = [0]
  let byteLength = 0

  function append(value: string | Uint8Array) {
    const bytes = typeof value === "string" ? encoder.encode(value) : value

    parts.push(bytes)
    byteLength += bytes.length
  }

  function appendObject(
    index: number,
    body: string | Uint8Array,
    prefix = "",
    suffix = ""
  ) {
    offsets[index] = byteLength
    append(`${index} 0 obj\n${prefix}`)
    append(body)
    append(`${suffix}\nendobj\n`)
  }

  const contentBytes = encoder.encode(content)

  append("%PDF-1.4\n")
  appendObject(1, "<< /Type /Catalog /Pages 2 0 R >>")
  appendObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  appendObject(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Logo 6 0 R >> >> /Contents 7 0 R >>"
  )
  appendObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  appendObject(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
  appendObject(
    6,
    logoBytes,
    `<< /Type /XObject /Subtype /Image /Width 360 /Height 360 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`,
    "\nendstream"
  )
  appendObject(
    7,
    contentBytes,
    `<< /Length ${contentBytes.length} >>\nstream\n`,
    "\nendstream"
  )

  const xrefOffset = byteLength

  append("xref\n0 8\n0000000000 65535 f \n")
  for (const offset of offsets.slice(1)) {
    append(`${String(offset).padStart(10, "0")} 00000 n \n`)
  }
  append(`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  const blobParts = parts.map((part) => {
    const buffer = new ArrayBuffer(part.byteLength)

    new Uint8Array(buffer).set(part)

    return buffer
  })

  return new Blob(blobParts, { type: "application/pdf" })
}

async function downloadFrabemarCommissionInvoicePdf({
  countryName,
  invoiceNumber,
  customerReference,
  invoiceDate,
  commissionAmount,
}: {
  countryName: string
  invoiceNumber: string
  customerReference: string
  invoiceDate: string
  commissionAmount: number
}) {
  const logoImage = await loadInvoiceLogoImage()
  const logoCanvas = document.createElement("canvas")
  const logoContext = logoCanvas.getContext("2d")

  logoCanvas.width = 360
  logoCanvas.height = 360

  if (!logoContext) {
    throw new Error("Could not create invoice PDF.")
  }

  logoContext.fillStyle = "#ffffff"
  logoContext.fillRect(0, 0, logoCanvas.width, logoCanvas.height)
  logoContext.drawImage(logoImage, 0, 0, 360, 360)

  const logoBytes = dataUrlToBytes(logoCanvas.toDataURL("image/jpeg", 0.9))
  const stream = makePdfContentStream()
  const companyLines = [
    "12337 Jones Rd, Suite 414",
    "Houston, Texas 77070",
    "United States",
    "",
    "281-477-3233",
    "info@africactn.com",
    "www.africactn.com",
  ]
  const amountText = formatCurrencyAmount(commissionAmount, "EUR")

  stream.image({ x: 34, y: 664, size: 92 })
  stream.text({ x: 156, y: 740, size: 21, value: "AfricaCTN LLC", bold: true })
  companyLines.forEach((line, index) => {
    if (line) {
      stream.text({ x: 157, y: 724 - index * 10.5, size: 8.5, value: line })
    }
  })
  stream.text({
    x: 542,
    y: 738,
    size: 39,
    value: "INVOICE",
    bold: true,
    align: "right",
  })

  stream.text({ x: 38, y: 636, size: 9, value: "Bill To", bold: true })
  stream.text({ x: 38, y: 614, size: 9, value: "654 Frabemar SRL", bold: true })
  stream.text({ x: 38, y: 602, size: 9, value: "Frabemar SRL" })
  stream.text({ x: 38, y: 590, size: 9, value: "Viale Brigata Patigiane 16/2" })
  stream.text({ x: 38, y: 578, size: 9, value: "Genova 16129" })
  stream.text({ x: 38, y: 566, size: 9, value: "Italy" })

  const detailRows = [
    ["Invoice Number:", invoiceNumber],
    ["Customer Reference:", customerReference],
    ["Invoice Date:", invoiceDate],
  ]
  const detailBoxX = 342
  const detailLabelWidth = 150
  const detailValueWidth = 90
  const detailLabelRightX = detailBoxX + detailLabelWidth - 8
  const detailValueX = detailBoxX + detailLabelWidth + 10

  detailRows.forEach(([label, value], index) => {
    const y = 622 - index * 18

    stream.rect({
      x: detailBoxX,
      y: y - 6,
      width: detailLabelWidth,
      height: 17,
      gray: 0.92,
    })
    stream.rect({
      x: detailBoxX + detailLabelWidth,
      y: y - 6,
      width: detailValueWidth,
      height: 17,
      gray: 0.97,
    })
    stream.text({
      x: detailLabelRightX,
      y,
      size: 8.5,
      value: label,
      bold: true,
      align: "right",
    })
    stream.text({ x: detailValueX, y, size: 8.5, value })
  })

  stream.rect({ x: 32, y: 520, width: 550, height: 24, gray: 0.9 })
  stream.text({ x: 38, y: 529, size: 8.5, value: "Item", bold: true })
  stream.text({
    x: 568,
    y: 529,
    size: 8.5,
    value: "Amount",
    bold: true,
    align: "right",
  })
  stream.text({
    x: 38,
    y: 494,
    size: 9,
    value: `Comission - ${countryName}`,
    bold: true,
  })
  stream.text({
    x: 38,
    y: 481,
    size: 8.5,
    value: `Frabemar Commissions for ${countryName}`,
  })
  stream.text({ x: 568, y: 488, size: 9, value: amountText, align: "right" })
  stream.line({ x1: 32, y1: 468, x2: 582, y2: 468 })
  stream.rect({ x: 32, y: 426, width: 550, height: 26, gray: 0.9 })
  stream.text({
    x: 452,
    y: 436,
    size: 9,
    value: "Total",
    bold: true,
    align: "right",
  })
  stream.text({ x: 568, y: 436, size: 9, value: amountText, align: "right" })

  stream.text({
    x: 38,
    y: 396,
    size: 10,
    value: "Bank Information",
    bold: true,
  })
  ;[
    "JP Morgan Chase Bank",
    "2904 N. Beltline Rd.",
    "Bank One Texas 75062",
    "",
    "Account Name: AfricaCTN LLC",
    "",
    "Account Number: 523725601",
    "Routing Number: 111000614",
    "",
    "International Wire: CHASUS33",
    "Zelle: info@africactn.com",
    "PayCargo: AfricaCTN LLC",
  ].forEach((line, index) => {
    if (line) {
      stream.text({ x: 38, y: 374 - index * 10.5, size: 8, value: line })
    }
  })

  const blob = createCommissionInvoicePdfBlob({
    content: stream.content(),
    logoBytes,
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = encodePdfString(
    `Frabemar-${customerReference}-commission.pdf`
  )
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function findCameroonDmiMappingColumns(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeCsvHeader)
  const dmiIndex = normalizedHeaders.findIndex((header) =>
    header.includes("dmi")
  )
  const miIndex = normalizedHeaders.findIndex(
    (header) =>
      !header.includes("dmi") &&
      (header === "mi" ||
        header.includes("minumber") ||
        header.includes("mino") ||
        header.includes("miinvoice") ||
        header.includes("documentmi"))
  )

  return {
    dmiIndex,
    miIndex,
  }
}

function parseCameroonDmiPaste(text: string): CameroonDmiMapping[] {
  const rows = parseCsv(text)
  const mappings: CameroonDmiMapping[] = []
  const mappingsByMi = new Map<string, CameroonDmiMapping>()
  const firstRow = rows[0] ?? []
  const { dmiIndex, miIndex } = findCameroonDmiMappingColumns(firstRow)
  const hasHeaderMapping = dmiIndex >= 0 && miIndex >= 0
  let pendingDmiNumber = ""

  for (const [index, row] of rows.entries()) {
    if (hasHeaderMapping && index === 0) {
      continue
    }

    const rowText = row.join(" ")
    const dmiNumber = hasHeaderMapping
      ? normalizeCameroonDocumentNumber(row[dmiIndex])
      : normalizeCameroonDocumentNumber(
          row.find((cell) => /\bDMI\s*\d+/i.test(cell)) ??
            rowText.match(/\bDMI\s*\d+/i)?.[0] ??
            ""
        )
    const miNumber = hasHeaderMapping
      ? normalizeCameroonDocumentNumber(row[miIndex])
      : normalizeCameroonDocumentNumber(
          row.find(
            (cell) => /\bMI\s*\d+/i.test(cell) && !/\bDMI/i.test(cell)
          ) ??
            rowText.match(/\bMI\s*\d+/i)?.[0] ??
            ""
        )

    if (dmiNumber) {
      pendingDmiNumber = dmiNumber
    }

    if (!miNumber || (!dmiNumber && !pendingDmiNumber)) {
      continue
    }

    const mapping = {
      miNumber,
      dmiNumber: dmiNumber || pendingDmiNumber,
      sourceRowIndex: index,
    }

    mappingsByMi.set(miNumber, mapping)
  }

  for (const mapping of mappingsByMi.values()) {
    mappings.push(mapping)
  }

  return mappings
}

function applyCameroonDmiMappings(
  records: MonthEndCountryReportRecord[],
  mappings: CameroonDmiMapping[]
) {
  if (!mappings.length) {
    return records
  }

  const mappingByMiNumber = new Map(
    mappings.map((mapping) => [
      normalizeMatchKey(mapping.miNumber),
      {
        dmiNumber: mapping.dmiNumber,
        miNumber: mapping.miNumber,
      },
    ])
  )

  return records.map((record) => {
    const candidates = [
      { field: "ctnNumber" as const, value: record.ctnNumber },
      { field: "reference" as const, value: record.reference },
      { field: "invoiceNumber" as const, value: record.invoiceNumber },
      {
        field: "billOfLadingNumber" as const,
        value: record.billOfLadingNumber,
      },
    ].flatMap((candidate) =>
      normalizedReferenceParts(candidate.value).map((key) => ({
        field: candidate.field,
        key,
      }))
    )
    const match = candidates.find((candidate) =>
      mappingByMiNumber.has(candidate.key)
    )

    if (!match) {
      return record
    }

    const mapping = mappingByMiNumber.get(match.key)
    const dmiNumber = mapping?.dmiNumber ?? ""
    const cameroonOriginalMiNumber = mapping?.miNumber ?? match.key

    if (match.field === "ctnNumber") {
      return { ...record, ctnNumber: dmiNumber, cameroonOriginalMiNumber }
    }

    if (match.field === "invoiceNumber") {
      return { ...record, invoiceNumber: dmiNumber, cameroonOriginalMiNumber }
    }

    if (match.field === "billOfLadingNumber") {
      return {
        ...record,
        billOfLadingNumber: dmiNumber,
        cameroonOriginalMiNumber,
      }
    }

    return { ...record, reference: dmiNumber, cameroonOriginalMiNumber }
  })
}

type MasterDisplayRow =
  | {
      kind: "record"
      id: string
      record: MonthEndMasterRecord
      records: MonthEndMasterRecord[]
    }
  | {
      kind: "group"
      id: string
      record: MonthEndMasterRecord
      records: MonthEndMasterRecord[]
    }

function isGabonOutOfTerritoryClass(record: MonthEndMasterRecord) {
  return (
    normalizeMatchKey(record.sourceClass) ===
    normalizeMatchKey("Gabon Out of Territory")
  )
}

function gabonNonOutOfTerritoryPairKey(record: MonthEndMasterRecord) {
  if (isGabonOutOfTerritoryClass(record)) {
    return ""
  }

  const createdFrom = normalizeMatchKey(record.salesOrderNumber)
  const billOfLadingNumber = normalizeMatchKey(record.billOfLadingNumber)

  if (!createdFrom || !billOfLadingNumber) {
    return ""
  }

  return `${createdFrom}__${billOfLadingNumber}`
}

function getGabonPairIssueByRecordId(
  countryId: string | undefined,
  masterRows: { record: MonthEndMasterRecord }[]
): Map<string, string> {
  const issuesByRecordId = new Map<string, string>()

  if (countryId !== "frabemar-gabon") {
    return issuesByRecordId
  }

  const recordsByPairKey = new Map<string, MonthEndMasterRecord[]>()

  for (const { record } of masterRows) {
    if (isGabonOutOfTerritoryClass(record)) {
      continue
    }

    const pairKey = gabonNonOutOfTerritoryPairKey(record)

    if (!pairKey) {
      issuesByRecordId.set(record.id, "Missing Created From or Bill of Lading")
      continue
    }

    recordsByPairKey.set(pairKey, [
      ...(recordsByPairKey.get(pairKey) ?? []),
      record,
    ])
  }

  for (const records of recordsByPairKey.values()) {
    if (records.length === 2) {
      continue
    }

    for (const record of records) {
      issuesByRecordId.set(
        record.id,
        `Expected 2 records, found ${records.length}`
      )
    }
  }

  return issuesByRecordId
}

function getGabonNonOutOfTerritoryPairCountByRecordId(
  masterRecords: MonthEndMasterRecord[]
) {
  const recordsByPairKey = new Map<string, MonthEndMasterRecord[]>()

  for (const record of masterRecords) {
    const pairKey = gabonNonOutOfTerritoryPairKey(record)

    if (!pairKey) {
      continue
    }

    recordsByPairKey.set(pairKey, [
      ...(recordsByPairKey.get(pairKey) ?? []),
      record,
    ])
  }

  const countByRecordId = new Map<string, number>()

  for (const records of recordsByPairKey.values()) {
    for (const record of records) {
      countByRecordId.set(record.id, records.length)
    }
  }

  return countByRecordId
}

function makeMasterDisplayRows(
  countryId: string | undefined,
  masterRows: { record: MonthEndMasterRecord }[],
  gabonPairIssueByRecordId?: Map<string, string>
): MasterDisplayRow[] {
  if (countryId !== "frabemar-gabon") {
    return masterRows.map(({ record }) => ({
      kind: "record",
      id: record.id,
      record,
      records: [record],
    }))
  }

  const recordsByPairKey = new Map<string, MonthEndMasterRecord[]>()

  for (const { record } of masterRows) {
    const pairKey = gabonNonOutOfTerritoryPairKey(record)

    if (!pairKey) {
      continue
    }

    recordsByPairKey.set(pairKey, [
      ...(recordsByPairKey.get(pairKey) ?? []),
      record,
    ])
  }

  const consumedPairKeys = new Set<string>()
  const displayRows: MasterDisplayRow[] = []

  for (const { record } of masterRows) {
    const pairKey = gabonNonOutOfTerritoryPairKey(record)
    const pairRecords = pairKey ? recordsByPairKey.get(pairKey) : undefined

    if (!pairKey || pairRecords?.length !== 2) {
      displayRows.push({
        kind: "record",
        id: record.id,
        record,
        records: [record],
      })
      continue
    }

    if (consumedPairKeys.has(pairKey)) {
      continue
    }

    consumedPairKeys.add(pairKey)
    displayRows.push({
      kind: "group",
      id: `gabon-pair-${pairKey}`,
      record: pairRecords[0],
      records: pairRecords,
    })
  }

  return displayRows.sort((first, second) => {
    const firstHasIssue =
      first.kind === "record" && gabonPairIssueByRecordId?.has(first.record.id)
    const secondHasIssue =
      second.kind === "record" &&
      gabonPairIssueByRecordId?.has(second.record.id)

    if (firstHasIssue === secondHasIssue) {
      return 0
    }

    return firstHasIssue ? -1 : 1
  })
}

function matchCandidates(
  masterRecord: MonthEndMasterRecord,
  countryRecord: MonthEndCountryReportRecord,
  countryId?: string
) {
  const cameroonOriginalMi =
    countryId === "cameroon" ? cameroonOriginalMiRecordValue(countryRecord) : ""
  const candidates = [
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
      countryValues: [
        countryRecord.ctnNumber,
        countryRecord.reference,
        cameroonOriginalMi,
      ],
    },
    {
      label: "Invoice",
      masterValue: masterRecord.salesOrderNumber,
      countryValues: [
        countryRecord.invoiceNumber,
        countryRecord.reference,
        cameroonOriginalMi,
      ],
    },
  ]

  return countryId === "frabemar-gabon"
    ? candidates.filter((candidate) => candidate.label !== "CTN")
    : candidates
}

function normalizedReferenceParts(value: string | undefined | null) {
  return (value ?? "")
    .split(/[\s,;/|]+/)
    .map((part) => normalizeMatchKey(part))
    .filter(Boolean)
}

function referencesMatch(
  masterValue: string | undefined | null,
  countryValue: string | undefined | null
) {
  const masterKey = normalizeMatchKey(masterValue)
  const countryKey = normalizeMatchKey(countryValue)

  if (!masterKey || !countryKey) {
    return false
  }

  if (masterKey === countryKey) {
    return true
  }

  const masterParts = normalizedReferenceParts(masterValue)
  const countryParts = normalizedReferenceParts(countryValue)

  return (
    masterParts.includes(countryKey) ||
    countryParts.includes(masterKey) ||
    ((masterKey.length >= 6 || countryKey.length >= 6) &&
      (masterKey.includes(countryKey) || countryKey.includes(masterKey)))
  )
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
  countryRecord: MonthEndCountryReportRecord,
  countryId?: string
) {
  for (const candidate of matchCandidates(
    masterRecord,
    countryRecord,
    countryId
  )) {
    const countryValue = candidate.countryValues.find((value) =>
      referencesMatch(candidate.masterValue, value)
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

function masterReferenceCandidates(
  masterRecord: MonthEndMasterRecord,
  countryId?: string
) {
  const candidates = [
    { label: "BL", value: masterRecord.billOfLadingNumber },
    { label: "CTN", value: masterRecord.ctnNumber },
    { label: "Invoice", value: masterRecord.salesOrderNumber },
  ]

  return (
    countryId === "frabemar-gabon"
      ? candidates.filter((candidate) => candidate.label !== "CTN")
      : candidates
  ).flatMap((candidate) => {
    const normalizedValue = normalizeMatchKey(candidate.value)

    return normalizedValue
      ? [{ ...candidate, key: `${candidate.label}:${normalizedValue}` }]
      : []
  })
}

function canAutoReconcileCountryRecord(
  countryRecord: MonthEndCountryReportRecord,
  countryId?: string
) {
  if (countryId !== "frabemar-gabon") {
    return true
  }

  return Boolean(countryRecord.transactionDate?.trim())
}

function canAutoReconcileMasterRecord({
  masterRecord,
  countryId,
  gabonPairCountByRecordId,
}: {
  masterRecord: MonthEndMasterRecord
  countryId?: string
  gabonPairCountByRecordId: Map<string, number>
}) {
  if (countryId !== "frabemar-gabon") {
    return true
  }

  return (gabonPairCountByRecordId.get(masterRecord.id) ?? 1) <= 2
}

function isGabonFormRecord(record: MonthEndMasterRecord) {
  const sourceClass = normalizeMatchKey(record.sourceClass)

  return sourceClass.includes("form")
}

function isGabonTariffRecord(record: MonthEndMasterRecord) {
  const sourceClass = normalizeMatchKey(record.sourceClass)

  return sourceClass.includes("tariff")
}

function isCurrentMonthBlankValidationGabonRecord(
  countryRecord: MonthEndCountryReportRecord,
  countryId: string | undefined,
  period: string | undefined
) {
  return (
    countryId === "frabemar-gabon" &&
    !countryRecord.transactionDate?.trim() &&
    Boolean(countryRecord.sellingDate?.trim()) &&
    datePeriodKey(countryRecord.sellingDate, true) === period
  )
}

function reconcileRecords({
  masterRecords,
  countryRecords,
  countryId,
  period,
}: {
  masterRecords: MonthEndMasterRecord[]
  countryRecords: MonthEndCountryReportRecord[]
  countryId?: string
  period?: string
}) {
  const matchedMasterIds = new Set<string>()
  const matchedCountryIds = new Set<string>()
  const autoRolledMasterIds = new Set<string>()
  const autoLeftMasterIds = new Set<string>()
  const gabonPairCountByRecordId =
    countryId === "frabemar-gabon"
      ? getGabonNonOutOfTerritoryPairCountByRecordId(masterRecords)
      : new Map<string, number>()
  const matched = countryRecords.flatMap((countryRecord) => {
    if (
      isCurrentMonthBlankValidationGabonRecord(countryRecord, countryId, period)
    ) {
      const matchingMasterRecords = masterRecords.filter((item) => {
        if (matchedMasterIds.has(item.id)) {
          return false
        }

        return Boolean(matchDetail(item, countryRecord, countryId))
      })

      if (matchingMasterRecords.length === 2) {
        for (const masterRecord of matchingMasterRecords) {
          matchedMasterIds.add(masterRecord.id)

          if (isGabonFormRecord(masterRecord)) {
            autoLeftMasterIds.add(masterRecord.id)
          }

          if (isGabonTariffRecord(masterRecord)) {
            autoRolledMasterIds.add(masterRecord.id)
          }
        }

        matchedCountryIds.add(countryRecord.id)

        return matchingMasterRecords.map((masterRecord) => ({
          id: `${masterRecord.id}__${countryRecord.id}`,
          masterRecord,
          countryRecord,
          matchedOn: {
            label: "Gabon BL",
            value:
              masterRecord.billOfLadingNumber ||
              countryRecord.billOfLadingNumber,
          },
        }))
      }
    }

    if (!canAutoReconcileCountryRecord(countryRecord, countryId)) {
      return []
    }

    const masterRecord = masterRecords.find((item) => {
      if (matchedMasterIds.has(item.id)) {
        return false
      }

      if (
        !canAutoReconcileMasterRecord({
          masterRecord: item,
          countryId,
          gabonPairCountByRecordId,
        })
      ) {
        return false
      }

      return Boolean(matchDetail(item, countryRecord, countryId))
    })

    if (!masterRecord) {
      return []
    }

    const matchedOn = matchDetail(masterRecord, countryRecord, countryId)

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
    for (const reference of masterReferenceCandidates(
      masterRecord,
      countryId
    )) {
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
    for (const reference of masterReferenceCandidates(
      match.masterRecord,
      countryId
    )) {
      matchedCountryByReference.set(reference.key, match.countryRecord)
    }
  }

  const linkedMasterRecordIds = new Set<string>()
  const linkedReferenceMatches = masterRecords.flatMap((masterRecord) => {
    if (matchedMasterIds.has(masterRecord.id)) {
      return []
    }

    if (
      !canAutoReconcileMasterRecord({
        masterRecord,
        countryId,
        gabonPairCountByRecordId,
      })
    ) {
      return []
    }

    const linkedReference = masterReferenceCandidates(
      masterRecord,
      countryId
    ).find(
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
    autoRolledMasterIds,
    autoLeftMasterIds,
    missingFromNetSuite: countryRecords.filter(
      (record) => !matchedCountryIds.has(record.id)
    ),
    missingFromCountry: masterRecords.filter(
      (record) => !matchedMasterIds.has(record.id)
    ),
  }
}

function makeReconciliationSnapshot({
  countryId,
  period,
  reconciliation,
  rolledInternalIds,
  leftInvoiceRecordIds,
  resolvedCountryReportRows,
}: {
  countryId: string
  period: string
  reconciliation: ReturnType<typeof reconcileRecords>
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  resolvedCountryReportRows: ResolvedCountryReportRow[]
}): ReconciliationSnapshot {
  const masterRecordsById = new Map(
    [
      ...reconciliation.matched.map(({ masterRecord }) => masterRecord),
      ...reconciliation.missingFromCountry,
    ].map((record) => [record.id, record])
  )
  const masterRecordsByInternalId = new Map(
    Array.from(masterRecordsById.values())
      .map((record) => [record.sourceInternalId.trim(), record] as const)
      .filter(([internalId]) => Boolean(internalId))
  )

  return {
    countryId,
    period,
    savedAt: new Date().toISOString(),
    matched: reconciliation.matched.map(
      ({ masterRecord, countryRecord, matchedOn }) => ({
        masterRecordId: masterRecord.id,
        countryRecordId: countryRecord.id,
        matchedOn: matchedOn?.label,
        matchedValue: matchedOn?.value,
      })
    ),
    linkedMasterRecordIds: Array.from(reconciliation.linkedMasterRecordIds),
    autoRolledMasterRecordIds: Array.from(reconciliation.autoRolledMasterIds),
    autoRolledInternalIds: Array.from(reconciliation.autoRolledMasterIds)
      .map((recordId) => masterRecordsById.get(recordId)?.sourceInternalId)
      .map((internalId) => internalId?.trim() ?? "")
      .filter(Boolean),
    autoLeftMasterRecordIds: Array.from(reconciliation.autoLeftMasterIds),
    autoLeftInternalIds: Array.from(reconciliation.autoLeftMasterIds)
      .map((recordId) => masterRecordsById.get(recordId)?.sourceInternalId)
      .map((internalId) => internalId?.trim() ?? "")
      .filter(Boolean),
    rolledInternalIds,
    leftInvoiceRecordIds,
    leftInvoiceInternalIds: leftInvoiceRecordIds
      .map(
        (recordId) =>
          masterRecordsById.get(recordId)?.sourceInternalId ||
          masterRecordsByInternalId.get(recordId)?.sourceInternalId ||
          recordId
      )
      .map((internalId) => internalId?.trim() ?? "")
      .filter(Boolean),
    resolvedCountryReportRows,
    missingCountryRecordIds: reconciliation.missingFromNetSuite.map(
      (record) => record.id
    ),
    missingMasterRecordIds: reconciliation.missingFromCountry.map(
      (record) => record.id
    ),
  }
}

function applyReconciliationSnapshot({
  reconciliation,
  snapshot,
  masterRecords,
  countryRecords,
}: {
  reconciliation: ReturnType<typeof reconcileRecords>
  snapshot?: ReconciliationSnapshot
  masterRecords: MonthEndMasterRecord[]
  countryRecords: MonthEndCountryReportRecord[]
}): ReturnType<typeof reconcileRecords> {
  if (!snapshot) {
    return reconciliation
  }

  const masterRecordsById = new Map(
    masterRecords.map((record) => [record.id, record])
  )
  const countryRecordsById = new Map(
    countryRecords.map((record) => [record.id, record])
  )
  const matched = snapshot.matched.flatMap((match) => {
    const masterRecord = masterRecordsById.get(match.masterRecordId)
    const countryRecord = countryRecordsById.get(match.countryRecordId)

    if (!masterRecord || !countryRecord) {
      return []
    }

    return [
      {
        id: `${masterRecord.id}__${countryRecord.id}`,
        masterRecord,
        countryRecord,
        matchedOn:
          match.matchedOn || match.matchedValue
            ? {
                label: match.matchedOn ?? "Saved",
                value: match.matchedValue ?? "",
              }
            : undefined,
      },
    ]
  })
  const missingCountryRecordIds = new Set(snapshot.missingCountryRecordIds)
  const missingMasterRecordIds = new Set(snapshot.missingMasterRecordIds)
  const autoRolledInternalIds = new Set(snapshot.autoRolledInternalIds ?? [])
  const autoLeftInternalIds = new Set(snapshot.autoLeftInternalIds ?? [])
  const autoRolledMasterIds = new Set([
    ...snapshot.autoRolledMasterRecordIds,
    ...masterRecords
      .filter(
        (record) =>
          record.sourceInternalId &&
          autoRolledInternalIds.has(record.sourceInternalId)
      )
      .map((record) => record.id),
  ])
  const autoLeftMasterIds = new Set([
    ...snapshot.autoLeftMasterRecordIds,
    ...masterRecords
      .filter(
        (record) =>
          record.sourceInternalId &&
          autoLeftInternalIds.has(record.sourceInternalId)
      )
      .map((record) => record.id),
  ])

  return {
    matched,
    linkedMasterRecordIds: new Set(snapshot.linkedMasterRecordIds),
    autoRolledMasterIds,
    autoLeftMasterIds,
    missingFromNetSuite: countryRecords.filter((record) =>
      missingCountryRecordIds.has(record.id)
    ),
    missingFromCountry: masterRecords.filter((record) =>
      missingMasterRecordIds.has(record.id)
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
  resolvedCountryReportRows,
  showCountryColumn,
  onDropMasterFile,
  onDropCountryFiles,
  canEditCountryData = true,
  isReadOnly = false,
  canUnreconcile = !isReadOnly,
  showOnlyMatched = false,
  countryId,
  countryName,
  countryRecordCount,
  masterRecordCount,
  matchedCountryCount,
  matchedMasterCount,
  onRollInvoices,
  onLeaveInvoices,
  onReconcileSelectedPair,
  onReconcileCountryRows,
  onUnreconcileMatchedRows,
  onPasteDmiReport,
  onProceed,
  onMoveInvoicesToOot,
}: {
  countryRecords: MonthEndCountryReportRecord[]
  masterRecords: MonthEndMasterRecord[]
  matchedRecords: ReturnType<typeof reconcileRecords>["matched"]
  missingCountryRecordIds: Set<string>
  missingMasterRecordIds: Set<string>
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  resolvedCountryReportRows: ResolvedCountryReportRow[]
  showCountryColumn: boolean
  onDropMasterFile: (file: File) => void
  onDropCountryFiles: (files: File[]) => void
  canEditCountryData?: boolean
  isReadOnly?: boolean
  canUnreconcile?: boolean
  showOnlyMatched?: boolean
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
  onReconcileSelectedPair: (
    countryRecord: MonthEndCountryReportRecord,
    masterRecord: MonthEndMasterRecord
  ) => Promise<void>
  onReconcileCountryRows: (
    records: MonthEndCountryReportRecord[],
    reason: string,
    note: string
  ) => Promise<void>
  onUnreconcileMatchedRows: (rows: MatchedDisplayRow[]) => Promise<void>
  onPasteDmiReport?: () => void
  onProceed: () => Promise<void>
  onMoveInvoicesToOot?: (
    records: MonthEndMasterRecord[]
  ) => Promise<{ movedCount: number }>
}) {
  const [selectedCountryRecordIds, setSelectedCountryRecordIds] =
    React.useState(() => new Set<string>())
  const [selectedMasterRecordIds, setSelectedMasterRecordIds] = React.useState(
    () => new Set<string>()
  )
  const [selectedMatchedRowIds, setSelectedMatchedRowIds] = React.useState(
    () => new Set<string>()
  )
  const lastCountrySelectionAnchorIdRef = React.useRef<string | null>(null)
  const isShiftClickingCountryRowRef = React.useRef(false)
  const lastMasterSelectionAnchorIdRef = React.useRef<string | null>(null)
  const isShiftClickingMasterRowRef = React.useRef(false)
  const [isRollingInvoices, setIsRollingInvoices] = React.useState(false)
  const [isReconcilingCountryRows, setIsReconcilingCountryRows] =
    React.useState(false)
  const [isReconcilingSelectedPair, setIsReconcilingSelectedPair] =
    React.useState(false)
  const [isUnreconcilingMatchedRows, setIsUnreconcilingMatchedRows] =
    React.useState(false)
  const [isProceeding, setIsProceeding] = React.useState(false)
  const [isMovingInvoicesToOot, setIsMovingInvoicesToOot] =
    React.useState(false)
  const [rollInvoiceMessage, setRollInvoiceMessage] = React.useState("")
  const [countryReconcileMessage, setCountryReconcileMessage] =
    React.useState("")
  const [isCountryReconcileDialogOpen, setIsCountryReconcileDialogOpen] =
    React.useState(false)
  const [countryReconcileReason, setCountryReconcileReason] = React.useState("")
  const [countryReconcileReasonSearch, setCountryReconcileReasonSearch] =
    React.useState("")
  const [isCountryReasonDropdownOpen, setIsCountryReasonDropdownOpen] =
    React.useState(false)
  const [countryReconcileNote, setCountryReconcileNote] = React.useState("")
  const [hiddenMasterRecordIds, setHiddenMasterRecordIds] = React.useState(
    () => new Set<string>()
  )
  const [expandedMasterGroupIds, setExpandedMasterGroupIds] = React.useState(
    () => new Set<string>()
  )
  const countryReconcileReasonRef = React.useRef<HTMLInputElement>(null)
  const countryReconcileNoteRef = React.useRef<HTMLTextAreaElement>(null)
  const [dragTarget, setDragTarget] = React.useState<
    "country" | "master" | null
  >(null)
  const visibleCountryIds = new Set(countryRecords.map((record) => record.id))
  const visibleMasterIds = new Set(masterRecords.map((record) => record.id))
  const rolledInternalIdSet = new Set(rolledInternalIds)
  const leftInvoiceRecordIdSet = new Set(leftInvoiceRecordIds)
  const resolvedCountryRecordIdSet = new Set(
    resolvedCountryReportRows.map((record) => record.id)
  )
  const filteredCountryReconcileReasonOptions =
    countryReportReconcileReasonOptions.filter((option) =>
      option
        .toLowerCase()
        .includes(countryReconcileReasonSearch.trim().toLowerCase())
    )
  const countryRows = countryRecords
    .filter(
      (record) =>
        missingCountryRecordIds.has(record.id) &&
        !resolvedCountryRecordIdSet.has(record.id)
    )
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
        !isApprovedMasterRecord(record, leftInvoiceRecordIdSet) &&
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
  const matchedCountryRecordIds = new Set(
    matchedRows.map(({ countryRecord }) => countryRecord.id)
  )
  const resolvedCountryReportRowById = new Map(
    resolvedCountryReportRows.map((row) => [row.id, row])
  )
  const clearedRows = countryRecords
    .filter(
      (record) =>
        visibleCountryIds.has(record.id) &&
        resolvedCountryReportRowById.has(record.id) &&
        !matchedCountryRecordIds.has(record.id)
    )
    .map((countryRecord) => ({
      id: `cleared__${countryRecord.id}`,
      kind: "cleared" as const,
      countryRecord,
      resolvedRow: resolvedCountryReportRowById.get(countryRecord.id),
    }))
    .filter(
      (
        row
      ): row is {
        id: string
        kind: "cleared"
        countryRecord: MonthEndCountryReportRecord
        resolvedRow: ResolvedCountryReportRow
      } => Boolean(row.resolvedRow)
    )
    .sort((first, second) =>
      (
        first.countryRecord.reference || first.countryRecord.ctnNumber
      ).localeCompare(
        second.countryRecord.reference || second.countryRecord.ctnNumber
      )
    )
  const matchedDisplayRows = [
    ...matchedRows.map((match) => ({ ...match, kind: "matched" as const })),
    ...clearedRows,
  ]
  const matchedRowCount = new Set(
    matchedDisplayRows.map(({ countryRecord }) => countryRecord.id)
  ).size
  const allMatchedRowsSelected =
    matchedDisplayRows.length > 0 &&
    matchedDisplayRows.every((row) => selectedMatchedRowIds.has(row.id))
  const selectedMatchedRows = matchedDisplayRows.filter((row) =>
    selectedMatchedRowIds.has(row.id)
  )
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
  const allCountryRowsSelected =
    countryRows.length > 0 &&
    countryRows.every(({ record }) => selectedCountryRecordIds.has(record.id))
  const selectedCountryRecords = countryRows
    .map(({ record }) => record)
    .filter((record) => selectedCountryRecordIds.has(record.id))
  const selectedMasterRecords = masterRows
    .map(({ record }) => record)
    .filter((record) => selectedMasterRecordIds.has(record.id))
  const hasPairedSelection =
    selectedCountryRecords.length > 0 && selectedMasterRecords.length > 0
  const canReconcileSelectedPair =
    selectedCountryRecords.length === 1 && selectedMasterRecords.length === 1
  const isCountryReconcileNoteRequired = countryReconcileReason === "Other"
  const canSaveCountryReconciliation =
    Boolean(countryReconcileReason) &&
    (!isCountryReconcileNoteRequired || Boolean(countryReconcileNote.trim()))
  const canProceed = countryRows.length === 0 && masterRows.length === 0
  const gabonPairIssueByRecordId = getGabonPairIssueByRecordId(
    countryId,
    masterRows
  )
  const masterDisplayRows = makeMasterDisplayRows(
    countryId,
    masterRows,
    gabonPairIssueByRecordId
  )

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

  function toggleAllCountryRows(checked: boolean) {
    setSelectedCountryRecordIds((current) => {
      const next = new Set(current)

      for (const { record } of countryRows) {
        if (checked) {
          next.add(record.id)
        } else {
          next.delete(record.id)
        }
      }

      return next
    })
  }

  function toggleCountryRow(
    recordId: string,
    checked: boolean,
    shiftKey = false
  ) {
    setSelectedCountryRecordIds((current) => {
      const next = new Set(current)
      const anchorRecordId = lastCountrySelectionAnchorIdRef.current
      const countryRowIds = countryRows.map(({ record }) => record.id)
      const anchorIndex = anchorRecordId
        ? countryRowIds.indexOf(anchorRecordId)
        : -1
      const recordIndex = countryRowIds.indexOf(recordId)

      if (shiftKey && anchorIndex >= 0 && recordIndex >= 0) {
        const startIndex = Math.min(anchorIndex, recordIndex)
        const endIndex = Math.max(anchorIndex, recordIndex)

        for (const rangeRecordId of countryRowIds.slice(
          startIndex,
          endIndex + 1
        )) {
          if (checked) {
            next.add(rangeRecordId)
          } else {
            next.delete(rangeRecordId)
          }
        }
      } else if (checked) {
        next.add(recordId)
      } else {
        next.delete(recordId)
      }

      return next
    })
    lastCountrySelectionAnchorIdRef.current = recordId
    isShiftClickingCountryRowRef.current = false
  }

  function toggleMasterRow(
    recordId: string,
    checked: boolean,
    shiftKey = false
  ) {
    setSelectedMasterRecordIds((current) => {
      const next = new Set(current)
      const anchorRecordId = lastMasterSelectionAnchorIdRef.current
      const masterRowIds = masterRows.map(({ record }) => record.id)
      const anchorIndex = anchorRecordId
        ? masterRowIds.indexOf(anchorRecordId)
        : -1
      const recordIndex = masterRowIds.indexOf(recordId)

      if (shiftKey && anchorIndex >= 0 && recordIndex >= 0) {
        const startIndex = Math.min(anchorIndex, recordIndex)
        const endIndex = Math.max(anchorIndex, recordIndex)

        for (const rangeRecordId of masterRowIds.slice(
          startIndex,
          endIndex + 1
        )) {
          if (checked) {
            next.add(rangeRecordId)
          } else {
            next.delete(rangeRecordId)
          }
        }
      } else if (checked) {
        next.add(recordId)
      } else {
        next.delete(recordId)
      }

      return next
    })
    lastMasterSelectionAnchorIdRef.current = recordId
    isShiftClickingMasterRowRef.current = false
  }

  function toggleMasterRecords(
    records: MonthEndMasterRecord[],
    checked: boolean
  ) {
    setSelectedMasterRecordIds((current) => {
      const next = new Set(current)

      for (const record of records) {
        if (checked) {
          next.add(record.id)
        } else {
          next.delete(record.id)
        }
      }

      return next
    })
    lastMasterSelectionAnchorIdRef.current = records.at(-1)?.id ?? null
    isShiftClickingMasterRowRef.current = false
  }

  function toggleAllMatchedRows(checked: boolean) {
    setSelectedMatchedRowIds((current) => {
      const next = new Set(current)

      for (const row of matchedDisplayRows) {
        if (checked) {
          next.add(row.id)
        } else {
          next.delete(row.id)
        }
      }

      return next
    })
  }

  function toggleMatchedRow(rowId: string, checked: boolean) {
    setSelectedMatchedRowIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(rowId)
      } else {
        next.delete(rowId)
      }

      return next
    })
  }

  function toggleMasterGroup(groupId: string) {
    setExpandedMasterGroupIds((current) => {
      const next = new Set(current)

      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }

      return next
    })
  }

  function focusCountryReconcileNote() {
    window.setTimeout(() => {
      countryReconcileNoteRef.current?.focus()
    }, 0)
  }

  function selectCountryReconcileReason(reason: string) {
    setCountryReconcileReason(reason)
    setCountryReconcileReasonSearch(reason)
    setIsCountryReasonDropdownOpen(false)
  }

  function commitCountryReconcileReason() {
    const search = countryReconcileReasonSearch.trim()
    const exactMatch = countryReportReconcileReasonOptions.find(
      (option) => option.toLowerCase() === search.toLowerCase()
    )
    const nextReason =
      exactMatch ?? filteredCountryReconcileReasonOptions[0] ?? ""

    if (nextReason) {
      selectCountryReconcileReason(nextReason)
    }

    return nextReason
  }

  function openCountryReconcileDialog() {
    if (!selectedCountryRecords.length) {
      return
    }

    setCountryReconcileReason("")
    setCountryReconcileReasonSearch("")
    setCountryReconcileNote("")
    setIsCountryReconcileDialogOpen(true)
    setIsCountryReasonDropdownOpen(false)
    window.setTimeout(() => {
      countryReconcileReasonRef.current?.focus()
    }, 0)
  }

  async function saveCountryReconciliation() {
    if (!selectedCountryRecords.length || !canSaveCountryReconciliation) {
      return
    }

    setIsReconcilingCountryRows(true)
    setCountryReconcileMessage("")

    try {
      await onReconcileCountryRows(
        selectedCountryRecords,
        countryReconcileReason,
        countryReconcileNote.trim()
      )
      setSelectedCountryRecordIds(new Set())
      setCountryReconcileReason("")
      setCountryReconcileReasonSearch("")
      setCountryReconcileNote("")
      setIsCountryReconcileDialogOpen(false)
      setCountryReconcileMessage(
        `${selectedCountryRecords.length} country report row${selectedCountryRecords.length === 1 ? "" : "s"} reconciled.`
      )
    } catch {
      setCountryReconcileMessage("Could not save the selected country rows.")
    } finally {
      setIsReconcilingCountryRows(false)
    }
  }

  async function reconcileSelectedPair() {
    if (!canReconcileSelectedPair) {
      return
    }

    setIsReconcilingSelectedPair(true)
    setCountryReconcileMessage("")
    setRollInvoiceMessage("")

    try {
      await onReconcileSelectedPair(
        selectedCountryRecords[0],
        selectedMasterRecords[0]
      )
      setSelectedCountryRecordIds(new Set())
      setSelectedMasterRecordIds(new Set())
      setCountryReconcileMessage(
        "Selected country and NetSuite records reconciled."
      )
    } catch {
      setCountryReconcileMessage("Could not reconcile the selected records.")
    } finally {
      setIsReconcilingSelectedPair(false)
    }
  }

  async function unreconcileSelectedMatchedRows() {
    if (!selectedMatchedRows.length) {
      return
    }

    setIsUnreconcilingMatchedRows(true)
    setCountryReconcileMessage("")
    setRollInvoiceMessage("")

    try {
      await onUnreconcileMatchedRows(selectedMatchedRows)
      setSelectedMatchedRowIds(new Set())
    } finally {
      setIsUnreconcilingMatchedRows(false)
    }
  }

  async function proceedToNextStep() {
    if (!canProceed) {
      return
    }

    setIsProceeding(true)
    setRollInvoiceMessage("")

    try {
      await onProceed()
    } finally {
      setIsProceeding(false)
    }
  }

  async function rollSelectedInvoices() {
    const rollingRecordIds = selectedMasterRecords.map((record) => record.id)
    const shouldProceedAfterRoll =
      countryRows.length === 0 &&
      selectedMasterRecords.length > 0 &&
      selectedMasterRecords.length === masterRows.length

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
      const canProceedAfterRoll =
        shouldProceedAfterRoll && result.excludedCount === 0
      const savedLabel = `${result.savedCount} invoice${result.savedCount === 1 ? "" : "s"} added`
      const excludedLabel = result.excludedCount
        ? ` ${result.excludedCount} selected record${result.excludedCount === 1 ? " was" : "s were"} excluded because no Internal ID was provided by NetSuite.`
        : ""

      if (canProceedAfterRoll) {
        setIsProceeding(true)
        await onProceed()
        return
      }

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
      setIsProceeding(false)
    }
  }

  async function leaveSelectedInvoices() {
    const leavingRecordIds = selectedMasterRecords.map((record) => record.id)
    const shouldProceedAfterLeave =
      countryRows.length === 0 &&
      selectedMasterRecords.length > 0 &&
      selectedMasterRecords.length === masterRows.length

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
      if (shouldProceedAfterLeave) {
        setIsProceeding(true)
        await onProceed()
        return
      }

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
    } finally {
      setIsProceeding(false)
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
    <>
      <Dialog
        open={isCountryReconcileDialogOpen}
        onOpenChange={setIsCountryReconcileDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear Country Rows</DialogTitle>
            <DialogDescription>
              {selectedCountryRecords.length} selected
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="relative">
              <Input
                ref={countryReconcileReasonRef}
                value={countryReconcileReasonSearch}
                onChange={(event) => {
                  setCountryReconcileReasonSearch(event.target.value)
                  setCountryReconcileReason("")
                  setIsCountryReasonDropdownOpen(true)
                }}
                onFocus={() => setIsCountryReasonDropdownOpen(false)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsCountryReasonDropdownOpen(false)
                  }, 100)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (commitCountryReconcileReason()) {
                      focusCountryReconcileNote()
                    }
                  }

                  if (event.key === "Tab") {
                    event.preventDefault()
                    if (commitCountryReconcileReason()) {
                      focusCountryReconcileNote()
                    } else {
                      setIsCountryReasonDropdownOpen(false)
                    }
                  }

                  if (event.key === "Escape") {
                    setIsCountryReasonDropdownOpen(false)
                  }
                }}
                role="combobox"
                aria-expanded={isCountryReasonDropdownOpen}
                aria-controls="country-reconcile-reason-options"
                aria-autocomplete="list"
                placeholder="Select a reason"
                autoComplete="off"
              />
              {isCountryReasonDropdownOpen ? (
                <div
                  id="country-reconcile-reason-options"
                  role="listbox"
                  className="absolute top-full left-0 z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
                >
                  {filteredCountryReconcileReasonOptions.length ? (
                    filteredCountryReconcileReasonOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        tabIndex={-1}
                        role="option"
                        aria-selected={countryReconcileReason === option}
                        className="flex min-h-8 w-full items-center rounded-xl px-2.5 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectCountryReconcileReason(option)
                          focusCountryReconcileNote()
                        }}
                      >
                        {option}
                      </button>
                    ))
                  ) : (
                    <div className="px-2.5 py-2 text-muted-foreground">
                      No reasons found.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <Textarea
              ref={countryReconcileNoteRef}
              value={countryReconcileNote}
              onChange={(event) => setCountryReconcileNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  saveCountryReconciliation()
                }
              }}
              placeholder={
                isCountryReconcileNoteRequired
                  ? "Type note, then press Enter"
                  : "Optional note"
              }
              className="min-h-28 resize-y"
              disabled={!countryReconcileReason || isReconcilingCountryRows}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCountryReconcileDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveCountryReconciliation}
              disabled={
                !canSaveCountryReconciliation || isReconcilingCountryRows
              }
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid min-h-0 gap-3 xl:gap-4">
        {!showOnlyMatched ? (
          <>
            <div className="grid min-h-0 items-stretch gap-4 lg:min-h-[calc(100svh-var(--header-height)-5.5rem)] lg:grid-cols-2">
              <section
                className={
                  "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background p-3 transition-colors " +
                  (dragTarget === "country"
                    ? "border-primary bg-primary/5"
                    : "")
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
                  <h2 className="text-lg font-semibold tracking-normal">
                    Country
                  </h2>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!isReadOnly && onPasteDmiReport ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full"
                        onClick={onPasteDmiReport}
                      >
                        <ClipboardPasteIcon />
                        Paste DMI Report
                      </Button>
                    ) : null}
                    {!isReadOnly && selectedCountryRecords.length ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-md"
                        disabled={
                          hasPairedSelection
                            ? !canReconcileSelectedPair ||
                              isReconcilingSelectedPair
                            : isReconcilingCountryRows
                        }
                        onClick={
                          hasPairedSelection
                            ? reconcileSelectedPair
                            : openCountryReconcileDialog
                        }
                      >
                        <CheckCircle2Icon />
                        {hasPairedSelection
                          ? "Reconcile"
                          : `Clear (${selectedCountryRecords.length})`}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid min-h-0 gap-2 overflow-y-auto pb-3 md:hidden">
                  {countryRows.length ? (
                    countryRows.map(({ record }) => (
                      <article
                        key={record.id}
                        className={
                          "rounded-lg border bg-muted/20 p-3 text-sm transition-colors " +
                          (isReadOnly
                            ? ""
                            : selectedCountryRecordIds.has(record.id)
                              ? "border-primary bg-primary/5"
                              : "")
                        }
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedCountryRecordIds.has(record.id)}
                            onCheckedChange={(checked) =>
                              toggleCountryRow(
                                record.id,
                                checked === true,
                                isShiftClickingCountryRowRef.current
                              )
                            }
                            aria-label={`Select country report row ${record.reference || record.ctnNumber || record.id}`}
                            className="mt-0.5 shrink-0 after:-inset-2"
                            disabled={isReadOnly}
                            onClick={(event) => {
                              event.stopPropagation()
                              isShiftClickingCountryRowRef.current =
                                event.shiftKey
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold break-words">
                                  {record.ctnNumber || "-"}
                                </div>
                                <div className="mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    BL
                                  </span>
                                  <span className="break-words">
                                    {record.billOfLadingNumber || "-"}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                                {formatAmount(record.amount)}
                              </div>
                            </div>
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
                        <TableHead className="w-8">
                          <Checkbox
                            checked={allCountryRowsSelected}
                            onCheckedChange={(checked) =>
                              toggleAllCountryRows(checked === true)
                            }
                            aria-label="Select all unmatched country report rows"
                          />
                        </TableHead>
                        <TableHead className="w-[20%]">Country</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>CTN</TableHead>
                        <TableHead>Bill of Lading</TableHead>
                        <TableHead className="w-24 text-right">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countryRows.length ? (
                        countryRows.map(({ record }) => (
                          <TableRow
                            key={record.id}
                            aria-selected={selectedCountryRecordIds.has(
                              record.id
                            )}
                            className="h-12"
                          >
                            <TableCell className="w-8">
                              <Checkbox
                                checked={selectedCountryRecordIds.has(
                                  record.id
                                )}
                                onCheckedChange={(checked) =>
                                  toggleCountryRow(
                                    record.id,
                                    checked === true,
                                    isShiftClickingCountryRowRef.current
                                  )
                                }
                                aria-label={`Select country report row ${record.reference || record.ctnNumber || record.id}`}
                                className="after:-inset-2"
                                disabled={isReadOnly}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  isShiftClickingCountryRowRef.current =
                                    event.shiftKey
                                }}
                              />
                            </TableCell>
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
                            colSpan={6}
                            className="h-24 text-center text-sm text-muted-foreground"
                          >
                            No country-only records.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {countryReconcileMessage ? (
                  <p className="px-1 pb-2 text-xs text-muted-foreground">
                    {countryReconcileMessage}
                  </p>
                ) : null}
                <div className="-mx-3 -mb-3 flex h-12 items-center justify-between border-t bg-muted/50 px-4 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span>Matched</span>
                    <span className="rounded-full border bg-background px-2 py-0.5 tabular-nums">
                      {Math.max(matchedCountryCount, matchedRowCount)} /{" "}
                      {countryRecordCount}
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
                  <h2 className="text-lg font-semibold tracking-normal">
                    NetSuite
                  </h2>
                  <div className="flex items-center gap-2">
                    {!isReadOnly &&
                    showAngolaNetSuiteReferences &&
                    selectedMasterRecords.length &&
                    !hasPairedSelection &&
                    onMoveInvoicesToOot ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isRollingInvoices || isMovingInvoicesToOot}
                        onClick={moveSelectedInvoicesToOot}
                      >
                        <ArrowRightIcon />
                        Move to OOT
                      </Button>
                    ) : null}
                    {!isReadOnly &&
                    selectedMasterRecords.length &&
                    !hasPairedSelection ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isRollingInvoices || isMovingInvoicesToOot}
                          onClick={leaveSelectedInvoices}
                        >
                          <ArrowRightIcon />
                          Leave Invoices ({selectedMasterRecords.length})
                        </Button>
                        <Button
                          type="button"
                          disabled={isRollingInvoices || isMovingInvoicesToOot}
                          onClick={rollSelectedInvoices}
                        >
                          <FileOutputIcon />
                          Roll Invoices ({selectedMasterRecords.length})
                        </Button>
                      </>
                    ) : !isReadOnly && canProceed ? (
                      <Button
                        type="button"
                        disabled={
                          isRollingInvoices ||
                          isMovingInvoicesToOot ||
                          isProceeding
                        }
                        onClick={proceedToNextStep}
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
                        masterRows.map(({ record }) => {
                          const gabonPairIssue = gabonPairIssueByRecordId.get(
                            record.id
                          )

                          return (
                            <article
                              key={record.id}
                              className={
                                "rounded-lg border p-3 text-sm transition-colors " +
                                (gabonPairIssue
                                  ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100 "
                                  : "bg-muted/20 ") +
                                (isReadOnly
                                  ? ""
                                  : selectedMasterRecordIds.has(record.id)
                                    ? "border-primary bg-primary/5"
                                    : "")
                              }
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedMasterRecordIds.has(
                                    record.id
                                  )}
                                  onCheckedChange={(checked) =>
                                    toggleMasterRow(
                                      record.id,
                                      checked === true,
                                      isShiftClickingMasterRowRef.current
                                    )
                                  }
                                  aria-label={`Select NetSuite record ${record.salesOrderNumber || record.id}`}
                                  className="mt-0.5 shrink-0 after:-inset-2"
                                  disabled={isReadOnly}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    isShiftClickingMasterRowRef.current =
                                      event.shiftKey
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium text-muted-foreground">
                                        {formatTransactionDate(
                                          record.transactionDate
                                        )}
                                      </div>
                                      <div className="font-semibold break-words">
                                        {showAngolaNetSuiteReferences
                                          ? record.billOfLadingNumber || "-"
                                          : record.salesOrderNumber || "-"}
                                      </div>
                                      {gabonPairIssue ? (
                                        <div className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">
                                          {gabonPairIssue}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                                      {formatAmount(record.amount)}
                                    </div>
                                  </div>
                                  <dl className="mt-3 grid gap-2 text-xs">
                                    {showAngolaNetSuiteReferences ? (
                                      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                                        <dt className="text-muted-foreground">
                                          CTN
                                        </dt>
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
                                      <dt className="text-muted-foreground">
                                        Status
                                      </dt>
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
                          )
                        })
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
                            <TableHead className="w-14">
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
                            <TableHead className="w-24 text-right">
                              Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {masterRows.length ? (
                            masterDisplayRows.map((displayRow) => {
                              const record = displayRow.record
                              const isGroup = displayRow.kind === "group"
                              const isExpanded =
                                isGroup &&
                                expandedMasterGroupIds.has(displayRow.id)
                              const selectedCount = displayRow.records.filter(
                                (groupRecord) =>
                                  selectedMasterRecordIds.has(groupRecord.id)
                              ).length
                              const allGroupRecordsSelected =
                                selectedCount === displayRow.records.length
                              const gabonPairIssue =
                                !isGroup &&
                                gabonPairIssueByRecordId.get(record.id)

                              return (
                                <React.Fragment key={displayRow.id}>
                                  <TableRow
                                    aria-selected={selectedCount > 0}
                                    className={
                                      isGroup
                                        ? "h-12 cursor-pointer"
                                        : gabonPairIssue
                                          ? "h-12 border-l-4 border-l-red-500 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100"
                                          : "h-12"
                                    }
                                    onClick={() => {
                                      if (isGroup) {
                                        toggleMasterGroup(displayRow.id)
                                      }
                                    }}
                                  >
                                    <TableCell className="w-14">
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          checked={
                                            isGroup
                                              ? allGroupRecordsSelected
                                              : selectedMasterRecordIds.has(
                                                  record.id
                                                )
                                          }
                                          aria-checked={
                                            isGroup &&
                                            selectedCount > 0 &&
                                            !allGroupRecordsSelected
                                              ? "mixed"
                                              : undefined
                                          }
                                          onCheckedChange={(checked) => {
                                            if (isGroup) {
                                              toggleMasterRecords(
                                                displayRow.records,
                                                checked === true
                                              )
                                              return
                                            }

                                            toggleMasterRow(
                                              record.id,
                                              checked === true,
                                              isShiftClickingMasterRowRef.current
                                            )
                                          }}
                                          aria-label={
                                            isGroup
                                              ? `Select paired NetSuite records for ${record.salesOrderNumber || record.id}`
                                              : `Select NetSuite record ${record.salesOrderNumber || record.id}`
                                          }
                                          className="after:-inset-2"
                                          disabled={isReadOnly}
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            isShiftClickingMasterRowRef.current =
                                              event.shiftKey
                                          }}
                                        />
                                        {isGroup ? (
                                          <button
                                            type="button"
                                            aria-label={
                                              isExpanded
                                                ? "Collapse paired NetSuite records"
                                                : "Expand paired NetSuite records"
                                            }
                                            aria-expanded={isExpanded}
                                            className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              toggleMasterGroup(displayRow.id)
                                            }}
                                          >
                                            <ChevronDownIcon
                                              className={
                                                "size-4 transition-transform " +
                                                (isExpanded ? "" : "-rotate-90")
                                              }
                                            />
                                          </button>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell className="break-words tabular-nums">
                                      {isExpanded
                                        ? ""
                                        : formatTransactionDate(
                                            record.transactionDate
                                          )}
                                    </TableCell>
                                    {showAngolaNetSuiteReferences ? (
                                      <>
                                        <TableCell className="break-words">
                                          {isExpanded
                                            ? ""
                                            : record.billOfLadingNumber || "-"}
                                        </TableCell>
                                        <TableCell className="break-words">
                                          {isExpanded
                                            ? ""
                                            : record.ctnNumber || "-"}
                                        </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell className="font-medium break-words">
                                          {isExpanded
                                            ? ""
                                            : record.salesOrderNumber || "-"}
                                        </TableCell>
                                        <TableCell className="break-words">
                                          {isExpanded
                                            ? ""
                                            : (showCtnReference
                                                ? record.ctnNumber
                                                : record.billOfLadingNumber) ||
                                              "-"}
                                        </TableCell>
                                      </>
                                    )}
                                    <TableCell className="break-words">
                                      {isExpanded ? "" : record.status || "-"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {isExpanded
                                        ? ""
                                        : formatAmount(record.amount)}
                                    </TableCell>
                                  </TableRow>
                                  {isGroup && isExpanded
                                    ? displayRow.records.map((childRecord) => (
                                        <TableRow
                                          key={childRecord.id}
                                          aria-selected={selectedMasterRecordIds.has(
                                            childRecord.id
                                          )}
                                          className="h-12 border-l-4 border-l-border"
                                        >
                                          <TableCell className="w-14 pl-9">
                                            <Checkbox
                                              checked={selectedMasterRecordIds.has(
                                                childRecord.id
                                              )}
                                              onCheckedChange={(checked) =>
                                                toggleMasterRow(
                                                  childRecord.id,
                                                  checked === true,
                                                  isShiftClickingMasterRowRef.current
                                                )
                                              }
                                              aria-label={`Select NetSuite record ${childRecord.salesOrderNumber || childRecord.id}`}
                                              className="after:-inset-2"
                                              disabled={isReadOnly}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                isShiftClickingMasterRowRef.current =
                                                  event.shiftKey
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell className="pl-4 break-words tabular-nums">
                                            {formatTransactionDate(
                                              childRecord.transactionDate
                                            )}
                                          </TableCell>
                                          {showAngolaNetSuiteReferences ? (
                                            <>
                                              <TableCell className="break-words">
                                                {childRecord.billOfLadingNumber ||
                                                  "-"}
                                              </TableCell>
                                              <TableCell className="break-words">
                                                {childRecord.ctnNumber || "-"}
                                              </TableCell>
                                            </>
                                          ) : (
                                            <>
                                              <TableCell className="pl-4 font-medium break-words">
                                                {childRecord.salesOrderNumber ||
                                                  "-"}
                                              </TableCell>
                                              <TableCell className="break-words">
                                                {(showCtnReference
                                                  ? childRecord.ctnNumber
                                                  : childRecord.billOfLadingNumber) ||
                                                  "-"}
                                              </TableCell>
                                            </>
                                          )}
                                          <TableCell className="break-words">
                                            {childRecord.status || "-"}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {formatAmount(childRecord.amount)}
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    : null}
                                </React.Fragment>
                              )
                            })
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
          </>
        ) : null}
        <section
          className={
            "grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-background p-3 " +
            (showOnlyMatched
              ? "lg:min-h-[calc(100svh-var(--header-height)-5.5rem)]"
              : "")
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal">Matched</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canUnreconcile && selectedMatchedRows.length ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md"
                  disabled={isUnreconcilingMatchedRows}
                  onClick={unreconcileSelectedMatchedRows}
                >
                  <ArrowLeftIcon />
                  Unreconcile ({selectedMatchedRows.length})
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid min-h-0 gap-2 overflow-y-auto pb-3 md:hidden">
            {matchedDisplayRows.length ? (
              matchedDisplayRows.map((row) => {
                const countryRecord = row.countryRecord
                const masterRecord =
                  row.kind === "matched" ? row.masterRecord : undefined
                const matchedBy =
                  row.kind === "matched"
                    ? row.matchedOn
                    : {
                        label: row.resolvedRow.reason,
                        value: row.resolvedRow.note,
                      }

                return (
                  <article
                    key={row.id}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900/70 dark:bg-emerald-950/20"
                  >
                    <div className="flex items-start gap-2">
                      {canUnreconcile ? (
                        <Checkbox
                          checked={selectedMatchedRowIds.has(row.id)}
                          onCheckedChange={(checked) =>
                            toggleMatchedRow(row.id, checked === true)
                          }
                          aria-label="Select matched row"
                          className="mt-0.5 shrink-0 after:-inset-2"
                        />
                      ) : (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      )}
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
                              {masterRecord?.salesOrderNumber || "-"}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Match</dt>
                            <dd className="break-words">
                              {matchedBy
                                ? [matchedBy.label, matchedBy.value]
                                    .filter(Boolean)
                                    .join(": ")
                                : "-"}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">CTN</dt>
                            <dd className="break-words">
                              {countryRecord.ctnNumber ||
                                masterRecord?.ctnNumber ||
                                "-"}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Bill</dt>
                            <dd className="break-words">
                              {countryRecord.billOfLadingNumber ||
                                masterRecord?.billOfLadingNumber ||
                                "-"}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">NS amount</dt>
                            <dd className="break-words tabular-nums">
                              {masterRecord
                                ? formatAmount(masterRecord.amount)
                                : "-"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </article>
                )
              })
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
                  <TableHead className="w-14">
                    {canUnreconcile ? (
                      <Checkbox
                        checked={allMatchedRowsSelected}
                        onCheckedChange={(checked) =>
                          toggleAllMatchedRows(checked === true)
                        }
                        aria-label="Select all matched rows"
                      />
                    ) : null}
                  </TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>NetSuite</TableHead>
                  <TableHead className="w-44">Matched By</TableHead>
                  <TableHead className="w-40 text-right">Amounts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchedDisplayRows.length ? (
                  matchedDisplayRows.map((row) => {
                    const countryRecord = row.countryRecord
                    const masterRecord =
                      row.kind === "matched" ? row.masterRecord : undefined
                    const matchedBy =
                      row.kind === "matched"
                        ? row.matchedOn
                        : {
                            label: row.resolvedRow.reason,
                            value: row.resolvedRow.note,
                          }

                    return (
                      <TableRow
                        key={row.id}
                        className="bg-emerald-50/60 transition-colors hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                      >
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2">
                            {canUnreconcile ? (
                              <Checkbox
                                checked={selectedMatchedRowIds.has(row.id)}
                                onCheckedChange={(checked) =>
                                  toggleMatchedRow(row.id, checked === true)
                                }
                                aria-label="Select matched row"
                                className="after:-inset-2"
                              />
                            ) : (
                              <CheckCircle2Icon className="size-4 text-emerald-600" />
                            )}
                          </div>
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
                          {masterRecord ? (
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
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {matchedBy ? (
                            <div className="grid gap-1">
                              <span className="text-[0.7rem] font-medium text-muted-foreground">
                                {matchedBy.label}
                              </span>
                              {matchedBy.value ? (
                                <span className="font-medium break-words">
                                  {matchedBy.value}
                                </span>
                              ) : null}
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
                              <span>
                                {masterRecord
                                  ? formatAmount(masterRecord.amount)
                                  : "-"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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
    </>
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

function DashboardMatchedTable({
  records,
}: {
  records: ReturnType<typeof reconcileRecords>["matched"]
}) {
  return (
    <div className="h-full min-h-0 overflow-auto md:overflow-x-hidden md:overflow-y-auto">
      <Table
        className="min-w-[48rem] table-fixed text-xs md:w-full md:min-w-0"
        containerClassName="overflow-visible md:overflow-x-hidden"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead>NetSuite</TableHead>
            <TableHead className="w-40">Matched By</TableHead>
            <TableHead className="w-40 text-right">Amounts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length ? (
            records.map((match) => (
              <TableRow key={match.id} className="h-14">
                <TableCell className="align-top">
                  <div className="grid gap-1 text-muted-foreground">
                    <span className="break-words text-foreground">
                      {match.countryRecord.reference ||
                        match.countryRecord.invoiceNumber ||
                        "-"}
                    </span>
                    <span>
                      BL: {match.countryRecord.billOfLadingNumber || "-"}
                    </span>
                    <span>CTN: {match.countryRecord.ctnNumber || "-"}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-1 text-muted-foreground">
                    <span className="break-words text-foreground">
                      {match.masterRecord.salesOrderNumber || "-"}
                    </span>
                    <span>
                      BL: {match.masterRecord.billOfLadingNumber || "-"}
                    </span>
                    <span>CTN: {match.masterRecord.ctnNumber || "-"}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-1">
                    <span className="font-medium">
                      {match.matchedOn?.label || "-"}
                    </span>
                    {match.matchedOn?.value ? (
                      <span className="break-words text-muted-foreground">
                        {match.matchedOn.value}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  <div className="grid gap-1">
                    <span>
                      Country: {formatAmount(match.countryRecord.amount)}
                    </span>
                    <span className="text-muted-foreground">
                      NS: {formatAmount(match.masterRecord.amount)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No matched records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
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

function DashboardDataTableSkeleton({
  section = "matched",
}: {
  section?: CountryDashboardSection
}) {
  const isMatchedSection = section === "matched"

  if (isMatchedSection) {
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <Table
          className="min-w-[48rem] table-fixed text-xs md:w-full md:min-w-0"
          containerClassName="overflow-hidden"
        >
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-4 w-16 rounded-md" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20 rounded-md" />
              </TableHead>
              <TableHead className="w-40">
                <Skeleton className="h-4 w-20 rounded-md" />
              </TableHead>
              <TableHead className="w-40">
                <Skeleton className="ml-auto h-4 w-16 rounded-md" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={rowIndex} className="h-14">
                <TableCell className="align-top">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-8 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid justify-items-end gap-2">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

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

function CountryDashboardSkeleton() {
  return (
    <div className="@container/month-end flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="hidden md:block" aria-hidden="true" />
      </section>

      <div className="grid min-h-0 gap-4">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Skeleton className="h-9 w-full rounded-lg md:w-64" />
            <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-1">
              <Skeleton className="h-7 w-24 rounded-md bg-background" />
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </section>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
          <DashboardDataTableSkeleton />
        </div>
      </div>
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

function createDashboardMatchedCsv(
  records: ReturnType<typeof reconcileRecords>["matched"]
) {
  const rows = records.map(({ masterRecord, countryRecord, matchedOn }) => [
    countryRecord.countryName,
    countryRecord.invoiceNumber || countryRecord.reference,
    countryRecord.billOfLadingNumber,
    countryRecord.ctnNumber,
    masterRecord.salesOrderNumber,
    masterRecord.billOfLadingNumber,
    masterRecord.ctnNumber,
    matchedOn?.label ?? "",
    matchedOn?.value ?? "",
    formatAmount(countryRecord.amount),
    formatAmount(masterRecord.amount),
  ])

  return [
    [
      "Country",
      "Country Invoice",
      "Country Bill of Lading",
      "Country CTN",
      "NetSuite Invoice",
      "NetSuite Bill of Lading",
      "NetSuite CTN",
      "Matched By",
      "Match Value",
      "Country Amount",
      "NetSuite Amount",
    ],
    ...rows,
  ]
    .map((row) => row.map((value) => escapeDashboardCsvValue(value)).join(","))
    .join("\n")
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
        variant="outline"
        aria-label="Previous country"
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <ArrowLeftIcon />
        Previous
      </Button>
      <Button
        variant="outline"
        aria-label="Next country"
        disabled={!onNext}
        onClick={onNext}
      >
        Next
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
  hideReconciliation = false,
}: {
  activeView: "reconciliation" | "journal" | "dashboard"
  reconciliationHref: string
  journalHref: string
  dashboardHref: string
  hideReconciliation?: boolean
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
  ].filter((step) => !hideReconciliation || step.value !== "reconciliation")
  return (
    <NavigationMenu className="max-w-none justify-start">
      <NavigationMenuList className="min-w-0 flex-wrap justify-start gap-6">
        {steps.map((step) => {
          const isActive = activeView === step.value

          return (
            <NavigationMenuItem key={step.value}>
              <AppLink
                href={step.href}
                className={cn(
                  "-mb-px inline-flex h-9 items-center border-b border-transparent bg-transparent px-0 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                  isActive && "border-foreground text-foreground"
                )}
              >
                {step.label}
              </AppLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function CountryReconciliationDashboard({
  countryName,
  masterRecords,
  reconciliation,
  rolledInternalIds,
  leftInvoiceRecordIds,
  activeSection,
  onActiveSectionChange,
}: {
  countryName: string
  masterRecords: MonthEndMasterRecord[]
  reconciliation: ReturnType<typeof reconcileRecords>
  rolledInternalIds: string[]
  leftInvoiceRecordIds: string[]
  activeSection: CountryDashboardSection
  onActiveSectionChange: (
    section: CountryDashboardSection
  ) => Promise<void> | void
}) {
  const [displaySection, setDisplaySection] =
    React.useState<CountryDashboardSection>(activeSection)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isTableLoading, setIsTableLoading] = React.useState(false)
  const reconciledMasterIds = new Set(
    reconciliation.matched.map(({ masterRecord }) => masterRecord.id)
  )
  const rolledInternalIdSet = new Set(rolledInternalIds)
  const leftInvoiceRecordIdSet = new Set(leftInvoiceRecordIds)
  const autoRolledRecordIdSet = reconciliation.autoRolledMasterIds
  const autoLeftRecordIdSet = reconciliation.autoLeftMasterIds
  const autoLeftInternalIdSet = new Set(
    masterRecords
      .filter((record) => autoLeftRecordIdSet.has(record.id))
      .map((record) => record.sourceInternalId.trim())
      .filter(Boolean)
  )
  const rolledRecords = masterRecords.filter(
    (record) =>
      autoRolledRecordIdSet.has(record.id) ||
      (!reconciledMasterIds.has(record.id) &&
        Boolean(record.sourceInternalId) &&
        rolledInternalIdSet.has(record.sourceInternalId))
  )
  const rolledRecordIds = new Set(rolledRecords.map((record) => record.id))
  const leftInMonthRecords = masterRecords.filter(
    (record) =>
      autoLeftRecordIdSet.has(record.id) ||
      (Boolean(record.sourceInternalId) &&
        autoLeftInternalIdSet.has(record.sourceInternalId)) ||
      (!reconciledMasterIds.has(record.id) &&
        !rolledRecordIds.has(record.id) &&
        (leftInvoiceRecordIdSet.size === 0 ||
          isApprovedMasterRecord(record, leftInvoiceRecordIdSet)))
  )
  const dashboardSections: {
    value: CountryDashboardSection
    label: string
    count: number
    records: MonthEndMasterRecord[] | ReturnType<typeof reconcileRecords>["matched"]
  }[] = [
    {
      value: "matched",
      label: "Matched",
      count: reconciliation.matched.length,
      records: reconciliation.matched,
    },
    {
      value: "left",
      label: "Left",
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

  const normalizedSearchQuery = normalizeMatchKey(searchQuery)
  const matchesDashboardSearch = (
    record:
      | MonthEndMasterRecord
      | MonthEndCountryReportRecord
      | ReturnType<typeof reconcileRecords>["matched"][number]
  ) => {
    if (!normalizedSearchQuery) {
      return true
    }

    const values =
      "masterRecord" in record
        ? [
            record.masterRecord.salesOrderNumber,
            record.masterRecord.billOfLadingNumber,
            record.masterRecord.ctnNumber,
            record.masterRecord.sourceInternalId,
            record.countryRecord.invoiceNumber,
            record.countryRecord.reference,
            record.countryRecord.billOfLadingNumber,
            record.countryRecord.ctnNumber,
          ]
        : "salesOrderNumber" in record
          ? [
              record.salesOrderNumber,
              record.billOfLadingNumber,
              record.ctnNumber,
              record.sourceInternalId,
              record.countryName,
            ]
          : [
              record.invoiceNumber,
              record.reference,
              record.billOfLadingNumber,
              record.ctnNumber,
              record.countryName,
            ]

    return values.some((value) =>
      normalizeMatchKey(value).includes(normalizedSearchQuery)
    )
  }

  const filteredDashboardSections = dashboardSections.map((section) => ({
    ...section,
    count: section.records.filter(matchesDashboardSearch).length,
    records: section.records.filter(matchesDashboardSearch),
  }))
  const activeDashboardSection =
    filteredDashboardSections.find(
      (section) => section.value === displaySection
    ) ?? filteredDashboardSections[0]
  const activeSectionCsv =
    activeDashboardSection.value === "matched"
      ? createDashboardMatchedCsv(
          activeDashboardSection.records as ReturnType<
            typeof reconcileRecords
          >["matched"]
        )
      : createDashboardMasterCsv(
          activeDashboardSection.records as MonthEndMasterRecord[]
        )

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
    <div className="@container/month-end flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="hidden md:block" aria-hidden="true" />
      </section>

      <div className="grid min-h-0 gap-4">
        <CountryTableFilters
          searchQuery={searchQuery}
          searchPlaceholder="Search certificates..."
          searchAriaLabel="Search certificates"
          selectedFilter={activeDashboardSection.value}
          filterOptions={filteredDashboardSections.map((section) => ({
            id: section.value,
            label: section.label,
            count: section.count,
          }))}
          action={
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() =>
                downloadDashboardCsv({
                  fileName: dashboardCsvFileName(
                    countryName,
                    activeDashboardSection.label
                  ),
                  csv: activeSectionCsv,
                })
              }
              disabled={!activeDashboardSection.records.length}
            >
              <DownloadIcon />
              Download
            </Button>
          }
          onSearchQueryChange={setSearchQuery}
          onSelectedFilterChange={(value) =>
            chooseDashboardSection(value as CountryDashboardSection)
          }
        />

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
          {isTableLoading ? (
            <DashboardDataTableSkeleton section={activeDashboardSection.value} />
          ) : activeDashboardSection.value === "matched" ? (
            <DashboardMatchedTable
              records={
                activeDashboardSection.records as ReturnType<
                  typeof reconcileRecords
                >["matched"]
              }
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
    </div>
  )
}

type JournalEntryRow = {
  account: string
  debit?: number
  credit?: number
  lineDescription?: string
  className?: string
  sectionGapBefore?: boolean
}

type JournalEntrySnapshot = {
  createdAt: string
  entries: {
    countryName: string
    countryTotal: number
    exchangeRate?: number
    journalTotal: number
  }[]
  additionalRows?: JournalEntryRow[]
  simpleRows?: JournalEntryRow[]
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
  additionalRows,
  simpleRows,
  journalRows,
  sourceDocumentCount,
  isReadOnly = false,
  pdfDownloadAction,
  exchangeRateEditor,
  exchangeRateNeedsAttention = false,
  onExchangeRateAttentionHandled,
  summaryMetric,
  onMakeJournalEntry,
}: {
  countryName: string
  entries: {
    countryName: string
    countryTotal: number
    exchangeRate?: number
    journalTotal: number
  }[]
  additionalRows?: JournalEntryRow[]
  simpleRows?: JournalEntryRow[]
  journalRows?: JournalEntryRow[]
  sourceDocumentCount?: number
  isReadOnly?: boolean
  pdfDownloadAction?: {
    label: string
    disabled?: boolean
    onClick: () => Promise<void>
  }
  exchangeRateEditor?: {
    value?: number
    draft: string
    onDraftChange: (value: string) => void
    onSave: () => Promise<void>
  }
  exchangeRateNeedsAttention?: boolean
  onExchangeRateAttentionHandled?: () => void
  summaryMetric?: {
    label: string
    value: string
  }
  onMakeJournalEntry: () => Promise<void>
}) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSavingExchangeRate, setIsSavingExchangeRate] = React.useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false)
  const exchangeRateInputRef = React.useRef<HTMLInputElement>(null)
  const countryTotal = entries.reduce(
    (sum, entry) => sum + entry.countryTotal,
    0
  )
  const journalTotal = entries.reduce(
    (sum, entry) => sum + entry.journalTotal,
    0
  )
  const additionalDebitTotal =
    additionalRows?.reduce((sum, row) => sum + (row.debit ?? 0), 0) ?? 0
  const additionalCreditTotal =
    additionalRows?.reduce((sum, row) => sum + (row.credit ?? 0), 0) ?? 0
  const simpleDebitTotal = journalTotal + additionalDebitTotal
  const simpleCreditTotal = journalTotal + additionalCreditTotal
  const journalDebitTotal = journalRows?.reduce(
    (sum, row) => sum + (row.debit ?? 0),
    0
  )
  const journalCreditTotal = journalRows?.reduce(
    (sum, row) => sum + (row.credit ?? 0),
    0
  )
  const hasDetailedJournal = Boolean(journalRows?.length)
  const hasCustomSimpleJournal = Boolean(simpleRows?.length)
  const summaryLineLabel = hasCustomSimpleJournal
    ? "Journal lines"
    : sourceDocumentCount === undefined
      ? "Journal lines"
      : "Source documents"
  const summaryLineValue = hasCustomSimpleJournal
    ? (simpleRows?.filter((row) => row.account).length ?? 0)
    : sourceDocumentCount === undefined
      ? (journalRows?.length ?? 0)
      : `${sourceDocumentCount} / 4`
  const exchangeRateLabel =
    entries.length === 1
      ? entries[0]?.exchangeRate?.toFixed(4) || "Not applied"
      : "By country"

  React.useEffect(() => {
    if (exchangeRateNeedsAttention) {
      exchangeRateInputRef.current?.focus()
    }
  }, [exchangeRateNeedsAttention])

  async function makeJournalEntry() {
    setIsSaving(true)

    try {
      await onMakeJournalEntry()
    } finally {
      setIsSaving(false)
    }
  }

  async function saveExchangeRate() {
    if (!exchangeRateEditor) {
      return
    }

    setIsSavingExchangeRate(true)

    try {
      await exchangeRateEditor.onSave()
    } finally {
      setIsSavingExchangeRate(false)
    }
  }

  async function downloadPdf() {
    if (!pdfDownloadAction) {
      return
    }

    setIsDownloadingPdf(true)

    try {
      await pdfDownloadAction.onClick()
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="grid flex-1 place-items-start md:place-items-center">
        <section
          role="dialog"
          aria-labelledby="journal-entry-title"
          className={`w-full overflow-hidden rounded-lg border bg-background ${
            hasDetailedJournal ? "max-w-6xl" : "max-w-3xl"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
            <div>
              <h2
                id="journal-entry-title"
                className="text-xl font-semibold tracking-normal"
              >
                Create Journal Entry
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {countryName}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {pdfDownloadAction ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadPdf}
                  disabled={
                    isReadOnly || pdfDownloadAction.disabled || isDownloadingPdf
                  }
                >
                  <DownloadIcon />
                  {isDownloadingPdf ? "Downloading" : pdfDownloadAction.label}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 p-5">
            {summaryMetric || exchangeRateEditor ? (
              <div className="grid gap-3 rounded-lg border bg-background px-4 py-3">
                {summaryMetric ? (
                  <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="text-sm font-medium text-muted-foreground">
                      {summaryMetric.label}
                    </div>
                    <div className="text-right text-2xl font-semibold tabular-nums">
                      {summaryMetric.value}
                    </div>
                  </div>
                ) : null}
                {exchangeRateEditor ? (
                  <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <label
                      htmlFor="frabemar-exchange-rate"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Exchange rate
                    </label>
                    <Input
                      ref={exchangeRateInputRef}
                      id="frabemar-exchange-rate"
                      type="text"
                      inputMode="decimal"
                      value={exchangeRateEditor.draft}
                      onChange={(event) => {
                        const nextValue = event.target.value

                        if (/^\d*(?:[.,]\d{0,4})?$/.test(nextValue)) {
                          onExchangeRateAttentionHandled?.()
                          exchangeRateEditor.onDraftChange(nextValue)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveExchangeRate()
                        }
                      }}
                      onBlur={() => {
                        if (!isReadOnly && !isSavingExchangeRate) {
                          saveExchangeRate()
                        }
                      }}
                      disabled={isReadOnly || isSavingExchangeRate}
                      className={`h-9 w-36 text-right tabular-nums ${
                        exchangeRateNeedsAttention
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {!exchangeRateEditor && !hasCustomSimpleJournal ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {hasDetailedJournal ? (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {summaryLineLabel}
                      </div>
                      <div className="mt-1 font-semibold tabular-nums">
                        {summaryLineValue}
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
            ) : null}

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
                  {hasCustomSimpleJournal
                    ? simpleRows?.map((row, index) => (
                        <React.Fragment key={`${row.account}-${index}`}>
                          {row.sectionGapBefore ? (
                            <TableRow className="h-3 border-0">
                              <TableCell colSpan={3} className="p-0" />
                            </TableRow>
                          ) : null}
                          <TableRow>
                            <TableCell className="font-medium">
                              <div>{row.account}</div>
                              {row.lineDescription ? (
                                <div className="text-xs font-normal text-muted-foreground">
                                  {row.lineDescription}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.debit === undefined
                                ? "-"
                                : formatAmount(row.debit)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.credit === undefined
                                ? "-"
                                : formatAmount(row.credit)}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))
                    : null}
                  {!hasDetailedJournal && !hasCustomSimpleJournal ? (
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
                  {!hasDetailedJournal && !hasCustomSimpleJournal
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
                  {!hasDetailedJournal && !hasCustomSimpleJournal
                    ? additionalRows?.map((row, index) => (
                        <TableRow key={`${row.account}-${index}`}>
                          <TableCell className="font-medium">
                            {row.account}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.debit === undefined
                              ? "-"
                              : formatAmount(row.debit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.credit === undefined
                              ? "-"
                              : formatAmount(row.credit)}
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                  {!hasCustomSimpleJournal ? (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(
                          hasDetailedJournal
                            ? (journalDebitTotal ?? 0)
                            : simpleDebitTotal
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(
                          hasDetailedJournal
                            ? (journalCreditTotal ?? 0)
                            : simpleCreditTotal
                        )}
                      </TableCell>
                      {hasDetailedJournal ? <TableCell colSpan={2} /> : null}
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t p-4">
            <Button onClick={makeJournalEntry} disabled={isSaving}>
              Make Journal Entry
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function InvoiceUploadStep({
  countryName,
  invoiceDocument,
  isComplete,
  isReadOnly,
  isUploading,
  congoInvoiceValues,
  visaUsedValue,
  onVisaUsedChange,
  onSaveVisaUsed,
  onChooseFile,
  onFiles,
  dashboardHref,
}: {
  countryName: string
  invoiceDocument?: InvoiceDocument
  isComplete: boolean
  isReadOnly: boolean
  isUploading: boolean
  congoInvoiceValues?: CongoInvoiceJournalValues
  visaUsedValue?: string
  onVisaUsedChange?: (value: string) => void
  onSaveVisaUsed?: () => void
  onChooseFile: () => void
  onFiles: (files: File[]) => void
  dashboardHref: string
}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const requiresVisaUsed = Boolean(onVisaUsedChange)
  const needsVisaUsed =
    requiresVisaUsed && invoiceDocument && congoInvoiceValues && !isComplete

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (isReadOnly || isComplete) {
      return
    }

    const files = Array.from(event.dataTransfer.files ?? [])

    if (files.length) {
      onFiles(files)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="grid flex-1 place-items-stretch">
        {isComplete ? (
          <section className="grid min-h-[22rem] place-items-center rounded-xl border bg-background p-6 text-center md:min-h-[26rem]">
            <div className="grid max-w-xl gap-4">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-200">
                <CheckCircle2Icon className="size-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">
                  Invoice Saved
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {invoiceDocument?.fileNames?.join(", ") ||
                    invoiceDocument?.fileName ||
                    `${countryName} invoice`}
                </p>
              </div>
              <Button render={<AppLink href={dashboardHref} />}>
                Country Dashboard
              </Button>
            </div>
          </section>
        ) : needsVisaUsed ? (
          <section className="grid min-h-[22rem] place-items-center rounded-xl border bg-background p-6 md:min-h-[26rem]">
            <div className="grid w-full max-w-xl gap-5">
              <div className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
                  <FileOutputIcon className="size-6 text-muted-foreground" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-normal">
                  Enter Visa Used
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {invoiceDocument.fileName}
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border bg-muted/25 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Visa points
                  </div>
                  <div className="mt-1 font-semibold tabular-nums">
                    {formatAmount(congoInvoiceValues.invoiceVisaPointsTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Commission
                  </div>
                  <div className="mt-1 font-semibold tabular-nums">
                    {formatAmount(congoInvoiceValues.invoiceCommission)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Bank charges
                  </div>
                  <div className="mt-1 font-semibold tabular-nums">
                    {formatAmount(congoInvoiceValues.invoiceBankCharges)}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="congo-visa-used"
                  className="text-sm font-medium"
                >
                  Visa Used
                </label>
                <Input
                  id="congo-visa-used"
                  value={visaUsedValue ?? ""}
                  onChange={(event) => onVisaUsedChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      onSaveVisaUsed?.()
                    }
                  }}
                  inputMode="decimal"
                  disabled={isReadOnly || isUploading}
                />
              </div>
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={onSaveVisaUsed}
                  disabled={isReadOnly || isUploading}
                >
                  {isUploading ? "Saving" : "Save Visa Used"}
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={
              "grid min-h-[22rem] cursor-pointer place-items-center rounded-xl border border-dashed bg-background p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[26rem] " +
              (isDragging ? "border-primary bg-muted/60" : "hover:bg-muted/40")
            }
            onClick={() => {
              if (!isReadOnly) {
                onChooseFile()
              }
            }}
            onKeyDown={(event) => {
              if (!isReadOnly && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                onChooseFile()
              }
            }}
            onDragOver={(event) => {
              if (isReadOnly) {
                return
              }

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
                  Upload {countryName} Invoice
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Drop the invoice here, or choose the invoice file.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChooseFile()
                  }}
                  disabled={isReadOnly || isUploading}
                >
                  <FileOutputIcon />
                  {isUploading ? "Saving" : "Choose Invoice"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FrabemarInvoicePackageStep({
  packageDocument,
  isReadOnly,
  isSaving,
  sharedExchangeRateDisplay,
  onSave,
  onSaveSharedExchangeRate,
  onDownloadAllCommissionInvoices,
  onMakeJournalEntries,
}: {
  packageDocument?: FrabemarInvoicePackage
  isReadOnly: boolean
  isSaving: boolean
  sharedExchangeRateDisplay: string
  onSave: (files: File[], pastedReportText: string) => Promise<void>
  onSaveSharedExchangeRate: (value: string) => Promise<boolean>
  onDownloadAllCommissionInvoices: () => Promise<void>
  onMakeJournalEntries: (exchangeRateText: string) => Promise<boolean>
}) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [pastedReportText, setPastedReportText] = React.useState(
    packageDocument?.pastedReportText ?? ""
  )
  const [sharedExchangeRateDraft, setSharedExchangeRateDraft] = React.useState(
    sharedExchangeRateDisplay
  )
  const [isSharedExchangeRateInvalid, setIsSharedExchangeRateInvalid] =
    React.useState(false)
  const [isDownloadingAll, setIsDownloadingAll] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const savedInvoiceNames =
    packageDocument?.invoices.map((invoice) => invoice.fileName) ?? []
  const displayedInvoiceNames = selectedFiles.length
    ? selectedFiles.map((file) => file.name)
    : savedInvoiceNames
  const hasSelectedInvoicePackage = selectedFiles.length >= 4
  const showPasteReportStep = hasSelectedInvoicePackage && !packageDocument

  React.useEffect(() => {
    setPastedReportText(packageDocument?.pastedReportText ?? "")
    setSelectedFiles([])
  }, [packageDocument])

  React.useEffect(() => {
    setSharedExchangeRateDraft(sharedExchangeRateDisplay)
  }, [sharedExchangeRateDisplay])

  function addFiles(files: File[]) {
    setSelectedFiles((current) => [...current, ...files])
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (isReadOnly) {
      return
    }

    const files = Array.from(event.dataTransfer.files ?? [])

    if (files.length) {
      addFiles(files)
    }
  }

  function chooseInvoiceFiles() {
    document.getElementById("frabemar-invoice-files")?.click()
  }

  async function saveSharedExchangeRate() {
    const didSave = await onSaveSharedExchangeRate(sharedExchangeRateDraft)

    setIsSharedExchangeRateInvalid(!didSave)
    return didSave
  }

  async function makeJournalEntries() {
    const didSave = await onMakeJournalEntries(sharedExchangeRateDraft)

    setIsSharedExchangeRateInvalid(!didSave)
  }

  async function downloadAllCommissionInvoices() {
    setIsDownloadingAll(true)

    try {
      await onDownloadAllCommissionInvoices()
    } finally {
      setIsDownloadingAll(false)
    }
  }

  const parsedSharedExchangeRate = parseFrabemarExchangeRate(
    sharedExchangeRateDraft
  )
  const frabemarReviewRows = packageDocument
    ? FRABEMAR_CHILD_COUNTRIES.map((country) => {
        const countryValue = packageDocument.countryValues[country.id]
        const netAmount = countryValue
          ? roundMoneyAmount(
              countryValue.invoiceTotal - countryValue.commission
            )
          : 0
        const journalAmount = parsedSharedExchangeRate
          ? roundMoneyAmount(netAmount * parsedSharedExchangeRate)
          : 0

        return {
          country,
          countryValue,
          netAmount,
          journalAmount,
        }
      })
    : []
  const totalWireTransferAmount = packageDocument
    ? roundMoneyAmount(
        FRABEMAR_CHILD_COUNTRIES.reduce((total, country) => {
          const countryValue = packageDocument.countryValues[country.id]

          if (!countryValue) {
            return total
          }

          return total + countryValue.invoiceTotal - countryValue.commission
        }, 0)
      )
    : 0
  const totalJournalAmount = roundMoneyAmount(
    frabemarReviewRows.reduce((total, row) => total + row.journalAmount, 0)
  )
  const frabemarCombinedJournalRows: JournalEntryRow[] = packageDocument
    ? [
        {
          account: "Income",
          debit: totalJournalAmount,
        },
        ...frabemarReviewRows.map((row) => ({
          account: row.country.accountName,
          credit: row.journalAmount,
          lineDescription: parsedSharedExchangeRate
            ? `${formatAmount(row.netAmount)} * ${formatFrabemarExchangeRate(
                parsedSharedExchangeRate
              )}`
            : undefined,
        })),
      ]
    : []

  if (packageDocument) {
    return (
      <JournalEntryPreview
        countryName="Frabemar"
        entries={[]}
        simpleRows={frabemarCombinedJournalRows}
        isReadOnly={isReadOnly}
        pdfDownloadAction={{
          label: "Download All PDFs",
          disabled: isReadOnly || isDownloadingAll,
          onClick: downloadAllCommissionInvoices,
        }}
        exchangeRateEditor={{
          draft: sharedExchangeRateDraft,
          onDraftChange: (value) => {
            setIsSharedExchangeRateInvalid(false)
            setSharedExchangeRateDraft(value)
          },
          onSave: async () => {
            await saveSharedExchangeRate()
          },
        }}
        exchangeRateNeedsAttention={isSharedExchangeRateInvalid}
        onExchangeRateAttentionHandled={() =>
          setIsSharedExchangeRateInvalid(false)
        }
        summaryMetric={{
          label: "Total EUR to WT",
          value: formatCurrencyAmount(totalWireTransferAmount, "EUR"),
        }}
        onMakeJournalEntry={makeJournalEntries}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <section className="grid flex-1 place-items-stretch">
        <input
          id="frabemar-invoice-files"
          type="file"
          className="hidden"
          accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
        {showPasteReportStep ? (
          <div className="grid gap-3">
            <Textarea
              value={pastedReportText}
              onChange={(event) => setPastedReportText(event.target.value)}
              placeholder="Paste report data"
              className="[field-sizing:fixed] min-h-48 resize-none overflow-auto rounded-lg font-mono text-sm"
              disabled={isReadOnly || isSaving}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedFiles([])
                  setPastedReportText("")
                }}
                disabled={isReadOnly || isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => onSave(selectedFiles, pastedReportText)}
                disabled={
                  isReadOnly ||
                  isSaving ||
                  selectedFiles.length < 4 ||
                  !pastedReportText.trim()
                }
              >
                <ClipboardPasteIcon />
                {isSaving ? "Importing" : "Import Paste"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={
              "grid min-h-[22rem] cursor-pointer place-items-center rounded-xl border border-dashed bg-background p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[26rem] " +
              (isDragging ? "border-primary bg-muted/60" : "hover:bg-muted/40")
            }
            onClick={() => {
              if (!isReadOnly) {
                chooseInvoiceFiles()
              }
            }}
            onKeyDown={(event) => {
              if (!isReadOnly && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                chooseInvoiceFiles()
              }
            }}
            onDragOver={(event) => {
              if (isReadOnly) {
                return
              }

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
                  Upload Frabemar Invoices
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {displayedInvoiceNames.length
                    ? `${displayedInvoiceNames.join(", ")}. Add ${Math.max(
                        4 - displayedInvoiceNames.length,
                        0
                      )} more.`
                    : "Drop the four invoice files here, or choose invoice files."}
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    chooseInvoiceFiles()
                  }}
                  disabled={isReadOnly || isSaving}
                >
                  <FileOutputIcon />
                  {isSaving ? "Saving" : "Choose Invoices"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
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
  view?: "auto" | "dashboard" | "reconciliation" | "invoice" | "journal"
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
  const [databaseReconciliationSnapshot, setDatabaseReconciliationSnapshot] =
    React.useState<ReconciliationSnapshot>()
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
  const [isPasteReportOpen, setIsPasteReportOpen] = React.useState(false)
  const [pastedReportText, setPastedReportText] = React.useState("")
  const [isCameroonDmiPasteOpen, setIsCameroonDmiPasteOpen] =
    React.useState(false)
  const [cameroonDmiPasteText, setCameroonDmiPasteText] = React.useState("")
  const [isSavingCameroonDmiPaste, setIsSavingCameroonDmiPaste] =
    React.useState(false)
  const [isUploadingInvoice, setIsUploadingInvoice] = React.useState(false)
  const [isSavingFrabemarInvoices, setIsSavingFrabemarInvoices] =
    React.useState(false)
  const [frabemarExchangeRateText, setFrabemarExchangeRateText] =
    React.useState("")
  const [
    isFrabemarExchangeRateNeedsAttention,
    setIsFrabemarExchangeRateNeedsAttention,
  ] = React.useState(false)
  const [congoVisaUsedText, setCongoVisaUsedText] = React.useState("")
  const [uploadError, setUploadError] = React.useState("")
  const [isUploadingCountryReport, setIsUploadingCountryReport] =
    React.useState(false)
  const masterInputRef = React.useRef<HTMLInputElement>(null)
  const countryReportInputRef = React.useRef<HTMLInputElement>(null)
  const invoiceInputRef = React.useRef<HTMLInputElement>(null)
  const pasteReportTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const pasteReportActionsRef = React.useRef<HTMLDivElement>(null)
  const shouldScrollPastedReportRef = React.useRef(false)
  const gabonReconciliationSaveRef = React.useRef("")
  const activeCountryId = countryId
    ? getCanonicalCountryId(countryId)
    : undefined

  function keepPasteReportControlsReachable() {
    window.requestAnimationFrame(() => {
      const textarea = pasteReportTextareaRef.current

      if (textarea) {
        const endPosition = textarea.value.length

        textarea.scrollTop = textarea.scrollHeight
        textarea.setSelectionRange(endPosition, endPosition)
        textarea.focus()
      }

      pasteReportActionsRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    })
  }

  React.useEffect(() => {
    let isMounted = true

    async function load() {
      if (!period || !activeCountryId) {
        setDatabaseReconciliationSnapshot(undefined)
        setHasLoaded(true)
        return
      }

      setLoadError("")

      try {
        setDatabaseReconciliationSnapshot(undefined)
        const [monthEndRecord, template] = await Promise.all([
          getMonthEndRecord(period),
          getMonthEndTemplate(),
        ])
        const isFrabemarParent = activeCountryId === FRABEMAR_COUNTRY_ID
        const linkedCountryRows = isFrabemarParent
          ? template.countries.filter((item) =>
              FRABEMAR_CHILD_COUNTRY_IDS.includes(item.id)
            )
          : getLinkedCountryRows(activeCountryId, template.countries)
        const linkedIds = linkedCountryRows.map((item) => item.id)
        const navigationIds = Array.from(
          new Set(
            template.countries
              .filter((item) => item.checkable !== false)
              .map((item) => getCanonicalCountryId(item.id, template.countries))
          )
        )
        const matchedCountry =
          (isFrabemarParent
            ? template.countries.find((item) => item.id === activeCountryId)
            : linkedCountryRows[0]) ??
          template.countries.find((item) => item.id === activeCountryId) ??
          loadMonthEndTemplate().countries.find(
            (item) => item.id === activeCountryId
          )
        const displayName =
          (isFrabemarParent ? matchedCountry?.name : "") ||
          formatCombinedCountryName(linkedCountryRows) ||
          matchedCountry?.name ||
          ""
        const supportsPasteReport = linkedCountryRows.some(
          (item) => item.requiresPasteReport
        )

        const [masterRecords, reportRecords, savedReconciliation] =
          monthEndRecord
            ? await Promise.all([
                isFrabemarParent
                  ? Promise.all(
                      FRABEMAR_CHILD_COUNTRY_IDS.map((childCountryId) =>
                        listMonthEndMasterRecords({
                          monthEndId: monthEndRecord.id,
                          countryId: childCountryId,
                        })
                      )
                    ).then((recordGroups) => recordGroups.flat())
                  : listMonthEndMasterRecords({
                      monthEndId: monthEndRecord.id,
                      countryId: activeCountryId,
                    }),
                isFrabemarParent
                  ? Promise.all(
                      FRABEMAR_CHILD_COUNTRY_IDS.map((childCountryId) =>
                        listMonthEndCountryReportRecords({
                          monthEndId: monthEndRecord.id,
                          countryId: childCountryId,
                        })
                      )
                    ).then((recordGroups) => recordGroups.flat())
                  : listMonthEndCountryReportRecords({
                      monthEndId: monthEndRecord.id,
                      countryId: activeCountryId,
                    }),
                activeCountryId === "frabemar-gabon"
                  ? getMonthEndCountryReconciliation<ReconciliationSnapshot>({
                      monthEndId: monthEndRecord.id,
                      countryId: activeCountryId,
                    })
                  : Promise.resolve(undefined),
              ])
            : [[], [], undefined]

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
        setDatabaseReconciliationSnapshot(savedReconciliation?.snapshot)
        const savedCongoInvoiceValues =
          activeCountryId === "republic-of-congo"
            ? parseCongoInvoiceJournalValues(
                monthEndRecord?.checked[
                  congoInvoiceJournalValuesKey(activeCountryId)
                ]
              )
            : undefined

        setCongoVisaUsedText(
          savedCongoInvoiceValues && savedCongoInvoiceValues.visaUsed > 0
            ? formatAmount(savedCongoInvoiceValues.visaUsed)
            : ""
        )
        const savedFrabemarExchangeRateDisplay =
          activeCountryId &&
          FRABEMAR_CHILD_COUNTRY_IDS.includes(activeCountryId)
            ? monthEndRecord?.checked[exchangeRateDisplayKey(activeCountryId)]
            : undefined
        const savedFrabemarExchangeRate =
          activeCountryId &&
          FRABEMAR_CHILD_COUNTRY_IDS.includes(activeCountryId)
            ? monthEndRecord?.checked[exchangeRateKey(activeCountryId)]
            : undefined

        setFrabemarExchangeRateText(
          typeof savedFrabemarExchangeRateDisplay === "string" &&
            savedFrabemarExchangeRateDisplay
            ? savedFrabemarExchangeRateDisplay
            : typeof savedFrabemarExchangeRate === "number" &&
                Number.isFinite(savedFrabemarExchangeRate) &&
                savedFrabemarExchangeRate > 0
              ? formatFrabemarExchangeRate(savedFrabemarExchangeRate)
              : ""
        )
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
        setCountryReportRecords(
          activeCountryId === "cameroon"
            ? applyCameroonDmiMappings(
                reportRecords,
                parseCameroonDmiMappings(
                  monthEndRecord?.checked[
                    cameroonDmiMappingKey(activeCountryId)
                  ]
                )
              )
            : reportRecords
        )
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

  React.useEffect(() => {
    if (activeCountryId !== "cameroon") {
      setIsCameroonDmiPasteOpen(false)
      setCameroonDmiPasteText("")
    }
  }, [activeCountryId])

  React.useEffect(() => {
    if (activeCountryId !== "republic-of-congo") {
      setCongoVisaUsedText("")
    }
  }, [activeCountryId])

  React.useEffect(() => {
    if (
      !activeCountryId ||
      !FRABEMAR_CHILD_COUNTRY_IDS.includes(activeCountryId)
    ) {
      setFrabemarExchangeRateText("")
    }
  }, [activeCountryId])

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
        countryId: activeCountryId,
        period: record?.period,
      }),
    [activeCountryId, countryReportRecords, record?.period, records]
  )
  const checkedReconciliationSnapshot = activeCountryId
    ? parseReconciliationSnapshot(
        record?.checked[reconciliationSnapshotKey(activeCountryId)]
      )
    : undefined
  const storedReconciliationSnapshot =
    activeCountryId === "frabemar-gabon"
      ? (databaseReconciliationSnapshot ?? checkedReconciliationSnapshot)
      : checkedReconciliationSnapshot
  const displayedReconciliation = React.useMemo(
    () =>
      applyReconciliationSnapshot({
        reconciliation,
        snapshot: storedReconciliationSnapshot,
        masterRecords: records,
        countryRecords: countryReportRecords,
      }),
    [
      countryReportRecords,
      records,
      reconciliation,
      storedReconciliationSnapshot,
    ]
  )
  const reconciliationCounts = React.useMemo(
    () => ({
      country: new Set(
        displayedReconciliation.matched.map(
          ({ countryRecord }) => countryRecord.id
        )
      ).size,
      master:
        displayedReconciliation.matched.length -
        displayedReconciliation.linkedMasterRecordIds.size,
    }),
    [
      displayedReconciliation.linkedMasterRecordIds.size,
      displayedReconciliation.matched,
    ]
  )
  const showCountryColumn = linkedCountryIds.length > 1
  const missingCountryRecordIds = React.useMemo(
    () =>
      new Set(
        displayedReconciliation.missingFromNetSuite.map((item) => item.id)
      ),
    [displayedReconciliation.missingFromNetSuite]
  )
  const missingMasterRecordIds = React.useMemo(
    () =>
      new Set(
        displayedReconciliation.missingFromCountry.map((item) => item.id)
      ),
    [displayedReconciliation.missingFromCountry]
  )
  const hasCountryReport = countryReportRecords.length > 0
  const hasMasterRecords = records.length > 0
  const requiresCountryReport = activeCountryId !== ANGOLA_OOT_COUNTRY_ID
  const isMonthClosed = record?.status === "Closed"

  function openMasterFilePicker() {
    if (isMonthClosed) {
      return
    }

    window.setTimeout(() => masterInputRef.current?.click(), 0)
  }

  function openCountryReportFilePicker() {
    if (isMonthClosed) {
      return
    }

    window.setTimeout(() => countryReportInputRef.current?.click(), 0)
  }

  function openInvoiceFilePicker() {
    if (isMonthClosed) {
      return
    }

    window.setTimeout(() => invoiceInputRef.current?.click(), 0)
  }

  const saveGabonSnapshotToDatabase = React.useCallback(
    async (snapshot: ReconciliationSnapshot, monthEndRecord = record) => {
      if (!monthEndRecord || activeCountryId !== "frabemar-gabon") {
        return
      }

      await saveMonthEndCountryReconciliation({
        monthEndId: monthEndRecord.id,
        period: monthEndRecord.period,
        countryId: activeCountryId,
        snapshot,
      })
      setDatabaseReconciliationSnapshot(snapshot)
    },
    [activeCountryId, record]
  )

  async function saveMasterWorkflowState(
    fileName: string,
    masterRecords: MonthEndMasterRecord[]
  ) {
    if (!record || !activeCountryId || isMonthClosed) {
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
    delete checked[resolvedCountryReportRowsKey(activeCountryId)]
    delete checked[reconciliationSnapshotKey(activeCountryId)]

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
    if (activeCountryId === "frabemar-gabon") {
      await deleteMonthEndCountryReconciliation({
        monthEndId: record.id,
        countryId: activeCountryId,
      })
      setDatabaseReconciliationSnapshot(undefined)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function saveCountryReportWorkflowState(
    fileName: string,
    antaserDocuments?: AntaserJournalDocument[],
    cameroonCommissionTotal?: number,
    cameroonReportTotal?: number
  ) {
    if (!record || !activeCountryId || isMonthClosed) {
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

    if (activeCountryId === "cameroon" && fileName) {
      if (
        typeof cameroonCommissionTotal === "number" &&
        Number.isFinite(cameroonCommissionTotal)
      ) {
        checked[cameroonCommissionTotalKey(activeCountryId)] =
          cameroonCommissionTotal
      } else {
        delete checked[cameroonCommissionTotalKey(activeCountryId)]
      }

      if (
        typeof cameroonReportTotal === "number" &&
        Number.isFinite(cameroonReportTotal)
      ) {
        checked[cameroonReportTotalKey(activeCountryId)] = cameroonReportTotal
      } else {
        delete checked[cameroonReportTotalKey(activeCountryId)]
      }
    } else {
      delete checked[cameroonCommissionTotalKey(activeCountryId)]
      delete checked[cameroonReportTotalKey(activeCountryId)]
    }

    delete checked[cameroonDmiMappingKey(activeCountryId)]
    delete checked[journalEntrySnapshotKey(activeCountryId)]
    delete checked[resolvedCountryReportRowsKey(activeCountryId)]
    delete checked[reconciliationSnapshotKey(activeCountryId)]

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
    if (activeCountryId === "frabemar-gabon") {
      await deleteMonthEndCountryReconciliation({
        monthEndId: record.id,
        countryId: activeCountryId,
      })
      setDatabaseReconciliationSnapshot(undefined)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function rollInvoices(selectedRecords: MonthEndMasterRecord[]) {
    if (!record || !activeCountryId || isMonthClosed) {
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

    const snapshot =
      activeCountryId === "frabemar-gabon"
        ? makeReconciliationSnapshot({
            countryId: activeCountryId,
            period: latestRecord.period,
            reconciliation: displayedReconciliation,
            rolledInternalIds: approvedInternalIds,
            leftInvoiceRecordIds,
            resolvedCountryReportRows,
          })
        : undefined

    if (snapshot) {
      checked[reconciliationSnapshotKey(activeCountryId)] =
        JSON.stringify(snapshot)
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    if (snapshot) {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))

    return {
      savedCount: newInternalIds.length,
      excludedCount,
    }
  }

  async function leaveInvoices(selectedRecords: MonthEndMasterRecord[]) {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const recordIds = selectedRecords.flatMap(masterRecordApprovalIds)
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

    const snapshot =
      activeCountryId === "frabemar-gabon"
        ? storedReconciliationSnapshot
          ? mergeSnapshotLeftInvoiceIds(
              storedReconciliationSnapshot,
              leftRecordIds,
              selectedRecords
            )
          : makeReconciliationSnapshot({
              countryId: activeCountryId,
              period: latestRecord.period,
              reconciliation: displayedReconciliation,
              rolledInternalIds,
              leftInvoiceRecordIds: leftRecordIds,
              resolvedCountryReportRows,
            })
        : undefined

    if (snapshot) {
      checked[reconciliationSnapshotKey(activeCountryId)] =
        JSON.stringify(snapshot)
    }

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
    if (snapshot) {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function reconcileCountryRows(
    selectedRecords: MonthEndCountryReportRecord[],
    reason: string,
    note: string
  ) {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const resolvedKey = resolvedCountryReportRowsKey(activeCountryId)
    const existingResolvedRows = parseResolvedCountryReportRows(
      latestRecord.checked[resolvedKey]
    )
    const selectedRecordIds = new Set(selectedRecords.map((item) => item.id))
    const nextResolvedRows = [
      ...existingResolvedRows.filter((item) => !selectedRecordIds.has(item.id)),
      ...selectedRecords.map((item) => ({
        id: item.id,
        reason,
        note,
        resolvedAt: new Date().toISOString(),
      })),
    ]
    const checked = {
      ...latestRecord.checked,
      [resolvedKey]: JSON.stringify(nextResolvedRows),
    }

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    const snapshot =
      activeCountryId === "frabemar-gabon"
        ? makeReconciliationSnapshot({
            countryId: activeCountryId,
            period: latestRecord.period,
            reconciliation: displayedReconciliation,
            rolledInternalIds,
            leftInvoiceRecordIds,
            resolvedCountryReportRows: nextResolvedRows,
          })
        : undefined

    if (snapshot) {
      checked[reconciliationSnapshotKey(activeCountryId)] =
        JSON.stringify(snapshot)
    }

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
    if (snapshot) {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function reconcileSelectedPair(
    countryRecord: MonthEndCountryReportRecord,
    masterRecord: MonthEndMasterRecord
  ) {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    const snapshotKey = reconciliationSnapshotKey(activeCountryId)
    const nextReconciliation = addManualReconciliationMatch({
      reconciliation: displayedReconciliation,
      countryRecord,
      masterRecord,
    })
    const snapshot = makeReconciliationSnapshot({
      countryId: activeCountryId,
      period: latestRecord.period,
      reconciliation: nextReconciliation,
      rolledInternalIds: parseApprovedInternalIds(
        checked[rollApprovalKey(activeCountryId)]
      ),
      leftInvoiceRecordIds: parseApprovedInternalIds(
        checked[leftInvoiceKey(activeCountryId)]
      ),
      resolvedCountryReportRows: parseResolvedCountryReportRows(
        checked[resolvedCountryReportRowsKey(activeCountryId)]
      ),
    })

    checked[snapshotKey] = JSON.stringify(snapshot)
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
    if (activeCountryId === "frabemar-gabon") {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function unreconcileMatchedRows(rows: MatchedDisplayRow[]) {
    if (!record || !activeCountryId || isMonthClosed || !rows.length) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    const snapshotKey = reconciliationSnapshotKey(activeCountryId)
    const matchedRowsToUnreconcile = rows.filter(
      (row): row is Extract<MatchedDisplayRow, { kind: "matched" }> =>
        row.kind === "matched"
    )
    const clearedCountryRecordIds = new Set(
      rows
        .filter((row) => row.kind === "cleared")
        .map((row) => row.countryRecord.id)
    )
    const nextResolvedCountryRows = parseResolvedCountryReportRows(
      checked[resolvedCountryReportRowsKey(activeCountryId)]
    ).filter((row) => !clearedCountryRecordIds.has(row.id))
    const nextReconciliation = removeReconciliationMatches({
      reconciliation: displayedReconciliation,
      countryRecords: matchedRowsToUnreconcile.map((row) => row.countryRecord),
      masterRecords: matchedRowsToUnreconcile.map((row) => row.masterRecord),
    })
    const snapshot = makeReconciliationSnapshot({
      countryId: activeCountryId,
      period: latestRecord.period,
      reconciliation: nextReconciliation,
      rolledInternalIds: parseApprovedInternalIds(
        checked[rollApprovalKey(activeCountryId)]
      ),
      leftInvoiceRecordIds: parseApprovedInternalIds(
        checked[leftInvoiceKey(activeCountryId)]
      ),
      resolvedCountryReportRows: nextResolvedCountryRows,
    })

    checked[snapshotKey] = JSON.stringify(snapshot)

    if (nextResolvedCountryRows.length) {
      checked[resolvedCountryReportRowsKey(activeCountryId)] = JSON.stringify(
        nextResolvedCountryRows
      )
    } else {
      delete checked[resolvedCountryReportRowsKey(activeCountryId)]
    }

    delete checked[journalEntrySnapshotKey(activeCountryId)]

    for (const linkedCountryId of linkedCountryIds.length
      ? linkedCountryIds
      : [activeCountryId]) {
      delete checked[monthEndTaskKey(linkedCountryId, "reconcile")]
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
    }

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    if (activeCountryId === "frabemar-gabon") {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function proceedFromReconciliation() {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    let snapshot: ReconciliationSnapshot | undefined

    if (activeCountryId === "frabemar-gabon") {
      const approvalKey = rollApprovalKey(activeCountryId)
      const leaveKey = leftInvoiceKey(activeCountryId)
      const existingRolledInternalIds = parseApprovedInternalIds(
        checked[approvalKey]
      )
      const existingLeftRecordIds = parseApprovedInternalIds(checked[leaveKey])
      const autoRolledInternalIds = Array.from(
        displayedReconciliation.autoRolledMasterIds
      )
        .map((recordId) =>
          records.find((masterRecord) => masterRecord.id === recordId)
        )
        .map((masterRecord) => masterRecord?.sourceInternalId.trim() ?? "")
        .filter(Boolean)
      const autoLeftRecordIds = Array.from(
        displayedReconciliation.autoLeftMasterIds
      ).flatMap((recordId) => {
        const masterRecord = records.find((record) => record.id === recordId)

        return masterRecord ? masterRecordApprovalIds(masterRecord) : []
      })
      const nextRolledInternalIds = Array.from(
        new Set([...existingRolledInternalIds, ...autoRolledInternalIds])
      )
      const nextLeftRecordIds = Array.from(
        new Set([...existingLeftRecordIds, ...autoLeftRecordIds])
      )

      if (nextRolledInternalIds.length) {
        checked[approvalKey] = serializeApprovedInternalIds(
          nextRolledInternalIds
        )
      } else {
        delete checked[approvalKey]
      }

      if (nextLeftRecordIds.length) {
        checked[leaveKey] = serializeApprovedInternalIds(nextLeftRecordIds)
      } else {
        delete checked[leaveKey]
      }

      snapshot = makeReconciliationSnapshot({
        countryId: activeCountryId,
        period: latestRecord.period,
        reconciliation: displayedReconciliation,
        rolledInternalIds: nextRolledInternalIds,
        leftInvoiceRecordIds: nextLeftRecordIds,
        resolvedCountryReportRows,
      })
      checked[reconciliationSnapshotKey(activeCountryId)] =
        JSON.stringify(snapshot)
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
    if (snapshot) {
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)
    }
    setRecord(updatedRecord)
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(
      country?.invoiceRequired === true
        ? countryDashboardHref
        : journalEntryHref
    )
  }

  async function moveInvoicesToAngolaOot(
    selectedRecords: MonthEndMasterRecord[]
  ) {
    if (!record || isMonthClosed || activeCountryId !== "angola") {
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
    if (!record || !activeCountryId || isMonthClosed) {
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
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }

    for (const linkedCountryId of workflowCountryIds) {
      delete checked[monthEndTaskKey(linkedCountryId, "reconcile")]
      delete checked[monthEndTaskKey(linkedCountryId, "journal")]
      delete checked[monthEndTaskKey(linkedCountryId, "invoice")]
      delete checked[rollApprovalKey(linkedCountryId)]
      delete checked[leftInvoiceKey(linkedCountryId)]
      delete checked[journalEntrySnapshotKey(linkedCountryId)]
      delete checked[invoiceDocumentKey(linkedCountryId)]
      delete checked[congoInvoiceJournalValuesKey(linkedCountryId)]
      delete checked[resolvedCountryReportRowsKey(linkedCountryId)]
      delete checked[reconciliationSnapshotKey(linkedCountryId)]
      delete checked[sourceFileNameKey(linkedCountryId, "country")]
      delete checked[sourceFileNameKey(linkedCountryId, "invoice")]
      delete checked[cameroonDmiMappingKey(linkedCountryId)]
      delete checked[cameroonCommissionTotalKey(linkedCountryId)]
      delete checked[cameroonReportTotalKey(linkedCountryId)]
    }

    delete checked[rollApprovalKey(activeCountryId)]
    delete checked[leftInvoiceKey(activeCountryId)]
    delete checked[journalEntrySnapshotKey(activeCountryId)]
    delete checked[invoiceDocumentKey(activeCountryId)]
    delete checked[congoInvoiceJournalValuesKey(activeCountryId)]
    delete checked[monthEndTaskKey(activeCountryId, "invoice")]
    delete checked[resolvedCountryReportRowsKey(activeCountryId)]
    delete checked[reconciliationSnapshotKey(activeCountryId)]
    delete checked[sourceFileNameKey(activeCountryId, "country")]
    delete checked[sourceFileNameKey(activeCountryId, "invoice")]
    delete checked[cameroonDmiMappingKey(activeCountryId)]
    delete checked[cameroonCommissionTotalKey(activeCountryId)]
    delete checked[cameroonReportTotalKey(activeCountryId)]

    await Promise.all(
      Array.from(new Set([activeCountryId, ...workflowCountryIds])).map(
        (countryId) =>
          replaceMonthEndCountryReportRecords({
            monthEndId: record.id,
            countryId,
            records: [],
          })
      )
    )
    await deleteMonthEndCountryReconciliation({
      monthEndId: record.id,
      countryId: activeCountryId,
    })

    const updatedRecord = {
      ...latestRecord,
      checked,
      updatedAt: new Date().toISOString(),
    }

    await saveMonthEndRecord(updatedRecord)
    setRecord(updatedRecord)
    setDatabaseReconciliationSnapshot(undefined)
    setCountryReportRecords([])
    setCongoVisaUsedText("")
    window.dispatchEvent(new Event("month-end:records-updated"))
    router.push(reconciliationReportHref)
  }

  async function saveCountryDashboardSection(section: CountryDashboardSection) {
    if (!record || !activeCountryId || isMonthClosed) {
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

  async function saveFrabemarExchangeRateForCountry(
    countryId: string,
    value: string
  ) {
    if (
      !record ||
      !FRABEMAR_CHILD_COUNTRY_IDS.includes(countryId) ||
      isMonthClosed
    ) {
      return false
    }

    const exchangeRate = parseFrabemarExchangeRate(value)

    if (exchangeRate === undefined) {
      return false
    }

    setUploadError("")
    setIsFrabemarExchangeRateNeedsAttention(false)

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const exchangeRateDisplay = value.trim().replace(",", ".")
      const checked = {
        ...latestRecord.checked,
        [exchangeRateKey(countryId)]: exchangeRate,
        [exchangeRateDisplayKey(countryId)]: exchangeRateDisplay,
      }

      delete checked[journalEntrySnapshotKey(countryId)]

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      if (countryId === activeCountryId) {
        setFrabemarExchangeRateText(exchangeRateDisplay)
      }
      window.dispatchEvent(new Event("month-end:records-updated"))
      return true
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not save Frabemar exchange rate.")
      )
      return false
    }
  }

  async function saveFrabemarExchangeRate() {
    if (!activeCountryId) {
      return
    }

    await saveFrabemarExchangeRateForCountry(
      activeCountryId,
      frabemarExchangeRateText
    )
  }

  async function saveFrabemarExchangeRateForPackage(value: string) {
    if (!record || activeCountryId !== FRABEMAR_COUNTRY_ID || isMonthClosed) {
      return false
    }

    const exchangeRate = parseFrabemarExchangeRate(value)

    if (exchangeRate === undefined) {
      return false
    }

    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const exchangeRateDisplay = value.trim().replace(",", ".")
      const checked = { ...latestRecord.checked }

      for (const childCountryId of FRABEMAR_CHILD_COUNTRY_IDS) {
        checked[exchangeRateKey(childCountryId)] = exchangeRate
        checked[exchangeRateDisplayKey(childCountryId)] = exchangeRateDisplay
        delete checked[journalEntrySnapshotKey(childCountryId)]
      }

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      window.dispatchEvent(new Event("month-end:records-updated"))
      return true
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not save Frabemar exchange rate.")
      )
      return false
    }
  }

  async function makeJournalEntry() {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    if (isFrabemarChildCountry && !frabemarExchangeRate) {
      setIsFrabemarExchangeRateNeedsAttention(true)
      return
    }

    const latestRecord = (await getMonthEndRecord(record.period)) ?? record
    const checked = { ...latestRecord.checked }
    const snapshot: JournalEntrySnapshot = {
      createdAt: new Date().toISOString(),
      entries: displayedJournalEntries,
      additionalRows: displayedAdditionalJournalRows.length
        ? displayedAdditionalJournalRows
        : undefined,
      simpleRows: displayedSimpleJournalRows.length
        ? displayedSimpleJournalRows
        : undefined,
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

  async function uploadInvoiceFiles(files: File[]) {
    if (
      !record ||
      !activeCountryId ||
      !country?.invoiceRequired ||
      isMonthClosed
    ) {
      return
    }

    if (!files.length) {
      return
    }

    setIsUploadingInvoice(true)
    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const checked = { ...latestRecord.checked }
      const fileNames = files.map((file) => file.name)
      const invoiceFile =
        files.find((file) => {
          const extension = file.name.split(".").pop()?.toLowerCase()

          return extension === "pdf" || file.type === "application/pdf"
        }) ?? files[0]
      const invoiceDocument: InvoiceDocument = {
        fileName: invoiceFile.name,
        fileNames,
        fileSize: files.reduce((total, file) => total + file.size, 0),
        fileType: invoiceFile.type,
        uploadedAt: new Date().toISOString(),
      }

      if (activeCountryId === "republic-of-congo") {
        if (
          invoiceFile.name.split(".").pop()?.toLowerCase() !== "pdf" &&
          invoiceFile.type !== "application/pdf"
        ) {
          throw new Error("Upload the Republic of Congo invoice PDF.")
        }

        const invoiceText = await extractPdfText(invoiceFile)
        const parsedInvoice = parseCongoInvoiceText(invoiceText)

        if (parsedInvoice.visaPointsTotal <= 0) {
          throw new Error(
            "Could not find Republic of Congo visa points on the invoice."
          )
        }

        const invoiceCommission = roundJournalAmount(
          parsedInvoice.visaPointsTotal * 0.1
        )
        const congoValues: CongoInvoiceJournalValues = {
          invoiceVisaPointsTotal: roundJournalAmount(
            parsedInvoice.visaPointsTotal
          ),
          invoiceCommission,
          invoiceBankCharges: roundJournalAmount(parsedInvoice.bankCharges),
          wireFee: 16,
          visaUsed: 0,
          visaUsedCommission: 0,
          visaUsedIncome: 0,
          invoiceFileName: invoiceFile.name,
          savedAt: new Date().toISOString(),
        }

        checked[congoInvoiceJournalValuesKey(activeCountryId)] =
          JSON.stringify(congoValues)
        delete checked[monthEndTaskKey(activeCountryId, "invoice")]
      } else {
        checked[monthEndTaskKey(activeCountryId, "invoice")] = true
      }

      checked[sourceFileNameKey(activeCountryId, "invoice")] =
        fileNames.join(", ")
      checked[invoiceDocumentKey(activeCountryId)] =
        JSON.stringify(invoiceDocument)
      delete checked[journalEntrySnapshotKey(activeCountryId)]

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      if (activeCountryId === "republic-of-congo") {
        setCongoVisaUsedText("")
      }
      window.dispatchEvent(new Event("month-end:records-updated"))
      router.push(journalEntryHref)
    } catch (error) {
      setUploadError(getUploadErrorMessage(error, "Could not save invoice."))
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  async function saveCongoVisaUsed() {
    if (
      !record ||
      activeCountryId !== "republic-of-congo" ||
      !country?.invoiceRequired ||
      isMonthClosed
    ) {
      return
    }

    setIsUploadingInvoice(true)
    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const checked = { ...latestRecord.checked }
      const congoValues = parseCongoInvoiceJournalValues(
        checked[congoInvoiceJournalValuesKey(activeCountryId)]
      )
      const visaUsed = parseCongoMoneyValue(congoVisaUsedText)

      if (!congoValues) {
        throw new Error("Upload the Republic of Congo invoice first.")
      }

      if (visaUsed <= 0) {
        throw new Error("Enter the Republic of Congo Visa Used amount.")
      }

      const visaUsedCommission = roundJournalAmount(visaUsed * 0.1)
      const nextCongoValues: CongoInvoiceJournalValues = {
        ...congoValues,
        visaUsed: roundJournalAmount(visaUsed),
        visaUsedCommission,
        visaUsedIncome: roundJournalAmount(visaUsed - visaUsedCommission),
        savedAt: new Date().toISOString(),
      }

      checked[congoInvoiceJournalValuesKey(activeCountryId)] =
        JSON.stringify(nextCongoValues)
      checked[monthEndTaskKey(activeCountryId, "invoice")] = true
      delete checked[journalEntrySnapshotKey(activeCountryId)]

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      setCongoVisaUsedText(formatAmount(nextCongoValues.visaUsed))
      window.dispatchEvent(new Event("month-end:records-updated"))
      router.push(journalEntryHref)
    } catch (error) {
      setUploadError(getUploadErrorMessage(error, "Could not save Visa Used."))
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  async function clearInvoiceAndReset() {
    if (!record || !activeCountryId || isMonthClosed) {
      return
    }

    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const checked = { ...latestRecord.checked }
      const invoiceCountryIds = Array.from(
        new Set([activeCountryId, ...linkedCountryIds])
      )

      for (const invoiceCountryId of invoiceCountryIds) {
        delete checked[sourceFileNameKey(invoiceCountryId, "invoice")]
        delete checked[invoiceDocumentKey(invoiceCountryId)]
        delete checked[congoInvoiceJournalValuesKey(invoiceCountryId)]
        delete checked[monthEndTaskKey(invoiceCountryId, "invoice")]
        delete checked[journalEntrySnapshotKey(invoiceCountryId)]
      }

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      setCongoVisaUsedText("")
      window.dispatchEvent(new Event("month-end:records-updated"))
      router.push(journalEntryHref)
    } catch (error) {
      setUploadError(getUploadErrorMessage(error, "Could not reset invoice."))
    }
  }

  async function saveFrabemarInvoicePackage(
    files: File[],
    pastedFrabemarReportText: string
  ) {
    if (!record || activeCountryId !== FRABEMAR_COUNTRY_ID || isMonthClosed) {
      return
    }

    if (files.length < 4) {
      setUploadError("Upload all 4 Frabemar invoices.")
      return
    }

    if (!pastedFrabemarReportText.trim()) {
      setUploadError("Paste the Frabemar text report.")
      return
    }

    setIsSavingFrabemarInvoices(true)
    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const checked = { ...latestRecord.checked }
      const uploadedAt = new Date().toISOString()
      const commissionsByCountryId = parseFrabemarCommissionReport(
        pastedFrabemarReportText
      )
      const invoices: InvoiceDocument[] = files.map((file) => ({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt,
      }))
      const countryValues: FrabemarInvoicePackage["countryValues"] = {}

      for (const file of files) {
        const countryId = findFrabemarCountryId(file.name)

        if (!countryId) {
          continue
        }

        if (
          file.name.split(".").pop()?.toLowerCase() !== "pdf" &&
          file.type !== "application/pdf"
        ) {
          throw new Error("Upload PDF invoices for Frabemar.")
        }

        const invoiceText = await extractPdfText(file)
        const invoiceTotal = parseFrabemarInvoiceTotal(invoiceText)
        const invoiceNumber = parseFrabemarInvoiceNumber(invoiceText, file.name)

        countryValues[countryId] = {
          invoiceTotal: roundJournalAmount(invoiceTotal),
          commission: roundJournalAmount(
            commissionsByCountryId.get(countryId) ?? 0
          ),
          invoiceFileName: file.name,
          invoiceNumber,
          commissionInvoiceNumber: frabemarCommissionInvoiceNumber(
            latestRecord.period,
            countryId
          ),
        }
      }

      const missingCountries = FRABEMAR_CHILD_COUNTRIES.filter(
        (country) =>
          !countryValues[country.id] ||
          countryValues[country.id].invoiceTotal <= 0
      )

      if (missingCountries.length) {
        throw new Error(
          `Could not find invoice total for ${missingCountries
            .map((country) => country.accountName.replace("Frabemar : ", ""))
            .join(", ")}.`
        )
      }

      const packageDocument: FrabemarInvoicePackage = {
        invoices,
        countryValues,
        pastedReportText: pastedFrabemarReportText.trim(),
        savedAt: uploadedAt,
      }
      const packageInvoiceDocument: InvoiceDocument = {
        fileName: "Frabemar invoice package",
        fileNames: invoices.map((invoice) => invoice.fileName),
        fileSize: invoices.reduce(
          (total, invoice) => total + invoice.fileSize,
          0
        ),
        fileType: "Frabemar invoices",
        uploadedAt,
      }

      checked[frabemarInvoicePackageKey()] = JSON.stringify(packageDocument)
      checked[sourceFileNameKey(FRABEMAR_COUNTRY_ID, "invoice")] =
        packageInvoiceDocument.fileNames?.join(", ") ?? ""
      checked[invoiceDocumentKey(FRABEMAR_COUNTRY_ID)] = JSON.stringify(
        packageInvoiceDocument
      )
      checked[monthEndTaskKey(FRABEMAR_COUNTRY_ID, "invoice")] = true

      for (const childCountryId of FRABEMAR_CHILD_COUNTRY_IDS) {
        const childInvoice = invoices.find(
          (invoice) =>
            invoice.fileName === countryValues[childCountryId].invoiceFileName
        )
        const childInvoiceDocument: InvoiceDocument = {
          fileName: countryValues[childCountryId].invoiceFileName,
          fileSize: childInvoice?.fileSize ?? 0,
          fileType: childInvoice?.fileType ?? "application/pdf",
          uploadedAt,
        }
        const childCountryValues: FrabemarCountryJournalValues = {
          ...countryValues[childCountryId],
          savedAt: uploadedAt,
        }

        checked[monthEndTaskKey(childCountryId, "invoice")] = true
        checked[sourceFileNameKey(childCountryId, "invoice")] =
          childInvoiceDocument.fileName
        checked[invoiceDocumentKey(childCountryId)] =
          JSON.stringify(childInvoiceDocument)
        checked[frabemarCountryJournalValuesKey(childCountryId)] =
          JSON.stringify(childCountryValues)
        delete checked[journalEntrySnapshotKey(childCountryId)]
      }

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not save Frabemar invoices.")
      )
    } finally {
      setIsSavingFrabemarInvoices(false)
    }
  }

  async function clearFrabemarInvoicePackage() {
    if (!record || activeCountryId !== FRABEMAR_COUNTRY_ID || isMonthClosed) {
      return
    }

    setIsSavingFrabemarInvoices(true)
    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const checked = { ...latestRecord.checked }

      delete checked[frabemarInvoicePackageKey()]
      delete checked[sourceFileNameKey(FRABEMAR_COUNTRY_ID, "invoice")]
      delete checked[invoiceDocumentKey(FRABEMAR_COUNTRY_ID)]
      delete checked[monthEndTaskKey(FRABEMAR_COUNTRY_ID, "invoice")]
      delete checked[monthEndTaskKey(FRABEMAR_COUNTRY_ID, "journal")]
      delete checked[journalEntrySnapshotKey(FRABEMAR_COUNTRY_ID)]

      for (const childCountryId of FRABEMAR_CHILD_COUNTRY_IDS) {
        delete checked[monthEndTaskKey(childCountryId, "invoice")]
        delete checked[monthEndTaskKey(childCountryId, "journal")]
        delete checked[sourceFileNameKey(childCountryId, "invoice")]
        delete checked[invoiceDocumentKey(childCountryId)]
        delete checked[frabemarCountryJournalValuesKey(childCountryId)]
        delete checked[journalEntrySnapshotKey(childCountryId)]
      }

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not reset Frabemar invoices.")
      )
    } finally {
      setIsSavingFrabemarInvoices(false)
    }
  }

  async function downloadFrabemarCommissionInvoice(countryId: string) {
    if (!record) {
      return
    }

    const packageDocument = parseFrabemarInvoicePackage(
      record.checked[frabemarInvoicePackageKey()]
    )
    const countryConfig = FRABEMAR_CHILD_COUNTRIES.find(
      (country) => country.id === countryId
    )
    const countryValue = packageDocument?.countryValues[countryId]

    if (!countryConfig || !countryValue || !countryConfig.hasCommission) {
      setUploadError(
        "No Frabemar commission invoice is available for this country."
      )
      return
    }

    if (!countryValue.invoiceNumber) {
      setUploadError("Could not find the customer reference invoice number.")
      return
    }

    setUploadError("")

    try {
      await downloadFrabemarCommissionInvoicePdf({
        countryName: countryConfig.accountName.replace("Frabemar : ", ""),
        invoiceNumber:
          frabemarCommissionInvoiceNumber(record.period, countryId) ||
          countryValue.commissionInvoiceNumber,
        customerReference: countryValue.invoiceNumber,
        invoiceDate: formatTransactionDate(new Date().toISOString()),
        commissionAmount: countryValue.commission,
      })
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not download commission PDF.")
      )
    }
  }

  async function downloadAllFrabemarCommissionInvoices() {
    if (!record) {
      return
    }

    const packageDocument = parseFrabemarInvoicePackage(
      record.checked[frabemarInvoicePackageKey()]
    )

    if (!packageDocument) {
      setUploadError("No Frabemar commission invoices are available.")
      return
    }

    setUploadError("")

    for (const country of FRABEMAR_CHILD_COUNTRIES) {
      const countryValue = packageDocument.countryValues[country.id]

      if (
        !country.hasCommission ||
        !countryValue?.commission ||
        !countryValue.invoiceNumber
      ) {
        continue
      }

      await downloadFrabemarCommissionInvoicePdf({
        countryName: country.accountName.replace("Frabemar : ", ""),
        invoiceNumber:
          frabemarCommissionInvoiceNumber(record.period, country.id) ||
          countryValue.commissionInvoiceNumber,
        customerReference: countryValue.invoiceNumber,
        invoiceDate: formatTransactionDate(new Date().toISOString()),
        commissionAmount: countryValue.commission,
      })
    }
  }

  async function makeFrabemarPackageJournalEntries(exchangeRateText: string) {
    if (!record || activeCountryId !== FRABEMAR_COUNTRY_ID || isMonthClosed) {
      return false
    }

    const exchangeRate = parseFrabemarExchangeRate(exchangeRateText)

    if (exchangeRate === undefined) {
      return false
    }

    const didSaveExchangeRate =
      await saveFrabemarExchangeRateForPackage(exchangeRateText)

    if (!didSaveExchangeRate) {
      return false
    }

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const packageDocument = parseFrabemarInvoicePackage(
        latestRecord.checked[frabemarInvoicePackageKey()]
      )

      if (!packageDocument) {
        setUploadError("Upload the Frabemar invoices before making journals.")
        return false
      }

      const checked = { ...latestRecord.checked }
      const exchangeRateDisplay = exchangeRateText.trim().replace(",", ".")
      const countryRows = FRABEMAR_CHILD_COUNTRIES.flatMap((country) => {
        const countryValue = packageDocument.countryValues[country.id]

        if (!countryValue) {
          return []
        }

        const netAmount = roundJournalAmount(
          countryValue.invoiceTotal - countryValue.commission
        )
        const journalAmount = roundJournalAmount(netAmount * exchangeRate)

        return [
          {
            account: country.accountName,
            credit: journalAmount,
            lineDescription: `${formatAmount(netAmount)} * ${exchangeRateDisplay}`,
          },
        ]
      })
      const totalJournalAmount = roundJournalAmount(
        countryRows.reduce((total, row) => total + (row.credit ?? 0), 0)
      )
      const snapshot: JournalEntrySnapshot = {
        createdAt: new Date().toISOString(),
        entries: [],
        simpleRows: [
          {
            account: "Income",
            debit: totalJournalAmount,
          },
          ...countryRows,
        ],
      }

      const serializedSnapshot = JSON.stringify(snapshot)

      for (const country of FRABEMAR_CHILD_COUNTRIES) {
        checked[journalEntrySnapshotKey(country.id)] = serializedSnapshot
        checked[monthEndTaskKey(country.id, "journal")] = true
      }

      checked[journalEntrySnapshotKey(FRABEMAR_COUNTRY_ID)] = serializedSnapshot
      checked[monthEndTaskKey(FRABEMAR_COUNTRY_ID, "journal")] = true

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      window.dispatchEvent(new Event("month-end:records-updated"))
      router.push(countryDashboardHref)
      return true
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not make Frabemar journal entries.")
      )
      return false
    }
  }

  async function uploadMasterFile(file: File) {
    if (!record || !activeCountryId || isMonthClosed) {
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
    cameroonCommissionTotal,
    cameroonReportTotal,
  }: {
    parsedRecords: ParsedCountryReportRecord[]
    sourceLabel: string
    antaserDocuments?: AntaserJournalDocument[]
    cameroonCommissionTotal?: number
    cameroonReportTotal?: number
  }) {
    if (!record || !country || !activeCountryId || isMonthClosed) {
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
      Array.from(replacementCountryIds).map(async (targetCountryId) => {
        const countryParsedRecords =
          recordsByCountryId.get(targetCountryId) ?? []
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
      })
    )
    const reportRecords = savedRecordGroups.flat()

    await saveCountryReportWorkflowState(
      sourceLabel,
      antaserDocuments,
      cameroonCommissionTotal,
      cameroonReportTotal
    )
    setCountryReportRecords(
      reportRecords.filter((item) => item.countryId === activeCountryId)
    )
  }

  async function deleteMasterRecords() {
    if (!record || !activeCountryId || isMonthClosed) {
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
    if (!record || !activeCountryId || isMonthClosed) {
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
    if (isMonthClosed) {
      setUploadError("Reopen this month before uploading reports.")
      return
    }

    setIsUploadingCountryReport(true)
    setUploadError("")

    try {
      const template = await getMonthEndTemplate()
      const activeCountry = activeCountryId
        ? template.countries.find((item) => item.id === activeCountryId)
        : undefined
      const parsedGroups: {
        records: ParsedCountryReportRecord[]
        antaserJournalDocument?: AntaserJournalDocument
        cameroonTotals?: CameroonCountryReportTotals
      }[] = await Promise.all(
        files.map(async (file) => {
          const savedMapping = activeCountry?.countryReportMapping
          const shouldUseSavedMapping =
            Boolean(savedMapping) &&
            !isDefaultCountryReportMapping(savedMapping)
          const csvText = await reportFileToCsvText(file, record?.period)
          const cameroonTotals =
            activeCountryId === "cameroon"
              ? getCameroonCountryReportTotals(csvText)
              : undefined
          const gabonRecords =
            activeCountryId === "frabemar-gabon"
              ? parseGabonCountryReportCsv(csvText)
              : []
          const cameroonRecords =
            activeCountryId === "cameroon"
              ? parseCameroonCountryReportCsv(csvText)
              : []

          if (gabonRecords.length) {
            return {
              records: gabonRecords,
              antaserJournalDocument: undefined,
            }
          }

          if (cameroonRecords.length) {
            return {
              records: cameroonRecords,
              antaserJournalDocument: undefined,
              cameroonTotals,
            }
          }

          const mappedRecords = shouldUseSavedMapping
            ? parseMappedCountryReportCsv(csvText, savedMapping)
            : undefined

          if (shouldUseSavedMapping) {
            if (mappedRecords?.length) {
              return {
                records: mappedRecords,
                antaserJournalDocument: undefined,
                cameroonTotals,
              }
            }

            const aiMappedRecords = savedMapping
              ? await parseCountryReportWithAiMapping({
                  csvText,
                  fileName: file.name,
                  mapping: savedMapping,
                })
              : []

            if (aiMappedRecords.length) {
              return {
                records: aiMappedRecords,
                antaserJournalDocument: undefined,
                cameroonTotals,
              }
            }

            throw new Error(
              `The saved ${activeCountry?.name ?? "country"} report mapping did not find any rows in ${file.name}, even after AI normalized the upload. Reopen the mapping, upload this sample, adjust the columns, and save it.`
            )
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
        cameroonCommissionTotal:
          activeCountryId === "cameroon"
            ? parsedGroups.reduce(
                (total, group) =>
                  total +
                  (group.cameroonTotals?.secondaryAmount ??
                    sumCameroonCommissionTotal(group.records)),
                0
              )
            : undefined,
        cameroonReportTotal:
          activeCountryId === "cameroon"
            ? parsedGroups.reduce(
                (total, group) =>
                  total +
                  (group.cameroonTotals?.amount ??
                    sumCameroonReportTotal(group.records)),
                0
              )
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
    if (!record || isMonthClosed) {
      setUploadError("Open a valid country record before uploading.")
      return
    }

    setIsUploadingCountryReport(true)
    setUploadError("")

    try {
      const template = await getMonthEndTemplate()
      const activeCountry = activeCountryId
        ? template.countries.find((item) => item.id === activeCountryId)
        : undefined
      const savedMapping = activeCountry?.countryReportMapping
      const shouldUseSavedMapping =
        Boolean(savedMapping) && !isDefaultCountryReportMapping(savedMapping)
      const gabonRecords =
        activeCountryId === "frabemar-gabon"
          ? parseGabonCountryReportCsv(pastedReportText)
          : []
      const cameroonRecords =
        activeCountryId === "cameroon"
          ? parseCameroonCountryReportCsv(pastedReportText)
          : []
      const cameroonTotals =
        activeCountryId === "cameroon"
          ? getCameroonCountryReportTotals(pastedReportText)
          : undefined
      const mappedRecords = shouldUseSavedMapping
        ? parseMappedCountryReportCsv(pastedReportText, savedMapping)
        : undefined
      const aiMappedRecords =
        !gabonRecords.length &&
        shouldUseSavedMapping &&
        savedMapping &&
        !mappedRecords?.length
          ? await parseCountryReportWithAiMapping({
              csvText: pastedReportText,
              fileName: "Pasted report",
              mapping: savedMapping,
            })
          : []

      if (
        !gabonRecords.length &&
        !cameroonRecords.length &&
        shouldUseSavedMapping &&
        !mappedRecords?.length &&
        !aiMappedRecords.length
      ) {
        throw new Error(
          `The saved ${activeCountry?.name ?? "country"} report mapping did not find any rows in the pasted report, even after AI normalized it. Reopen the mapping, paste this sample, adjust the columns, and save it.`
        )
      }

      await saveParsedCountryReportRecords({
        parsedRecords: gabonRecords.length
          ? gabonRecords
          : cameroonRecords.length
            ? cameroonRecords
            : mappedRecords?.length
              ? mappedRecords
              : aiMappedRecords.length
                ? aiMappedRecords
                : parseCountryReportText(pastedReportText, {
                    period: record.period,
                  }),
        sourceLabel: "Pasted report",
        cameroonCommissionTotal:
          activeCountryId === "cameroon"
            ? (cameroonTotals?.secondaryAmount ??
              sumCameroonCommissionTotal(
                cameroonRecords.length
                  ? cameroonRecords
                  : parseCountryReportText(pastedReportText, {
                      period: record.period,
                    })
              ))
            : undefined,
        cameroonReportTotal:
          activeCountryId === "cameroon"
            ? (cameroonTotals?.amount ??
              sumCameroonReportTotal(
                cameroonRecords.length
                  ? cameroonRecords
                  : parseCountryReportText(pastedReportText, {
                      period: record.period,
                    })
              ))
            : undefined,
      })
      setPastedReportText("")
      setIsPasteReportOpen(false)
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not read the pasted report.")
      )
    } finally {
      setIsUploadingCountryReport(false)
    }
  }

  async function saveCameroonDmiPaste() {
    if (!record || activeCountryId !== "cameroon" || isMonthClosed) {
      setUploadError("Open Cameroon before applying the DMI report.")
      return
    }

    const mappings = parseCameroonDmiPaste(cameroonDmiPasteText)

    if (!mappings.length) {
      setUploadError("No DMI / MI number pairs were found in that paste.")
      return
    }

    setIsSavingCameroonDmiPaste(true)
    setUploadError("")

    try {
      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const rawCountryReportRecords = await listMonthEndCountryReportRecords({
        monthEndId: latestRecord.id,
        countryId: activeCountryId,
      })
      const updatedCountryReportRecords = applyCameroonDmiMappings(
        rawCountryReportRecords,
        mappings
      )
      const matchedCount = updatedCountryReportRecords.filter(
        (updatedRecord, index) =>
          updatedRecord.reference !==
            rawCountryReportRecords[index]?.reference ||
          updatedRecord.ctnNumber !==
            rawCountryReportRecords[index]?.ctnNumber ||
          updatedRecord.invoiceNumber !==
            rawCountryReportRecords[index]?.invoiceNumber ||
          updatedRecord.billOfLadingNumber !==
            rawCountryReportRecords[index]?.billOfLadingNumber
      ).length

      if (!matchedCount) {
        throw new Error(
          "The DMI report imported, but none of its MI numbers matched the uploaded Cameroon country report."
        )
      }

      const checked = {
        ...latestRecord.checked,
        [cameroonDmiMappingKey(activeCountryId)]:
          serializeCameroonDmiMappings(mappings),
      }

      delete checked[journalEntrySnapshotKey(activeCountryId)]

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      setRecord(updatedRecord)
      setCountryReportRecords(updatedCountryReportRecords)
      setCameroonDmiPasteText("")
      setIsCameroonDmiPasteOpen(false)
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch (error) {
      setUploadError(
        getUploadErrorMessage(error, "Could not apply the Cameroon DMI report.")
      )
    } finally {
      setIsSavingCameroonDmiPaste(false)
    }
  }

  const fallbackTitleCountryName = countryIdFallbackName(activeCountryId)
  const fallbackTitle =
    fallbackTitleCountryName && period
      ? `${fallbackTitleCountryName} - ${formatPeriod(period)}`
      : fallbackTitleCountryName
  const title = country
    ? `${countryDisplayName || country.name} - ${record ? getMonthEndTitle(record) : "Month End"}`
    : fallbackTitle || "Country Records"
  const countryReportLabel = country
    ? `${countryDisplayName || country.name} Report`
    : "Country Report"
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
  const resolvedCountryReportRows = activeCountryId
    ? parseResolvedCountryReportRows(
        record?.checked[resolvedCountryReportRowsKey(activeCountryId)]
      )
    : []

  React.useEffect(() => {
    if (
      !record ||
      activeCountryId !== "frabemar-gabon" ||
      isMonthClosed ||
      databaseReconciliationSnapshot ||
      !records.length ||
      !countryReportRecords.length
    ) {
      return
    }

    let isCancelled = false

    async function saveGabonReconciliationState() {
      if (!record || !activeCountryId) {
        return
      }

      const latestRecord = (await getMonthEndRecord(record.period)) ?? record
      const approvalKey = rollApprovalKey(activeCountryId)
      const leaveKey = leftInvoiceKey(activeCountryId)
      const snapshotKey = reconciliationSnapshotKey(activeCountryId)
      const checked = { ...latestRecord.checked }
      const existingRolledInternalIds = parseApprovedInternalIds(
        checked[approvalKey]
      )
      const existingLeftRecordIds = parseApprovedInternalIds(checked[leaveKey])
      const latestResolvedRows = parseResolvedCountryReportRows(
        checked[resolvedCountryReportRowsKey(activeCountryId)]
      )
      const autoRolledInternalIds = Array.from(
        reconciliation.autoRolledMasterIds
      )
        .map((recordId) =>
          records.find((masterRecord) => masterRecord.id === recordId)
        )
        .map((masterRecord) => masterRecord?.sourceInternalId.trim() ?? "")
        .filter(Boolean)
      const autoLeftRecordIds = Array.from(
        reconciliation.autoLeftMasterIds
      ).flatMap((recordId) => {
        const masterRecord = records.find((record) => record.id === recordId)

        return masterRecord ? masterRecordApprovalIds(masterRecord) : []
      })
      const nextRolledInternalIds = Array.from(
        new Set([...existingRolledInternalIds, ...autoRolledInternalIds])
      )
      const nextLeftRecordIds = Array.from(
        new Set([...existingLeftRecordIds, ...autoLeftRecordIds])
      )
      const snapshot = makeReconciliationSnapshot({
        countryId: activeCountryId,
        period: latestRecord.period,
        reconciliation,
        rolledInternalIds: nextRolledInternalIds,
        leftInvoiceRecordIds: nextLeftRecordIds,
        resolvedCountryReportRows: latestResolvedRows,
      })
      const comparableSnapshot = reconciliationSnapshotComparable(snapshot)
      const existingComparableSnapshot = reconciliationSnapshotComparable(
        parseReconciliationSnapshot(checked[snapshotKey])
      )

      if (existingComparableSnapshot) {
        return
      }

      if (
        comparableSnapshot === existingComparableSnapshot &&
        approvedIdsMatch(checked[approvalKey], nextRolledInternalIds) &&
        approvedIdsMatch(checked[leaveKey], nextLeftRecordIds)
      ) {
        return
      }

      if (gabonReconciliationSaveRef.current === comparableSnapshot) {
        return
      }

      gabonReconciliationSaveRef.current = comparableSnapshot

      if (nextRolledInternalIds.length) {
        checked[approvalKey] = serializeApprovedInternalIds(
          nextRolledInternalIds
        )
      } else {
        delete checked[approvalKey]
      }

      if (nextLeftRecordIds.length) {
        checked[leaveKey] = serializeApprovedInternalIds(nextLeftRecordIds)
      } else {
        delete checked[leaveKey]
      }

      checked[snapshotKey] = JSON.stringify(snapshot)

      const updatedRecord = {
        ...latestRecord,
        checked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      await saveGabonSnapshotToDatabase(snapshot, updatedRecord)

      if (!isCancelled) {
        setRecord(updatedRecord)
        window.dispatchEvent(new Event("month-end:records-updated"))
      }
    }

    saveGabonReconciliationState().catch(() => {
      gabonReconciliationSaveRef.current = ""
    })

    return () => {
      isCancelled = true
    }
  }, [
    activeCountryId,
    countryReportRecords,
    databaseReconciliationSnapshot,
    isMonthClosed,
    reconciliation,
    record,
    records,
    saveGabonSnapshotToDatabase,
  ])

  const activeDashboardSection = activeCountryId
    ? parseCountryDashboardSection(
        record?.checked[countryDashboardSectionKey(activeCountryId)]
      )
    : "matched"
  const workflowCountryIds = linkedCountryIds.length
    ? linkedCountryIds
    : activeCountryId
      ? [activeCountryId]
      : []
  const isFrabemarChildCountry = Boolean(
    activeCountryId && FRABEMAR_CHILD_COUNTRY_IDS.includes(activeCountryId)
  )
  const isReconciliationComplete =
    workflowCountryIds.length > 0 &&
    workflowCountryIds.every(
      (linkedCountryId) =>
        record?.checked[monthEndTaskKey(linkedCountryId, "reconcile")] === true
    )
  const isInvoiceComplete =
    activeCountryId && country?.invoiceRequired === true
      ? record?.checked[monthEndTaskKey(activeCountryId, "invoice")] === true
      : false
  const activeCountryJournalComplete = activeCountryId
    ? record?.checked[monthEndTaskKey(activeCountryId, "journal")] === true
    : false
  const isFrabemarMasterJournalComplete =
    record?.checked[monthEndTaskKey(FRABEMAR_COUNTRY_ID, "journal")] === true
  const isJournalComplete =
    activeCountryJournalComplete ||
    ((activeCountryId === FRABEMAR_COUNTRY_ID || isFrabemarChildCountry) &&
      isFrabemarMasterJournalComplete)
  const shouldAutoOpenDashboard =
    isReconciliationComplete ||
    (activeCountryId === FRABEMAR_COUNTRY_ID && isJournalComplete) ||
    (isFrabemarChildCountry && isJournalComplete)
  const requestedView = view === "invoice" ? "journal" : view
  const resolvedView =
    requestedView === "auto"
      ? shouldAutoOpenDashboard
        ? "dashboard"
        : "reconciliation"
      : requestedView
  const shouldShowFrabemarPackage =
    activeCountryId === FRABEMAR_COUNTRY_ID &&
    (resolvedView === "journal" || !isReconciliationComplete)
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
    const countryTotal =
      item.id === "cameroon"
        ? parseStoredNumber(record?.checked[cameroonReportTotalKey(item.id)]) ||
          (journalTotalsByCountryId.get(item.id) ?? 0)
        : (journalTotalsByCountryId.get(item.id) ?? 0)
    const exchangeRateValue = record?.checked[exchangeRateKey(item.id)]
    const exchangeRate =
      item.id === "cameroon"
        ? 1.2
        : typeof exchangeRateValue === "number" &&
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
  const cameroonJournalEntry = journalEntries.find(
    (entry) => normalizeMatchKey(entry.countryName) === "cameroon"
  )
  const cameroonCommissionTotal =
    activeCountryId === "cameroon"
      ? countryReportRecords.reduce(
          (total, reportRecord) => total + (reportRecord.secondaryAmount ?? 0),
          0
        ) ||
        parseStoredNumber(
          record?.checked[cameroonCommissionTotalKey(activeCountryId)]
        )
      : 0
  const cameroonAdditionalJournalRows: JournalEntryRow[] =
    activeCountryId === "cameroon" &&
    cameroonJournalEntry &&
    cameroonCommissionTotal > 0
      ? [
          {
            account: "Income",
            debit: roundJournalAmount(cameroonCommissionTotal),
          },
          {
            account: "Accounts Payable",
            credit: roundJournalAmount(cameroonCommissionTotal),
          },
        ].filter((row) => (row.debit ?? row.credit ?? 0) > 0)
      : []
  const frabemarCountryConfig = FRABEMAR_CHILD_COUNTRIES.find(
    (item) => item.id === activeCountryId
  )
  const frabemarCountryJournalValues = activeCountryId
    ? parseFrabemarCountryJournalValues(
        record?.checked[frabemarCountryJournalValuesKey(activeCountryId)]
      )
    : undefined
  const frabemarExchangeRateValue =
    activeCountryId && frabemarCountryConfig
      ? record?.checked[exchangeRateKey(activeCountryId)]
      : undefined
  const frabemarExchangeRate =
    typeof frabemarExchangeRateValue === "number" &&
    Number.isFinite(frabemarExchangeRateValue) &&
    frabemarExchangeRateValue > 0
      ? frabemarExchangeRateValue
      : undefined
  const frabemarNetInvoiceAmount = frabemarCountryJournalValues
    ? roundJournalAmount(
        frabemarCountryJournalValues.invoiceTotal -
          frabemarCountryJournalValues.commission
      )
    : 0
  const frabemarConvertedNetInvoiceAmount = roundJournalAmount(
    frabemarNetInvoiceAmount * (frabemarExchangeRate ?? 0)
  )
  const frabemarJournalRows: JournalEntryRow[] =
    frabemarCountryConfig && frabemarCountryJournalValues
      ? [
          {
            account: "Income",
            debit: frabemarConvertedNetInvoiceAmount,
          },
          {
            account: "Accounts Payable",
            credit: frabemarConvertedNetInvoiceAmount,
            lineDescription: frabemarExchangeRate
              ? `${formatAmount(frabemarNetInvoiceAmount)} * ${formatFrabemarExchangeRate(frabemarExchangeRate)}`
              : undefined,
          },
        ]
      : []
  const congoInvoiceJournalValues =
    activeCountryId === "republic-of-congo"
      ? parseCongoInvoiceJournalValues(
          record?.checked[congoInvoiceJournalValuesKey(activeCountryId)]
        )
      : undefined
  const congoInvoicePaymentTotal = congoInvoiceJournalValues
    ? roundJournalAmount(
        congoInvoiceJournalValues.invoiceVisaPointsTotal -
          congoInvoiceJournalValues.invoiceCommission +
          congoInvoiceJournalValues.invoiceBankCharges
      )
    : 0
  const congoJournalRows: JournalEntryRow[] =
    congoInvoiceJournalValues && congoInvoiceJournalValues.visaUsed > 0
      ? [
          {
            account: "Prepaid Accounts : Republic of Congo",
            debit: congoInvoiceJournalValues.invoiceVisaPointsTotal,
          },
          {
            account: "Prepaid Accounts : Republic of Congo : Commission",
            credit: congoInvoiceJournalValues.invoiceCommission,
          },
          {
            account: "Bank Charges",
            debit: congoInvoiceJournalValues.invoiceBankCharges,
          },
          {
            account: "Accounts Payable",
            credit: congoInvoicePaymentTotal,
          },
          {
            account: "Prepaid Accounts : Republic of Congo",
            credit: congoInvoiceJournalValues.visaUsed,
          },
          {
            account: "Prepaid Accounts : Republic of Congo : Commission",
            debit: congoInvoiceJournalValues.visaUsedCommission,
          },
          {
            account: "Income",
            debit: congoInvoiceJournalValues.visaUsedIncome,
          },
          {
            account: "Chase Main Account",
            credit: congoInvoiceJournalValues.wireFee,
          },
          {
            account: "Bank Charges : Wire Fees",
            debit: congoInvoiceJournalValues.wireFee,
          },
        ]
      : []
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
  const activeJournalEntry =
    activeCountryId && activeCountryId !== "cameroon"
      ? parseJournalEntrySnapshot(
          record?.checked[journalEntrySnapshotKey(activeCountryId)]
        )
      : undefined
  const frabemarMasterJournalEntry = isFrabemarChildCountry
    ? parseJournalEntrySnapshot(
        record?.checked[journalEntrySnapshotKey(FRABEMAR_COUNTRY_ID)]
      )
    : undefined
  const savedJournalEntry = frabemarMasterJournalEntry ?? activeJournalEntry
  const displayedJournalEntries = savedJournalEntry?.entries ?? journalEntries
  const displayedAdditionalJournalRows =
    activeCountryId === "cameroon"
      ? cameroonAdditionalJournalRows
      : (savedJournalEntry?.additionalRows ?? [])
  const displayedSimpleJournalRows =
    activeCountryId === "republic-of-congo"
      ? congoJournalRows
      : (savedJournalEntry?.simpleRows ??
        (frabemarJournalRows.length ? frabemarJournalRows : []))
  const displayedJournalRows =
    savedJournalEntry?.rows ??
    (antaserJournalRows.length ? antaserJournalRows : [])
  const displayedSourceDocumentCount =
    savedJournalEntry?.sourceDocumentCount ??
    (antaserJournalRows.length ? antaserJournalDocuments.length : undefined)
  const frabemarPackageExchangeRateDisplay =
    FRABEMAR_CHILD_COUNTRY_IDS.map((childCountryId) => {
      const displayValue =
        record?.checked[exchangeRateDisplayKey(childCountryId)]
      const exchangeRateValue = record?.checked[exchangeRateKey(childCountryId)]

      return typeof displayValue === "string" && displayValue
        ? displayValue
        : typeof exchangeRateValue === "number" &&
            Number.isFinite(exchangeRateValue) &&
            exchangeRateValue > 0
          ? formatFrabemarExchangeRate(exchangeRateValue)
          : ""
    }).find(Boolean) ?? ""
  const activeInvoiceDocument = parseInvoiceDocument(
    record?.checked[invoiceDocumentKey(activeCountryId ?? "")]
  )
  const frabemarPackageDocument = parseFrabemarInvoicePackage(
    record?.checked[frabemarInvoicePackageKey()]
  )
  const shouldShowDashboardLoadingState =
    requestedView === "dashboard" ||
    (requestedView === "auto" && Boolean(activeCountryId))
  const showCountryHeaderControls = hasLoaded || shouldShowDashboardLoadingState
  const backHref = period
    ? `/month-end?period=${encodeURIComponent(period)}`
    : "/month-end"
  function goBackToMonthEnd() {
    const returnPoint = readMonthEndReturnPoint(period)
    const href = returnPoint?.period
      ? `/month-end?period=${encodeURIComponent(returnPoint.period)}`
      : backHref

    markMonthEndReturnIntent(returnPoint?.period ?? period)
    router.replace(href, { scroll: false })
  }

  const countryHeaderLeading = showCountryHeaderControls ? (
    <Button
      type="button"
      variant="outline"
      aria-label="Back to month end"
      onClick={goBackToMonthEnd}
    >
      <ArrowLeftIcon />
      Back
    </Button>
  ) : undefined
  const showCountryNavigation =
    showCountryHeaderControls && !shouldShowFrabemarPackage
  const countryHeaderMenu =
    showCountryHeaderControls && shouldShowFrabemarPackage
      ? frabemarPackageDocument && !isMonthClosed
        ? {
            label: "Frabemar invoice actions",
            disabled: isSavingFrabemarInvoices,
            itemLabel: "Clear Invoice and Reset",
            onClick: clearFrabemarInvoicePackage,
          }
        : undefined
      : resolvedView === "reconciliation" && !isMonthClosed
        ? {
            label: "More actions",
            itemLabel: isReconciliationComplete
              ? "Reopen Reconciliation"
              : "Clear Recon and Start Over",
            onClick: isReconciliationComplete
              ? reopenReconciliation
              : clearReconciliationAndStartOver,
          }
        : resolvedView === "journal" &&
            country?.invoiceRequired === true &&
            !isMonthClosed &&
            (isInvoiceComplete || Boolean(activeInvoiceDocument))
          ? {
              label: "Invoice actions",
              disabled: isUploadingInvoice,
              itemLabel: "Clear Invoice and Reset",
              onClick: clearInvoiceAndReset,
            }
          : undefined
  const countryHeaderActions = showCountryHeaderControls ? (
    <>
      {showCountryNavigation ? (
        <CountryNavigationButtons
          onPrevious={
            previousCountryHref
              ? () => router.push(previousCountryHref)
              : undefined
          }
          onNext={
            nextCountryHref ? () => router.push(nextCountryHref) : undefined
          }
        />
      ) : null}
      {countryHeaderMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <HeaderActionMenuTrigger
                label={countryHeaderMenu.label}
                disabled={countryHeaderMenu.disabled}
              />
            }
          />
          <DropdownMenuContent align="end" className="min-w-64">
            <DropdownMenuItem
              variant="destructive"
              onClick={countryHeaderMenu.onClick}
            >
              <ListChecksIcon />
              {countryHeaderMenu.itemLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  ) : undefined
  const showCountryProcessMenu =
    (hasLoaded || shouldShowDashboardLoadingState) &&
    (!shouldShowFrabemarPackage ||
      (Boolean(frabemarPackageDocument) && isReconciliationComplete))
  const countryProcessMenu = showCountryProcessMenu ? (
    <CountryProcessBreadcrumb
      activeView={
        shouldShowFrabemarPackage
          ? "journal"
          : shouldShowDashboardLoadingState
            ? "dashboard"
            : resolvedView
      }
      reconciliationHref={reconciliationReportHref}
      journalHref={journalEntryHref}
      dashboardHref={countryDashboardHref}
      hideReconciliation={
        shouldShowFrabemarPackage ||
        (resolvedView === "journal" && isFrabemarChildCountry)
      }
    />
  ) : undefined

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
          <SiteHeader
            title={title}
            leadingContent={countryHeaderLeading}
            actions={countryHeaderActions}
            bottomContent={countryProcessMenu}
          />
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
          <HiddenFileInput
            ref={invoiceInputRef}
            accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onFiles={uploadInvoiceFiles}
          />
          {uploadError || loadError ? (
            <div className="px-4 pt-4 lg:px-6">
              {uploadError ? (
                <p className="text-sm text-destructive">{uploadError}</p>
              ) : null}
              {loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : null}
            </div>
          ) : null}
          {!hasLoaded ? (
            shouldShowDashboardLoadingState || resolvedView === "dashboard" ? (
              <CountryDashboardSkeleton />
            ) : (
              <CountryReconciliationSkeleton />
            )
          ) : shouldShowFrabemarPackage ? (
            <FrabemarInvoicePackageStep
              packageDocument={frabemarPackageDocument}
              isReadOnly={isMonthClosed}
              isSaving={isSavingFrabemarInvoices}
              sharedExchangeRateDisplay={frabemarPackageExchangeRateDisplay}
              onSave={saveFrabemarInvoicePackage}
              onSaveSharedExchangeRate={saveFrabemarExchangeRateForPackage}
              onDownloadAllCommissionInvoices={
                downloadAllFrabemarCommissionInvoices
              }
              onMakeJournalEntries={makeFrabemarPackageJournalEntries}
            />
          ) : resolvedView === "dashboard" ? (
            <CountryReconciliationDashboard
              countryName={
                countryDisplayName || country?.name || "Unknown country"
              }
              masterRecords={records}
              reconciliation={displayedReconciliation}
              rolledInternalIds={rolledInternalIds}
              leftInvoiceRecordIds={leftInvoiceRecordIds}
              activeSection={activeDashboardSection}
              onActiveSectionChange={saveCountryDashboardSection}
            />
          ) : resolvedView === "journal" ? (
            country?.invoiceRequired === true && !isInvoiceComplete ? (
              <InvoiceUploadStep
                countryName={
                  countryDisplayName || country?.name || "Unknown country"
                }
                invoiceDocument={activeInvoiceDocument}
                isComplete={isInvoiceComplete}
                isReadOnly={isMonthClosed}
                isUploading={isUploadingInvoice}
                congoInvoiceValues={
                  activeCountryId === "republic-of-congo"
                    ? congoInvoiceJournalValues
                    : undefined
                }
                visaUsedValue={
                  activeCountryId === "republic-of-congo"
                    ? congoVisaUsedText
                    : undefined
                }
                onVisaUsedChange={
                  activeCountryId === "republic-of-congo"
                    ? setCongoVisaUsedText
                    : undefined
                }
                onSaveVisaUsed={
                  activeCountryId === "republic-of-congo"
                    ? saveCongoVisaUsed
                    : undefined
                }
                onChooseFile={openInvoiceFilePicker}
                onFiles={uploadInvoiceFiles}
                dashboardHref={countryDashboardHref}
              />
            ) : (
              <JournalEntryPreview
                countryName={
                  countryDisplayName || country?.name || "Unknown country"
                }
                entries={displayedJournalEntries}
                additionalRows={displayedAdditionalJournalRows}
                simpleRows={displayedSimpleJournalRows}
                journalRows={displayedJournalRows}
                sourceDocumentCount={displayedSourceDocumentCount}
                isReadOnly={isMonthClosed}
                pdfDownloadAction={
                  isFrabemarChildCountry
                    ? {
                        label: "Download PDF",
                        disabled:
                          !frabemarCountryConfig?.hasCommission ||
                          !frabemarCountryJournalValues?.commission ||
                          !frabemarCountryJournalValues.invoiceNumber,
                        onClick: () =>
                          activeCountryId
                            ? downloadFrabemarCommissionInvoice(activeCountryId)
                            : Promise.resolve(),
                      }
                    : undefined
                }
                exchangeRateEditor={
                  isFrabemarChildCountry
                    ? {
                        value: frabemarExchangeRate,
                        draft: frabemarExchangeRateText,
                        onDraftChange: (value) => {
                          setIsFrabemarExchangeRateNeedsAttention(false)
                          setFrabemarExchangeRateText(value)
                        },
                        onSave: saveFrabemarExchangeRate,
                      }
                    : undefined
                }
                exchangeRateNeedsAttention={
                  isFrabemarExchangeRateNeedsAttention
                }
                onExchangeRateAttentionHandled={() =>
                  setIsFrabemarExchangeRateNeedsAttention(false)
                }
                onMakeJournalEntry={makeJournalEntry}
              />
            )
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
              {isPasteReportOpen && !isMonthClosed ? (
                <Card className="max-h-[min(70vh,42rem)] overflow-hidden rounded-lg py-0 shadow-sm">
                  <CardContent className="flex max-h-[min(70vh,42rem)] min-h-0 flex-col gap-3 p-3">
                    <Textarea
                      ref={pasteReportTextareaRef}
                      value={pastedReportText}
                      onChange={(event) => {
                        setPastedReportText(event.target.value)
                        if (shouldScrollPastedReportRef.current) {
                          shouldScrollPastedReportRef.current = false
                          keepPasteReportControlsReachable()
                        }
                      }}
                      onPaste={() => {
                        shouldScrollPastedReportRef.current = true
                      }}
                      placeholder="Paste report data"
                      className="[field-sizing:fixed] min-h-48 flex-1 resize-none overflow-auto rounded-lg font-mono text-sm"
                    />
                    <div
                      ref={pasteReportActionsRef}
                      className="-mx-3 -mb-3 flex shrink-0 justify-end gap-2 border-t bg-card px-3 py-3"
                    >
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

              {isCameroonDmiPasteOpen && !isMonthClosed ? (
                <Card className="max-h-[min(70vh,42rem)] overflow-hidden rounded-lg py-0 shadow-sm">
                  <CardContent className="flex max-h-[min(70vh,42rem)] min-h-0 flex-col gap-3 p-3">
                    <Textarea
                      value={cameroonDmiPasteText}
                      onChange={(event) =>
                        setCameroonDmiPasteText(event.target.value)
                      }
                      placeholder="Paste Cameroon DMI report data"
                      className="[field-sizing:fixed] min-h-48 flex-1 resize-none overflow-auto rounded-lg font-mono text-sm"
                    />
                    <div className="-mx-3 -mb-3 flex shrink-0 justify-end gap-2 border-t bg-card px-3 py-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCameroonDmiPasteOpen(false)
                          setCameroonDmiPasteText("")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveCameroonDmiPaste}
                        disabled={
                          !cameroonDmiPasteText.trim() ||
                          isSavingCameroonDmiPaste
                        }
                      >
                        <ClipboardPasteIcon />
                        Apply DMI
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {!hasLoaded ? (
                <CountryReconciliationSkeleton />
              ) : requiresCountryReport &&
                !hasCountryReport &&
                !isMonthClosed ? (
                <CountryReportUploadStep
                  countryReportLabel={countryReportLabel}
                  masterCount={records.length}
                  isUploading={isUploadingCountryReport}
                  canPasteReport={canPasteReport}
                  isAntaserPackage={activeCountryId?.startsWith("antaser")}
                  onChooseFile={openCountryReportFilePicker}
                  onPasteReport={() => {
                    if (!isMonthClosed) {
                      setIsPasteReportOpen(true)
                    }
                  }}
                  onFiles={uploadCountryReports}
                />
              ) : requiresCountryReport && !hasCountryReport ? (
                <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                  Reopen this month to upload a country report.
                </div>
              ) : hasCountryReport || hasMasterRecords ? (
                <ReconciliationWorkbench
                  countryRecords={countryReportRecords}
                  masterRecords={sortedRecords}
                  matchedRecords={displayedReconciliation.matched}
                  missingCountryRecordIds={missingCountryRecordIds}
                  missingMasterRecordIds={missingMasterRecordIds}
                  rolledInternalIds={rolledInternalIds}
                  leftInvoiceRecordIds={leftInvoiceRecordIds}
                  resolvedCountryReportRows={resolvedCountryReportRows}
                  showCountryColumn={showCountryColumn}
                  onDropMasterFile={uploadMasterFile}
                  onDropCountryFiles={uploadCountryReports}
                  canEditCountryData={requiresCountryReport}
                  isReadOnly={isReconciliationComplete || isMonthClosed}
                  canUnreconcile={!isReconciliationComplete && !isMonthClosed}
                  showOnlyMatched={isReconciliationComplete}
                  countryId={activeCountryId}
                  countryName={
                    countryDisplayName || country?.name || "Unknown country"
                  }
                  countryRecordCount={countryReportRecords.length}
                  masterRecordCount={
                    records.length -
                    displayedReconciliation.linkedMasterRecordIds.size
                  }
                  matchedCountryCount={reconciliationCounts.country}
                  matchedMasterCount={reconciliationCounts.master}
                  onRollInvoices={rollInvoices}
                  onLeaveInvoices={leaveInvoices}
                  onReconcileSelectedPair={reconcileSelectedPair}
                  onReconcileCountryRows={reconcileCountryRows}
                  onUnreconcileMatchedRows={unreconcileMatchedRows}
                  onPasteDmiReport={
                    activeCountryId === "cameroon" &&
                    hasCountryReport &&
                    !isMonthClosed
                      ? () => setIsCameroonDmiPasteOpen(true)
                      : undefined
                  }
                  onProceed={proceedFromReconciliation}
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
