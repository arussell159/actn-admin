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
  createdTime: string
  closedTime: string
  contactName: string
  assigneeName: string
  countryCode?: string
  countryName?: string
}

type ZohoThread = {
  id?: string
  summary?: string
  content?: string
  plainText?: string
  direction?: string
  channel?: string
  status?: string
  visibility?: string
  createdTime?: string
  fromEmailAddress?: string
  to?: string
  author?: {
    name?: string
    type?: string
    email?: string
  }
}

type ZohoTicketResponse = {
  ok: boolean
  tickets: ZohoTicket[]
  message: string
}

type ZohoTicketReaderResponse = {
  ok: boolean
  ticket: ZohoTicket | null
  threads: ZohoThread[]
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

const chartConfig = {
  newTickets: {
    label: "New Tickets",
    color: "#1f4fd8",
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
    key: "outgoingReplies",
    label: "Outgoing",
    color: chartConfig.outgoingReplies.color,
    isDashed: false,
  },
  {
    key: "newTickets",
    label: "New Tickets",
    color: chartConfig.newTickets.color,
    isDashed: false,
  },
  {
    key: "incomingReplies",
    label: "Incoming",
    color: chartConfig.incomingReplies.color,
    isDashed: true,
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

function threadBody(thread: ZohoThread) {
  return (
    thread.plainText ||
    thread.summary ||
    (thread.content ? thread.content.replace(/<[^>]+>/g, " ") : "") ||
    "No reply content returned."
  )
}

function sanitizedThreadHtml(thread: ZohoThread) {
  if (!thread.content) {
    return ""
  }

  return thread.content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\shref=(["'])javascript:[\s\S]*?\1/gi, "")
}

function threadAuthor(thread: ZohoThread) {
  return (
    thread.author?.name ||
    thread.fromEmailAddress ||
    (thread.direction === "out" ? "ACTN" : "Customer")
  )
}

function threadInitials(thread: ZohoThread) {
  const author = threadAuthor(thread)
  const words = author
    .replace(/<[^>]*>/g, "")
    .split(/[\s.-]+/)
    .filter(Boolean)

  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "EM"
  )
}

function threadPreview(thread: ZohoThread) {
  return threadBody(thread).replace(/\s+/g, " ").trim()
}

function formatThreadTime(thread: ZohoThread) {
  return thread.createdTime ? new Date(thread.createdTime).toLocaleString() : ""
}

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

function ThreadContent({
  thread,
  compact = false,
}: {
  thread: ZohoThread
  compact?: boolean
}) {
  const html = sanitizedThreadHtml(thread)

  if (html) {
    return (
      <div
        className={cn(
          "mt-3 overflow-auto rounded-md bg-muted/20 p-3 text-sm leading-6 text-foreground",
          "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
          "[&_br]:block [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3",
          "[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
          compact ? "max-h-36" : "max-h-[60vh]"
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <p
      className={cn(
        "mt-3 overflow-auto whitespace-pre-wrap rounded-md bg-muted/20 p-3 text-sm leading-6",
        compact ? "max-h-36" : "max-h-[60vh]"
      )}
    >
      {threadBody(thread)}
    </p>
  )
}

function TicketThreadList({
  ticketId,
  ticketReader,
  isLoadingTicketReader,
  selectedThreadId,
  setSelectedThreadId,
}: {
  ticketId: string
  ticketReader: ZohoTicketReaderResponse | null
  isLoadingTicketReader: boolean
  selectedThreadId: string
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string>>
}) {
  const latestThread = ticketReader?.threads[0]
  const threadHistory = ticketReader?.threads.slice(1) ?? []

  if (isLoadingTicketReader) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Loading recent replies...
      </div>
    )
  }

  if (!ticketReader?.ok || !latestThread) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        {ticketReader?.message ?? "No recent replies found."}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {[latestThread, ...threadHistory].map((thread, index) => {
        const threadKey = thread.id ?? `${ticketId}-${index}`
        const isThreadOpen = selectedThreadId === threadKey
        const isOutbound = thread.direction === "out"

        return (
          <article
            key={threadKey}
            className="overflow-hidden rounded-md border bg-muted/30"
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              onClick={() =>
                setSelectedThreadId(isThreadOpen ? "" : threadKey)
              }
              aria-expanded={isThreadOpen}
            >
              <span className="relative mt-1 grid size-9 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium">
                {threadInitials(thread)}
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background",
                    isOutbound ? "bg-primary" : "bg-emerald-500"
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-foreground">
                    {threadAuthor(thread)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatThreadTime(thread)}
                  </span>
                </span>
                <span className="mt-2 line-clamp-2 text-sm leading-6 text-foreground">
                  {threadPreview(thread)}
                </span>
              </span>
              <MailIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </button>
            {isThreadOpen ? (
              <div className="border-t bg-background px-4 pb-4">
                <ThreadContent thread={thread} />
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

export function DashboardView() {
  const isMobile = useIsMobile()
  const [zohoData, setZohoData] = React.useState<ZohoTicketResponse | null>(
    null
  )
  const [zohoMetrics, setZohoMetrics] =
    React.useState<ZohoDashboardMetricResponse | null>(null)
  const [selectedTicketId, setSelectedTicketId] = React.useState("")
  const [selectedThreadId, setSelectedThreadId] = React.useState("")
  const [ticketReader, setTicketReader] =
    React.useState<ZohoTicketReaderResponse | null>(null)
  const [isLoadingTicketReader, setIsLoadingTicketReader] =
    React.useState(false)
  const [isSyncingZoho, setIsSyncingZoho] = React.useState(false)
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
      const [ticketsResponse, metricsResponse] = await Promise.all([
        fetch("/api/zoho-desk/tickets?limit=100", {
          cache: "no-store",
        }),
        fetch("/api/zoho-desk/dashboard-metrics", {
          cache: "no-store",
        }),
      ])
      const data = (await ticketsResponse.json()) as ZohoTicketResponse
      const metrics =
        (await metricsResponse.json()) as ZohoDashboardMetricResponse

      setZohoData(data)
      setZohoMetrics(metrics)
    } catch (error) {
      setZohoData({
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

  async function openTicketReader(ticketId: string) {
    if (selectedTicketId === ticketId) {
      setSelectedTicketId("")
      setSelectedThreadId("")
      setTicketReader(null)
      return
    }

    setSelectedTicketId(ticketId)
    setSelectedThreadId("")
    setIsLoadingTicketReader(true)

    try {
      const response = await fetch(
        `/api/zoho-desk/tickets/${encodeURIComponent(ticketId)}/reader`,
        {
          cache: "no-store",
        }
      )
      const data = (await response.json()) as ZohoTicketReaderResponse

      setTicketReader(data)
    } catch (error) {
      setTicketReader({
        ok: false,
        ticket: null,
        threads: [],
        message:
          error instanceof Error ? error.message : "Could not read ticket.",
      })
    } finally {
      setIsLoadingTicketReader(false)
    }
  }

  const tickets = zohoData?.tickets ?? []
  const hourlyTicketData = zohoMetrics?.chartData ?? []
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
  const dailyReplyTotals = hourlyTicketData.reduce(
    (totals, hour) => ({
      incoming: totals.incoming + (hour.incomingReplies ?? 0),
      outgoing: totals.outgoing + (hour.outgoingReplies ?? 0),
    }),
    {
      incoming: 0,
      outgoing: 0,
    }
  )
  const newTicketTotal = zohoMetrics?.totals.newTickets ?? 0
  const openTicketTotal = tickets.filter((ticket) => {
    const status = `${ticket.status} ${ticket.statusType}`.toLowerCase()

    return !status.includes("closed")
  }).length
  const agentTicketCounts = React.useMemo(() => {
    const counts = new Map<string, number>()

    tickets.forEach((ticket) => {
      if (!isToday(ticket.createdTime)) {
        return
      }

      const assigneeName = ticket.assigneeName || "Unassigned"

      counts.set(assigneeName, (counts.get(assigneeName) ?? 0) + 1)
    })

    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name)
    )
  }, [tickets])
  const todayCountryTickets = React.useMemo(
    () =>
      tickets
        .filter((ticket) => isToday(ticket.createdTime))
        .map((ticket) => ({
          ticket,
          countryId: countryRowIdForTicket(ticket),
        }))
        .filter((item) => item.countryId),
    [tickets]
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
  const activeCountryId =
    selectedCountryId || countryTicketLeaders[0]?.countryId || ""

  const dashboardStats = [
    {
      label: "New Tickets",
      value: zohoMetrics?.ok ? newTicketTotal.toLocaleString() : "-",
      icon: MailIcon,
    },
    {
      label: "Incoming",
      value: zohoMetrics?.ok ? dailyReplyTotals.incoming.toLocaleString() : "-",
      icon: DatabaseIcon,
    },
    {
      label: "Outgoing",
      value: zohoMetrics?.ok ? dailyReplyTotals.outgoing.toLocaleString() : "-",
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
      label: "Incoming",
      value: zohoMetrics?.ok
        ? (currentHourTicketData?.incomingReplies ?? 0).toLocaleString()
        : "-",
    },
    {
      label: "Outgoing",
      value: zohoMetrics?.ok
        ? (currentHourTicketData?.outgoingReplies ?? 0).toLocaleString()
        : "-",
    },
  ]

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
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="group mt-3 border-t pt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium marker:hidden">
                      <span>Agents</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {agentTicketCounts
                          .reduce((total, agent) => total + agent.count, 0)
                          .toLocaleString()}{" "}
                        assigned
                      </span>
                    </summary>
                    <div className="mt-2 grid gap-1.5">
                      {agentTicketCounts.length ? (
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
                          {countryTicketLeaders[0]?.count ?? 0}
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
                            {stat.value}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    )
                  })}
                </section>

                {isCountryMapOpen ? (
                  <section className="hidden px-4 md:block lg:px-6">
                    <Card>
                      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
                        <div className="grid min-h-[24rem] place-items-center p-4">
                          <CountryTicketHeatMap
                            countryCounts={countryTicketCounts}
                            selectedCountryId={activeCountryId}
                            onSelectCountry={setSelectedCountryId}
                            className="h-full max-h-[30rem] w-full"
                          />
                        </div>
                        <div className="grid content-start gap-1.5">
                          {countryTicketLeaders.length ? (
                            countryTicketLeaders.map((country) => (
                              <button
                                key={country.countryId}
                                type="button"
                              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
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
                      <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[250px] w-full"
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
                            dataKey="outgoingReplies"
                            fill={chartConfig.outgoingReplies.color}
                            fillOpacity={0.8}
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
                          <Line
                            dataKey="incomingReplies"
                            type="natural"
                            stroke={chartConfig.incomingReplies.color}
                            strokeWidth={3}
                            strokeDasharray="7 5"
                            dot={false}
                            activeDot={{ r: 5 }}
                          />
                        </ComposedChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                  <Card className="hidden shadow-sm md:flex lg:col-span-1">
                    <CardHeader>
                      <CardTitle>Agents</CardTitle>
                    </CardHeader>
                    <CardContent className="grid content-start">
                      {agentTicketCounts.length ? (
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
                    <h2 className="px-1 text-base font-medium">Open Tickets</h2>
                    {tickets.length ? (
                      tickets.map((ticket) => {
                        const isSelected = selectedTicketId === ticket.id

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
                              </div>
                              <button
                                type="button"
                                className="grid gap-2 text-left"
                                onClick={() => openTicketReader(ticket.id)}
                                aria-expanded={isSelected}
                              >
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
                              </button>
                            </div>
                            {isSelected ? (
                              <div className="border-t bg-muted/20 p-3">
                                <TicketThreadList
                                  ticketId={ticket.id}
                                  ticketReader={ticketReader}
                                  isLoadingTicketReader={isLoadingTicketReader}
                                  selectedThreadId={selectedThreadId}
                                  setSelectedThreadId={setSelectedThreadId}
                                />
                              </div>
                            ) : null}
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
                      <CardTitle>Open Tickets</CardTitle>
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
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead className="w-44 pr-6">
                              Assigned To
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.length ? (
                            tickets.map((ticket) => {
                              const isSelected = selectedTicketId === ticket.id

                              return (
                                <React.Fragment
                                  key={ticket.id || ticket.ticketNumber}
                                >
                                  <TableRow
                                    className="cursor-pointer"
                                    data-state={isSelected ? "selected" : ""}
                                    onClick={() => openTicketReader(ticket.id)}
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
                                      <button
                                        className="block max-w-[680px] truncate text-left underline-offset-4 hover:underline"
                                        type="button"
                                        title={ticket.subject}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openTicketReader(ticket.id)
                                        }}
                                      >
                                        {ticket.subject || "-"}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      {ticket.status ||
                                        ticket.statusType ||
                                        "-"}
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
                                  {isSelected ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={5}
                                        className="bg-muted/30 p-0"
                                      >
                                        <div className="border-y bg-background px-6 py-4">
                                          <div className="grid gap-3">
                                            <TicketThreadList
                                              ticketId={ticket.id}
                                              ticketReader={ticketReader}
                                              isLoadingTicketReader={
                                                isLoadingTicketReader
                                              }
                                              selectedThreadId={
                                                selectedThreadId
                                              }
                                              setSelectedThreadId={
                                                setSelectedThreadId
                                              }
                                            />
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : null}
                                </React.Fragment>
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
