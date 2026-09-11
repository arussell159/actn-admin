"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  Building2Icon,
  CheckIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  DownloadIcon,
  FileCheck2Icon,
  FileTextIcon,
  HistoryIcon,
  ListTodoIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UploadIcon,
  UserRoundCheckIcon,
  XIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { MonthEndValueByDayChart } from "@/components/month-end-dashboard-charts"
import { SectionNavigation } from "@/components/section-navigation"
import { PageFrame } from "@/components/page-frame"
import { CountryTableFilters } from "@/components/country-table-filters"
import { HeaderActionMenuTrigger } from "@/components/header-action-menu-trigger"
import {
  MonthEndDashboardSkeleton,
  PreviousMonthEndsSkeleton,
} from "@/components/page-skeletons"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox"
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
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  ensureMonthEndRecord,
  formatPeriod,
  loadMonthEndRecords,
  listMonthEndRecords,
  monthEndRecordsStorageKey,
  saveMonthEndRecord,
  type MonthEndValue,
  type MonthEndRecord,
} from "@/lib/month-end-db"
import {
  getMasterTransactionDateCheckedValues,
  getMasterCustomerNamesCheckedValue,
  getMasterAnalyticsRecordsCheckedValue,
  isMasterCsv,
  listMonthEndMasterRecords,
  masterTransactionDatesKey,
  masterCustomerNamesKey,
  masterAnalyticsRecordsKey,
  parseMonthEndMasterCsv,
  parseMappedCountryMasterCsv,
  parseCountryMasterCsv,
  saveMonthEndMasterRecords,
  type MonthEndMasterRecord,
} from "@/lib/month-end-master-records"
import { monthEndCountryHref } from "@/lib/month-end-country-route"
import { extractWorkbookRows } from "@/lib/country-report-import"
import {
  getMonthEndTemplate,
  isDefaultMasterReportMapping,
  loadMonthEndTemplate,
  workflowTasks,
  type CloseTaskId,
  type MonthEndTemplate,
  type TemplateCountryRow,
} from "@/lib/month-end-template"
import {
  createRollInvoicesCsv,
  listApprovedInternalIds,
} from "@/lib/month-end-roll-invoices"
import {
  consumeMonthEndReturnIntent,
  hasMonthEndReturnIntent,
  readMonthEndReturnRecord,
  readMonthEndReturnPoint,
  saveMonthEndReturnRecord,
  saveMonthEndReturnPoint,
} from "@/lib/month-end-return-point"
import { createClient } from "@/lib/client"
import { simpleMapAfricaPaths } from "@/lib/simplemap-africa-paths"
import { cn } from "@/lib/utils"

const workflowTaskIcons: Record<CloseTaskId, React.ElementType> = {
  invoice: FileTextIcon,
  reconcile: ClipboardCheckIcon,
  journal: Building2Icon,
}

const dashboardHandoffNoteKey = "__dashboard_handoff_note"
const dashboardHandoffUpdatedAtKey = "__dashboard_handoff_updated_at"
const dashboardHandoffCompleteKey = "__dashboard_handoff_complete"
const dashboardHandoffAuthorKey = "__dashboard_handoff_author"
const topCustomerSortOptions = ["Most Invoices", "Highest Value"] as const
const countryMoverSortOptions = ["Invoice Swing", "Value Swing"] as const

function noteCompleteKey(rowId: string) {
  return `${rowId}__note_complete`
}

type MonthEndSectionId = "dashboard" | "countries" | "tasks" | string
type CountryTableFilterId = "all" | "not-reconciled" | "missing-invoice"
type DashboardMetricDetailId =
  "countries" | "invoices" | "shared-tasks" | "customers" | "comments"
type CountryHeatMapDetail = {
  name: string
  tasks: Array<{ id: string; label: string; isComplete: boolean }>
}

const monthEndCountryRowIdByCode: Record<string, string | undefined> = {
  AO: "angola",
  BJ: "benin",
  BF: "burkina-faso",
  CM: "cameroon",
  TD: "foremost-chad",
  CD: "frabemar-dr-congo",
  GA: "frabemar-gabon",
  ML: "frabemar-mali",
  GN: "frabemar-republic-of-guinea",
  LR: "gtms-liberia",
  CI: "ivory-coast",
  MG: "madagascar",
  CG: "republic-of-congo",
  DJ: "sck-djibouti",
  KE: "sck-kenya",
  SL: "sck-sierra-leone",
  SO: "sck-somalia",
  SD: "sck-sudan",
  YE: "sck-yemen",
  SN: "senegal",
  NE: "antaser",
  CF: "antaser",
  GW: "antaser",
  TG: "antaser-afrique",
  BI: "antaser-afrique",
  GQ: "antaser-afrique",
  SS: "antaser-afrique",
}

const monthEndCountryCodesByGroupedRowId: Record<string, readonly string[]> = {
  antaser: ["NE", "CF", "GW"],
  "antaser-oot": ["NE", "CF", "GW"],
  "antaser-afrique": ["TG", "BI", "GQ", "SS"],
  "antaser-afrique-oot": ["TG", "BI", "GQ", "SS"],
}

const countryTableFilterOptions: Array<{
  id: CountryTableFilterId
  label: string
  mobileLabel?: string
}> = [
  { id: "all", label: "All" },
  {
    id: "not-reconciled",
    label: "Not Reconciled",
    mobileLabel: "Not Recon",
  },
  {
    id: "missing-invoice",
    label: "Missing Invoice",
    mobileLabel: "No Invoice",
  },
]

function taskKey(scope: string, taskId: string) {
  return `${scope}__${taskId}`
}

function noteKey(rowId: string) {
  return `${rowId}__note`
}

function noteUpdatedAtKey(rowId: string) {
  return `${rowId}__note_updated_at`
}

function noteAuthorKey(rowId: string) {
  return `${rowId}__note_author`
}

function userDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}) {
  const metadataName = [
    user.user_metadata?.full_name,
    user.user_metadata?.display_name,
    user.user_metadata?.name,
  ].find((value): value is string =>
    Boolean(typeof value === "string" && value.trim())
  )

  if (metadataName) return metadataName.trim()
  if (user.email === "local-development@africactn.invalid") {
    return "Alex Russell"
  }

  const emailName = user.email
    ?.split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim()
  return emailName
    ? emailName.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Africa CTN User"
}

function formatNoteTimestamp(value: string) {
  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return "Earlier"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp)
}

type InvoiceSummary = {
  name: string
  invoiceCount: number
  amount: number
}

function invoiceIdentity(record: MonthEndMasterRecord) {
  return (
    record.sourceInternalId ||
    record.salesOrderNumber ||
    record.billOfLadingNumber ||
    record.id
  )
}

function customerDisplayName(value: string) {
  return value.replace(/^\d+(?::\d+)?\s+/, "").trim()
}

function summarizeInvoices(
  records: MonthEndMasterRecord[],
  nameForRecord: (record: MonthEndMasterRecord) => string,
  deduplicate = false
) {
  const summaries = new Map<string, InvoiceSummary>()
  const seenInvoices = new Set<string>()

  for (const record of records) {
    const name = nameForRecord(record).trim()
    const invoiceId = invoiceIdentity(record)

    if (!name || (deduplicate && seenInvoices.has(invoiceId))) continue
    if (deduplicate) seenInvoices.add(invoiceId)

    const summary = summaries.get(name) ?? {
      name,
      invoiceCount: 0,
      amount: 0,
    }
    summary.invoiceCount += 1
    summary.amount += record.amount
    summaries.set(name, summary)
  }

  return Array.from(summaries.values()).sort(
    (first, second) =>
      second.amount - first.amount ||
      second.invoiceCount - first.invoiceCount ||
      first.name.localeCompare(second.name)
  )
}

function formatDashboardCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function transactionDayInPeriod(value: string | undefined, period: string) {
  const trimmedValue = value?.trim()
  if (!trimmedValue) return undefined

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const recordPeriod = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}`
    return recordPeriod === period ? Number(isoMatch[3]) : undefined
  }

  const parsedDate = new Date(trimmedValue)
  if (Number.isNaN(parsedDate.getTime())) return undefined

  const recordPeriod = `${parsedDate.getFullYear()}-${String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0")}`
  return recordPeriod === period ? parsedDate.getDate() : undefined
}

function readMasterCustomerNames(value: MonthEndValue | undefined) {
  if (typeof value !== "string" || !value) return new Map<string, string>()

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return new Map(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
  } catch {
    return new Map<string, string>()
  }
}

function readMasterAnalyticsRecords(value: MonthEndValue | undefined) {
  if (typeof value !== "string" || !value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as MonthEndMasterRecord[]) : []
  } catch {
    return []
  }
}

function masterSourceFileNameKey(rowId: string) {
  return `${rowId}__master_source_file`
}

function countryRecordHref(
  period: string,
  countryId: string,
  row?: TemplateCountryRow,
  checked?: Record<string, unknown>
) {
  return monthEndCountryHref({ period, countryId, row, checked })
}

function getMonthEndScrollY() {
  if (typeof window === "undefined") {
    return 0
  }

  const sidebarInset = document.querySelector<HTMLElement>(
    "[data-slot='sidebar-inset']"
  )

  if (window.matchMedia("(max-width: 767px)").matches) {
    return sidebarInset?.scrollTop ?? 0
  }

  const documentScrollY = document.scrollingElement?.scrollTop ?? window.scrollY

  return Math.max(window.scrollY, documentScrollY, sidebarInset?.scrollTop ?? 0)
}

function restoreMonthEndScrollY(scrollY: number) {
  const isMobile = window.matchMedia("(max-width: 767px)").matches
  const outerScrollY = isMobile ? 0 : scrollY

  window.scrollTo({ top: outerScrollY, left: 0, behavior: "instant" })
  document.scrollingElement?.scrollTo({
    top: outerScrollY,
    left: 0,
    behavior: "instant",
  })
  document
    .querySelectorAll<HTMLElement>("[data-slot='sidebar-inset']")
    .forEach((element) => {
      element.scrollTo({ top: scrollY, left: 0, behavior: "instant" })
    })
}

function asBool(value: unknown) {
  return value === true
}

function asString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function exchangeRateDisplayKey(rowId: string) {
  return `${rowId}__exchange_rate_display`
}

function parseExchangeRate(value: string) {
  const normalizedValue = value.trim().replace(",", ".")

  if (!/^\d+(?:\.\d{1,4})?$/.test(normalizedValue)) {
    return undefined
  }

  const exchangeRate = Number(normalizedValue)

  return Number.isFinite(exchangeRate) && exchangeRate > 0
    ? exchangeRate
    : undefined
}

function formatExchangeRate(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    useGrouping: false,
  })
}

function MonthEndMetricCard({
  title,
  value,
  icon: Icon,
  progress,
  caption,
  stats,
  iconActionLabel,
  onIconActivate,
  iconActionDisabled = false,
  isActive = false,
  onActivate,
  expandedContent,
}: {
  title: string
  value: string
  icon: React.ElementType
  progress?: number
  caption?: string
  stats?: Array<{ label: string; value: string }>
  iconActionLabel?: string
  onIconActivate?: () => void
  iconActionDisabled?: boolean
  isActive?: boolean
  onActivate?: () => void
  expandedContent?: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "relative gap-0 py-0 shadow-sm transition-colors",
        onActivate && "hover:bg-muted/40",
        isActive && "bg-muted/20 ring-primary/40",
        isActive && expandedContent && "sm:col-span-2 md:col-span-1"
      )}
    >
      {onIconActivate && iconActionLabel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute top-3 right-3 z-10 bg-background"
          disabled={iconActionDisabled}
          onClick={onIconActivate}
        >
          <Icon />
          {iconActionLabel}
        </Button>
      ) : null}
      <div
        className={cn(
          "grid gap-3 py-4 text-left",
          onActivate &&
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        )}
        role={onActivate ? "button" : undefined}
        tabIndex={onActivate ? 0 : undefined}
        aria-label={
          onActivate
            ? `${title}: ${
                stats
                  ?.map((stat) => `${stat.value} ${stat.label}`)
                  .join(", ") ?? `${value}${caption ? `, ${caption}` : ""}`
              }`
            : undefined
        }
        aria-expanded={onActivate ? isActive : undefined}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (!onActivate || (event.key !== "Enter" && event.key !== " ")) {
            return
          }

          event.preventDefault()
          onActivate()
        }}
      >
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between px-4",
            onIconActivate && iconActionLabel && "pr-24"
          )}
        >
          <CardDescription className="font-medium text-foreground">
            {title}
          </CardDescription>
          {!onIconActivate ? (
            <Icon className="size-4 text-muted-foreground" />
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 px-4">
          {stats?.length ? (
            <div className="grid grid-cols-2 divide-x">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="grid gap-0.5 px-3 first:pl-0 last:pr-0"
                >
                  <span className="text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              {caption ? (
                <div className="text-xs text-muted-foreground">{caption}</div>
              ) : null}
            </>
          )}
          {progress !== undefined ? (
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </CardContent>
      </div>
      {isActive && expandedContent ? (
        <div className="border-t md:hidden [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:shadow-none [&>[data-slot=card]]:ring-0">
          {expandedContent}
        </div>
      ) : null}
    </Card>
  )
}

function MonthEndCountryHeatMap({
  progressByCountry,
  detailsByCountry,
  selectedCountryId,
  highlightedCountryId,
  onSelectCountry,
  onHighlightCountry,
  className,
}: {
  progressByCountry: Map<string, { done: number; total: number }>
  detailsByCountry: Map<string, CountryHeatMapDetail>
  selectedCountryId?: string
  highlightedCountryId?: string
  onSelectCountry: (countryId: string) => void
  onHighlightCountry: (countryId?: string) => void
  className?: string
}) {
  const [hoveredCountry, setHoveredCountry] = React.useState<{
    code: string
    countryId?: string
    name: string
    x: number
    y: number
  } | null>(null)
  const highlightedCountryCodes = hoveredCountry
    ? [hoveredCountry.code]
    : highlightedCountryId
      ? (monthEndCountryCodesByGroupedRowId[highlightedCountryId] ??
        Object.entries(monthEndCountryRowIdByCode)
          .filter(([, countryId]) => countryId === highlightedCountryId)
          .map(([code]) => code))
      : []
  const highlightedCountryPaths = simpleMapAfricaPaths.filter((country) =>
    highlightedCountryCodes.includes(country.code)
  )

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="845 245 500 490"
        role="img"
        aria-label="Month-end country completion heat map"
        className="h-full w-full"
        onPointerLeave={() => {
          setHoveredCountry(null)
          onHighlightCountry()
        }}
      >
        {simpleMapAfricaPaths.map((country) => {
          const countryId = monthEndCountryRowIdByCode[country.code]
          const progress = countryId
            ? progressByCountry.get(countryId)
            : undefined
          const isComplete =
            progress && progress.total > 0 && progress.done === progress.total
          const isInProgress = progress && progress.done > 0 && !isComplete
          const isSelected = countryId === selectedCountryId
          const isHovered = hoveredCountry?.code === country.code

          return (
            <path
              key={country.code}
              d={country.path}
              className={cn(
                "stroke-background transition-[filter,opacity] dark:stroke-background",
                isComplete
                  ? "fill-primary dark:fill-primary"
                  : !progress
                    ? "fill-primary dark:fill-primary"
                    : isInProgress
                      ? "fill-primary/55 dark:fill-primary/60"
                      : "fill-primary/25 dark:fill-primary/30",
                countryId && "cursor-pointer",
                isSelected && !isHovered && "brightness-75 saturate-150"
              )}
              strokeWidth="1.5"
              onPointerMove={(event) => {
                const bounds =
                  event.currentTarget.ownerSVGElement?.getBoundingClientRect()

                if (!bounds) {
                  return
                }

                setHoveredCountry({
                  code: country.code,
                  countryId,
                  name: country.name,
                  x: Math.max(
                    8,
                    Math.min(
                      event.clientX - bounds.left + 12,
                      Math.max(8, bounds.width - 228)
                    )
                  ),
                  y: Math.max(
                    8,
                    Math.min(
                      event.clientY - bounds.top + 12,
                      Math.max(8, bounds.height - 150)
                    )
                  ),
                })
                onHighlightCountry(countryId)
              }}
              onClick={(event) => {
                if (!countryId) {
                  return
                }

                event.stopPropagation()
                onSelectCountry(countryId)
              }}
            />
          )
        })}
        {highlightedCountryPaths.length ? (
          <g className="pointer-events-none">
            {highlightedCountryPaths.map((country) => (
              <React.Fragment key={country.code}>
                <path
                  d={country.path}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="9"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.95"
                  style={{ filter: "blur(4px)" }}
                />
                <path
                  d={country.path}
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      "drop-shadow(0 0 3px white) drop-shadow(0 0 7px #3b82f6)",
                  }}
                />
              </React.Fragment>
            ))}
          </g>
        ) : null}
      </svg>
      {hoveredCountry ? (
        <div
          className="pointer-events-none absolute z-20 grid w-55 gap-2 rounded-lg border border-border/60 bg-popover/95 p-3 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
          style={{ left: hoveredCountry.x, top: hoveredCountry.y }}
        >
          <div>
            <div className="font-semibold">{hoveredCountry.name}</div>
            {hoveredCountry.countryId &&
            detailsByCountry.get(hoveredCountry.countryId)?.name &&
            detailsByCountry.get(hoveredCountry.countryId)?.name !==
              hoveredCountry.name ? (
              <div className="text-xs text-muted-foreground">
                {detailsByCountry.get(hoveredCountry.countryId)?.name}
              </div>
            ) : null}
          </div>
          {hoveredCountry.countryId &&
          detailsByCountry.get(hoveredCountry.countryId)?.tasks.length ? (
            <div className="grid gap-1.5">
              {detailsByCountry
                .get(hoveredCountry.countryId)!
                .tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-muted-foreground">{task.label}</span>
                    <span
                      className={cn(
                        "font-medium",
                        task.isComplete
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      )}
                    >
                      {task.isComplete ? "Complete" : "Open"}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Not included in this month end
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

function MonthEndSectionNavigation({
  items,
  activeSection,
  onActiveSectionChange,
}: {
  items: { id: MonthEndSectionId; label: string }[]
  activeSection: MonthEndSectionId
  onActiveSectionChange: (section: MonthEndSectionId) => void
}) {
  return (
    <SectionNavigation
      items={items}
      value={activeSection}
      onValueChange={onActiveSectionChange}
      label="Month end sections"
      panelId="month-end-section"
    />
  )
}

function MonthEndTaskGroupsList({
  groups,
  checked,
  updateTask,
  isReadOnly = false,
}: {
  groups: Array<{
    id: string
    title: string
    tasks: Array<{ id: string; label: string; key?: string }>
  }>
  checked: Record<string, MonthEndValue>
  updateTask: (key: string, value: boolean) => void
  isReadOnly?: boolean
}) {
  const columns: [typeof groups, typeof groups] = [[], []]
  const columnWeights = [0, 0]

  for (const group of groups) {
    const columnIndex = columnWeights[0] <= columnWeights[1] ? 0 : 1
    columns[columnIndex].push(group)
    columnWeights[columnIndex] +=
      2 +
      group.tasks.reduce(
        (height, task) =>
          height + Math.max(1, Math.ceil(task.label.length / 55)),
        0
      )
  }

  return (
    <div className="grid max-w-5xl items-start gap-5 md:grid-cols-2">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="grid gap-5">
          {column.map((group) => (
            <Card
              key={group.id}
              data-task-group={group.id}
              className={cn(
                "gap-0 py-0 shadow-none",
                group.tasks.length > 0 &&
                  group.tasks.every((task) =>
                    asBool(checked[task.key ?? taskKey(group.id, task.id)])
                  ) &&
                  "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-50"
              )}
            >
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-lg">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-0 px-0">
                {group.tasks.map((task, taskIndex) => {
                  const key = task.key ?? taskKey(group.id, task.id)

                  return (
                    <label
                      key={task.id}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm font-medium hover:bg-muted/60",
                        taskIndex > 0 && "border-t",
                        asBool(checked[key]) &&
                          "bg-emerald-100 hover:bg-emerald-100/80 dark:bg-emerald-900/35 dark:hover:bg-emerald-900/45"
                      )}
                    >
                      <span className="min-w-0 flex-1">{task.label}</span>
                      <Checkbox
                        checked={asBool(checked[key])}
                        disabled={isReadOnly}
                        onCheckedChange={(value) =>
                          updateTask(key, value === true)
                        }
                      />
                    </label>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

async function reportFileToCsvText(file: File, period?: string) {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "xlsx" || extension === "xls") {
    return extractWorkbookRows(file, { period })
  }

  return file.text()
}

export function MonthEndView({ period }: { period?: string } = {}) {
  const router = useRouter()
  const [initialReturnState] = React.useState(() => {
    if (!hasMonthEndReturnIntent(period)) {
      return {}
    }

    return {
      point: readMonthEndReturnPoint(period),
      record: readMonthEndReturnRecord(period),
    }
  })
  const initialReturnPoint = initialReturnState.point
  const initialReturnRecord = initialReturnState.record
  const [template, setTemplate] =
    React.useState<MonthEndTemplate>(loadMonthEndTemplate)
  const [record, setRecord] = React.useState<MonthEndRecord | null>(
    initialReturnRecord ?? null
  )
  const recordRef = React.useRef<MonthEndRecord | null>(
    initialReturnRecord ?? null
  )
  const [checked, setChecked] = React.useState<Record<string, MonthEndValue>>(
    initialReturnRecord?.checked ?? {}
  )
  const [editingNoteRowId, setEditingNoteRowId] = React.useState<string | null>(
    null
  )
  const [noteDraft, setNoteDraft] = React.useState("")
  const [dashboardHandoffDraft, setDashboardHandoffDraft] = React.useState("")
  const [currentUserName, setCurrentUserName] =
    React.useState("Africa CTN User")
  const [isSavingDashboardHandoff, setIsSavingDashboardHandoff] =
    React.useState(false)
  const [dashboardHandoffSaveError, setDashboardHandoffSaveError] =
    React.useState("")
  const [isDashboardCommentDialogOpen, setIsDashboardCommentDialogOpen] =
    React.useState(false)
  const [editingExchangeRateRowId, setEditingExchangeRateRowId] =
    React.useState<string | null>(null)
  const [exchangeRateDraft, setExchangeRateDraft] = React.useState("")
  const [activeMonthEndSection, setActiveMonthEndSection] =
    React.useState<MonthEndSectionId>(
      initialReturnPoint?.activeSection ?? "dashboard"
    )
  const [activeDashboardMetric, setActiveDashboardMetric] =
    React.useState<DashboardMetricDetailId | null>(null)
  const [showAllTopCustomers, setShowAllTopCustomers] = React.useState(false)
  const [showAllCountryMovers, setShowAllCountryMovers] = React.useState(false)
  const [topCustomerSort, setTopCustomerSort] =
    React.useState<(typeof topCustomerSortOptions)[number]>("Most Invoices")
  const [countryMoverSort, setCountryMoverSort] =
    React.useState<(typeof countryMoverSortOptions)[number]>("Invoice Swing")
  const [selectedDashboardCountryId, setSelectedDashboardCountryId] =
    React.useState("")
  const [highlightedDashboardCountryId, setHighlightedDashboardCountryId] =
    React.useState("")
  const [countryDetailViewportHeight, setCountryDetailViewportHeight] =
    React.useState<number>()
  const [countrySearchQuery, setCountrySearchQuery] = React.useState(
    initialReturnPoint?.countrySearchQuery ?? ""
  )
  const [countryTableFilter, setCountryTableFilter] =
    React.useState<CountryTableFilterId>(
      initialReturnPoint?.countryTableFilter === "not-reconciled" ||
        initialReturnPoint?.countryTableFilter === "missing-invoice"
        ? initialReturnPoint.countryTableFilter
        : "all"
    )
  const [masterUploadMessage, setMasterUploadMessage] = React.useState("")
  const [isUploadingMasterSheet, setIsUploadingMasterSheet] =
    React.useState(false)
  const [showCloseMonthConfirm, setShowCloseMonthConfirm] =
    React.useState(false)
  const [showReopenMonthConfirm, setShowReopenMonthConfirm] =
    React.useState(false)
  const [hasLoaded, setHasLoaded] = React.useState(Boolean(initialReturnRecord))
  const [loadError, setLoadError] = React.useState("")
  const [loadRetryNonce, setLoadRetryNonce] = React.useState(0)
  const [recordSaveError, setRecordSaveError] = React.useState("")
  const [saveRetryNonce, setSaveRetryNonce] = React.useState(0)
  const [masterAnalyticsRecords, setMasterAnalyticsRecords] = React.useState<
    MonthEndMasterRecord[]
  >([])
  const [previousMasterAnalyticsRecords, setPreviousMasterAnalyticsRecords] =
    React.useState<MonthEndMasterRecord[]>([])
  const [previousAnalyticsChecked, setPreviousAnalyticsChecked] =
    React.useState<Record<string, MonthEndValue>>({})
  const [masterAnalyticsRefreshNonce, setMasterAnalyticsRefreshNonce] =
    React.useState(0)
  const masterUploadInputRef = React.useRef<HTMLInputElement>(null)
  const pendingReturnScrollYRef = React.useRef<number | null>(
    initialReturnPoint?.scrollY ?? null
  )

  React.useEffect(() => {
    let isMounted = true

    async function loadCurrentUserName() {
      const response = await createClient().auth.getUser()

      if (isMounted && response.data.user) {
        setCurrentUserName(userDisplayName(response.data.user))
      }
    }

    void loadCurrentUserName()

    return () => {
      isMounted = false
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    async function loadMasterAnalytics() {
      if (!record?.id || !record.period) {
        if (isMounted) {
          setMasterAnalyticsRecords([])
          setPreviousMasterAnalyticsRecords([])
          setPreviousAnalyticsChecked({})
        }
        return
      }

      const monthEnds = await listMonthEndRecords()
      const previousMonthEnd = monthEnds
        .filter((item) => item.period < record.period)
        .sort((first, second) => second.period.localeCompare(first.period))[0]
      const [currentRecords, previousRecords] = await Promise.all([
        listMonthEndMasterRecords({ monthEndId: record.id }),
        previousMonthEnd
          ? listMonthEndMasterRecords({ monthEndId: previousMonthEnd.id })
          : Promise.resolve([]),
      ])

      if (isMounted) {
        setMasterAnalyticsRecords(currentRecords)
        setPreviousMasterAnalyticsRecords(previousRecords)
        setPreviousAnalyticsChecked(previousMonthEnd?.checked ?? {})
      }
    }

    void loadMasterAnalytics().catch(() => {
      if (isMounted) {
        setMasterAnalyticsRecords([])
        setPreviousMasterAnalyticsRecords([])
        setPreviousAnalyticsChecked({})
      }
    })

    return () => {
      isMounted = false
    }
  }, [masterAnalyticsRefreshNonce, record?.id, record?.period])

  React.useEffect(() => {
    if (activeDashboardMetric !== "countries") {
      setCountryDetailViewportHeight(undefined)
      return
    }

    const updateHeight = () => {
      const visibleCountryDetail = Array.from(
        document.querySelectorAll<HTMLElement>("[data-country-detail]")
      ).find((element) => element.getClientRects().length > 0)
      const cardTop = visibleCountryDetail?.getBoundingClientRect().top

      if (cardTop === undefined) {
        return
      }

      setCountryDetailViewportHeight(
        Math.max(320, Math.floor(window.innerHeight - cardTop - 16))
      )
    }
    const frame = window.requestAnimationFrame(updateHeight)

    window.addEventListener("resize", updateHeight)
    window.visualViewport?.addEventListener("resize", updateHeight)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updateHeight)
      window.visualViewport?.removeEventListener("resize", updateHeight)
    }
  }, [activeDashboardMetric])

  React.useEffect(() => {
    let isMounted = true
    const syncTemplate = async () => {
      const activeTemplate = await getMonthEndTemplate()

      if (isMounted) {
        setTemplate(activeTemplate)
      }
    }

    syncTemplate()
    window.addEventListener("month-end:template-updated", syncTemplate)

    return () => {
      isMounted = false
      window.removeEventListener("month-end:template-updated", syncTemplate)
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    async function loadRecord() {
      if (!initialReturnRecord) {
        setHasLoaded(false)

        const cachedRecords = loadMonthEndRecords()
        const cachedRecord = period
          ? cachedRecords.find((monthEnd) => monthEnd.period === period)
          : cachedRecords.find((monthEnd) => monthEnd.status === "Open")

        if (cachedRecord && isMounted) {
          recordRef.current = cachedRecord
          setRecord(cachedRecord)
          setChecked(cachedRecord.checked)
          setHasLoaded(true)
        }
      }

      try {
        setLoadError("")
        const activeRecord = period
          ? await ensureMonthEndRecord(period)
          : undefined
        const monthEndRecords = period ? [] : await listMonthEndRecords()
        const openRecord =
          activeRecord ??
          monthEndRecords.find((monthEnd) => monthEnd.status === "Open") ??
          null

        if (isMounted) {
          const returnPeriod = openRecord?.period ?? period
          const returnPoint = consumeMonthEndReturnIntent(returnPeriod)
            ? readMonthEndReturnPoint(returnPeriod)
            : undefined

          if (returnPoint?.activeSection) {
            setActiveMonthEndSection(returnPoint.activeSection)
          }

          if (!initialReturnPoint) {
            pendingReturnScrollYRef.current = returnPoint?.scrollY ?? null
          }
          recordRef.current = openRecord
          setRecord(openRecord)
          setChecked(openRecord?.checked ?? {})
          setDashboardHandoffDraft("")
        }
      } catch (error) {
        if (isMounted) {
          if (!initialReturnRecord) {
            recordRef.current = null
            setRecord(null)
            setChecked({})
            setDashboardHandoffDraft("")
          }
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load the month-end record."
          )
        }
      } finally {
        if (isMounted) {
          setHasLoaded(true)
        }
      }
    }

    loadRecord()

    return () => {
      isMounted = false
    }
  }, [initialReturnPoint, initialReturnRecord, loadRetryNonce, period])

  React.useEffect(() => {
    const retryAfterResume = () => {
      if (
        loadError &&
        navigator.onLine &&
        document.visibilityState === "visible"
      ) {
        setLoadRetryNonce((current) => current + 1)
      }

      if (
        recordSaveError &&
        navigator.onLine &&
        document.visibilityState === "visible"
      ) {
        setSaveRetryNonce((current) => current + 1)
      }
    }
    const reloadAfterMonthEndUpdate = (event: StorageEvent) => {
      if (event.key === monthEndRecordsStorageKey) {
        setLoadRetryNonce((current) => current + 1)
      }
    }

    window.addEventListener("online", retryAfterResume)
    window.addEventListener("storage", reloadAfterMonthEndUpdate)
    document.addEventListener("visibilitychange", retryAfterResume)

    return () => {
      window.removeEventListener("online", retryAfterResume)
      window.removeEventListener("storage", reloadAfterMonthEndUpdate)
      document.removeEventListener("visibilitychange", retryAfterResume)
    }
  }, [loadError, recordSaveError])

  React.useEffect(() => {
    if (
      !hasLoaded ||
      !recordRef.current ||
      recordRef.current.status === "Closed" ||
      recordRef.current.checked === checked
    ) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const activeRecord = recordRef.current

        if (!activeRecord) {
          return
        }

        const updatedRecord: MonthEndRecord = {
          ...activeRecord,
          checked,
          updatedAt: new Date().toISOString(),
        }

        await saveMonthEndRecord(updatedRecord)
        recordRef.current = updatedRecord
        setRecord(updatedRecord)
        setRecordSaveError("")
        window.dispatchEvent(new Event("month-end:records-updated"))
      } catch {
        setRecordSaveError(
          "Your latest changes are still on this screen but have not synced. Reconnect and retry."
        )
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [checked, hasLoaded, saveRetryNonce])

  const hasRecord = Boolean(record)
  const recordStatus = record?.status

  React.useEffect(() => {
    if (period && recordStatus === "Open") {
      router.replace("/month-end")
      return
    }

    if (!period && hasLoaded && !hasRecord && !loadError) {
      router.replace("/previous-month-ends")
    }
  }, [hasLoaded, hasRecord, loadError, period, recordStatus, router])

  const activeRecordPeriod = record?.period

  function saveCurrentMonthEndReturnPoint(countryId?: string) {
    if (!activeRecordPeriod) {
      return
    }

    saveMonthEndReturnPoint({
      period: activeRecordPeriod,
      countryId,
      activeSection: activeMonthEndSection,
      countrySearchQuery,
      countryTableFilter,
      scrollY: getMonthEndScrollY(),
    })
    if (recordRef.current) {
      saveMonthEndReturnRecord(recordRef.current)
    }
  }

  React.useLayoutEffect(() => {
    if (!hasLoaded || pendingReturnScrollYRef.current === null) {
      return
    }

    const scrollY = pendingReturnScrollYRef.current
    pendingReturnScrollYRef.current = null
    restoreMonthEndScrollY(scrollY)
  }, [hasLoaded])

  const checkableRows = template.countries.filter(
    (row) => row.checkable !== false
  )
  const countriesModule = {
    tab: template.countriesModule?.tab ?? "Countries",
  }

  function getRequiredTasks(row: TemplateCountryRow) {
    return workflowTasks.filter(
      (task) => task.id !== "invoice" || row.invoiceRequired
    )
  }

  const totalTasks = checkableRows.reduce(
    (sum, row) => sum + getRequiredTasks(row).length,
    0
  )
  const countryDone = checkableRows.reduce(
    (sum, row) =>
      sum +
      getRequiredTasks(row).filter((task) =>
        asBool(checked[taskKey(row.id, task.id)])
      ).length,
    0
  )
  const supplementalTaskTotal = template.taskGroups.reduce(
    (sum, group) => sum + group.tasks.length,
    0
  )
  const supplementalTaskDone = template.taskGroups.reduce(
    (sum, group) =>
      sum +
      group.tasks.filter((task) => asBool(checked[taskKey(group.id, task.id)]))
        .length,
    0
  )
  const dashboardCommentTaskKeys = [
    ...(asString(checked[dashboardHandoffNoteKey]).trim()
      ? [dashboardHandoffCompleteKey]
      : []),
    ...checkableRows
      .filter((row) => asString(checked[noteKey(row.id)]).trim())
      .map((row) => noteCompleteKey(row.id)),
  ]
  const commentTaskTotal = dashboardCommentTaskKeys.length
  const commentTaskDone = dashboardCommentTaskKeys.filter((key) =>
    asBool(checked[key])
  ).length
  const displayedTaskTotal = supplementalTaskTotal + commentTaskTotal
  const displayedTaskDone = supplementalTaskDone + commentTaskDone
  const supplementalTaskSummaryOrder: Record<string, number> = {
    statements: 0,
    "prepaid-accounts": 1,
    "bank-reconciliation": 2,
  }
  const orderedTaskGroups = [...template.taskGroups].sort((first, second) => {
    const firstIncomplete = first.tasks.filter(
      (task) => !asBool(checked[taskKey(first.id, task.id)])
    ).length
    const secondIncomplete = second.tasks.filter(
      (task) => !asBool(checked[taskKey(second.id, task.id)])
    ).length

    return (
      secondIncomplete - firstIncomplete ||
      (supplementalTaskSummaryOrder[first.id] ?? 100) -
        (supplementalTaskSummaryOrder[second.id] ?? 100)
    )
  })
  const monthEndSectionItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "countries", label: countriesModule.tab },
    { id: "tasks", label: "Tasks" },
  ]
  const grandTotalTasks = totalTasks + displayedTaskTotal
  const totalDone = countryDone + displayedTaskDone
  const completion = grandTotalTasks
    ? Math.round((totalDone / grandTotalTasks) * 100)
    : 0
  const invoiceRequiredRows = checkableRows.filter((row) => row.invoiceRequired)
  const openInvoiceRows = invoiceRequiredRows.filter(
    (row) => !asBool(checked[taskKey(row.id, "invoice")])
  ).length
  const completedInvoiceRows = invoiceRequiredRows.length - openInvoiceRows
  const reconciliationRows = checkableRows.filter((row) =>
    getRequiredTasks(row).some((task) => task.id === "reconcile")
  )
  const completedReconciliationRows = reconciliationRows.filter((row) =>
    asBool(checked[taskKey(row.id, "reconcile")])
  ).length
  const journalRows = checkableRows.filter((row) =>
    getRequiredTasks(row).some((task) => task.id === "journal")
  )
  const completedJournalRows = journalRows.filter((row) =>
    asBool(checked[taskKey(row.id, "journal")])
  ).length
  const areAllCountryReconciliationsComplete =
    reconciliationRows.length > 0 &&
    reconciliationRows.every((row) =>
      asBool(checked[taskKey(row.id, "reconcile")])
    )
  const approvedRollInternalIds = listApprovedInternalIds(checked)
  const approvedRollIdSet = new Set(approvedRollInternalIds)
  const previousRollIdSet = new Set(
    listApprovedInternalIds(previousAnalyticsChecked)
  )
  const savedCustomerNames = readMasterCustomerNames(
    checked[masterCustomerNamesKey]
  )
  const previousSavedCustomerNames = readMasterCustomerNames(
    previousAnalyticsChecked[masterCustomerNamesKey]
  )
  const currentAnalyticsRecords = masterAnalyticsRecords.length
    ? masterAnalyticsRecords
    : readMasterAnalyticsRecords(checked[masterAnalyticsRecordsKey])
  const previousAnalyticsRecords = previousMasterAnalyticsRecords.length
    ? previousMasterAnalyticsRecords
    : readMasterAnalyticsRecords(
        previousAnalyticsChecked[masterAnalyticsRecordsKey]
      )
  const includedMasterRecords = currentAnalyticsRecords
    .filter((item) => !approvedRollIdSet.has(item.sourceInternalId))
    .map((item) => ({
      ...item,
      customerName:
        item.customerName ||
        savedCustomerNames.get(invoiceIdentity(item)) ||
        "",
    }))
  const includedPreviousMasterRecords = previousAnalyticsRecords
    .filter((item) => !previousRollIdSet.has(item.sourceInternalId))
    .map((item) => ({
      ...item,
      customerName:
        item.customerName ||
        previousSavedCustomerNames.get(invoiceIdentity(item)) ||
        "",
    }))
  const customerSummaries = summarizeInvoices(
    includedMasterRecords,
    (item) => customerDisplayName(item.customerName ?? ""),
    true
  )
  const customersByInvoiceCount = [...customerSummaries].sort(
    (first, second) =>
      second.invoiceCount - first.invoiceCount ||
      second.amount - first.amount ||
      first.name.localeCompare(second.name)
  )
  const repeatCustomers = customersByInvoiceCount.filter(
    (customer) => customer.invoiceCount > 1
  )
  const oneTimeCustomers = customersByInvoiceCount.filter(
    (customer) => customer.invoiceCount === 1
  )
  const topCustomers =
    topCustomerSort === "Most Invoices"
      ? customersByInvoiceCount
      : [...customerSummaries].sort(
          (first, second) =>
            second.amount - first.amount ||
            second.invoiceCount - first.invoiceCount ||
            first.name.localeCompare(second.name)
        )
  const currentCountrySummaries = summarizeInvoices(
    includedMasterRecords,
    (item) => item.countryName
  )
  const topCountries = currentCountrySummaries.slice(0, 5)
  const currentCountrySummaryByName = new Map(
    currentCountrySummaries.map((item) => [item.name, item])
  )
  const previousCountrySummaries = summarizeInvoices(
    includedPreviousMasterRecords,
    (item) => item.countryName
  )
  const previousCountrySummaryByName = new Map(
    previousCountrySummaries.map((item) => [item.name, item])
  )
  const countryMovers = Array.from(
    new Set([
      ...currentCountrySummaryByName.keys(),
      ...previousCountrySummaryByName.keys(),
    ])
  )
    .map((name) => {
      const current = currentCountrySummaryByName.get(name) ?? {
        name,
        invoiceCount: 0,
        amount: 0,
      }
      const previous = previousCountrySummaryByName.get(name) ?? {
        name,
        invoiceCount: 0,
        amount: 0,
      }

      return {
        name,
        invoiceCount: current.invoiceCount,
        amount: current.amount,
        invoiceChange: current.invoiceCount - previous.invoiceCount,
        amountChange: current.amount - previous.amount,
      }
    })
    .filter((item) => item.invoiceChange !== 0 || item.amountChange !== 0)
  const sortedCountryMovers = [...countryMovers].sort((first, second) =>
    countryMoverSort === "Invoice Swing"
      ? Math.abs(second.invoiceChange) - Math.abs(first.invoiceChange) ||
        Math.abs(second.amountChange) - Math.abs(first.amountChange) ||
        first.name.localeCompare(second.name)
      : Math.abs(second.amountChange) - Math.abs(first.amountChange) ||
        Math.abs(second.invoiceChange) - Math.abs(first.invoiceChange) ||
        first.name.localeCompare(second.name)
  )
  const canDownloadRollInvoices =
    Boolean(record) &&
    areAllCountryReconciliationsComplete &&
    approvedRollInternalIds.length > 0
  const isClosed = record?.status === "Closed"
  React.useEffect(() => {
    function openCommentDialog(event: KeyboardEvent) {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (
        event.key.toLowerCase() !== "c" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTyping ||
        isClosed
      )
        return

      event.preventDefault()
      setDashboardHandoffDraft("")
      setDashboardHandoffSaveError("")
      setIsDashboardCommentDialogOpen(true)
    }

    window.addEventListener("keydown", openCommentDialog)
    return () => window.removeEventListener("keydown", openCommentDialog)
  }, [isClosed])
  const shouldShowPreviousBackButton = Boolean(period && isClosed)
  const activePeriod = record?.period ?? period ?? ""
  const [activeYear, activeMonth] = activePeriod.split("-").map(Number)
  const daysInActivePeriod =
    Number.isInteger(activeYear) && Number.isInteger(activeMonth)
      ? new Date(activeYear, activeMonth, 0).getDate()
      : 31
  const invoiceValueByDay = new Map<number, number>()
  const chartedInvoiceIds = new Set<string>()

  for (const item of includedMasterRecords) {
    const invoiceId = invoiceIdentity(item)
    const day = transactionDayInPeriod(item.transactionDate, activePeriod)
    if (!day || chartedInvoiceIds.has(invoiceId)) continue

    chartedInvoiceIds.add(invoiceId)
    invoiceValueByDay.set(day, (invoiceValueByDay.get(day) ?? 0) + item.amount)
  }

  const monthlyValueByDay = Array.from(
    { length: daysInActivePeriod },
    (_, index) => ({
      day: index + 1,
      amount: invoiceValueByDay.get(index + 1) ?? 0,
    })
  )
  const previousMonthMetrics = (() => {
    const invoiceIds = new Set<string>()
    const revenue = includedPreviousMasterRecords.reduce((total, item) => {
      const invoiceId = invoiceIdentity(item)
      if (invoiceIds.has(invoiceId)) return total

      invoiceIds.add(invoiceId)
      return total + item.amount
    }, 0)

    return { revenue, invoiceCount: invoiceIds.size }
  })()
  const countryProgressRows = checkableRows.map((row) => {
    const requiredTasks = getRequiredTasks(row)
    const done = requiredTasks.filter((task) =>
      asBool(checked[taskKey(row.id, task.id)])
    ).length
    const nextTask = requiredTasks.find(
      (task) => !asBool(checked[taskKey(row.id, task.id)])
    )

    return {
      row,
      done,
      total: requiredTasks.length,
      nextTask,
      percentage: requiredTasks.length
        ? Math.round((done / requiredTasks.length) * 100)
        : 0,
    }
  })
  const countryProgressById = new Map(
    countryProgressRows.map((item) => [
      item.row.id,
      { done: item.done, total: item.total },
    ])
  )
  const countryDetailsById = new Map(
    countryProgressRows.map((item) => [
      item.row.id,
      {
        name: item.row.name,
        tasks: getRequiredTasks(item.row).map((task) => ({
          id: task.id,
          label: task.label,
          isComplete: asBool(checked[taskKey(item.row.id, task.id)]),
        })),
      },
    ])
  )
  const countryWorkQueue = countryProgressRows
    .filter((item) => item.done < item.total)
    .sort(
      (first, second) =>
        first.percentage - second.percentage ||
        first.row.name.localeCompare(second.row.name)
    )
  const countryCompletionDetailRows = [
    ...countryWorkQueue,
    ...countryProgressRows
      .filter((item) => item.total > 0 && item.done === item.total)
      .sort((first, second) => first.row.name.localeCompare(second.row.name)),
  ]
  const countryDashboardRows = [
    ...countryWorkQueue,
    ...countryProgressRows.filter((item) => item.done === item.total),
  ].slice(0, 7)
  const completedCountryCount = countryProgressRows.filter(
    (item) => item.total > 0 && item.done === item.total
  ).length
  const inProgressCountryCount = countryProgressRows.filter(
    (item) => item.done > 0 && item.done < item.total
  ).length
  const notStartedCountryCount = countryProgressRows.filter(
    (item) => item.done === 0
  ).length
  const workflowChartData = [
    {
      stage: "Invoices",
      completed: completedInvoiceRows,
      total: invoiceRequiredRows.length,
    },
    {
      stage: "Recon",
      completed: completedReconciliationRows,
      total: reconciliationRows.length,
    },
    {
      stage: "Journals",
      completed: completedJournalRows,
      total: journalRows.length,
    },
    {
      stage: "Tasks",
      completed: supplementalTaskDone,
      total: supplementalTaskTotal,
    },
  ].map((item) => ({
    ...item,
    progress: item.total ? (item.completed / item.total) * 100 : 0,
  }))
  const countryStatusChartData = [
    {
      status: "complete",
      label: "Complete",
      value: completedCountryCount,
      fill: "var(--color-complete)",
    },
    {
      status: "inProgress",
      label: "In Progress",
      value: inProgressCountryCount,
      fill: "var(--color-inProgress)",
    },
    {
      status: "notStarted",
      label: "Not Started",
      value: notStartedCountryCount,
      fill: "var(--color-notStarted)",
    },
  ]
  const savedDashboardHandoffNote = asString(checked[dashboardHandoffNoteKey])
  const dashboardCountryNotes = checkableRows
    .map((row) => ({
      id: row.id,
      note: asString(checked[noteKey(row.id)]),
      updatedAt:
        asString(checked[noteUpdatedAtKey(row.id)]) || record?.updatedAt || "",
      label: asString(checked[noteAuthorKey(row.id)]) || currentUserName,
      row,
      isHandoff: false,
      taskKey: noteCompleteKey(row.id),
      isComplete: asBool(checked[noteCompleteKey(row.id)]),
    }))
    .filter((item) => Boolean(item.note.trim()))
  const dashboardNotes = [
    ...(savedDashboardHandoffNote
      ? [
          {
            id: "handoff",
            label:
              asString(checked[dashboardHandoffAuthorKey]) || currentUserName,
            note: savedDashboardHandoffNote,
            updatedAt:
              asString(checked[dashboardHandoffUpdatedAtKey]) ||
              record?.updatedAt ||
              "",
            row: undefined,
            isHandoff: true,
            taskKey: dashboardHandoffCompleteKey,
            isComplete: asBool(checked[dashboardHandoffCompleteKey]),
          },
        ]
      : []),
    ...dashboardCountryNotes,
  ].sort(
    (first, second) =>
      Number(first.isComplete) - Number(second.isComplete) ||
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  )
  const taskPageGroups = [
    ...orderedTaskGroups,
    ...(dashboardNotes.length
      ? [
          {
            id: "comments",
            title: "Comments",
            tasks: dashboardNotes.map((item) => ({
              id: item.id,
              label: `${item.label}: ${item.note}`,
              key: item.taskKey,
            })),
          },
        ]
      : []),
  ]
  const countrySearchTerm = countrySearchQuery.trim().toLowerCase()

  function rowMatchesCountryTableFilter(row: TemplateCountryRow) {
    const matchesSearch =
      !countrySearchTerm || row.name.toLowerCase().includes(countrySearchTerm)

    if (!matchesSearch) {
      return false
    }

    if (row.checkable === false) {
      return countryTableFilter === "all"
    }

    if (countryTableFilter === "not-reconciled") {
      const hasReconciliationTask = getRequiredTasks(row).some(
        (task) => task.id === "reconcile"
      )

      return (
        hasReconciliationTask && !asBool(checked[taskKey(row.id, "reconcile")])
      )
    }

    if (countryTableFilter === "missing-invoice") {
      return row.invoiceRequired && !asBool(checked[taskKey(row.id, "invoice")])
    }

    return true
  }

  const filteredCountryRows = template.countries
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row, rowIndex }) => {
      if (rowMatchesCountryTableFilter(row)) {
        return true
      }

      if (row.checkable !== false) {
        return false
      }

      return template.countries
        .slice(rowIndex + 1, findChildInsertIndex(template, rowIndex))
        .some((childRow) => rowMatchesCountryTableFilter(childRow))
    })

  function updateTask(key: string, value: boolean) {
    if (isClosed) {
      return
    }

    setChecked((current) => ({ ...current, [key]: value }))
  }

  function startEditNote(rowId: string) {
    if (isClosed) {
      return
    }

    setEditingNoteRowId(rowId)
    setNoteDraft(asString(checked[noteKey(rowId)]))
  }

  function cancelEditNote() {
    setEditingNoteRowId(null)
    setNoteDraft("")
  }

  function saveNote(rowId: string) {
    if (isClosed) {
      cancelEditNote()
      return
    }

    const cleanNote = noteDraft.trim()

    setChecked((current) => {
      const nextChecked = { ...current }

      if (cleanNote) {
        nextChecked[noteKey(rowId)] = cleanNote
        nextChecked[noteUpdatedAtKey(rowId)] = new Date().toISOString()
        nextChecked[noteAuthorKey(rowId)] = currentUserName
        nextChecked[noteCompleteKey(rowId)] = false
      } else {
        delete nextChecked[noteKey(rowId)]
        delete nextChecked[noteUpdatedAtKey(rowId)]
        delete nextChecked[noteAuthorKey(rowId)]
      }

      return nextChecked
    })
    cancelEditNote()
  }

  function deleteNote(rowId: string) {
    if (isClosed) {
      return
    }

    setChecked((current) => {
      const nextChecked = { ...current }

      delete nextChecked[noteKey(rowId)]
      delete nextChecked[noteUpdatedAtKey(rowId)]
      delete nextChecked[noteAuthorKey(rowId)]
      delete nextChecked[noteCompleteKey(rowId)]

      return nextChecked
    })

    if (editingNoteRowId === rowId) {
      cancelEditNote()
    }
  }

  function deleteDashboardComment() {
    if (isClosed) return
    setChecked((current) => {
      const nextChecked = { ...current }
      delete nextChecked[dashboardHandoffNoteKey]
      delete nextChecked[dashboardHandoffUpdatedAtKey]
      delete nextChecked[dashboardHandoffCompleteKey]
      delete nextChecked[dashboardHandoffAuthorKey]
      return nextChecked
    })
  }

  async function saveDashboardHandoffNote() {
    const activeRecord = recordRef.current

    if (isClosed || !activeRecord) {
      return
    }

    const cleanNote = dashboardHandoffDraft.trim()

    if (!cleanNote) {
      return
    }

    const nextChecked = {
      ...checked,
      [dashboardHandoffNoteKey]: cleanNote,
      [dashboardHandoffUpdatedAtKey]: new Date().toISOString(),
      [dashboardHandoffCompleteKey]: false,
      [dashboardHandoffAuthorKey]: currentUserName,
    }
    const updatedRecord: MonthEndRecord = {
      ...activeRecord,
      checked: nextChecked,
      updatedAt: new Date().toISOString(),
    }

    setIsSavingDashboardHandoff(true)
    setDashboardHandoffSaveError("")

    try {
      await saveMonthEndRecord(updatedRecord)
      recordRef.current = updatedRecord
      setRecord(updatedRecord)
      setChecked(nextChecked)
      setDashboardHandoffDraft("")
      setIsDashboardCommentDialogOpen(false)
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch {
      setDashboardHandoffSaveError("Could not save the handoff note.")
    } finally {
      setIsSavingDashboardHandoff(false)
    }
  }

  function showCountryWork(filter: CountryTableFilterId = "all") {
    setCountryTableFilter(filter)
    setActiveMonthEndSection("countries")
  }

  function startEditExchangeRate(rowId: string) {
    if (isClosed) {
      return
    }

    const exchangeRate = asNumber(checked[exchangeRateKey(rowId)])
    const exchangeRateDisplay = asString(checked[exchangeRateDisplayKey(rowId)])

    setEditingExchangeRateRowId(rowId)
    setExchangeRateDraft(
      exchangeRateDisplay ||
        (exchangeRate === undefined ? "" : formatExchangeRate(exchangeRate))
    )
  }

  function cancelEditExchangeRate() {
    setEditingExchangeRateRowId(null)
    setExchangeRateDraft("")
  }

  function saveExchangeRate(rowId: string) {
    if (isClosed) {
      cancelEditExchangeRate()
      return
    }

    const trimmedValue = exchangeRateDraft.trim().replace(",", ".")
    const nextValue = parseExchangeRate(trimmedValue)

    if (trimmedValue && nextValue === undefined) {
      return
    }

    setChecked((current) => {
      const nextChecked = { ...current }

      if (!trimmedValue) {
        delete nextChecked[exchangeRateKey(rowId)]
        delete nextChecked[exchangeRateDisplayKey(rowId)]
        return nextChecked
      }

      nextChecked[exchangeRateKey(rowId)] = nextValue ?? 0
      nextChecked[exchangeRateDisplayKey(rowId)] = trimmedValue

      return nextChecked
    })

    cancelEditExchangeRate()
  }

  async function closeMonth() {
    const activeRecord = recordRef.current

    if (!activeRecord) {
      return
    }

    const now = new Date().toISOString()
    const updatedRecord: MonthEndRecord = {
      ...activeRecord,
      checked,
      status: "Closed",
      updatedAt: now,
      completedAt: activeRecord.completedAt ?? now,
    }

    await saveMonthEndRecord(updatedRecord)
    recordRef.current = period ? updatedRecord : null
    setRecord(period ? updatedRecord : null)
    setChecked(period ? updatedRecord.checked : {})
    setShowCloseMonthConfirm(false)
    if (!period) {
      router.replace("/previous-month-ends")
    }
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  async function reopenMonth() {
    const activeRecord = recordRef.current

    if (!activeRecord) {
      return
    }

    const updatedRecord: MonthEndRecord = {
      ...activeRecord,
      checked,
      status: "Open",
      updatedAt: new Date().toISOString(),
      completedAt: undefined,
    }

    await saveMonthEndRecord(updatedRecord)
    recordRef.current = updatedRecord
    setRecord(updatedRecord)
    setShowCloseMonthConfirm(false)
    setShowReopenMonthConfirm(false)
    router.replace("/month-end")
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  function downloadRollInvoicesCsv() {
    if (!approvedRollInternalIds.length) {
      return
    }

    const csv = createRollInvoicesCsv(approvedRollInternalIds)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `${record?.period ?? "month-end"}-roll-invoices.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function openMasterSheetUpload() {
    window.setTimeout(() => masterUploadInputRef.current?.click(), 0)
  }

  async function reuploadMasterSheet(file: File) {
    const activeRecord = recordRef.current

    if (!activeRecord || activeRecord.status === "Closed") {
      return
    }

    setIsUploadingMasterSheet(true)
    setMasterUploadMessage("")

    try {
      const activeTemplate = await getMonthEndTemplate()
      const targetCountries = activeTemplate.countries.filter(
        (country) => country.checkable !== false
      )
      const csvText = await reportFileToCsvText(file, activeRecord.period)
      const masterRecords = isMasterCsv(csvText)
        ? parseMonthEndMasterCsv({
            csvText,
            countries: activeTemplate.countries,
            monthEndId: activeRecord.id,
            period: activeRecord.period,
          })
        : (() => {
            const mappedMasterRecords = targetCountries.flatMap((country) =>
              isDefaultMasterReportMapping(country.masterReportMapping)
                ? []
                : (parseMappedCountryMasterCsv({
                    csvText,
                    monthEndId: activeRecord.id,
                    period: activeRecord.period,
                    targetCountries: [country],
                    mapping: country.masterReportMapping,
                  }) ?? [])
            )

            return mappedMasterRecords.length
              ? mappedMasterRecords
              : parseCountryMasterCsv({
                  csvText,
                  monthEndId: activeRecord.id,
                  period: activeRecord.period,
                  targetCountries,
                })
          })()

      await saveMonthEndMasterRecords(activeRecord.id, masterRecords)

      const nextChecked = { ...checked }
      const countryIdsWithMasterRecords = new Set(
        masterRecords.map((masterRecord) => masterRecord.countryId)
      )

      for (const country of targetCountries) {
        delete nextChecked[masterTransactionDatesKey(country.id)]
        delete nextChecked[masterSourceFileNameKey(country.id)]
      }

      for (const countryId of countryIdsWithMasterRecords) {
        nextChecked[masterSourceFileNameKey(countryId)] = file.name
      }

      Object.assign(
        nextChecked,
        getMasterTransactionDateCheckedValues(masterRecords)
      )
      nextChecked[masterCustomerNamesKey] =
        getMasterCustomerNamesCheckedValue(masterRecords)
      nextChecked[masterAnalyticsRecordsKey] =
        getMasterAnalyticsRecordsCheckedValue(masterRecords)

      const updatedRecord: MonthEndRecord = {
        ...activeRecord,
        checked: nextChecked,
        updatedAt: new Date().toISOString(),
      }

      await saveMonthEndRecord(updatedRecord)
      recordRef.current = updatedRecord
      setRecord(updatedRecord)
      setChecked(nextChecked)
      setMasterAnalyticsRefreshNonce((current) => current + 1)
      setMasterUploadMessage(
        `Master sheet reuploaded with ${masterRecords.length} NetSuite record${
          masterRecords.length === 1 ? "" : "s"
        }.`
      )
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch (error) {
      setMasterUploadMessage(
        error instanceof Error
          ? error.message
          : "Could not reupload the master sheet."
      )
    } finally {
      setIsUploadingMasterSheet(false)
    }
  }

  function updateRowTasks(
    row: TemplateCountryRow,
    rowIndex: number,
    value: boolean
  ) {
    if (isClosed) {
      return
    }

    const targetRows =
      row.checkable === false
        ? template.countries
            .slice(rowIndex + 1, findChildInsertIndex(template, rowIndex))
            .filter((childRow) => childRow.checkable !== false)
        : [row]

    setChecked((current) => {
      const nextChecked = { ...current }

      for (const targetRow of targetRows) {
        for (const task of getRequiredTasks(targetRow)) {
          nextChecked[taskKey(targetRow.id, task.id)] = value
        }
      }

      return nextChecked
    })
  }

  function renderDashboardMetricDetail(
    metric: DashboardMetricDetailId,
    hideHeader = false
  ) {
    const title =
      metric === "countries"
        ? "Country Completion"
        : metric === "invoices"
          ? "Invoice Completion"
          : metric === "shared-tasks"
            ? "Task Completion"
            : metric === "customers"
              ? "Customers"
              : "Comments"
    const description =
      metric === "countries"
        ? `${completedCountryCount} complete, ${inProgressCountryCount} in progress, and ${notStartedCountryCount} not started`
        : metric === "invoices"
          ? `${completedInvoiceRows} complete and ${openInvoiceRows} remaining`
          : metric === "shared-tasks"
            ? `${supplementalTaskDone} complete and ${supplementalTaskTotal - supplementalTaskDone} remaining`
            : metric === "customers"
              ? `${repeatCustomers.length} repeat and ${oneTimeCustomers.length} one-time customers`
              : `${commentTaskDone} complete and ${commentTaskTotal - commentTaskDone} remaining`

    return (
      <Card
        data-country-detail={metric === "countries" ? "" : undefined}
        className="gap-0 overflow-hidden py-0 shadow-sm"
        style={
          metric === "countries" && countryDetailViewportHeight
            ? { height: countryDetailViewportHeight }
            : undefined
        }
      >
        {!hideHeader ? (
          <CardHeader className="border-b py-4">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        ) : null}
        {metric === "countries" ? (
          <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(14rem,1.2fr)_minmax(8rem,0.8fr)] gap-4 p-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)] lg:grid-rows-none">
            <div className="grid min-h-0 place-items-center">
              <MonthEndCountryHeatMap
                progressByCountry={countryProgressById}
                detailsByCountry={countryDetailsById}
                selectedCountryId={
                  selectedDashboardCountryId ||
                  countryWorkQueue[0]?.row.id ||
                  countryProgressRows[0]?.row.id
                }
                highlightedCountryId={highlightedDashboardCountryId}
                onSelectCountry={setSelectedDashboardCountryId}
                onHighlightCountry={(countryId) =>
                  setHighlightedDashboardCountryId(countryId ?? "")
                }
                className="h-full max-h-[28rem] w-full"
              />
            </div>
            <div className="grid min-h-0 content-start gap-1.5 overflow-y-auto pr-1">
              {countryCompletionDetailRows.map((item) => {
                const isComplete = item.total > 0 && item.done === item.total
                const isInProgress = item.done > 0 && !isComplete
                const isSelected = item.row.id === selectedDashboardCountryId

                return (
                  <AppLink
                    key={item.row.id}
                    href={countryRecordHref(
                      activePeriod,
                      item.row.id,
                      item.row,
                      checked
                    )}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                      isSelected && !isComplete && "bg-muted",
                      isComplete &&
                        "bg-emerald-100 text-emerald-950 hover:bg-emerald-100/80 dark:bg-emerald-900/35 dark:text-emerald-50 dark:hover:bg-emerald-900/45"
                    )}
                    onMouseEnter={() =>
                      setHighlightedDashboardCountryId(item.row.id)
                    }
                    onMouseLeave={() => setHighlightedDashboardCountryId("")}
                    onFocus={() =>
                      setHighlightedDashboardCountryId(item.row.id)
                    }
                    onBlur={() => setHighlightedDashboardCountryId("")}
                    onClick={() => saveCurrentMonthEndReturnPoint(item.row.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.row.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.nextTask?.label ?? "All tasks complete"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        className="hidden sm:inline-flex"
                        variant={isComplete ? "secondary" : "outline"}
                      >
                        {isComplete
                          ? "Complete"
                          : isInProgress
                            ? "In progress"
                            : "Not started"}
                      </Badge>
                      <span className="w-9 text-right tabular-nums">
                        {item.done}/{item.total}
                      </span>
                    </span>
                  </AppLink>
                )
              })}
            </div>
          </CardContent>
        ) : metric === "invoices" ? (
          <CardContent className="p-4 sm:p-6">
            <div className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {invoiceRequiredRows.map((row) => {
                const isComplete = asBool(checked[taskKey(row.id, "invoice")])

                return (
                  <AppLink
                    key={row.id}
                    href={countryRecordHref(activePeriod, row.id, row, checked)}
                    className={cn(
                      "flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 font-medium transition-colors hover:bg-muted/60",
                      isComplete &&
                        "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-100/80 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-50 dark:hover:bg-emerald-900/45"
                    )}
                    onClick={() => saveCurrentMonthEndReturnPoint(row.id)}
                  >
                    <span className="min-w-0 truncate">{row.name}</span>
                    {isComplete ? (
                      <CheckIcon className="size-4 shrink-0" />
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Missing
                      </span>
                    )}
                  </AppLink>
                )
              })}
            </div>
          </CardContent>
        ) : metric === "customers" ? (
          <CardContent className="grid items-start gap-4 p-4 lg:grid-cols-2">
            {[
              { title: "Repeat Customers", rows: repeatCustomers },
              { title: "One-Time Customers", rows: oneTimeCustomers },
            ].map((group) => {
              const totals = group.rows.reduce(
                (total, customer) => ({
                  invoiceCount: total.invoiceCount + customer.invoiceCount,
                  amount: total.amount + customer.amount,
                }),
                { invoiceCount: 0, amount: 0 }
              )

              return (
                <div
                  key={group.title}
                  className="overflow-hidden rounded-lg border"
                >
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="font-medium">{group.title}</h3>
                    <Badge variant="secondary">{group.rows.length}</Badge>
                  </div>
                  {group.rows.length ? (
                    <div className="max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Customer</TableHead>
                            <TableHead className="text-right">
                              Invoices
                            </TableHead>
                            <TableHead className="pr-4 text-right">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((customer) => (
                            <TableRow key={customer.name}>
                              <TableCell className="max-w-64 truncate pl-4 font-medium">
                                {customer.name}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {customer.invoiceCount}
                              </TableCell>
                              <TableCell className="pr-4 text-right font-medium tabular-nums">
                                {formatDashboardCurrency(customer.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="pl-4">Total</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {totals.invoiceCount}
                            </TableCell>
                            <TableCell className="pr-4 text-right tabular-nums">
                              {formatDashboardCurrency(totals.amount)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      No customers match this category.
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        ) : metric === "comments" ? (
          <CardContent className="grid gap-2 p-2">
            {dashboardNotes.length ? (
              dashboardNotes.map((item) => (
                <Alert
                  key={item.id}
                  className={cn(
                    "py-2 pr-12 shadow-none",
                    item.isComplete
                      ? "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-50"
                      : "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-50"
                  )}
                >
                  {item.isComplete ? (
                    <CheckCircle2Icon className="text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangleIcon className="text-orange-600 dark:text-orange-400" />
                  )}
                  <AlertTitle>
                    {item.label}
                    <time
                      className="ml-2 text-xs font-normal opacity-65"
                      dateTime={item.updatedAt}
                    >
                      {formatNoteTimestamp(item.updatedAt)}
                    </time>
                  </AlertTitle>
                  <AlertDescription
                    className={cn(
                      item.isComplete
                        ? "text-emerald-900 dark:text-emerald-100"
                        : "text-orange-900 dark:text-orange-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{item.note}</p>
                  </AlertDescription>
                  <AlertAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <HeaderActionMenuTrigger
                            label={`Actions for ${item.label} comment`}
                            className="size-8 border-0 bg-transparent shadow-none"
                          />
                        }
                      />
                      <DropdownMenuContent
                        align="end"
                        className="w-max min-w-48"
                      >
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          disabled={isClosed}
                          onClick={() =>
                            updateTask(item.taskKey, !item.isComplete)
                          }
                        >
                          {item.isComplete ? <XIcon /> : <CheckCircle2Icon />}
                          {item.isComplete
                            ? "Mark as Incomplete"
                            : "Mark as Complete"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          variant="destructive"
                          disabled={isClosed}
                          onClick={() =>
                            item.row
                              ? deleteNote(item.row.id)
                              : deleteDashboardComment()
                          }
                        >
                          <Trash2Icon />
                          Delete Comment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AlertAction>
                </Alert>
              ))
            ) : (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No comments yet.
              </p>
            )}
          </CardContent>
        ) : (
          <CardContent className="p-4 sm:p-6">
            <div className="mx-auto max-w-5xl">
              <MonthEndTaskGroupsList
                groups={orderedTaskGroups}
                checked={checked}
                updateTask={updateTask}
                isReadOnly={isClosed}
              />
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  function renderCountryMoverRow(country: (typeof countryMovers)[number]) {
    const invoiceChangeLabel =
      country.invoiceChange < 0
        ? `↓ ${Math.abs(country.invoiceChange)}`
        : country.invoiceChange > 0
          ? `↑ ${country.invoiceChange}`
          : "No change"
    const amountChangeLabel =
      country.amountChange === 0
        ? "No change"
        : `${country.amountChange < 0 ? "↓" : "↑"} ${formatDashboardCurrency(
            Math.abs(country.amountChange)
          )}`

    return (
      <TableRow key={country.name} className="h-12">
        <TableCell className="max-w-52 truncate pl-4 font-medium">
          {country.name}
        </TableCell>
        <TableCell className="text-center tabular-nums">
          <span className="inline-flex items-center justify-center gap-2">
            <span className="font-semibold text-foreground">
              {country.invoiceCount}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                country.invoiceChange < 0
                  ? "text-destructive"
                  : country.invoiceChange > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              )}
            >
              {invoiceChangeLabel}
            </span>
          </span>
        </TableCell>
        <TableCell className="pr-4 text-center tabular-nums">
          <span className="inline-flex items-center justify-center gap-2">
            <span className="font-semibold text-foreground">
              {formatDashboardCurrency(country.amount)}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                country.amountChange < 0
                  ? "text-destructive"
                  : country.amountChange > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              )}
            >
              {amountChangeLabel}
            </span>
          </span>
        </TableCell>
      </TableRow>
    )
  }

  const monthStatusAction = (
    <div className="flex shrink-0 items-center gap-2">
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) {
            setShowCloseMonthConfirm(false)
            setShowReopenMonthConfirm(false)
          }
        }}
      >
        <DropdownMenuTrigger
          render={<HeaderActionMenuTrigger label="Month end actions" />}
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem render={<AppLink href="/previous-month-ends" />}>
            <HistoryIcon />
            View previous months
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isClosed}
            onClick={() => {
              setDashboardHandoffDraft("")
              setDashboardHandoffSaveError("")
              setIsDashboardCommentDialogOpen(true)
            }}
          >
            <MessageSquareTextIcon />
            Add Comment
            <DropdownMenuShortcut>C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!record || isClosed || isUploadingMasterSheet}
            onClick={openMasterSheetUpload}
          >
            <UploadIcon />
            Reupload Master Sheet
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isClosed && showReopenMonthConfirm ? (
            <DropdownMenuItem closeOnClick={false} onClick={reopenMonth}>
              <CheckCircle2Icon />
              Confirm Reopen Month
            </DropdownMenuItem>
          ) : isClosed ? (
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() => setShowReopenMonthConfirm(true)}
            >
              <CheckCircle2Icon />
              Reopen Month
            </DropdownMenuItem>
          ) : showCloseMonthConfirm ? (
            <DropdownMenuItem variant="destructive" onClick={closeMonth}>
              <FileCheck2Icon />
              Confirm Close Month
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              closeOnClick={false}
              onClick={() => setShowCloseMonthConfirm(true)}
            >
              <FileCheck2Icon />
              Close Month
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  if (loadError && !record) {
    return (
      <PageFrame
        mainClassName="flex min-h-svh flex-col bg-background"
        header={<SiteHeader title="Month End" />}
      >
        <div className="grid max-w-xl gap-4 p-4 lg:p-6">
          <Card>
            <CardHeader>
              <CardTitle>Could not load month end</CardTitle>
              <CardDescription>
                Check your connection and try again. The app will also retry
                when your device reconnects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setLoadRetryNonce((current) => current + 1)}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageFrame>
    )
  }

  if (!period && hasLoaded && !record) {
    return (
      <PageFrame header={<SiteHeader title="Month End" />}>
        <div className="grid gap-4 px-4 py-4 lg:px-6">
          <PreviousMonthEndsSkeleton includeAction />
        </div>
      </PageFrame>
    )
  }

  if (!hasLoaded) {
    return (
      <PageFrame
        style={
          {
            "--mobile-page-bottom-padding":
              "calc(8rem + env(safe-area-inset-bottom, 0px))",
          } as React.CSSProperties
        }
        header={
          <SiteHeader
            titleContent={<Skeleton className="h-5 w-32 rounded-md" />}
          />
        }
      >
        <div className="@container/month-end flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
          <Skeleton className="h-10 w-full rounded-lg md:hidden" />
          <MonthEndDashboardSkeleton />
        </div>
      </PageFrame>
    )
  }

  return (
    <PageFrame
      style={
        {
          "--mobile-page-bottom-padding":
            "calc(8rem + env(safe-area-inset-bottom, 0px))",
        } as React.CSSProperties
      }
      header={
        <SiteHeader
          title={record ? formatPeriod(record.period) : "Month End"}
          leadingContent={
            shouldShowPreviousBackButton ? (
              <Button
                variant="outline"
                className="w-[4.625rem]"
                aria-label="Back to previous months"
                nativeButton={false}
                render={<AppLink href="/previous-month-ends" />}
              >
                <ArrowLeftIcon />
                Back
              </Button>
            ) : undefined
          }
          mobileLeadingContent={
            shouldShowPreviousBackButton ? (
              <SiteHeaderBackButton
                label="Back to previous months"
                href="/previous-month-ends"
              />
            ) : undefined
          }
          actions={monthStatusAction}
          mobileTrailingContent={monthStatusAction}
          bottomContent={
            <MonthEndSectionNavigation
              items={monthEndSectionItems}
              activeSection={activeMonthEndSection}
              onActiveSectionChange={setActiveMonthEndSection}
            />
          }
        />
      }
    >
      <input
        ref={masterUploadInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) reuploadMasterSheet(file)
          event.currentTarget.value = ""
        }}
      />
      <div
        role="tabpanel"
        id="month-end-section"
        aria-labelledby={`month-end-section-${activeMonthEndSection}`}
        className="@container/month-end flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6"
      >
        {masterUploadMessage ? (
          <p className="text-sm text-muted-foreground">{masterUploadMessage}</p>
        ) : null}

        {recordSaveError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          >
            <span>{recordSaveError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveRetryNonce((current) => current + 1)}
            >
              Retry sync
            </Button>
          </div>
        ) : null}

        <Tabs
          value={activeMonthEndSection}
          onValueChange={setActiveMonthEndSection}
          className="md:hidden"
        >
          <TabsList className="h-12! w-full touch-manipulation p-0.5!">
            {monthEndSectionItems.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="min-h-11 touch-manipulation px-3 text-base transition-colors! duration-75! select-none"
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") {
                    setActiveMonthEndSection(item.id)
                  }
                }}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {activeMonthEndSection === "dashboard" ? (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <MonthEndMetricCard
                title="Overall Progress"
                value={`${completion}%`}
                icon={CheckCircle2Icon}
                progress={completion}
              />
              <MonthEndMetricCard
                title="Countries Complete"
                value={`${completedCountryCount}/${checkableRows.length}`}
                icon={Building2Icon}
                isActive={activeDashboardMetric === "countries"}
                expandedContent={renderDashboardMetricDetail("countries", true)}
                onActivate={() =>
                  setActiveDashboardMetric((current) =>
                    current === "countries" ? null : "countries"
                  )
                }
              />
              <MonthEndMetricCard
                title="Tasks"
                value={`${supplementalTaskDone}/${supplementalTaskTotal}`}
                icon={ListTodoIcon}
                isActive={activeDashboardMetric === "shared-tasks"}
                expandedContent={renderDashboardMetricDetail(
                  "shared-tasks",
                  true
                )}
                onActivate={() =>
                  setActiveDashboardMetric((current) =>
                    current === "shared-tasks" ? null : "shared-tasks"
                  )
                }
              />
              <MonthEndMetricCard
                title="Customers"
                value={`${customerSummaries.length}`}
                stats={[
                  { label: "Repeat", value: `${repeatCustomers.length}` },
                  { label: "One-time", value: `${oneTimeCustomers.length}` },
                ]}
                icon={UserRoundCheckIcon}
                isActive={activeDashboardMetric === "customers"}
                expandedContent={renderDashboardMetricDetail("customers", true)}
                onActivate={() =>
                  setActiveDashboardMetric((current) =>
                    current === "customers" ? null : "customers"
                  )
                }
              />
              <MonthEndMetricCard
                title="Comments"
                value={`${dashboardNotes.length}`}
                stats={[
                  {
                    label: "Open",
                    value: `${commentTaskTotal - commentTaskDone}`,
                  },
                  { label: "Complete", value: `${commentTaskDone}` },
                ]}
                icon={MessageSquareTextIcon}
                iconActionLabel="Add"
                iconActionDisabled={isClosed}
                onIconActivate={() => {
                  setDashboardHandoffDraft("")
                  setDashboardHandoffSaveError("")
                  setIsDashboardCommentDialogOpen(true)
                }}
                isActive={activeDashboardMetric === "comments"}
                expandedContent={renderDashboardMetricDetail("comments", true)}
                onActivate={() =>
                  setActiveDashboardMetric((current) =>
                    current === "comments" ? null : "comments"
                  )
                }
              />
            </section>

            {activeDashboardMetric ? (
              <div className="hidden md:block xl:hidden">
                {renderDashboardMetricDetail(activeDashboardMetric)}
              </div>
            ) : null}

            {activeDashboardMetric ? (
              <div className="hidden xl:block">
                {renderDashboardMetricDetail(activeDashboardMetric)}
              </div>
            ) : null}

            <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]">
              <MonthEndValueByDayChart
                data={monthlyValueByDay}
                invoiceCount={chartedInvoiceIds.size}
                previousInvoiceCount={previousMonthMetrics.invoiceCount}
                previousTotalRevenue={previousMonthMetrics.revenue}
              />

              <Card className="h-full gap-0 py-0 shadow-none">
                <CardHeader className="px-4 pt-4 pb-3">
                  <CardTitle>Top Countries</CardTitle>
                  <CardDescription>
                    Highest invoice value this month
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col px-0 pb-0">
                  {topCountries.length ? (
                    <>
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/2 pl-4">
                              Country
                            </TableHead>
                            <TableHead className="w-1/4 text-center">
                              Invoices
                            </TableHead>
                            <TableHead className="w-1/4 pr-4 text-center">
                              Value
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topCountries.map((country) => (
                            <TableRow key={country.name} className="h-12">
                              <TableCell className="max-w-52 truncate pl-4 font-medium">
                                {country.name}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {country.invoiceCount}
                              </TableCell>
                              <TableCell className="pr-4 text-center font-medium tabular-nums">
                                {formatDashboardCurrency(country.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  ) : (
                    <p className="flex-1 border-t px-4 py-6 text-sm text-muted-foreground">
                      No invoice data is available in this month&apos;s master
                      report.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid items-stretch gap-4 xl:grid-cols-2">
              <Card className="h-full gap-0 py-0 shadow-none">
                <CardHeader className="flex min-h-17 flex-row items-start justify-between gap-3 px-4 pt-4 pb-3">
                  <div className="grid gap-1.5">
                    <CardTitle>Top Customers</CardTitle>
                    <CardDescription>
                      {topCustomerSort === "Most Invoices"
                        ? "Most invoices this month"
                        : "Highest invoice value this month"}
                    </CardDescription>
                  </div>
                  <Combobox
                    items={[...topCustomerSortOptions]}
                    value={topCustomerSort}
                    onValueChange={(value) => {
                      if (
                        value === "Most Invoices" ||
                        value === "Highest Value"
                      ) {
                        setTopCustomerSort(value)
                        setShowAllTopCustomers(false)
                      }
                    }}
                  >
                    <ComboboxTrigger
                      aria-label="Sort top customers"
                      className="h-7 w-auto min-w-36 shrink-0 cursor-pointer rounded-md px-2.5 text-sm"
                    >
                      {topCustomerSort}
                    </ComboboxTrigger>
                    <ComboboxContent focusListOnOpen>
                      {topCustomerSortOptions.map((option) => (
                        <ComboboxItem
                          key={option}
                          value={option}
                          className="cursor-pointer"
                        >
                          {option}
                        </ComboboxItem>
                      ))}
                    </ComboboxContent>
                  </Combobox>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col px-0 pb-0">
                  {topCustomers.length ? (
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2 pl-4">Customer</TableHead>
                          <TableHead className="w-1/4 text-center">
                            Invoices
                          </TableHead>
                          <TableHead className="w-1/4 pr-4 text-center">
                            Value
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topCustomers
                          .slice(0, showAllTopCustomers ? undefined : 5)
                          .map((customer) => (
                            <TableRow key={customer.name} className="h-12">
                              <TableCell className="max-w-52 truncate pl-4 font-medium">
                                {customer.name}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {customer.invoiceCount}
                              </TableCell>
                              <TableCell className="pr-4 text-center font-medium tabular-nums">
                                {formatDashboardCurrency(customer.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="flex-1 border-t px-4 py-6 text-sm text-muted-foreground">
                      No customer data is available in this month&apos;s master
                      report.
                    </p>
                  )}
                  {topCustomers.length > 5 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-auto w-full rounded-none border-t"
                      onClick={() =>
                        setShowAllTopCustomers((current) => !current)
                      }
                    >
                      {showAllTopCustomers
                        ? "Show fewer"
                        : `Show ${topCustomers.length - 5} more`}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="h-full gap-0 py-0 shadow-none">
                <CardHeader className="flex min-h-17 flex-row items-start justify-between gap-3 px-4 pt-4 pb-3">
                  <div className="grid gap-1.5">
                    <CardTitle>Biggest Movers</CardTitle>
                    <CardDescription>
                      {countryMoverSort === "Invoice Swing"
                        ? "Largest invoice swings from last month"
                        : "Largest value swings from last month"}
                    </CardDescription>
                  </div>
                  <Combobox
                    items={[...countryMoverSortOptions]}
                    value={countryMoverSort}
                    onValueChange={(value) => {
                      if (
                        value === "Invoice Swing" ||
                        value === "Value Swing"
                      ) {
                        setCountryMoverSort(value)
                        setShowAllCountryMovers(false)
                      }
                    }}
                  >
                    <ComboboxTrigger
                      aria-label="Sort biggest movers"
                      className="h-7 w-auto min-w-36 shrink-0 cursor-pointer rounded-md px-2.5 text-sm"
                    >
                      {countryMoverSort}
                    </ComboboxTrigger>
                    <ComboboxContent focusListOnOpen>
                      {countryMoverSortOptions.map((option) => (
                        <ComboboxItem
                          key={option}
                          value={option}
                          className="cursor-pointer"
                        >
                          {option}
                        </ComboboxItem>
                      ))}
                    </ComboboxContent>
                  </Combobox>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col px-0 pb-0">
                  {sortedCountryMovers.length ? (
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2 pl-4">Country</TableHead>
                          <TableHead className="w-1/4 text-center">
                            Invoices
                          </TableHead>
                          <TableHead className="w-1/4 pr-4 text-center">
                            Value
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCountryMovers
                          .slice(0, showAllCountryMovers ? undefined : 5)
                          .map((country) => renderCountryMoverRow(country))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="flex-1 border-t px-4 py-6 text-sm text-muted-foreground">
                      {previousAnalyticsRecords.length
                        ? "No country movement from last month."
                        : "A previous month master report is needed for comparison."}
                    </p>
                  )}
                  {sortedCountryMovers.length > 5 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-auto w-full rounded-none border-t"
                      onClick={() =>
                        setShowAllCountryMovers((current) => !current)
                      }
                    >
                      {showAllCountryMovers
                        ? "Show fewer"
                        : `Show ${sortedCountryMovers.length - 5} more`}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </section>
            <Dialog
              open={isDashboardCommentDialogOpen}
              onOpenChange={setIsDashboardCommentDialogOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Comment</DialogTitle>
                  <DialogDescription>
                    Add a visible note or blocker for this month end.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  autoFocus
                  value={dashboardHandoffDraft}
                  disabled={isClosed}
                  rows={7}
                  className="min-h-40 resize-y"
                  placeholder="Write a comment..."
                  onChange={(event) =>
                    setDashboardHandoffDraft(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault()
                      saveDashboardHandoffNote()
                    }
                  }}
                />
                {dashboardHandoffSaveError ? (
                  <p className="text-sm text-destructive">
                    {dashboardHandoffSaveError}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDashboardCommentDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={
                      isClosed ||
                      isSavingDashboardHandoff ||
                      !dashboardHandoffDraft.trim()
                    }
                    onClick={saveDashboardHandoffNote}
                  >
                    {isSavingDashboardHandoff ? "Saving..." : "Comment"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        {activeMonthEndSection === "countries" ? (
          <div className="grid min-h-0 gap-4">
            <CountryTableFilters
              searchQuery={countrySearchQuery}
              searchPlaceholder="Search countries..."
              searchAriaLabel="Search countries"
              selectedFilter={countryTableFilter}
              filterOptions={countryTableFilterOptions}
              mobileFiltersFullWidth
              hideActionOnMobile
              action={
                <Button
                  size="lg"
                  disabled={!canDownloadRollInvoices}
                  onClick={downloadRollInvoicesCsv}
                >
                  <DownloadIcon />
                  Roll Invoices CSV ({approvedRollInternalIds.length})
                </Button>
              }
              onSearchQueryChange={setCountrySearchQuery}
              onSelectedFilterChange={(value) =>
                setCountryTableFilter(value as CountryTableFilterId)
              }
            />
            <Card className="rounded-none bg-transparent py-0 shadow-none ring-0 md:overflow-hidden md:rounded-lg md:bg-card md:py-(--card-spacing) md:shadow-sm md:ring-1">
              <CardContent className="grid gap-3 px-0 md:block md:overflow-x-auto">
                <div className="grid gap-3 md:hidden">
                  {filteredCountryRows.map(({ row, rowIndex }) => {
                    const isParentRow = row.checkable === false
                    const isFrabemarParentRow = row.id === "frabemar"
                    const requiredTasks = getRequiredTasks(row)
                    const childRows = isParentRow
                      ? template.countries
                          .slice(
                            rowIndex + 1,
                            findChildInsertIndex(template, rowIndex)
                          )
                          .filter((childRow) => childRow.checkable !== false)
                      : []
                    const doneCount = isParentRow
                      ? 0
                      : requiredTasks.filter((task) =>
                          asBool(checked[taskKey(row.id, task.id)])
                        ).length
                    const rowNote = asString(checked[noteKey(row.id)])
                    const exchangeRate = asNumber(
                      checked[exchangeRateKey(row.id)]
                    )
                    const exchangeRateDisplay = asString(
                      checked[exchangeRateDisplayKey(row.id)]
                    )
                    const isEditingNote = editingNoteRowId === row.id
                    const actionRows = isParentRow ? childRows : [row]
                    const actionTaskCount = actionRows.reduce(
                      (sum, actionRow) =>
                        sum + getRequiredTasks(actionRow).length,
                      0
                    )
                    const actionDoneCount = actionRows.reduce(
                      (sum, actionRow) =>
                        sum +
                        getRequiredTasks(actionRow).filter((task) =>
                          asBool(checked[taskKey(actionRow.id, task.id)])
                        ).length,
                      0
                    )
                    const canCheckAll = actionDoneCount < actionTaskCount
                    const canUncheckAll =
                      actionTaskCount > 0 && actionDoneCount === actionTaskCount
                    const hasActionTargets =
                      canCheckAll || canUncheckAll || Boolean(rowNote)
                    const isRowComplete = isParentRow
                      ? actionTaskCount > 0 &&
                        actionDoneCount === actionTaskCount
                      : requiredTasks.length > 0 &&
                        doneCount === requiredTasks.length

                    return (
                      <div
                        key={row.id}
                        className={
                          "grid gap-3 rounded-lg border bg-background p-3 " +
                          (isRowComplete
                            ? "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-50"
                            : isParentRow
                              ? "bg-muted/40"
                              : "")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={
                              isParentRow
                                ? "min-w-0 font-semibold"
                                : "min-w-0 font-medium"
                            }
                            style={{
                              paddingLeft: `${row.indent * 1}rem`,
                            }}
                          >
                            {isParentRow && !isFrabemarParentRow ? (
                              <div className="truncate">{row.name}</div>
                            ) : (
                              <AppLink
                                href={countryRecordHref(
                                  activePeriod,
                                  row.id,
                                  row,
                                  checked
                                )}
                                className="block truncate underline-offset-4 hover:underline"
                                onClick={() =>
                                  saveCurrentMonthEndReturnPoint(row.id)
                                }
                              >
                                {row.name}
                              </AppLink>
                            )}
                            {!isParentRow ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {doneCount}/{requiredTasks.length} complete
                                {exchangeRate !== undefined
                                  ? ` · Rate ${
                                      exchangeRateDisplay ||
                                      formatExchangeRate(exchangeRate)
                                    }`
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                          {hasActionTargets && !isClosed ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${row.name}`}
                                  />
                                }
                              >
                                <MoreHorizontalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-40"
                              >
                                {canCheckAll ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateRowTasks(row, rowIndex, true)
                                    }
                                  >
                                    <CheckCircle2Icon />
                                    Check All
                                  </DropdownMenuItem>
                                ) : null}
                                {canUncheckAll ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateRowTasks(row, rowIndex, false)
                                    }
                                  >
                                    <XIcon />
                                    Uncheck All
                                  </DropdownMenuItem>
                                ) : null}
                                {rowNote ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => deleteNote(row.id)}
                                  >
                                    <Trash2Icon />
                                    Delete Comment
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>

                        {isParentRow ? null : (
                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              {requiredTasks.map((task) => {
                                const key = taskKey(row.id, task.id)
                                const Icon = workflowTaskIcons[task.id]

                                return (
                                  <label
                                    key={task.id}
                                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm font-medium"
                                  >
                                    <Checkbox
                                      checked={asBool(checked[key])}
                                      disabled={isClosed}
                                      onCheckedChange={(value) =>
                                        updateTask(key, value === true)
                                      }
                                    />
                                    <Icon className="size-4 text-muted-foreground" />
                                    <span>{task.label}</span>
                                  </label>
                                )
                              })}
                            </div>

                            {isEditingNote ? (
                              <div className="grid gap-2">
                                <Input
                                  value={noteDraft}
                                  onChange={(event) =>
                                    setNoteDraft(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      saveNote(row.id)
                                    }

                                    if (event.key === "Escape") {
                                      cancelEditNote()
                                    }
                                  }}
                                  className="h-9 text-foreground"
                                  autoFocus
                                />
                                <ButtonGroup className="justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => saveNote(row.id)}
                                  >
                                    <CheckIcon />
                                    Save
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelEditNote}
                                  >
                                    <XIcon />
                                    Cancel
                                  </Button>
                                </ButtonGroup>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isClosed}
                                className="min-h-10 rounded-lg border bg-background px-3 py-2 text-left text-sm text-muted-foreground disabled:cursor-default disabled:opacity-100"
                                onClick={() => startEditNote(row.id)}
                                aria-label={`Edit notes for ${row.name}`}
                              >
                                {rowNote}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {filteredCountryRows.length === 0 ? (
                    <div className="rounded-lg border bg-background px-3 py-8 text-center text-sm text-muted-foreground">
                      No countries match these filters.
                    </div>
                  ) : null}
                </div>

                <Table className="hidden min-w-[900px] table-auto md:table">
                  <colgroup>
                    <col className="w-0" />
                    <col className="min-w-56" />
                    <col className="w-32" />
                    <col className="w-28" />
                    <col className="w-36" />
                    <col className="w-28" />
                    <col className="w-12" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pr-8 pl-[calc(var(--card-spacing)+0.5rem)]">
                        Country
                      </TableHead>
                      <TableHead className="pl-4">Notes</TableHead>
                      <TableHead>Exchange Rate</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Reconciliation</TableHead>
                      <TableHead>Journal</TableHead>
                      <TableHead
                        className="pr-[calc(var(--card-spacing)+0.5rem)]"
                        aria-label="Actions"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCountryRows.map(({ row, rowIndex }) => {
                      const isParentRow = row.checkable === false
                      const isFrabemarParentRow = row.id === "frabemar"
                      const requiredTasks = getRequiredTasks(row)
                      const childRows = isParentRow
                        ? template.countries
                            .slice(
                              rowIndex + 1,
                              findChildInsertIndex(template, rowIndex)
                            )
                            .filter((childRow) => childRow.checkable !== false)
                        : []
                      const doneCount = isParentRow
                        ? 0
                        : requiredTasks.filter((task) =>
                            asBool(checked[taskKey(row.id, task.id)])
                          ).length
                      const rowNote = asString(checked[noteKey(row.id)])
                      const exchangeRate = asNumber(
                        checked[exchangeRateKey(row.id)]
                      )
                      const exchangeRateDisplay = asString(
                        checked[exchangeRateDisplayKey(row.id)]
                      )
                      const isEditingNote = editingNoteRowId === row.id
                      const isEditingExchangeRate =
                        editingExchangeRateRowId === row.id
                      const actionRows = isParentRow ? childRows : [row]
                      const actionTaskCount = actionRows.reduce(
                        (sum, actionRow) =>
                          sum + getRequiredTasks(actionRow).length,
                        0
                      )
                      const actionDoneCount = actionRows.reduce(
                        (sum, actionRow) =>
                          sum +
                          getRequiredTasks(actionRow).filter((task) =>
                            asBool(checked[taskKey(actionRow.id, task.id)])
                          ).length,
                        0
                      )
                      const canCheckAll = actionDoneCount < actionTaskCount
                      const canUncheckAll =
                        actionTaskCount > 0 &&
                        actionDoneCount === actionTaskCount
                      const hasActionTargets =
                        !isClosed &&
                        (canCheckAll || canUncheckAll || Boolean(rowNote))
                      const isRowComplete = isParentRow
                        ? actionTaskCount > 0 &&
                          actionDoneCount === actionTaskCount
                        : requiredTasks.length > 0 &&
                          doneCount === requiredTasks.length

                      return (
                        <TableRow
                          key={row.id}
                          className={
                            isRowComplete
                              ? "bg-emerald-100 hover:bg-emerald-100/80 dark:bg-emerald-900/35 dark:hover:bg-emerald-900/45"
                              : isParentRow
                                ? "bg-muted/40"
                                : undefined
                          }
                        >
                          <TableCell
                            className={
                              isParentRow
                                ? "pr-8 pl-[calc(var(--card-spacing)+0.5rem)] font-semibold whitespace-nowrap"
                                : "pr-8 pl-[calc(var(--card-spacing)+0.5rem)] font-medium whitespace-nowrap"
                            }
                          >
                            {isParentRow && !isFrabemarParentRow ? (
                              <span
                                className="block"
                                style={{
                                  marginLeft: `${row.indent * 1.75}rem`,
                                }}
                              >
                                {row.name}
                              </span>
                            ) : (
                              <AppLink
                                href={countryRecordHref(
                                  activePeriod,
                                  row.id,
                                  row,
                                  checked
                                )}
                                className="block underline-offset-4 hover:underline"
                                onClick={() =>
                                  saveCurrentMonthEndReturnPoint(row.id)
                                }
                                style={{
                                  marginLeft: `${row.indent * 1.75}rem`,
                                }}
                              >
                                {row.name}
                              </AppLink>
                            )}
                          </TableCell>
                          <TableCell className="pl-4 text-muted-foreground">
                            {isEditingNote ? (
                              <div className="flex min-h-8 items-center gap-2">
                                <Input
                                  value={noteDraft}
                                  onChange={(event) =>
                                    setNoteDraft(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      saveNote(row.id)
                                    }

                                    if (event.key === "Escape") {
                                      cancelEditNote()
                                    }
                                  }}
                                  className="h-8 min-w-0 text-foreground"
                                  autoFocus
                                />
                                <ButtonGroup className="shrink-0">
                                  <Button
                                    size="icon"
                                    className="size-8"
                                    onClick={() => saveNote(row.id)}
                                    aria-label={`Save notes for ${row.name}`}
                                  >
                                    <CheckIcon />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    onClick={cancelEditNote}
                                    aria-label={`Cancel notes for ${row.name}`}
                                  >
                                    <XIcon />
                                  </Button>
                                </ButtonGroup>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isClosed}
                                className="block min-h-8 w-full cursor-text truncate rounded-md px-2 py-1 text-left hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent"
                                onClick={() => startEditNote(row.id)}
                                aria-label={`Edit notes for ${row.name}`}
                              >
                                {rowNote}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {isParentRow ? null : (
                              <>
                                {isEditingExchangeRate ? (
                                  <div className="flex min-h-8 items-center gap-2">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={exchangeRateDraft}
                                      onChange={(event) => {
                                        const nextValue = event.target.value

                                        if (
                                          /^\d*(?:[.,]\d{0,4})?$/.test(
                                            nextValue
                                          )
                                        ) {
                                          setExchangeRateDraft(nextValue)
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          saveExchangeRate(row.id)
                                        }

                                        if (event.key === "Escape") {
                                          cancelEditExchangeRate()
                                        }
                                      }}
                                      className="h-8 w-28 text-foreground"
                                      autoFocus
                                      aria-label={`Exchange rate for ${row.name}`}
                                    />
                                    <ButtonGroup className="shrink-0">
                                      <Button
                                        size="icon"
                                        className="size-8"
                                        onClick={() => saveExchangeRate(row.id)}
                                        aria-label={`Save exchange rate for ${row.name}`}
                                      >
                                        <CheckIcon />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-8"
                                        onClick={cancelEditExchangeRate}
                                        aria-label={`Cancel exchange rate for ${row.name}`}
                                      >
                                        <XIcon />
                                      </Button>
                                    </ButtonGroup>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isClosed}
                                    className="block min-h-8 w-28 cursor-text truncate rounded-md px-2 py-1 text-left hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent"
                                    onClick={() =>
                                      startEditExchangeRate(row.id)
                                    }
                                    aria-label={`Edit exchange rate for ${row.name}`}
                                  >
                                    {exchangeRate === undefined
                                      ? ""
                                      : exchangeRateDisplay ||
                                        formatExchangeRate(exchangeRate)}
                                  </button>
                                )}
                              </>
                            )}
                          </TableCell>
                          {workflowTasks.map((task) => {
                            const key = taskKey(row.id, task.id)
                            const isRequired = requiredTasks.some(
                              (requiredTask) => requiredTask.id === task.id
                            )
                            const Icon = workflowTaskIcons[task.id]

                            return (
                              <TableCell key={task.id}>
                                {isParentRow || !isRequired ? null : (
                                  <label className="flex min-h-8 w-fit min-w-20 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/70">
                                    <Checkbox
                                      checked={asBool(checked[key])}
                                      disabled={isClosed}
                                      onCheckedChange={(value) =>
                                        updateTask(key, value === true)
                                      }
                                    />
                                    <Icon className="size-4 text-muted-foreground" />
                                  </label>
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="pr-[calc(var(--card-spacing)+0.5rem)]">
                            {hasActionTargets ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Actions for ${row.name}`}
                                    />
                                  }
                                >
                                  <MoreHorizontalIcon />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="min-w-40"
                                >
                                  {canCheckAll ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateRowTasks(row, rowIndex, true)
                                      }
                                    >
                                      <CheckCircle2Icon />
                                      Check All
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canUncheckAll ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateRowTasks(row, rowIndex, false)
                                      }
                                    >
                                      <XIcon />
                                      Uncheck All
                                    </DropdownMenuItem>
                                  ) : null}
                                  {rowNote ? (
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => deleteNote(row.id)}
                                    >
                                      <Trash2Icon />
                                      Delete Comment
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredCountryRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No countries match these filters.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : null}
        {activeMonthEndSection === "tasks" ? (
          <MonthEndTaskGroupsList
            groups={taskPageGroups}
            checked={checked}
            updateTask={updateTask}
            isReadOnly={isClosed}
          />
        ) : null}
      </div>
    </PageFrame>
  )
}

export default MonthEndView

function findChildInsertIndex(template: MonthEndTemplate, parentIndex: number) {
  const parentIndent = template.countries[parentIndex]?.indent ?? 0
  let index = parentIndex + 1

  while (
    index < template.countries.length &&
    template.countries[index].indent > parentIndent
  ) {
    index += 1
  }

  return index
}
