"use client"

import * as React from "react"
import { AppLink } from "@/components/app-link"
import {
  ChevronDownIcon,
  DownloadIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { ClientCell, CountryCell } from "@/components/country-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAgentProfileUrl } from "@/lib/agents"

type ShipmentRow = {
  id: number
  billOfLading: string
  lastUpdated: string
  status: string
  country: string
  client: string
  invoiceNumber: string
  invoicePaid: boolean
  agent: string
}

type SavedView = {
  name: string
  query: string
  statusFilters: string[]
  countryFilters: string[]
  clientFilter: string
}

const defaultViews = [
  { name: "All Records", count: "All" },
]

const statusPillClasses: Record<string, string> = {
  Initiated:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Pending:
    "border-sky-200 bg-sky-200 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  "Missing Docs":
    "border-rose-200 bg-rose-100 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  "Draft Available":
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  "Changes Needed":
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  "Draft Approved":
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  "Validation Submitted":
    "border-emerald-950 bg-slate-800 text-lime-300 dark:border-lime-900 dark:bg-slate-900 dark:text-lime-300",
  Completed:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  Rejected:
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  Cancelled:
    "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`block max-w-full justify-start overflow-hidden text-left text-ellipsis whitespace-nowrap ${statusPillClasses[status] ?? "text-muted-foreground"}`}
    >
      {status}
    </Badge>
  )
}

function InvoiceBadge({
  row,
  onPaidChange,
}: {
  row: ShipmentRow
  onPaidChange: (rowId: number, invoicePaid: boolean) => void
}) {
  const invoiceClass = !row.invoiceNumber
    ? "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-muted bg-muted text-muted-foreground [&>svg]:shrink-0"
    : row.invoicePaid
      ? "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300 [&>svg]:shrink-0"
      : "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 [&>svg]:shrink-0"

  if (!row.invoiceNumber) {
    return (
      <Badge variant="outline" className={invoiceClass}>
        <ReceiptTextIcon />
        <span className="min-w-0 truncate">No invoice</span>
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-auto w-full justify-start rounded-md p-0 outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
        aria-label={`Invoice payment status for ${row.invoiceNumber}`}
      >
        <Badge
          variant="outline"
          className={`${invoiceClass} cursor-pointer`}
        >
          <ReceiptTextIcon />
          <span className="min-w-0 truncate">{row.invoiceNumber}</span>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onPaidChange(row.id, true)}>
          Paid
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPaidChange(row.id, false)}>
          Unpaid
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RowActions({
  row,
  onDelete,
}: {
  row: ShipmentRow
  onDelete: (rowId: number) => void
}) {
  const downloadValidation = React.useCallback(() => {
    const validation = {
      billOfLading: row.billOfLading,
      status: row.status,
      country: row.country,
      client: row.client,
      invoiceNumber: row.invoiceNumber || null,
      invoicePaid: row.invoicePaid,
      agent: row.agent,
      lastUpdated: row.lastUpdated,
    }
    const blob = new Blob([JSON.stringify(validation, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `${row.billOfLading}-validation.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [row])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
        aria-label={`Actions for ${row.billOfLading}`}
      >
        <EllipsisIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<AppLink href={`/classic/${encodeURIComponent(row.billOfLading)}`} />}>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadValidation}>
          <DownloadIcon />
          Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.id)}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ClassicDataTable({
  data,
  showToolbar = true,
  showClientColumn = true,
  showAgentColumn = true,
}: {
  data: ShipmentRow[]
  showToolbar?: boolean
  showClientColumn?: boolean
  showAgentColumn?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [statusFilters, setStatusFilters] = React.useState<string[]>([])
  const [countryFilters, setCountryFilters] = React.useState<string[]>([])
  const [clientFilter, setClientFilter] = React.useState("all")
  const [clientSearch, setClientSearch] = React.useState("")
  const [viewSearch, setViewSearch] = React.useState("")
  const [viewName, setViewName] = React.useState("")
  const [currentViewName, setCurrentViewName] = React.useState("All Records")
  const [isSavingView, setIsSavingView] = React.useState(false)
  const [savedViews, setSavedViews] = React.useState<SavedView[]>(() => {
    if (typeof window === "undefined") return []

    const rawSavedViews = window.localStorage.getItem("classic-table-views")
    if (!rawSavedViews) return []

    try {
      return JSON.parse(rawSavedViews) as SavedView[]
    } catch {
      return []
    }
  })
  const [rows, setRows] = React.useState(() => data)

  const updateInvoicePaid = React.useCallback(
    (rowId: number, invoicePaid: boolean) => {
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === rowId ? { ...row, invoicePaid } : row
        )
      )
    },
    []
  )

  const deleteRow = React.useCallback((rowId: number) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId))
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem(
      "classic-table-views",
      JSON.stringify(savedViews)
    )
  }, [savedViews])
  const statusOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort(),
    [rows]
  )
  const countryOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.country))).sort(),
    [rows]
  )
  const clientOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.client))).sort(),
    [rows]
  )
  const filteredClientOptions = React.useMemo(() => {
    const normalizedClientSearch = clientSearch.trim().toLowerCase()
    if (!normalizedClientSearch) return clientOptions

    return clientOptions.filter((client) =>
      client.toLowerCase().includes(normalizedClientSearch)
    )
  }, [clientOptions, clientSearch])
  const filteredDefaultViews = React.useMemo(() => {
    const normalizedViewSearch = viewSearch.trim().toLowerCase()
    if (!normalizedViewSearch) return defaultViews

    return defaultViews.filter((view) =>
      view.name.toLowerCase().includes(normalizedViewSearch)
    )
  }, [viewSearch])
  const filteredSavedViews = React.useMemo(() => {
    const normalizedViewSearch = viewSearch.trim().toLowerCase()
    if (!normalizedViewSearch) return savedViews

    return savedViews.filter((view) =>
      view.name.toLowerCase().includes(normalizedViewSearch)
    )
  }, [savedViews, viewSearch])
  const agentOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.agent)
            .filter((agent) => agent && agent !== "Assign agent")
        )
      ).sort(),
    [rows]
  )
  const normalizedQuery = query.trim().toLowerCase()
  const hasActiveFilters =
    normalizedQuery ||
    statusFilters.length > 0 ||
    countryFilters.length > 0 ||
    clientFilter !== "all"
  const hasActiveViewOrFilters =
    currentViewName !== "All Records" || Boolean(hasActiveFilters)
  const filteredData = React.useMemo(() => {
    return rows.filter((row) =>
      (statusFilters.length === 0 || statusFilters.includes(row.status)) &&
      (countryFilters.length === 0 || countryFilters.includes(row.country)) &&
      (clientFilter === "all" || row.client === clientFilter) &&
      (!normalizedQuery ||
        [
          row.billOfLading,
          row.lastUpdated,
          row.status,
          row.country,
          row.client,
          row.invoiceNumber,
          row.agent,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery))
    )
  }, [clientFilter, countryFilters, normalizedQuery, rows, statusFilters])

  function toggleFilterValue(
    values: string[],
    value: string,
    setValues: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setValues(
      values.includes(value)
        ? values.filter((currentValue) => currentValue !== value)
        : [...values, value]
    )
  }

  function updateAgent(id: number, agent: string | null) {
    if (!agent) return

    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, agent } : row))
    )
  }

  function saveCurrentView() {
    const normalizedViewName = viewName.trim()
    if (!normalizedViewName) return

    setSavedViews((currentViews) => [
      ...currentViews.filter((view) => view.name !== normalizedViewName),
      {
        name: normalizedViewName,
        query,
        statusFilters,
        countryFilters,
        clientFilter,
      },
    ])
    setCurrentViewName(normalizedViewName)
    setViewName("")
    setIsSavingView(false)
  }

  function applySavedView(view: SavedView) {
    setQuery(view.query)
    setStatusFilters(view.statusFilters)
    setCountryFilters(view.countryFilters)
    setClientFilter(view.clientFilter)
    setCurrentViewName(view.name)
  }

  function applyDefaultView(viewName: string) {
    setQuery("")
    setCountryFilters([])
    setClientFilter("all")
    setCurrentViewName(viewName)

    if (viewName === "All Records") {
      setStatusFilters([])
    } else if (viewName === "Missing Documents") {
      setStatusFilters(["Missing Docs"])
    } else {
      setStatusFilters([viewName])
    }
  }

  function deleteSavedView(viewName: string) {
    setSavedViews((currentViews) =>
      currentViews.filter((view) => view.name !== viewName)
    )

    if (currentViewName === viewName) {
      clearFilters()
    }
  }

  function clearFilters() {
    setQuery("")
    setStatusFilters([])
    setCountryFilters([])
    setClientFilter("all")
    setCurrentViewName("All Records")
  }

  return (
    <div
      className={
        showToolbar
          ? "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 md:gap-4 md:px-4 lg:px-6"
          : "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      }
    >
      {showToolbar ? (
      <div className="hidden shrink-0 items-center justify-between gap-2 overflow-x-auto pb-1 md:flex">
        <div className="flex shrink-0 items-center gap-2">
          {isSavingView ? (
            <>
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="View name"
                className="h-8 w-44 shrink-0 text-sm"
              />
              <Button size="sm" onClick={saveCurrentView}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsSavingView(false)
                  setViewName("")
                }}
              >
                Cancel
              </Button>
            </>
          ) : hasActiveFilters ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  <span className="max-w-44 truncate">
                    {currentViewName} ({filteredData.length})
                  </span>
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-0">
                  <div className="p-3">
                    <Input
                      value={viewSearch}
                      onChange={(event) => setViewSearch(event.target.value)}
                      onKeyDown={(event) => event.stopPropagation()}
                      placeholder="Search View"
                    />
                  </div>
                  <DropdownMenuGroup>
                    {filteredDefaultViews.map((view) => (
                      <DropdownMenuItem
                        key={view.name}
                        onClick={() => applyDefaultView(view.name)}
                        className={
                          currentViewName === view.name ? "bg-muted" : undefined
                        }
                      >
                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {view.count === "All" ? rows.length : view.count}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {filteredSavedViews.map((view) => (
                      <DropdownMenuItem
                        key={view.name}
                        onClick={() => applySavedView(view)}
                        className={
                          currentViewName === view.name
                            ? "group bg-muted pr-2"
                            : "group pr-2"
                        }
                      >
                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {rows.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="ml-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                          aria-label={`Delete ${view.name}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            deleteSavedView(view.name)
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <div className="bg-muted/60 p-1.5">
                    <DropdownMenuItem onClick={() => setIsSavingView(true)}>
                      <PlusIcon />
                      Add Custom View
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={() => setIsSavingView(true)}>
                Save View
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <span className="max-w-44 truncate">
                  {currentViewName} ({filteredData.length})
                </span>
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-0">
                <div className="p-3">
                  <Input
                    value={viewSearch}
                    onChange={(event) => setViewSearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Search View"
                  />
                </div>
                <DropdownMenuGroup>
                  {filteredDefaultViews.map((view) => (
                    <DropdownMenuItem
                      key={view.name}
                      onClick={() => applyDefaultView(view.name)}
                      className={
                        currentViewName === view.name ? "bg-muted" : undefined
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{view.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {view.count === "All" ? rows.length : view.count}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {filteredSavedViews.map((view) => (
                    <DropdownMenuItem
                      key={view.name}
                      onClick={() => applySavedView(view)}
                      className={
                        currentViewName === view.name
                          ? "group bg-muted pr-2"
                          : "group pr-2"
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{view.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {rows.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="ml-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                        aria-label={`Delete ${view.name}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          deleteSavedView(view.name)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="bg-muted/60 p-1.5">
                  <DropdownMenuItem onClick={() => setIsSavingView(true)}>
                    <PlusIcon />
                    Add Custom View
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {hasActiveViewOrFilters ? (
            <Button
              variant="outline"
              size="sm"
              className="min-w-24"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="min-w-32" />}
            >
              <span className="truncate">
                {statusFilters.length
                  ? `${statusFilters.length} statuses`
                  : "All statuses"}
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={statusFilters.length === 0}
                  onCheckedChange={() => setStatusFilters([])}
                >
                  All statuses
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {statusOptions.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() =>
                      toggleFilterValue(statusFilters, status, setStatusFilters)
                    }
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="min-w-32" />}
            >
              <span className="truncate">
                {countryFilters.length
                  ? `${countryFilters.length} countries`
                  : "All countries"}
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Country</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={countryFilters.length === 0}
                  onCheckedChange={() => setCountryFilters([])}
                >
                  All countries
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {countryOptions.map((country) => (
                  <DropdownMenuCheckboxItem
                    key={country}
                    checked={countryFilters.includes(country)}
                    onCheckedChange={() =>
                      toggleFilterValue(
                        countryFilters,
                        country,
                        setCountryFilters
                      )
                    }
                  >
                    {country}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="min-w-32" />}
            >
              <span className="max-w-28 truncate">
                {clientFilter === "all" ? "All clients" : clientFilter}
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="p-1.5">
                <Input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Search clients"
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setClientFilter("all")}>
                All clients
              </DropdownMenuItem>
              {filteredClientOptions.map((client) => (
                <DropdownMenuItem
                  key={client}
                  onClick={() => setClientFilter(client)}
                >
                  <span className="truncate">{client}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative h-8 w-80 shrink-0">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shipments"
              className="h-8 pl-9 text-sm focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
            />
          </div>
        </div>
      </div>
      ) : null}
      {showToolbar ? (
      <div className="flex shrink-0 flex-col gap-2 md:hidden">
        <div className="relative h-8 w-full">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shipments"
            className="h-8 pl-9 text-sm focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {!isSavingView ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <span className="max-w-44 truncate">
                {currentViewName} ({filteredData.length})
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-0">
              <div className="p-3">
                <Input
                  value={viewSearch}
                  onChange={(event) => setViewSearch(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Search View"
                />
              </div>
              <DropdownMenuGroup>
                {filteredDefaultViews.map((view) => (
                  <DropdownMenuItem
                    key={view.name}
                    onClick={() => applyDefaultView(view.name)}
                    className={
                      currentViewName === view.name ? "bg-muted" : undefined
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {view.count === "All" ? rows.length : view.count}
                    </span>
                  </DropdownMenuItem>
                ))}
                {filteredSavedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.name}
                    onClick={() => applySavedView(view)}
                    className={
                      currentViewName === view.name
                        ? "group bg-muted pr-2"
                        : "group pr-2"
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {rows.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                      aria-label={`Delete ${view.name}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        deleteSavedView(view.name)
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <div className="bg-muted/60 p-1.5">
                <DropdownMenuItem onClick={() => setIsSavingView(true)}>
                  <PlusIcon />
                  Add Custom View
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
          {isSavingView ? (
            <>
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="View name"
                className="h-8 w-44 shrink-0 text-sm"
              />
              <Button size="sm" onClick={saveCurrentView}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsSavingView(false)
                  setViewName("")
                }}
              >
                Cancel
              </Button>
            </>
          ) : hasActiveFilters ? (
            <Button size="sm" onClick={() => setIsSavingView(true)}>
              Save View
            </Button>
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-w-[980px] flex-col">
            <Table containerClassName="shrink-0 overflow-visible" className="table-fixed">
              <colgroup>
                <col className={showClientColumn ? "w-[16%]" : "w-[19%]"} />
                <col className={showClientColumn ? "w-[12%]" : "w-[13%]"} />
                <col className={showClientColumn ? "w-[16%]" : "w-[18%]"} />
                <col className={showClientColumn ? "w-[17%]" : "w-[20%]"} />
                {showClientColumn ? <col className="w-[14%]" /> : null}
                <col className={showClientColumn ? "w-[13%]" : "w-[16%]"} />
                {showAgentColumn ? (
                  <col className={showClientColumn ? "w-[12%]" : "w-[14%]"} />
                ) : null}
                <col className="w-[44px]" />
              </colgroup>
              <TableHeader className="bg-muted shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="bg-muted">Bill of Lading</TableHead>
                  <TableHead className="bg-muted">Last Updated</TableHead>
                  <TableHead className="bg-muted">Status</TableHead>
                  <TableHead className="bg-muted">Country</TableHead>
                  {showClientColumn ? (
                    <TableHead className="bg-muted">Client</TableHead>
                  ) : null}
                  <TableHead className="bg-muted">Invoice Number</TableHead>
                  {showAgentColumn ? (
                    <TableHead className="bg-muted">Agent</TableHead>
                  ) : null}
                  <TableHead className="bg-muted" aria-label="Actions" />
                </TableRow>
              </TableHeader>
            </Table>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table containerClassName="overflow-visible" className="table-fixed">
                <colgroup>
                  <col className={showClientColumn ? "w-[16%]" : "w-[19%]"} />
                  <col className={showClientColumn ? "w-[12%]" : "w-[13%]"} />
                  <col className={showClientColumn ? "w-[16%]" : "w-[18%]"} />
                  <col className={showClientColumn ? "w-[17%]" : "w-[20%]"} />
                  {showClientColumn ? <col className="w-[14%]" /> : null}
                  <col className={showClientColumn ? "w-[13%]" : "w-[16%]"} />
                  {showAgentColumn ? (
                    <col className={showClientColumn ? "w-[12%]" : "w-[14%]"} />
                  ) : null}
                  <col className="w-[44px]" />
                </colgroup>
                <TableBody>
                  {filteredData.length ? (
                    filteredData.map((row) => (
                      <TableRow key={row.id} className="h-12">
                        <TableCell className="h-12 truncate py-2 font-medium">
                          <AppLink
                            href={`/classic/${encodeURIComponent(row.billOfLading)}`}
                            className="block truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                          >
                            {row.billOfLading}
                          </AppLink>
                        </TableCell>
                        <TableCell className="h-12 py-2 text-muted-foreground">
                          {row.lastUpdated}
                        </TableCell>
                        <TableCell className="h-12 min-w-0 py-2">
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="h-12 py-2">
                          <CountryCell country={row.country} className="max-w-full" />
                        </TableCell>
                        {showClientColumn ? (
                          <TableCell className="h-12 py-2">
                            <ClientCell client={row.client} className="max-w-full" />
                          </TableCell>
                        ) : null}
                        <TableCell className="h-12 min-w-0 py-2">
                          <InvoiceBadge
                            row={row}
                            onPaidChange={updateInvoicePaid}
                          />
                        </TableCell>
                        {showAgentColumn ? (
                          <TableCell className="h-12 py-2">
                            {row.agent !== "Assign agent" ? (
                              <AppLink
                                href={getAgentProfileUrl(row.agent)}
                                className="block truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                              >
                                {row.agent}
                              </AppLink>
                            ) : (
                              <Select
                                onValueChange={(value) => {
                                  if (typeof value === "string") {
                                    updateAgent(row.id, value)
                                  }
                                }}
                                items={agentOptions.map((agent) => ({
                                  label: agent,
                                  value: agent,
                                }))}
                              >
                                <SelectTrigger
                                  className="h-8 w-full **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
                                  size="sm"
                                  aria-label={`Agent for ${row.billOfLading}`}
                                >
                                  <SelectValue placeholder="Assign agent" />
                                </SelectTrigger>
                                <SelectContent align="end">
                                  <SelectGroup>
                                    {agentOptions.map((agent) => (
                                      <SelectItem key={agent} value={agent}>
                                        {agent}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="h-12 py-2 pr-2 text-right">
                          <RowActions row={row} onDelete={deleteRow} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={
                          6 + (showClientColumn ? 1 : 0) + (showAgentColumn ? 1 : 0)
                        }
                        className="h-24 text-center"
                      >
                        No shipments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-t px-3 text-xs text-muted-foreground md:px-4 md:text-sm">
          <span className="truncate">
            Showing {filteredData.length} of {rows.length} shipments
          </span>
          <span className="shrink-0">Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
