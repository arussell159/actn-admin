"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  Building2Icon,
  CheckIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  FileTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  exchangeRateKey,
  ensureMonthEndRecord,
  getMonthEndTitle,
  listMonthEndRecords,
  saveMonthEndRecord,
  type MonthEndValue,
  type MonthEndRecord,
} from "@/lib/month-end-db"
import { getCanonicalCountryId } from "@/lib/month-end-master-records"
import {
  getMonthEndTemplate,
  loadMonthEndTemplate,
  workflowTasks,
  type CloseTaskId,
  type MonthEndTemplate,
  type TemplateCountryRow,
  type TemplateSimpleTask,
} from "@/lib/month-end-template"
import { simpleMapAfricaPaths } from "@/lib/simplemap-africa-paths"

const workflowTaskIcons: Record<CloseTaskId, React.ElementType> = {
  invoice: FileTextIcon,
  reconcile: ClipboardCheckIcon,
  journal: Building2Icon,
}

function taskKey(scope: string, taskId: string) {
  return `${scope}__${taskId}`
}

function noteKey(rowId: string) {
  return `${rowId}__note`
}

function countryRecordHref(period: string, countryId: string) {
  const canonicalCountryId = getCanonicalCountryId(countryId)

  return `/month-end/country?period=${encodeURIComponent(
    period
  )}&country=${encodeURIComponent(canonicalCountryId)}`
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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function SingleCheckTaskList({
  title,
  description,
  scope,
  tasks,
  checked,
  updateTask,
}: {
  title: string
  description: string
  scope: string
  tasks: TemplateSimpleTask[]
  checked: Record<string, MonthEndValue>
  updateTask: (key: string, value: boolean) => void
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          {tasks.map((task) => {
            const key = taskKey(scope, task.id)

            return (
              <label
                key={task.id}
                className="flex min-h-14 items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium"
              >
                <Checkbox
                  checked={asBool(checked[key])}
                  onCheckedChange={(value) => updateTask(key, value === true)}
                />
                <span>{task.label}</span>
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

const monthEndRowIdByCountryCode: Record<string, string | undefined> = {
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

const monthEndGroupRowIdsByCountryCode: Record<string, string[] | undefined> = {
  NE: ["antaser", "antaser-oot"],
  CF: ["antaser", "antaser-oot"],
  GW: ["antaser", "antaser-oot"],
  TG: ["antaser-afrique", "antaser-afrique-oot"],
  BI: ["antaser-afrique", "antaser-afrique-oot"],
  GQ: ["antaser-afrique", "antaser-afrique-oot"],
  SS: ["antaser-afrique", "antaser-afrique-oot"],
}

function isMapCountryIncomplete(
  countryCode: string,
  completedByCountryId: Record<string, boolean>
) {
  const groupRowIds = monthEndGroupRowIdsByCountryCode[countryCode]

  if (groupRowIds) {
    return !groupRowIds.every((rowId) => completedByCountryId[rowId])
  }

  const rowId = monthEndRowIdByCountryCode[countryCode]

  return rowId ? !completedByCountryId[rowId] : false
}

function AfricaStatusMap({
  completedByCountryId,
}: {
  completedByCountryId: Record<string, boolean>
}) {
  return (
    <div className="absolute top-2 right-3 z-10 shrink-0">
      <svg
        viewBox="845 245 500 490"
        role="img"
        aria-label="Country completion map"
        className="h-30 w-34"
      >
        {simpleMapAfricaPaths.map((country) => {
          const isIncomplete = isMapCountryIncomplete(
            country.code,
            completedByCountryId
          )

          return (
            <path
              key={country.code}
              d={country.path}
              className={
                isIncomplete
                  ? "fill-muted stroke-background dark:fill-muted/70 dark:stroke-background"
                  : "fill-primary/75 stroke-background dark:fill-primary/85 dark:stroke-background"
              }
              strokeWidth="1.5"
            />
          )
        })}
      </svg>
    </div>
  )
}

export function MonthEndView({ period }: { period?: string } = {}) {
  const router = useRouter()
  const [template, setTemplate] =
    React.useState<MonthEndTemplate>(loadMonthEndTemplate)
  const [record, setRecord] = React.useState<MonthEndRecord | null>(null)
  const recordRef = React.useRef<MonthEndRecord | null>(null)
  const [checked, setChecked] = React.useState<Record<string, MonthEndValue>>(
    {}
  )
  const [editingNoteRowId, setEditingNoteRowId] = React.useState<string | null>(
    null
  )
  const [noteDraft, setNoteDraft] = React.useState("")
  const [hasLoaded, setHasLoaded] = React.useState(false)

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
      setHasLoaded(false)

      try {
        const activeRecord = period
          ? await ensureMonthEndRecord(period)
          : undefined
        const monthEndRecords = period ? [] : await listMonthEndRecords()
        const openRecord =
          activeRecord ??
          monthEndRecords.find((monthEnd) => monthEnd.status === "Open") ??
          null

        if (isMounted) {
          recordRef.current = openRecord
          setRecord(openRecord)
          setChecked(openRecord?.checked ?? {})
        }
      } catch {
        if (isMounted) {
          recordRef.current = null
          setRecord(null)
          setChecked({})
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
  }, [period])

  React.useEffect(() => {
    if (!hasLoaded || !recordRef.current) {
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
        window.dispatchEvent(new Event("month-end:records-updated"))
      } catch {}
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [checked, hasLoaded])

  React.useEffect(() => {
    if (period && record?.status === "Open") {
      router.replace("/month-end")
      return
    }

    if (!period && hasLoaded && !record) {
      router.replace("/month-end/new")
    }
  }, [hasLoaded, period, record?.status, router])

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
  const supplementalTaskSummaryOrder: Record<string, number> = {
    statements: 0,
    "prepaid-accounts": 1,
    "bank-reconciliation": 2,
  }
  const orderedTaskGroups = [...template.taskGroups].sort(
    (first, second) =>
      (supplementalTaskSummaryOrder[first.id] ?? 100) -
      (supplementalTaskSummaryOrder[second.id] ?? 100)
  )
  const supplementalTaskSummaries = orderedTaskGroups.map((group) => {
    const done = group.tasks.filter((task) =>
      asBool(checked[taskKey(group.id, task.id)])
    ).length

    return {
      id: group.id,
      name: group.tab,
      done,
      total: group.tasks.length,
    }
  })
  const grandTotalTasks = totalTasks + supplementalTaskTotal
  const totalDone = countryDone + supplementalTaskDone
  const completion = grandTotalTasks
    ? Math.round((totalDone / grandTotalTasks) * 100)
    : 0
  const completedRows = checkableRows.filter((row) =>
    getRequiredTasks(row).every((task) =>
      asBool(checked[taskKey(row.id, task.id)])
    )
  ).length
  const completedByCountryId = checkableRows.reduce<Record<string, boolean>>(
    (completionById, row) => {
      const requiredTasks = getRequiredTasks(row)

      completionById[row.id] =
        requiredTasks.length > 0 &&
        requiredTasks.every((task) => asBool(checked[taskKey(row.id, task.id)]))

      return completionById
    },
    {}
  )
  const invoiceRequiredRows = checkableRows.filter((row) => row.invoiceRequired)
  const openInvoiceRows = invoiceRequiredRows.filter(
    (row) => !asBool(checked[taskKey(row.id, "invoice")])
  ).length
  const isClosed = record?.status === "Closed"
  const shouldShowPreviousBackButton = Boolean(period && isClosed)
  const activePeriod = record?.period ?? period ?? ""

  function updateTask(key: string, value: boolean) {
    setChecked((current) => ({ ...current, [key]: value }))
  }

  function startEditNote(rowId: string) {
    setEditingNoteRowId(rowId)
    setNoteDraft(asString(checked[noteKey(rowId)]))
  }

  function cancelEditNote() {
    setEditingNoteRowId(null)
    setNoteDraft("")
  }

  function saveNote(rowId: string) {
    const cleanNote = noteDraft.trim()

    setChecked((current) => {
      const nextChecked = { ...current }

      if (cleanNote) {
        nextChecked[noteKey(rowId)] = cleanNote
      } else {
        delete nextChecked[noteKey(rowId)]
      }

      return nextChecked
    })
    cancelEditNote()
  }

  function deleteNote(rowId: string) {
    setChecked((current) => {
      const nextChecked = { ...current }

      delete nextChecked[noteKey(rowId)]

      return nextChecked
    })

    if (editingNoteRowId === rowId) {
      cancelEditNote()
    }
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
    if (!period) {
      router.replace("/month-end/new")
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
    router.replace("/month-end")
    window.dispatchEvent(new Event("month-end:records-updated"))
  }

  function updateRowTasks(
    row: TemplateCountryRow,
    rowIndex: number,
    value: boolean
  ) {
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

  if (!period && hasLoaded && !record) {
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
            <SiteHeader title="New Month End" />
            <div className="grid gap-4 px-4 py-4 lg:px-6">
              <section>
                <h1 className="text-2xl font-semibold">No Open Month End</h1>
              </section>
              <Card className="rounded-lg shadow-sm">
                <CardHeader className="gap-3">
                  <CardTitle>Create a month end to continue</CardTitle>
                  <CardDescription>
                    Current Month is empty because there is no open month-end
                    record.
                  </CardDescription>
                  <Button
                    className="w-fit"
                    render={<AppLink href="/month-end/new" />}
                  >
                    Create Month End
                  </Button>
                </CardHeader>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

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
          <SiteHeader
            title={record ? getMonthEndTitle(record) : "Current Month End"}
          />
          <div className="@container/month-end flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
            <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {shouldShowPreviousBackButton ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="w-fit"
                  aria-label="Back to previous months"
                  render={<AppLink href="/previous-month-ends" />}
                >
                  <ArrowLeftIcon />
                </Button>
              ) : (
                <span className="hidden md:block" aria-hidden="true" />
              )}
              {isClosed ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-fit"
                  onClick={reopenMonth}
                >
                  <CheckCircle2Icon />
                  Reopen Month
                </Button>
              ) : (
                <Button className="w-full sm:w-fit" onClick={closeMonth}>
                  <FileCheck2Icon />
                  Close Month
                </Button>
              )}
            </section>

            <section className="rounded-lg border bg-background p-3 md:hidden">
              <div className="grid grid-cols-3 divide-x">
                <div className="pr-3">
                  <div className="text-[11px] text-muted-foreground">
                    Progress
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {completion}%
                  </div>
                </div>
                <div className="px-3">
                  <div className="text-[11px] text-muted-foreground">
                    Countries
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {completedRows}/{checkableRows.length}
                  </div>
                </div>
                <div className="pl-3">
                  <div className="text-[11px] text-muted-foreground">
                    Invoices
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {openInvoiceRows}/{invoiceRequiredRows.length}
                  </div>
                </div>
              </div>
              <details className="group mt-3 border-t pt-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium marker:hidden">
                  <span>Modules</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {supplementalTaskDone}/{supplementalTaskTotal}
                  </span>
                </summary>
                <div className="mt-2 grid gap-1.5">
                  {supplementalTaskSummaries.length ? (
                    supplementalTaskSummaries.map((module) => (
                      <div
                        key={module.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 truncate">{module.name}</span>
                        <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                          {module.done}/{module.total}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No tasks
                    </span>
                  )}
                </div>
              </details>
            </section>

            <section className="hidden gap-4 md:grid md:grid-cols-4">
              <Card className="rounded-lg shadow-sm">
                <CardHeader className="gap-2">
                  <CardDescription>Progress</CardDescription>
                  <CardTitle className="flex items-end gap-2 text-3xl">
                    {completion}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProgressBar value={completion} />
                </CardContent>
              </Card>
              <Card className="relative overflow-visible rounded-lg shadow-sm">
                <CardHeader className="!flex flex-row flex-nowrap items-start justify-between gap-3 pr-28">
                  <div className="min-w-0 shrink-0">
                    <CardDescription>Countries</CardDescription>
                    <CardTitle className="flex items-center gap-2 text-3xl whitespace-nowrap">
                      <Building2Icon className="size-5 text-muted-foreground" />
                      {completedRows}/{checkableRows.length}
                    </CardTitle>
                  </div>
                  <AfricaStatusMap
                    completedByCountryId={completedByCountryId}
                  />
                </CardHeader>
              </Card>
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardDescription>Waiting on Invoice</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-3xl">
                    <FileTextIcon className="size-5 text-muted-foreground" />
                    {openInvoiceRows}/{invoiceRequiredRows.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <div className="grid gap-2">
                    {supplementalTaskSummaries.length ? (
                      supplementalTaskSummaries.map((module) => {
                        const isComplete =
                          module.total > 0 && module.done === module.total

                        return (
                          <div
                            key={module.id}
                            className={
                              "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm " +
                              (isComplete
                                ? "bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/15 dark:text-emerald-300"
                                : "text-foreground")
                            }
                          >
                            <span className="min-w-0 truncate font-medium">
                              {module.name}
                            </span>
                            <span
                              className={
                                "shrink-0 font-semibold tabular-nums " +
                                (isComplete
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-muted-foreground")
                              }
                            >
                              {module.done}/{module.total}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No tasks
                      </span>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </section>

            <Tabs defaultValue="countries" className="min-h-0 flex-1 gap-4">
              <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <TabsList className="h-auto min-h-11 w-max min-w-full flex-nowrap items-center gap-1 rounded-[1.375rem] p-1 md:min-w-0">
                  <TabsTrigger
                    value="countries"
                    className="h-9 flex-none rounded-[1.05rem] px-4 py-2 leading-none"
                  >
                    {countriesModule.tab}
                  </TabsTrigger>
                  {orderedTaskGroups.map((group) => (
                    <TabsTrigger
                      key={group.id}
                      value={group.id}
                      className="h-9 flex-none rounded-[1.05rem] px-4 py-2 leading-none"
                    >
                      {group.tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="countries" className="min-h-0">
                <Card className="rounded-none bg-transparent py-0 shadow-none ring-0 md:rounded-lg md:bg-card md:py-(--card-spacing) md:shadow-sm md:ring-1">
                  <CardContent className="grid gap-3 px-0 md:block md:overflow-x-auto md:px-(--card-spacing)">
                    <div className="grid gap-3 md:hidden">
                      {template.countries.map((row, rowIndex) => {
                        const isParentRow = row.checkable === false
                        const requiredTasks = getRequiredTasks(row)
                        const childRows = isParentRow
                          ? template.countries
                              .slice(
                                rowIndex + 1,
                                findChildInsertIndex(template, rowIndex)
                              )
                              .filter(
                                (childRow) => childRow.checkable !== false
                              )
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
                          actionTaskCount > 0 &&
                          actionDoneCount === actionTaskCount
                        const hasActionTargets =
                          canCheckAll || canUncheckAll || Boolean(rowNote)
                        const isRowComplete =
                          !isParentRow &&
                          requiredTasks.length > 0 &&
                          doneCount === requiredTasks.length

                        return (
                          <div
                            key={row.id}
                            className={
                              "grid gap-3 rounded-lg border bg-background p-3 " +
                              (isParentRow
                                ? "bg-muted/40"
                                : isRowComplete
                                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/15"
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
                                {isParentRow ? (
                                  <div className="truncate">{row.name}</div>
                                ) : (
                                  <AppLink
                                    href={countryRecordHref(activePeriod, row.id)}
                                    className="block truncate underline-offset-4 hover:underline"
                                  >
                                    {row.name}
                                  </AppLink>
                                )}
                                {!isParentRow ? (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {doneCount}/{requiredTasks.length} complete
                                    {exchangeRate !== undefined
                                      ? ` · Rate ${exchangeRate.toFixed(2)}`
                                      : ""}
                                  </div>
                                ) : null}
                              </div>
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
                                    className="min-h-10 rounded-lg border bg-background px-3 py-2 text-left text-sm text-muted-foreground"
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
                          <TableHead className="pr-8">Country</TableHead>
                          <TableHead className="pl-4">Notes</TableHead>
                          <TableHead>Exchange Rate</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Reconciliation</TableHead>
                          <TableHead>Journal</TableHead>
                          <TableHead aria-label="Actions" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {template.countries.map((row, rowIndex) => {
                          const isParentRow = row.checkable === false
                          const requiredTasks = getRequiredTasks(row)
                          const childRows = isParentRow
                            ? template.countries
                                .slice(
                                  rowIndex + 1,
                                  findChildInsertIndex(template, rowIndex)
                                )
                                .filter(
                                  (childRow) => childRow.checkable !== false
                                )
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
                            actionTaskCount > 0 &&
                            actionDoneCount === actionTaskCount
                          const hasActionTargets =
                            canCheckAll || canUncheckAll || Boolean(rowNote)
                          const isRowComplete =
                            !isParentRow &&
                            requiredTasks.length > 0 &&
                            doneCount === requiredTasks.length

                          return (
                            <TableRow
                              key={row.id}
                              className={
                                isParentRow
                                  ? "bg-muted/40"
                                  : isRowComplete
                                    ? "bg-emerald-50/50 hover:bg-emerald-50/70 dark:bg-emerald-950/15 dark:hover:bg-emerald-950/25"
                                    : undefined
                              }
                            >
                              <TableCell
                                className={
                                  isParentRow
                                    ? "whitespace-nowrap pr-8 font-semibold"
                                    : "whitespace-nowrap pr-8 font-medium"
                                }
                              >
                                {isParentRow ? (
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
                                    href={countryRecordHref(activePeriod, row.id)}
                                    className="block underline-offset-4 hover:underline"
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
                                    className="block min-h-8 w-full cursor-text truncate rounded-md px-2 py-1 text-left hover:bg-muted/70"
                                    onClick={() => startEditNote(row.id)}
                                    aria-label={`Edit notes for ${row.name}`}
                                  >
                                    {rowNote}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {isParentRow || exchangeRate === undefined
                                  ? null
                                  : exchangeRate.toFixed(2)}
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
                              <TableCell>
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
                                            updateRowTasks(
                                              row,
                                              rowIndex,
                                              false
                                            )
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
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              {orderedTaskGroups.map((group) => (
                <TabsContent key={group.id} value={group.id}>
                  <SingleCheckTaskList
                    title={group.title}
                    description={group.description}
                    scope={group.id}
                    tasks={group.tasks}
                    checked={checked}
                    updateTask={updateTask}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
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
