"use client"

import * as React from "react"
import {
  DatabaseIcon,
  MailIcon,
  MapIcon,
} from "lucide-react"
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { simpleMapAfricaPaths } from "@/lib/simplemap-africa-paths"
import { cn } from "@/lib/utils"

type ZohoTicket = {
  id: string
  ticketNumber: string
  subject: string
  status: string
  statusType: string
  channel: string
  teamName: string
  responseDueTime: string
  repliedTime: string
  threadCount?: number
  createdTime: string
  closedTime: string
  contactName: string
  assigneeName: string
  countryCode?: string
  countryName?: string
}

type ZohoTicketResponse = {
  ok: boolean
  tickets: ZohoTicket[]
  message: string
}

type ZohoDashboardMetricResponse = {
  ok: boolean
  chartData: {
    hour: string
    newTickets: number
    closedTickets: number
    onHoldTickets: number
    incomingReplies?: number
    outgoingReplies?: number
  }[]
  totals: {
    newTickets: number
    closedTickets: number
    onHoldTickets: number
  }
  message: string
}

type ZohoDashboardBundleResponse = {
  ok: boolean
  tickets: ZohoTicket[]
  todayTickets: ZohoTicket[]
  metrics: ZohoDashboardMetricResponse
  message: string
}

const chartConfig = {
  newTickets: {
    label: "New Tickets",
    color: "#1f4fd8",
  },
  closedTickets: {
    label: "Closed Tickets",
    color: "#22a347",
  },
  incomingReplies: {
    label: "Incoming",
    color: "#7aa7ff",
  },
  outgoingReplies: {
    label: "Outgoing",
    color: "#22a347",
  },
} satisfies ChartConfig

const ticketVolumeLegend = [
  {
    key: "closedTickets",
    label: "Closed Tickets",
    color: chartConfig.closedTickets.color,
    isDashed: false,
  },
  {
    key: "newTickets",
    label: "New Tickets",
    color: chartConfig.newTickets.color,
    isDashed: false,
  },
] as const

const dashboardCountryRowIdByCode: Record<string, string | undefined> = {
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

const dashboardCountryLabelsByRowId: Record<string, string> = {
  angola: "Angola",
  benin: "Benin",
  "burkina-faso": "Burkina Faso",
  cameroon: "Cameroon",
  "foremost-chad": "Chad",
  "frabemar-dr-congo": "DR Congo",
  "frabemar-gabon": "Gabon",
  "frabemar-mali": "Mali",
  "frabemar-republic-of-guinea": "Republic of Guinea",
  "gtms-liberia": "Liberia",
  "ivory-coast": "Ivory Coast",
  madagascar: "Madagascar",
  "republic-of-congo": "Republic of Congo",
  "sck-djibouti": "Djibouti",
  "sck-kenya": "Kenya",
  "sck-sierra-leone": "Sierra Leone",
  "sck-somalia": "Somalia",
  "sck-sudan": "Sudan",
  "sck-yemen": "Yemen",
  senegal: "Senegal",
  antaser: "Antaser",
  "antaser-afrique": "Antaser Afrique",
}

const ticketCountryMatchers = Object.entries(dashboardCountryLabelsByRowId).map(
  ([rowId, label]) => ({
    rowId,
    label,
    pattern: new RegExp(
      label
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+"),
      "i"
    ),
  })
)

function isToday(value: string) {
  if (!value) {
    return false
  }

  const date = new Date(value)
  const today = new Date()

  return date.toDateString() === today.toDateString()
}

function zohoTicketUrl(ticket: ZohoTicket) {
  return `https://desk.zoho.com/agent/africactnllc/info/tickets/details/${encodeURIComponent(
    ticket.id || ticket.ticketNumber
  )}`
}

function formatThreadCount(ticket: ZohoTicket) {
  return typeof ticket.threadCount === "number"
    ? ticket.threadCount.toLocaleString()
    : "-"
}

function countryRowIdForTicket(ticket: ZohoTicket) {
  if (ticket.countryCode) {
    return dashboardCountryRowIdByCode[ticket.countryCode.toUpperCase()] ?? ""
  }

  if (ticket.countryName) {
    const directMatch = ticketCountryMatchers.find(
      (matcher) => matcher.label.toLowerCase() === ticket.countryName?.toLowerCase()
    )

    if (directMatch) {
      return directMatch.rowId
    }
  }

  const searchableText = [
    ticket.countryName,
    ticket.teamName,
    ticket.subject,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    ticketCountryMatchers.find((matcher) =>
      matcher.pattern.test(searchableText)
    )?.rowId ?? ""
  )
}

function countryHeatClass(count: number, maxCount: number) {
  if (!count) {
    return "fill-muted stroke-background dark:fill-muted/70 dark:stroke-background"
  }

  const heat = maxCount ? count / maxCount : 0

  if (heat >= 0.75) {
    return "fill-primary stroke-background dark:fill-primary dark:stroke-background"
  }

  if (heat >= 0.4) {
    return "fill-primary/70 stroke-background dark:fill-primary/75 dark:stroke-background"
  }

  return "fill-primary/40 stroke-background dark:fill-primary/50 dark:stroke-background"
}

function CountryTicketHeatMap({
  countryCounts,
  selectedCountryId,
  onSelectCountry,
  className,
}: {
  countryCounts: Map<string, number>
  selectedCountryId?: string
  onSelectCountry?: (countryId: string) => void
  className?: string
}) {
  const maxCount = Math.max(0, ...Array.from(countryCounts.values()))

  return (
    <svg
      viewBox="845 245 500 490"
      role="img"
      aria-label="New ticket country heat map"
      className={className}
    >
      {simpleMapAfricaPaths.map((country) => {
        const countryId = dashboardCountryRowIdByCode[country.code]
        const count = countryId ? countryCounts.get(countryId) ?? 0 : 0
        const isSelected = countryId && countryId === selectedCountryId

        return (
          <path
            key={country.code}
            d={country.path}
            className={cn(
              countryHeatClass(count, maxCount),
              countryId &&
                "cursor-pointer transition-opacity hover:opacity-80",
              isSelected && "stroke-primary"
            )}
            strokeWidth={isSelected ? "3" : "1.5"}
            onClick={(event) => {
              if (!countryId || !onSelectCountry) {
                return
              }

              event.stopPropagation()
              onSelectCountry(countryId)
            }}
          />
        )
      })}
    </svg>
  )
}

function TicketVolumeSkeleton() {
  return (
    <div className="grid h-[250px] content-end gap-4 px-2 pb-2">
      <div className="grid gap-4">
        {[0, 1, 2, 3, 4].map((line) => (
          <Skeleton key={line} className="h-px rounded-none" />
        ))}
      </div>
      <div className="flex h-32 items-end gap-3">
        {[28, 44, 36, 68, 52, 82, 46, 62, 38, 72, 48, 58].map(
          (height, index) => (
            <Skeleton
              key={index}
              className="flex-1 rounded-t-md"
              style={{ height: `${height}%` }}
            />
          )
        )}
      </div>
      <div className="grid grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <Skeleton key={tick} className="h-3" />
        ))}
      </div>
    </div>
  )
}

function AgentListSkeleton() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex items-center justify-between gap-3 py-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-8 rounded-md" />
        </div>
      ))}
    </div>
  )
}

function MobileTicketSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="rounded-[min(var(--radius-4xl),24px)] border bg-background p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="mt-3 h-5 w-11/12" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function DesktopTicketTableSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <TableRow key={row}>
          <TableCell className="pl-6">
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-full max-w-[520px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="pr-6">
            <Skeleton className="h-4 w-28" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function DashboardView() {
  const isMobile = useIsMobile()
  const [zohoData, setZohoData] = React.useState<ZohoTicketResponse | null>(
    null
  )
  const [zohoTodayData, setZohoTodayData] =
    React.useState<ZohoTicketResponse | null>(null)
  const [zohoMetrics, setZohoMetrics] =
    React.useState<ZohoDashboardMetricResponse | null>(null)
  const [isSyncingZoho, setIsSyncingZoho] = React.useState(true)
  const [timeRange, setTimeRange] = React.useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
      ? "6h"
      : "24h"
  )
  const [isCountryMapOpen, setIsCountryMapOpen] = React.useState(false)
  const [selectedCountryId, setSelectedCountryId] = React.useState("")

  async function syncZohoDesk() {
    setIsSyncingZoho(true)

    try {
      const response = await fetch("/api/zoho-desk/dashboard?limit=400", {
        cache: "no-store",
      })
      const dashboard = (await response.json()) as ZohoDashboardBundleResponse

      setZohoData({
        ok: dashboard.ok,
        tickets: dashboard.tickets,
        message: dashboard.message,
      })
      setZohoTodayData({
        ok: dashboard.ok,
        tickets: dashboard.todayTickets,
        message: dashboard.message,
      })
      setZohoMetrics(dashboard.metrics)
    } catch (error) {
      setZohoData({
        ok: false,
        tickets: [],
        message:
          error instanceof Error ? error.message : "Could not reach Zoho Desk.",
      })
      setZohoTodayData({
        ok: false,
        tickets: [],
        message:
          error instanceof Error ? error.message : "Could not reach Zoho Desk.",
      })
      setZohoMetrics({
        ok: false,
        chartData: [],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message:
          error instanceof Error ? error.message : "Could not reach Zoho Desk.",
      })
    } finally {
      setIsSyncingZoho(false)
    }
  }

  React.useEffect(() => {
    syncZohoDesk()
  }, [])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("6h")
    }
  }, [isMobile])

  const tickets = zohoData?.tickets ?? []
  const todayCreatedTickets = zohoTodayData?.tickets ?? []
  const hourlyTicketData = zohoMetrics?.chartData ?? []
  const isInitialZohoLoad = isSyncingZoho && !zohoData && !zohoMetrics
  const selectedTimeRange = timeRange
  const filteredHourlyTicketData = React.useMemo(() => {
    const hoursToShow =
      selectedTimeRange === "1h"
        ? 1
        : selectedTimeRange === "6h"
          ? 6
          : selectedTimeRange === "12h"
            ? 12
            : 24

    return hourlyTicketData.slice(-hoursToShow)
  }, [hourlyTicketData, selectedTimeRange])
  const currentHourTicketData = hourlyTicketData[hourlyTicketData.length - 1]
  const newTicketTotal = zohoMetrics?.totals.newTickets ?? 0
  const closedTicketTotal = zohoMetrics?.totals.closedTickets ?? 0
  const openTicketTotal = tickets.filter((ticket) => {
    const status = `${ticket.status} ${ticket.statusType}`.toLowerCase()

    return !status.includes("closed")
  }).length
  const openTicketsCountLabel = zohoData?.ok
    ? openTicketTotal.toLocaleString()
    : null
  const agentTicketCounts = React.useMemo(() => {
    const counts = new Map<string, number>()

    todayCreatedTickets.forEach((ticket) => {
      const assigneeName = ticket.assigneeName || "Unassigned"

      counts.set(assigneeName, (counts.get(assigneeName) ?? 0) + 1)
    })

    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name)
    )
  }, [todayCreatedTickets])
  const todayCountryTickets = React.useMemo(
    () =>
      todayCreatedTickets
        .map((ticket) => ({
          ticket,
          countryId: countryRowIdForTicket(ticket),
        }))
        .filter((item) => item.countryId),
    [todayCreatedTickets]
  )
  const countryTicketCounts = React.useMemo(() => {
    const counts = new Map<string, number>()

    todayCountryTickets.forEach(({ countryId }) => {
      counts.set(countryId, (counts.get(countryId) ?? 0) + 1)
    })

    return counts
  }, [todayCountryTickets])
  const countryTicketLeaders = React.useMemo(
    () => {
      const labels = new Map<string, string>()

      todayCountryTickets.forEach(({ countryId, ticket }) => {
        if (!labels.has(countryId)) {
          labels.set(
            countryId,
            ticket.teamName ||
              ticket.countryName ||
              dashboardCountryLabelsByRowId[countryId] ||
              countryId
          )
        }
      })

      return Array.from(countryTicketCounts, ([countryId, count]) => ({
        countryId,
        count,
        label: labels.get(countryId) ?? countryId,
      })).sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label)
      )
    },
    [countryTicketCounts, todayCountryTickets]
  )
  const countryTicketTotal = React.useMemo(
    () =>
      Array.from(countryTicketCounts.values()).reduce(
        (total, count) => total + count,
        0
      ),
    [countryTicketCounts]
  )
  const activeCountryId =
    selectedCountryId || countryTicketLeaders[0]?.countryId || ""

  const dashboardStats = [
    {
      label: "New Tickets",
      value: zohoMetrics?.ok ? newTicketTotal.toLocaleString() : "-",
      icon: MailIcon,
    },
    {
      label: "Closed Tickets",
      value: zohoMetrics?.ok ? closedTicketTotal.toLocaleString() : "-",
      icon: DatabaseIcon,
    },
    {
      label: "Open Tickets",
      value: zohoData?.ok ? openTicketTotal.toLocaleString() : "-",
      icon: DatabaseIcon,
    },
  ]
  const mobileDashboardStats = [
    {
      label: "New Tickets",
      value: zohoMetrics?.ok
        ? (currentHourTicketData?.newTickets ?? 0).toLocaleString()
        : "-",
    },
    {
      label: "Closed",
      value: zohoMetrics?.ok
        ? (currentHourTicketData?.closedTickets ?? 0).toLocaleString()
        : "-",
    },
    {
      label: "Open",
      value: zohoData?.ok ? openTicketTotal.toLocaleString() : "-",
    },
  ]

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
          "--mobile-page-bottom-padding":
            "calc(10rem + env(safe-area-inset-bottom, 0px))",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title="Dashboard" />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <section className="mx-4 rounded-[min(var(--radius-4xl),24px)] border bg-linear-to-t from-primary/5 to-card p-3 shadow-sm md:hidden dark:bg-card">
                  <div className="grid grid-cols-3 divide-x">
                    {mobileDashboardStats.map((stat, index) => (
                      <div
                        key={stat.label}
                        className={
                          index === 0
                            ? "pr-3"
                            : index === mobileDashboardStats.length - 1
                              ? "pl-3"
                              : "px-3"
                        }
                      >
                        <div className="text-[11px] text-muted-foreground">
                          {stat.label}
                        </div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">
                          {isInitialZohoLoad ? (
                            <Skeleton className="h-6 w-10" />
                          ) : (
                            stat.value
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="group mt-3 border-t pt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium marker:hidden">
                      <span>Agents</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {isInitialZohoLoad ? (
                          <Skeleton className="inline-block h-4 w-20 align-middle" />
                        ) : (
                          <>
                            {agentTicketCounts
                              .reduce((total, agent) => total + agent.count, 0)
                              .toLocaleString()}{" "}
                            assigned
                          </>
                        )}
                      </span>
                    </summary>
                    <div className="mt-2 grid gap-1.5">
                      {isInitialZohoLoad ? (
                        <AgentListSkeleton />
                      ) : agentTicketCounts.length ? (
                        agentTicketCounts.map((agent) => (
                          <div
                            key={agent.name}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              {agent.name}
                            </span>
                            <span className="shrink-0 font-medium text-muted-foreground tabular-nums">
                              {agent.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No new assignments today
                        </span>
                      )}
                    </div>
                  </details>
                </section>

                <section className="hidden gap-4 px-4 md:grid md:grid-cols-4 lg:px-6">
                  <Card
                    className="cursor-pointer bg-linear-to-t from-primary/5 to-card shadow-sm transition-colors hover:bg-muted/30 dark:bg-card"
                    onClick={() => setIsCountryMapOpen((open) => !open)}
                  >
                    <CardHeader className="!flex flex-row flex-nowrap items-start justify-between gap-3 pr-3">
                      <div className="min-w-0">
                        <CardDescription>Country Heat Map</CardDescription>
                        <CardTitle className="flex items-center gap-2 text-3xl tabular-nums">
                          <MapIcon className="size-5 text-muted-foreground" />
                          {isInitialZohoLoad ? (
                            <Skeleton className="h-8 w-14" />
                          ) : (
                            countryTicketTotal
                          )}
                        </CardTitle>
                      </div>
                      <CountryTicketHeatMap
                        countryCounts={countryTicketCounts}
                        selectedCountryId={activeCountryId}
                        onSelectCountry={(countryId) => {
                          setSelectedCountryId(countryId)
                          setIsCountryMapOpen(true)
                        }}
                        className="h-24 w-28 shrink-0"
                      />
                    </CardHeader>
                  </Card>
                  {dashboardStats.map((stat) => {
                    const Icon = stat.icon

                    return (
                      <Card
                        key={stat.label}
                        className="bg-linear-to-t from-primary/5 to-card shadow-sm dark:bg-card"
                      >
                        <CardHeader>
                          <CardDescription>{stat.label}</CardDescription>
                          <CardTitle className="flex items-center gap-2 text-3xl tabular-nums">
                            <Icon className="size-5 text-muted-foreground" />
                            {isInitialZohoLoad ? (
                              <Skeleton className="h-8 w-16" />
                            ) : (
                              stat.value
                            )}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    )
                  })}
                </section>

                {isCountryMapOpen ? (
                  <section className="hidden px-4 md:block lg:px-6">
                    <Card>
                      <CardContent className="grid h-[clamp(16rem,calc(100svh-17rem),22rem)] gap-4 overflow-hidden p-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
                        <div className="grid min-h-0 place-items-center">
                          <CountryTicketHeatMap
                            countryCounts={countryTicketCounts}
                            selectedCountryId={activeCountryId}
                            onSelectCountry={setSelectedCountryId}
                            className="h-full max-h-full w-full"
                          />
                        </div>
                        <div className="grid min-h-0 content-start gap-1.5 overflow-y-auto pr-1">
                          {isInitialZohoLoad ? (
                            [0, 1, 2, 3, 4, 5].map((row) => (
                              <div
                                key={row}
                                className="flex items-center justify-between gap-3 rounded-md px-3 py-1.5"
                              >
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-6" />
                              </div>
                            ))
                          ) : countryTicketLeaders.length ? (
                            countryTicketLeaders.map((country) => (
                              <button
                                key={country.countryId}
                                type="button"
                                className="flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                                onClick={() =>
                                  setSelectedCountryId(country.countryId)
                                }
                              >
                                <span className="min-w-0 truncate font-medium">
                                  {country.label}
                                </span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                  {country.count}
                                </span>
                              </button>
                            ))
                          ) : (
                            <span className="rounded-md border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                              No country tickets today
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                ) : null}

                <section className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 lg:px-6">
                  <Card className="@container/card lg:col-span-3">
                    <CardHeader>
                      <div className="grid gap-3">
                        <CardTitle>Ticket Volume</CardTitle>
                        <div className="hidden flex-wrap items-center gap-4 text-xs text-muted-foreground md:flex">
                          {ticketVolumeLegend.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center gap-2"
                            >
                              <span
                                className="h-0.5 w-7 rounded-full"
                                style={{
                                  background: item.isDashed
                                    ? `repeating-linear-gradient(90deg, ${item.color} 0 7px, transparent 7px 12px)`
                                    : item.color,
                                }}
                                aria-hidden="true"
                              />
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <CardAction>
                        <ToggleGroup
                          multiple={false}
                          value={selectedTimeRange ? [selectedTimeRange] : []}
                          onValueChange={(value) => {
                            setTimeRange(value[0] ?? "24h")
                          }}
                          variant="outline"
                          className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
                        >
                          <ToggleGroupItem value="24h">Last 24 hours</ToggleGroupItem>
                          <ToggleGroupItem value="12h">Last 12 hours</ToggleGroupItem>
                          <ToggleGroupItem value="1h">Last 1 hour</ToggleGroupItem>
                        </ToggleGroup>
                        <Select
                          value={selectedTimeRange}
                          onValueChange={(value) => {
                            if (value !== null) {
                              setTimeRange(value)
                            }
                          }}
                        >
                          <SelectTrigger
                            className="flex w-36 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                            size="sm"
                            aria-label="Select a time range"
                          >
                            <SelectValue placeholder="Last 24 hours" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="24h" className="rounded-lg">
                              Last 24 hours
                            </SelectItem>
                            <SelectItem value="12h" className="rounded-lg">
                              Last 12 hours
                            </SelectItem>
                            <SelectItem value="6h" className="rounded-lg">
                              Last 6 hours
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                      {isInitialZohoLoad ? (
                        <TicketVolumeSkeleton />
                      ) : (
                        <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[250px] w-full [&_.recharts-bar-rectangle]:cursor-pointer"
                        initialDimension={{ width: 900, height: 250 }}
                      >
                        <ComposedChart
                          data={filteredHourlyTicketData}
                          margin={{ left: 4, right: 12 }}
                          accessibilityLayer
                        >
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="hour"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={36}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                formatter={(value, name, item) => (
                                  <>
                                    <div
                                      className="size-2.5 shrink-0 rounded-[2px]"
                                      style={{
                                        backgroundColor:
                                          item.color ?? "currentColor",
                                      }}
                                    />
                                    <span className="text-muted-foreground">
                                      {chartConfig[
                                        name as keyof typeof chartConfig
                                      ]?.label ?? name}
                                    </span>
                                    <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                                      {Math.abs(Number(value)).toLocaleString()}
                                    </span>
                                  </>
                                )}
                                indicator="dot"
                              />
                            }
                          />
                          <Bar
                            dataKey="closedTickets"
                            fill={chartConfig.closedTickets.color}
                            fillOpacity={0.8}
                            activeBar={{
                              fill: "#2fc85a",
                              fillOpacity: 0.18,
                              stroke: "#16a34a",
                              strokeOpacity: 1,
                              strokeWidth: 2,
                              filter:
                                "drop-shadow(0 0 6px rgba(34, 163, 71, 0.45))",
                            }}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                          <Line
                            dataKey="newTickets"
                            type="natural"
                            stroke={chartConfig.newTickets.color}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5 }}
                          />
                        </ComposedChart>
                      </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="hidden shadow-sm md:flex lg:col-span-1">
                    <CardHeader>
                      <CardTitle>Agents</CardTitle>
                    </CardHeader>
                    <CardContent className="grid content-start">
                      {isInitialZohoLoad ? (
                        <AgentListSkeleton />
                      ) : agentTicketCounts.length ? (
                        agentTicketCounts.map((agent) => (
                          <div
                            key={agent.name}
                            className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {agent.name}
                            </span>
                            <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
                              {agent.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="py-6 text-center text-sm text-muted-foreground">
                          No new assignments today
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </section>

                <section className="px-4 lg:px-6">
                  <div className="grid gap-3 md:hidden">
                    <h2 className="flex items-center gap-1 px-1 text-base font-medium">
                      <span>Open Tickets</span>
                      {isInitialZohoLoad ? (
                        <Skeleton className="h-5 w-8" />
                      ) : (
                        <span>({openTicketsCountLabel ?? "-"})</span>
                      )}
                    </h2>
                    {isInitialZohoLoad ? (
                      <MobileTicketSkeleton />
                    ) : tickets.length ? (
                      tickets.map((ticket) => {
                        return (
                          <article
                            key={ticket.id || ticket.ticketNumber}
                            className="overflow-hidden rounded-[min(var(--radius-4xl),24px)] border bg-background shadow-sm"
                          >
                            <div className="grid gap-2 p-3">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <a
                                  href={zohoTicketUrl(ticket)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-primary underline-offset-4 hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  #{ticket.ticketNumber || "-"}
                                </a>
                                <span className="shrink-0 font-medium text-muted-foreground tabular-nums">
                                  {formatThreadCount(ticket)} threads
                                </span>
                              </div>
                              <div className="grid gap-2 text-left">
                                <span
                                  className="line-clamp-2 text-[15px] font-semibold leading-5"
                                  title={ticket.subject}
                                >
                                  {ticket.subject || "-"}
                                </span>
                                <span className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                  <span>
                                    <span className="font-medium text-foreground">
                                      {ticket.responseDueTime
                                        ? new Date(
                                            ticket.responseDueTime
                                          ).toLocaleString([], {
                                            month: "numeric",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                          })
                                        : "None"}
                                    </span>
                                  </span>
                                  <span>
                                    <span className="font-medium text-foreground">
                                      {ticket.assigneeName || "Unassigned"}
                                    </span>
                                  </span>
                                </span>
                              </div>
                            </div>
                          </article>
                        )
                      })
                    ) : (
                      <div className="rounded-[min(var(--radius-4xl),24px)] border bg-background px-3 py-8 text-center text-sm text-muted-foreground shadow-sm">
                        {zohoData?.message ?? "Checking Zoho Desk..."}
                      </div>
                    )}
                  </div>
                  <Card className="hidden md:flex">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1">
                        <span>Open Tickets</span>
                        {isInitialZohoLoad ? (
                          <Skeleton className="h-6 w-8" />
                        ) : (
                          <span>({openTicketsCountLabel ?? "-"})</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-hidden px-0">
                      <Table className="hidden md:table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32 pl-6">
                              Ticket Number
                            </TableHead>
                            <TableHead className="w-44">
                              Response Due Time
                            </TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="w-32">Threads</TableHead>
                            <TableHead className="w-44 pr-6">
                              Assigned To
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isInitialZohoLoad ? (
                            <DesktopTicketTableSkeleton />
                          ) : tickets.length ? (
                            tickets.map((ticket) => {
                              return (
                                <TableRow
                                  key={ticket.id || ticket.ticketNumber}
                                >
                                    <TableCell className="pl-6 font-medium">
                                      <a
                                        href={zohoTicketUrl(ticket)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-left underline-offset-4 hover:underline"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                        }}
                                      >
                                        {ticket.ticketNumber || "-"}
                                      </a>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {ticket.responseDueTime
                                        ? new Date(
                                            ticket.responseDueTime
                                          ).toLocaleString()
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="min-w-0">
                                      <span
                                        className="block max-w-[680px] truncate text-left"
                                        title={ticket.subject}
                                      >
                                        {ticket.subject || "-"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="font-medium tabular-nums text-muted-foreground">
                                      {formatThreadCount(ticket)}
                                    </TableCell>
                                    <TableCell className="min-w-0 pr-6">
                                      <span
                                        className="block truncate"
                                        title={ticket.assigneeName}
                                      >
                                        {ticket.assigneeName || "-"}
                                      </span>
                                    </TableCell>
                                </TableRow>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="h-32 text-center text-muted-foreground"
                              >
                                {zohoData?.message ?? "Checking Zoho Desk..."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </section>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
