import "server-only"

import {
  getZohoDeskCredentials,
  missingZohoDeskCredentialNames,
} from "@/lib/zoho-desk-env"
import {
  readZohoDeskCache,
  writeZohoDeskCache,
} from "@/lib/zoho-desk-cache"

export type ZohoDeskTicket = {
  id: string
  ticketNumber: string
  subject: string
  status: string
  statusType: string
  channel: string
  departmentId: string
  departmentName: string
  teamId: string
  teamName: string
  responseDueTime: string
  repliedTime: string
  customerResponseTime: string
  threadCount: number
  createdTime: string
  closedTime: string
  modifiedTime: string
  contactName: string
  assigneeName: string
  countryCode?: string
  countryName?: string
}

type ZohoTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type ZohoDeskAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; message: string }

type ZohoTicketResponse = {
  data?: {
    id?: string
    ticketNumber?: string
    subject?: string
    status?: string
    statusType?: string
    channel?: string
    departmentId?: string
    department?: { id?: string; name?: string }
    teamId?: string
    team?: { id?: string; name?: string }
    repliedTime?: string
    latestThreadTime?: string
    lastThreadTime?: string
    lastRepliedTime?: string
    responseTime?: string
    customerResponseTime?: string
    threadCount?: string | number
    threadsCount?: string | number
    conversationCount?: string | number
    responseDueDate?: string
    responseDueTime?: string
    firstResponseDueDate?: string
    firstResponseDueTime?: string
    dueDate?: string
    createdTime?: string
    closedTime?: string
    modifiedTime?: string
    contact?: { firstName?: string; lastName?: string; name?: string }
    assignee?: { firstName?: string; lastName?: string; name?: string }
  }[]
}

type ZohoTicketDetailResponse = {
  id?: string
  ticketNumber?: string
  subject?: string
  status?: string
  statusType?: string
  channel?: string
    departmentId?: string
    department?: { id?: string; name?: string }
  teamId?: string
  team?: { id?: string; name?: string }
  responseDueDate?: string
  responseDueTime?: string
  firstResponseDueDate?: string
  firstResponseDueTime?: string
  dueDate?: string
  createdTime?: string
  modifiedTime?: string
  contact?: { firstName?: string; lastName?: string; name?: string }
  assignee?: { firstName?: string; lastName?: string; name?: string }
}

type ZohoThreadResponse = {
  data?: ZohoDeskThread[]
}

export type ZohoDeskThread = {
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

type ZohoDashboardMetricResponse = {
  groupedBy?: string
  avg?: string
  totalTicketCount?: string
  totalResponseCount?: string
  ticketCount?: {
    value?: string
    count?: string
    referenceValue?: string | null
  }[]
  responseCount?: {
    value?: string
    count?: string
    referenceValue?: string | null
  }[]
}

type ZohoViewResponse = {
  data?: {
    id?: string
    name?: string
    displayName?: string
    viewName?: string
    apiName?: string
  }[]
}

type ZohoDepartmentsResponse = {
  data?: {
    id?: string
    name?: string
    isEnabled?: boolean
  }[]
}

type ZohoDashboardMetricKey =
  | "createdTickets"
  | "solvedTickets"
  | "onholdTickets"
  | "responseCount"
type ZohoHourlyTicketData = {
  hour: string
  newTickets: number
  closedTickets: number
  onHoldTickets: number
  incomingReplies?: number
  outgoingReplies?: number
}
type ZohoTicketListResult = {
  ok: boolean
  tickets: ZohoDeskTicket[]
  message: string
}
type ZohoDashboardMetricsResult = {
  ok: boolean
  chartData: ZohoHourlyTicketData[]
  totals: {
    newTickets: number
    closedTickets: number
    onHoldTickets: number
  }
  message: string
}
type ZohoDashboardBundleResult = {
  ok: boolean
  tickets: ZohoDeskTicket[]
  todayTickets: ZohoDeskTicket[]
  metrics: ZohoDashboardMetricsResult
  message: string
}

const CACHE_TTL_MS = 15 * 60_000
const DASHBOARD_BUNDLE_CACHE_TTL_MS = 60_000
const STALE_CACHE_TTL_MS = 24 * 60 * 60_000
const RATE_LIMIT_COOLDOWN_MS = 30 * 60_000
const ZOHO_TICKET_PAGE_LIMIT = 100
const accessTokenCache = {
  accessToken: "",
  expiresAt: 0,
}
const responseCache = new Map<string, { expiresAt: number; data: unknown }>()
let dashboardBundleRefreshPromise: Promise<ZohoDashboardBundleResult> | null =
  null

function getCachedResponse<T>(key: string) {
  const cached = responseCache.get(key)

  if (!cached || cached.expiresAt <= Date.now()) {
    return null
  }

  return cached.data as T
}

function setCachedResponse(key: string, data: unknown, maxAgeMs = CACHE_TTL_MS) {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + maxAgeMs,
  })
}

function isZohoRateLimitMessage(message: string) {
  return /too many requests|rate limit|rate-limit/i.test(message)
}

async function getStoredResponse<T>(key: string, maxAgeMs = CACHE_TTL_MS) {
  const cached = getCachedResponse<T>(key)

  if (cached) {
    return cached
  }

  const stored = await readZohoDeskCache<T>(key, maxAgeMs)

  if (stored) {
    setCachedResponse(key, stored, maxAgeMs)
  }

  return stored
}

async function getStaleStoredResponse<T>(key: string) {
  const stored = await readZohoDeskCache<T>(key, STALE_CACHE_TTL_MS)

  if (stored) {
    setCachedResponse(key, stored)
  }

  return stored
}

async function setStoredResponse(
  key: string,
  data: unknown,
  maxAgeMs = CACHE_TTL_MS
) {
  setCachedResponse(key, data, maxAgeMs)
  await writeZohoDeskCache(key, data)
}

async function getZohoRateLimitCooldown() {
  const cooldown = await readZohoDeskCache<{
    until: number
    message: string
  }>("rate-limit-cooldown", RATE_LIMIT_COOLDOWN_MS)

  if (!cooldown || cooldown.until <= Date.now()) {
    return null
  }

  return cooldown
}

async function markZohoRateLimited(message: string) {
  await writeZohoDeskCache("rate-limit-cooldown", {
    until: Date.now() + RATE_LIMIT_COOLDOWN_MS,
    message,
  })
}

function dashboardBundleCacheKey(limit: number) {
  return `dashboard-bundle:v8:${limit}:${openTicketViewId()}:not-team-${excludedTicketTeamId()}:report-tz-${reportTimeZone()}`
}

function configuredInfoDepartmentId() {
  return process.env.ZOHO_DESK_INFO_DEPARTMENT_ID ?? ""
}

function excludedTicketTeamId() {
  return process.env.ZOHO_DESK_EXCLUDED_TICKET_TEAM_ID ?? "812317000000700244"
}

function customerRespondedTicketViewId() {
  return (
    process.env.ZOHO_DESK_CUSTOMER_RESPONDED_VIEW_ID ?? "812317000000190659"
  )
}

function openTicketViewId() {
  return process.env.ZOHO_DESK_TICKET_VIEW_ID ?? "812317000000190677"
}

function isInfoDepartmentName(name: string) {
  return name.trim().toLowerCase() === "info"
}

function personName(
  person: { firstName?: string; lastName?: string; name?: string } | undefined
) {
  return (
    person?.name ||
    [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
    ""
  )
}

function reportTimeZone() {
  return process.env.ZOHO_DESK_REPORT_TIME_ZONE ?? "America/Chicago"
}

function datePartsInTimeZone(
  value: string | Date | undefined,
  timeZone = reportTimeZone()
) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const partValue = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ""

  return {
    year: partValue("year"),
    month: partValue("month"),
    day: partValue("day"),
    hour: Number(partValue("hour")),
  }
}

function dateKeyInTimeZone(
  value: string | Date | undefined,
  timeZone = reportTimeZone()
) {
  const parts = datePartsInTimeZone(value, timeZone)

  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ""
}

function isToday(value: string | undefined, timeZone = reportTimeZone()) {
  return (
    Boolean(value) &&
    dateKeyInTimeZone(value, timeZone) === dateKeyInTimeZone(new Date(), timeZone)
  )
}

function customerReplyTime(
  ticket: NonNullable<ZohoTicketResponse["data"]>[number]
) {
  return (
    ticket.customerResponseTime ??
    ticket.repliedTime ??
    ticket.lastRepliedTime ??
    ticket.latestThreadTime ??
    ticket.lastThreadTime ??
    ticket.responseTime ??
    ""
  )
}

function numericTicketCount(value: string | number | undefined) {
  const count = Number(value ?? 0)

  return Number.isFinite(count) ? count : 0
}

function normalizeTicket(ticket: NonNullable<ZohoTicketResponse["data"]>[number]) {
  const replyTime = customerReplyTime(ticket)

  return {
    id: ticket.id ?? "",
    ticketNumber: ticket.ticketNumber ?? "",
    subject: ticket.subject ?? "",
    status: ticket.status ?? "",
    statusType: ticket.statusType ?? "",
    channel: ticket.channel ?? "",
    departmentId: ticket.departmentId ?? ticket.department?.id ?? "",
    departmentName: ticket.department?.name ?? "",
    teamId: ticket.teamId ?? ticket.team?.id ?? "",
    teamName: ticket.team?.name ?? "",
    responseDueTime:
      ticket.responseDueDate ??
      ticket.responseDueTime ??
      ticket.firstResponseDueDate ??
      ticket.firstResponseDueTime ??
      ticket.dueDate ??
      "",
    repliedTime: replyTime || (ticket.modifiedTime ?? ""),
    customerResponseTime: ticket.customerResponseTime ?? replyTime,
    threadCount:
      numericTicketCount(ticket.threadCount) ||
      numericTicketCount(ticket.threadsCount) ||
      numericTicketCount(ticket.conversationCount),
    createdTime: ticket.createdTime ?? "",
    closedTime: ticket.closedTime ?? "",
    modifiedTime: ticket.modifiedTime ?? "",
    contactName: personName(ticket.contact),
    assigneeName: personName(ticket.assignee),
  }
}

function hourNumber(value: string | undefined, timeZone = reportTimeZone()) {
  if (!value) {
    return null
  }

  const parts = datePartsInTimeZone(value, timeZone)

  if (!parts || !Number.isFinite(parts.hour)) {
    return null
  }

  return parts.hour
}

function emptyHourlyReplyCounts() {
  return {
    incoming: new Map<number, number>(),
    outgoing: new Map<number, number>(),
  }
}

function incrementHourCount(counts: Map<number, number>, value: string) {
  const hour = hourNumber(value)

  if (hour !== null && isToday(value)) {
    counts.set(hour, (counts.get(hour) ?? 0) + 1)
  }
}

function last24HourSlots(timeZone = reportTimeZone()) {
  const now = new Date()
  const todayKey = dateKeyInTimeZone(now, timeZone)

  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000)

    return {
      hour: datePartsInTimeZone(date, timeZone)?.hour ?? date.getHours(),
      label: hourLabel(date, timeZone),
      isToday: dateKeyInTimeZone(date, timeZone) === todayKey,
    }
  })
}

function isInfoDepartmentTicket(
  ticket: NonNullable<ZohoTicketResponse["data"]>[number],
  departmentId: string
) {
  const ticketDepartmentId = ticket.departmentId ?? ticket.department?.id ?? ""
  const ticketDepartmentName = ticket.department?.name ?? ""

  return (
    ticketDepartmentId === departmentId ||
    isInfoDepartmentName(ticketDepartmentName)
  )
}

async function fetchZohoTicketPage({
  accessToken,
  departmentId,
  limit,
  from,
  sortBy,
  viewId,
  receivedInDays,
}: {
  accessToken: string
  departmentId: string
  limit: number
  from: number
  sortBy: string
  viewId?: string
  receivedInDays?: string
}) {
  const credentials = getZohoDeskCredentials()
  const ticketsUrl = new URL("/api/v1/tickets", credentials.apiBaseUrl)

  ticketsUrl.searchParams.set("from", String(from))
  ticketsUrl.searchParams.set("limit", String(limit))
  ticketsUrl.searchParams.set("departmentId", departmentId)
  ticketsUrl.searchParams.set("sortBy", sortBy)
  ticketsUrl.searchParams.set("include", "contacts,assignee,departments,team,isRead")
  if (viewId) {
    ticketsUrl.searchParams.set("viewId", viewId)
  }
  if (receivedInDays) {
    ticketsUrl.searchParams.set("receivedInDays", receivedInDays)
  }

  const ticketsResponse = await fetch(ticketsUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!ticketsResponse.ok) {
    return {
      ok: false as const,
      tickets: [] as NonNullable<ZohoTicketResponse["data"]>,
      message: `Zoho Desk returned ${ticketsResponse.status}: ${(
        await ticketsResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const ticketData = (await ticketsResponse.json()) as ZohoTicketResponse

  return {
    ok: true as const,
    tickets: ticketData.data ?? [],
    message: "Connected",
  }
}

async function fetchZohoTickets({
  accessToken,
  departmentId,
  limit,
  sortBy,
  viewId,
  receivedInDays,
  stopWhenPageIsOutsideToday,
}: {
  accessToken: string
  departmentId: string
  limit: number
  sortBy: string
  viewId?: string
  receivedInDays?: string
  stopWhenPageIsOutsideToday?: "createdTime" | "modifiedTime"
}) {
  const requestedLimit = Math.min(Math.max(limit, 1), 400)
  const tickets: NonNullable<ZohoTicketResponse["data"]> = []

  for (let from = 1; tickets.length < requestedLimit; from += ZOHO_TICKET_PAGE_LIMIT) {
    const pageLimit = Math.min(ZOHO_TICKET_PAGE_LIMIT, requestedLimit - tickets.length)
    const page = await fetchZohoTicketPage({
      accessToken,
      departmentId,
      limit: pageLimit,
      from,
      sortBy,
      viewId,
      receivedInDays,
    })

    if (!page.ok) {
      return page
    }

    tickets.push(...page.tickets)

    if (
      stopWhenPageIsOutsideToday &&
      page.tickets.length > 0 &&
      page.tickets.every((ticket) => !isToday(ticket[stopWhenPageIsOutsideToday]))
    ) {
      break
    }

    if (page.tickets.length < pageLimit) {
      break
    }
  }

  return {
    ok: true as const,
    tickets,
    message: "Connected",
  }
}

async function getZohoDeskAccessToken(): Promise<ZohoDeskAccessTokenResult> {
  const credentials = getZohoDeskCredentials()
  const missingCredentials = missingZohoDeskCredentialNames(credentials)

  if (missingCredentials.length) {
    return {
      ok: false,
      message: `Missing Zoho Desk env: ${missingCredentials.join(", ")}`,
    }
  }

  if (accessTokenCache.accessToken && accessTokenCache.expiresAt > Date.now()) {
    return {
      ok: true,
      accessToken: accessTokenCache.accessToken,
    }
  }

  const tokenUrl = new URL("/oauth/v2/token", credentials.accountsUrl)

  tokenUrl.searchParams.set("refresh_token", credentials.refreshToken)
  tokenUrl.searchParams.set("client_id", credentials.clientId)
  tokenUrl.searchParams.set("client_secret", credentials.clientSecret)
  tokenUrl.searchParams.set("grant_type", "refresh_token")

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    cache: "no-store",
  })
  const tokenData = (await tokenResponse.json()) as ZohoTokenResponse

  if (!tokenResponse.ok || !tokenData.access_token) {
    return {
      ok: false,
      message:
        tokenData.error_description ||
        tokenData.error ||
        `Zoho OAuth returned ${tokenResponse.status}`,
    }
  }

  accessTokenCache.accessToken = tokenData.access_token
  accessTokenCache.expiresAt = Date.now() + 50 * 60 * 1000

  return {
    ok: true,
    accessToken: tokenData.access_token,
  }
}

export async function listZohoDeskEmailTickets(
  limit = 25,
  viewId = openTicketViewId()
) {
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: accessTokenResult.message,
    }
  }

  if (!viewId) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message:
        "Missing ZOHO_DESK_TICKET_VIEW_ID. Open /api/zoho-desk/views after refreshing the Zoho token with Desk.settings.READ, then save the numeric ID for 1-open-all.",
    }
  }

  if (!/^\d+$/.test(viewId)) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message:
        "Zoho Desk needs the numeric View ID for 1-open-all. Generate a token with Desk.settings.READ, then open /api/zoho-desk/views to find it.",
    }
  }

  const infoDepartmentResult = await getZohoDeskInfoDepartment(
    accessTokenResult.accessToken
  )

  if (!infoDepartmentResult.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: infoDepartmentResult.message,
    }
  }

  const excludedTeamId = excludedTicketTeamId()
  const cacheKey = `tickets:v3:${limit}:${viewId}:${infoDepartmentResult.department.id}:status-open:not-team-${excludedTeamId}`
  const cached = await getStoredResponse<ZohoTicketListResult>(cacheKey)

  if (cached) {
    return cached
  }

  const ticketData = await fetchZohoTickets({
    accessToken: accessTokenResult.accessToken,
    departmentId: infoDepartmentResult.department.id,
    limit,
    sortBy: "-createdTime",
    viewId,
  })

  if (!ticketData.ok) {
    const stale = isZohoRateLimitMessage(ticketData.message)
      ? await getStaleStoredResponse<ZohoTicketListResult>(cacheKey)
      : null

    if (stale) {
      return {
        ...stale,
        message: "Connected with cached Zoho data while Zoho cools down.",
      }
    }

    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: ticketData.message,
    }
  }

  const tickets = ticketData.tickets
    .filter((ticket) => {
      const ticketTeamId = ticket.teamId ?? ticket.team?.id ?? ""

      return (
        isInfoDepartmentTicket(ticket, infoDepartmentResult.department.id) &&
        ticket.status === "Open" &&
        ticketTeamId !== excludedTeamId
      )
    })
    .map(normalizeTicket)

  const result = {
    ok: true,
    tickets,
    message: "Connected",
  }

  await setStoredResponse(cacheKey, result)

  return result
}

export async function listZohoDeskTodayCreatedTickets(limit = 100) {
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: accessTokenResult.message,
    }
  }

  const infoDepartmentResult = await getZohoDeskInfoDepartment(
    accessTokenResult.accessToken
  )

  if (!infoDepartmentResult.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: infoDepartmentResult.message,
    }
  }

  const excludedTeamId = excludedTicketTeamId()
  const cacheKey = `tickets-created-today:v1:${limit}:${infoDepartmentResult.department.id}:not-team-${excludedTeamId}`
  const cached = await getStoredResponse<ZohoTicketListResult>(cacheKey)

  if (cached) {
    return cached
  }

  const ticketData = await fetchZohoTickets({
    accessToken: accessTokenResult.accessToken,
    departmentId: infoDepartmentResult.department.id,
    limit,
    sortBy: "-createdTime",
    stopWhenPageIsOutsideToday: "createdTime",
  })

  if (!ticketData.ok) {
    const stale = isZohoRateLimitMessage(ticketData.message)
      ? await getStaleStoredResponse<ZohoTicketListResult>(cacheKey)
      : null

    if (stale) {
      return {
        ...stale,
        message: "Connected with cached Zoho data while Zoho cools down.",
      }
    }

    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: ticketData.message,
    }
  }

  const tickets = ticketData.tickets
    .filter((ticket) => {
      const ticketTeamId = ticket.teamId ?? ticket.team?.id ?? ""

      return (
        isInfoDepartmentTicket(ticket, infoDepartmentResult.department.id) &&
        isToday(ticket.createdTime) &&
        ticketTeamId !== excludedTeamId
      )
    })
    .map(normalizeTicket)

  const result = {
    ok: true,
    tickets,
    message: "Connected",
  }

  await setStoredResponse(cacheKey, result)

  return result
}

async function getZohoDeskInfoDepartment(accessToken: string) {
  const configuredDepartmentId = configuredInfoDepartmentId()

  if (configuredDepartmentId) {
    return {
      ok: true as const,
      department: {
        id: configuredDepartmentId,
        name: "Info",
      },
    }
  }

  type DepartmentResult = {
    ok: true
    department: {
      id: string
      name: string
    }
  }
  const cached = await getStoredResponse<DepartmentResult>("department:info")

  if (cached) {
    return cached
  }

  const credentials = getZohoDeskCredentials()
  const departmentsUrl = new URL("/api/v1/departments", credentials.apiBaseUrl)

  departmentsUrl.searchParams.set("isEnabled", "true")
  departmentsUrl.searchParams.set("limit", "100")

  const departmentsResponse = await fetch(departmentsUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!departmentsResponse.ok) {
    return {
      ok: false as const,
      message: `Zoho Desk departments returned ${departmentsResponse.status}: ${(
        await departmentsResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const departmentsData =
    (await departmentsResponse.json()) as ZohoDepartmentsResponse
  const infoDepartment = (departmentsData.data ?? []).find((department) =>
    isInfoDepartmentName(department.name ?? "")
  )

  if (!infoDepartment?.id) {
    return {
      ok: false as const,
      message:
        "Could not find an enabled Zoho Desk department named Info. Set ZOHO_DESK_INFO_DEPARTMENT_ID in .env.local.",
    }
  }

  const result = {
    ok: true as const,
    department: {
      id: infoDepartment.id,
      name: infoDepartment.name ?? "Info",
    },
  }

  await setStoredResponse("department:info", result)

  return result
}

export async function getZohoDeskTicketReader(ticketId: string) {
  const cacheKey = `ticket-reader:${ticketId}`
  const cached = getCachedResponse<{
    ok: boolean
    ticket: ZohoDeskTicket | null
    threads: ZohoDeskThread[]
    message: string
  }>(cacheKey)

  if (cached) {
    return cached
  }

  const credentials = getZohoDeskCredentials()
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      ticket: null,
      threads: [] as ZohoDeskThread[],
      message: accessTokenResult.message,
    }
  }

  const infoDepartmentResult = await getZohoDeskInfoDepartment(
    accessTokenResult.accessToken
  )

  if (!infoDepartmentResult.ok) {
    return {
      ok: false,
      ticket: null,
      threads: [] as ZohoDeskThread[],
      message: infoDepartmentResult.message,
    }
  }

  const ticketUrl = new URL(`/api/v1/tickets/${ticketId}`, credentials.apiBaseUrl)

  ticketUrl.searchParams.set("include", "contacts,assignee,departments")

  const ticketResponse = await fetch(ticketUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessTokenResult.accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!ticketResponse.ok) {
    return {
      ok: false,
      ticket: null,
      threads: [] as ZohoDeskThread[],
      message: `Zoho Desk ticket returned ${ticketResponse.status}: ${(
        await ticketResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const ticketData = (await ticketResponse.json()) as ZohoTicketDetailResponse
  const ticketDepartmentId =
    ticketData.departmentId ?? ticketData.department?.id ?? ""

  if (ticketDepartmentId !== infoDepartmentResult.department.id) {
    return {
      ok: false,
      ticket: null,
      threads: [] as ZohoDeskThread[],
      message: "This dashboard reader is only available for Info department tickets.",
    }
  }

  const threadsUrl = new URL(
    `/api/v1/tickets/${ticketId}/threads`,
    credentials.apiBaseUrl
  )

  threadsUrl.searchParams.set("from", "1")
  threadsUrl.searchParams.set("limit", "10")

  const threadsResponse = await fetch(threadsUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessTokenResult.accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!threadsResponse.ok) {
    return {
      ok: false,
      ticket: null,
      threads: [] as ZohoDeskThread[],
      message: `Zoho Desk threads returned ${threadsResponse.status}: ${(
        await threadsResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const threadsData = (await threadsResponse.json()) as ZohoThreadResponse
  const threadSummaries = (threadsData.data ?? [])
    .filter((thread) => thread.status !== "DRAFT")
    .sort((left, right) => {
      const leftTime = left.createdTime ? new Date(left.createdTime).getTime() : 0
      const rightTime = right.createdTime
        ? new Date(right.createdTime).getTime()
        : 0

      return rightTime - leftTime
    })
    .slice(0, 5)
  const threads = await Promise.all(
    threadSummaries.map(async (thread) => {
      if (!thread.id) {
        return thread
      }

      const threadUrl = new URL(
        `/api/v1/tickets/${ticketId}/threads/${thread.id}`,
        credentials.apiBaseUrl
      )

      threadUrl.searchParams.set("include", "plainText")

      const threadResponse = await fetch(threadUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessTokenResult.accessToken}`,
          orgId: credentials.orgId,
        },
        cache: "no-store",
      })

      if (!threadResponse.ok) {
        return thread
      }

      return (await threadResponse.json()) as ZohoDeskThread
    })
  )

  const ticket = {
    id: ticketData.id ?? "",
    ticketNumber: ticketData.ticketNumber ?? "",
    subject: ticketData.subject ?? "",
    status: ticketData.status ?? "",
    statusType: ticketData.statusType ?? "",
    channel: ticketData.channel ?? "",
    departmentId: ticketDepartmentId,
    departmentName:
      ticketData.department?.name ?? infoDepartmentResult.department.name,
    teamId: ticketData.teamId ?? ticketData.team?.id ?? "",
    teamName: ticketData.team?.name ?? "",
    responseDueTime:
      ticketData.responseDueDate ??
      ticketData.responseDueTime ??
      ticketData.firstResponseDueDate ??
      ticketData.firstResponseDueTime ??
      ticketData.dueDate ??
      "",
    customerResponseTime: "",
    threadCount: 0,
    repliedTime: ticketData.modifiedTime ?? "",
    createdTime: ticketData.createdTime ?? "",
    closedTime: "",
    modifiedTime: ticketData.modifiedTime ?? "",
    contactName: personName(ticketData.contact),
    assigneeName: personName(ticketData.assignee),
  }

  const result = {
    ok: true,
    ticket,
    threads,
    message: "Connected",
  }

  setCachedResponse(cacheKey, result)

  return result
}

export async function listZohoDeskTicketViews() {
  const credentials = getZohoDeskCredentials()
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      views: [] as NonNullable<ZohoViewResponse["data"]>,
      message: accessTokenResult.message,
    }
  }

  const viewsUrl = new URL("/api/v1/views", credentials.apiBaseUrl)

  viewsUrl.searchParams.set("module", "tickets")

  const viewsResponse = await fetch(viewsUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessTokenResult.accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!viewsResponse.ok) {
    return {
      ok: false,
      views: [] as NonNullable<ZohoViewResponse["data"]>,
      message: `Zoho Desk returned ${viewsResponse.status}: ${(
        await viewsResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const viewsData = (await viewsResponse.json()) as ZohoViewResponse

  return {
    ok: true,
    views: viewsData.data ?? [],
    message: "Connected",
  }
}

async function getZohoDashboardMetric(
  endpoint: ZohoDashboardMetricKey,
  accessToken: string,
  departmentId: string
) {
  const credentials = getZohoDeskCredentials()
  const metricUrl = new URL(`/api/v1/dashboards/${endpoint}`, credentials.apiBaseUrl)

  metricUrl.searchParams.set("duration", "TODAY")
  metricUrl.searchParams.set("groupBy", "hour")
  metricUrl.searchParams.set("departmentId", departmentId)

  const response = await fetch(metricUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return {
      ok: false as const,
      message: `Zoho Desk returned ${response.status}: ${(
        await response.text()
      ).slice(0, 300)}`,
    }
  }

  return {
    ok: true as const,
    data: (await response.json()) as ZohoDashboardMetricResponse,
  }
}

async function getZohoDeskTodayReplyCounts(
  accessToken: string,
  departmentId: string
) {
  const excludedTeamId = excludedTicketTeamId()
  const cacheKey = `reply-counts-today:v2:${departmentId}:not-team-${excludedTeamId}`
  const cached = getCachedResponse<ReturnType<typeof emptyHourlyReplyCounts>>(
    cacheKey
  )

  if (cached) {
    return {
      ok: true as const,
      counts: cached,
    }
  }

  const [outgoingMetric, incomingTickets] = await Promise.all([
    getZohoDashboardMetric("responseCount", accessToken, departmentId),
    fetchZohoTickets({
      accessToken,
      departmentId,
      limit: 400,
      sortBy: "-recentThread",
      receivedInDays: "15",
    }),
  ])

  if (!outgoingMetric.ok || !incomingTickets.ok) {
    return {
      ok: false as const,
      message:
        (!outgoingMetric.ok && outgoingMetric.message) ||
        (!incomingTickets.ok && incomingTickets.message) ||
        "Could not read Zoho Desk reply counts.",
      counts: emptyHourlyReplyCounts(),
    }
  }

  const counts = emptyHourlyReplyCounts()

  ;(outgoingMetric.data.responseCount ?? []).forEach((item) => {
    const hour = Number(item.value ?? 0)

    if (Number.isFinite(hour)) {
      counts.outgoing.set(hour, Number(item.count ?? 0))
    }
  })

  incomingTickets.tickets.forEach((ticket) => {
    const ticketTeamId = ticket.teamId ?? ticket.team?.id ?? ""

    if (
      !isInfoDepartmentTicket(ticket, departmentId) ||
      ticketTeamId === excludedTeamId
    ) {
      return
    }

    const replyTime = customerReplyTime(ticket)
    const replyHour = hourNumber(replyTime)

    if (replyHour === null || !isToday(replyTime)) {
      return
    }

    counts.incoming.set(replyHour, (counts.incoming.get(replyHour) ?? 0) + 1)
  })

  setCachedResponse(cacheKey, counts)

  return {
    ok: true as const,
    counts,
  }
}

function buildDashboardMetricsFromLiveData({
  todayTickets,
  incomingTickets,
  outgoingMetric,
}: {
  todayTickets: ZohoDeskTicket[]
  incomingTickets: ZohoDeskTicket[]
  outgoingMetric: ZohoDashboardMetricResponse
}): ZohoDashboardMetricsResult {
  const newTicketCounts = new Map<number, number>()
  const incomingReplyCounts = new Map<number, number>()
  const outgoingReplyCounts = new Map<number, number>()

  todayTickets.forEach((ticket) => {
    incrementHourCount(newTicketCounts, ticket.createdTime)
  })

  incomingTickets.forEach((ticket) => {
    const replyTime =
      ticket.customerResponseTime ||
      ticket.repliedTime ||
      ticket.modifiedTime ||
      ticket.createdTime

    incrementHourCount(incomingReplyCounts, replyTime)
  })

  ;(outgoingMetric.responseCount ?? []).forEach((item) => {
    const hour = Number(item.value ?? 0)

    if (Number.isFinite(hour)) {
      outgoingReplyCounts.set(hour, Number(item.count ?? 0))
    }
  })

  const chartData = last24HourSlots().map(({ hour, label, isToday }) => ({
    hour: label,
    newTickets: isToday ? (newTicketCounts.get(hour) ?? 0) : 0,
    closedTickets: 0,
    onHoldTickets: 0,
    incomingReplies: isToday ? (incomingReplyCounts.get(hour) ?? 0) : 0,
    outgoingReplies: isToday ? (outgoingReplyCounts.get(hour) ?? 0) : 0,
  }))

  return {
    ok: true,
    chartData,
    totals: {
      newTickets: todayTickets.length,
      closedTickets: 0,
      onHoldTickets: 0,
    },
    message: "Connected",
  }
}

function dashboardMetricHour(
  item: NonNullable<ZohoDashboardMetricResponse["ticketCount"]>[number]
) {
  const numericHour = Number(item.value ?? item.referenceValue ?? "")

  if (Number.isFinite(numericHour)) {
    return numericHour
  }

  const dateHour = hourNumber(item.value ?? item.referenceValue ?? "")

  if (dateHour !== null) {
    return dateHour
  }

  const matchedHour = String(item.value ?? item.referenceValue ?? "").match(
    /\b([01]?\d|2[0-3])\b/
  )

  return matchedHour ? Number(matchedHour[1]) : null
}

function dashboardTicketCountsByHour(metric: ZohoDashboardMetricResponse) {
  const counts = new Map<number, number>()

  ;(metric.ticketCount ?? []).forEach((item) => {
    const hour = dashboardMetricHour(item)

    if (hour !== null) {
      counts.set(hour, Number(item.count ?? 0))
    }
  })

  return counts
}

function buildDashboardMetricsFromZohoReport({
  created,
  solved,
}: {
  created: ZohoDashboardMetricResponse
  solved: ZohoDashboardMetricResponse
}): ZohoDashboardMetricsResult {
  const createdCounts = dashboardTicketCountsByHour(created)
  const solvedCounts = dashboardTicketCountsByHour(solved)
  const chartData = last24HourSlots().map(({ hour, label, isToday }) => ({
    hour: label,
    newTickets: isToday ? (createdCounts.get(hour) ?? 0) : 0,
    closedTickets: isToday ? (solvedCounts.get(hour) ?? 0) : 0,
    onHoldTickets: 0,
    incomingReplies: 0,
    outgoingReplies: 0,
  }))

  return {
    ok: true,
    chartData,
    totals: {
      newTickets: Number(created.totalTicketCount ?? 0),
      closedTickets: Number(solved.totalTicketCount ?? 0),
      onHoldTickets: 0,
    },
    message: "Connected",
  }
}

export async function getZohoDeskDashboardBundle(limit = 400) {
  const requestedLimit = Math.min(Math.max(limit, 1), 400)
  const cacheKey = dashboardBundleCacheKey(requestedLimit)
  const cached = await getStoredResponse<ZohoDashboardBundleResult>(
    cacheKey,
    DASHBOARD_BUNDLE_CACHE_TTL_MS
  )

  if (cached) {
    return cached
  }

  const stale = await getStaleStoredResponse<ZohoDashboardBundleResult>(cacheKey)
  const cooldown = await getZohoRateLimitCooldown()

  if (cooldown && stale) {
    return {
      ...stale,
      message: "Connected with cached Zoho data while Zoho cools down.",
      metrics: {
        ...stale.metrics,
        message: "Connected with cached Zoho data while Zoho cools down.",
      },
    }
  }

  if (cooldown) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      todayTickets: [] as ZohoDeskTicket[],
      metrics: {
        ok: false,
        chartData: [] as ZohoHourlyTicketData[],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message: cooldown.message,
      },
      message: cooldown.message,
    }
  }

  if (dashboardBundleRefreshPromise) {
    return dashboardBundleRefreshPromise
  }

  dashboardBundleRefreshPromise = refreshZohoDeskDashboardBundle(
    requestedLimit,
    cacheKey
  ).finally(() => {
    dashboardBundleRefreshPromise = null
  })

  return dashboardBundleRefreshPromise
}

async function refreshZohoDeskDashboardBundle(
  requestedLimit: number,
  cacheKey: string
): Promise<ZohoDashboardBundleResult> {
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    if (isZohoRateLimitMessage(accessTokenResult.message)) {
      await markZohoRateLimited(accessTokenResult.message)
    }

    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      todayTickets: [] as ZohoDeskTicket[],
      metrics: {
        ok: false,
        chartData: [] as ZohoHourlyTicketData[],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message: accessTokenResult.message,
      },
      message: accessTokenResult.message,
    }
  }

  const infoDepartmentResult = await getZohoDeskInfoDepartment(
    accessTokenResult.accessToken
  )

  if (!infoDepartmentResult.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      todayTickets: [] as ZohoDeskTicket[],
      metrics: {
        ok: false,
        chartData: [] as ZohoHourlyTicketData[],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message: infoDepartmentResult.message,
      },
      message: infoDepartmentResult.message,
    }
  }

  const excludedTeamId = excludedTicketTeamId()
  const [openTicketData, todayTicketData, createdMetric, solvedMetric] =
    await Promise.all([
      fetchZohoTickets({
        accessToken: accessTokenResult.accessToken,
        departmentId: infoDepartmentResult.department.id,
        limit: requestedLimit,
        sortBy: "-createdTime",
        viewId: openTicketViewId(),
      }),
      fetchZohoTickets({
        accessToken: accessTokenResult.accessToken,
        departmentId: infoDepartmentResult.department.id,
        limit: requestedLimit,
        sortBy: "-createdTime",
        stopWhenPageIsOutsideToday: "createdTime",
      }),
      getZohoDashboardMetric(
        "createdTickets",
        accessTokenResult.accessToken,
        infoDepartmentResult.department.id
      ),
      getZohoDashboardMetric(
        "solvedTickets",
        accessTokenResult.accessToken,
        infoDepartmentResult.department.id
      ),
    ])
  const failedMessage =
    (!openTicketData.ok && openTicketData.message) ||
    (!todayTicketData.ok && todayTicketData.message) ||
    (!createdMetric.ok && createdMetric.message) ||
    (!solvedMetric.ok && solvedMetric.message) ||
    ""

  if (failedMessage) {
    const stale = await getStaleStoredResponse<ZohoDashboardBundleResult>(
      cacheKey
    )

    if (isZohoRateLimitMessage(failedMessage)) {
      await markZohoRateLimited(failedMessage)
    }

    if (isZohoRateLimitMessage(failedMessage) && stale) {
      return {
        ...stale,
        message: "Connected with cached Zoho data while Zoho cools down.",
        metrics: {
          ...stale.metrics,
          message: "Connected with cached Zoho data while Zoho cools down.",
        },
      }
    }

    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      todayTickets: [] as ZohoDeskTicket[],
      metrics: {
        ok: false,
        chartData: [] as ZohoHourlyTicketData[],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message: failedMessage,
      },
      message: failedMessage,
    }
  }

  if (
    !openTicketData.ok ||
    !todayTicketData.ok ||
    !createdMetric.ok ||
    !solvedMetric.ok
  ) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      todayTickets: [] as ZohoDeskTicket[],
      metrics: {
        ok: false,
        chartData: [] as ZohoHourlyTicketData[],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message: "Could not read Zoho Desk dashboard.",
      },
      message: "Could not read Zoho Desk dashboard.",
    }
  }

  const filterTicket = (
    ticket: NonNullable<ZohoTicketResponse["data"]>[number]
  ) => {
    const ticketTeamId = ticket.teamId ?? ticket.team?.id ?? ""

    return (
      isInfoDepartmentTicket(ticket, infoDepartmentResult.department.id) &&
      ticketTeamId !== excludedTeamId
    )
  }
  const tickets = openTicketData.tickets
    .filter(
      (ticket) =>
        filterTicket(ticket) &&
        ticket.status === "Open"
    )
    .map(normalizeTicket)
  const todayTickets = todayTicketData.tickets
    .filter((ticket) => filterTicket(ticket) && isToday(ticket.createdTime))
    .map(normalizeTicket)
  const metrics = buildDashboardMetricsFromZohoReport({
    created: createdMetric.data,
    solved: solvedMetric.data,
  })
  const result = {
    ok: true,
    tickets,
    todayTickets,
    metrics,
    message: "Connected",
  }

  await setStoredResponse(cacheKey, result, DASHBOARD_BUNDLE_CACHE_TTL_MS)

  return result
}

export async function getZohoDeskDashboardMetrics() {
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      chartData: [] as ZohoHourlyTicketData[],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message: accessTokenResult.message,
    }
  }

  const infoDepartmentResult = await getZohoDeskInfoDepartment(
    accessTokenResult.accessToken
  )

  if (!infoDepartmentResult.ok) {
    return {
      ok: false,
      chartData: [] as ZohoHourlyTicketData[],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message: infoDepartmentResult.message,
    }
  }

  const cacheKey = `dashboard-metrics:TODAY:hour:${infoDepartmentResult.department.id}`
  type DashboardMetricsResult = {
    ok: boolean
    chartData: ZohoHourlyTicketData[]
    totals: {
      newTickets: number
      closedTickets: number
      onHoldTickets: number
    }
    message: string
  }
  const cached = await getStoredResponse<DashboardMetricsResult>(cacheKey)

  if (cached) {
    return cached
  }

  const [created, solved, onHold, replyCounts] = await Promise.all([
    getZohoDashboardMetric(
      "createdTickets",
      accessTokenResult.accessToken,
      infoDepartmentResult.department.id
    ),
    getZohoDashboardMetric(
      "solvedTickets",
      accessTokenResult.accessToken,
      infoDepartmentResult.department.id
    ),
    getZohoDashboardMetric(
      "onholdTickets",
      accessTokenResult.accessToken,
      infoDepartmentResult.department.id
    ),
    getZohoDeskTodayReplyCounts(
      accessTokenResult.accessToken,
      infoDepartmentResult.department.id
    ),
  ])

  if (!created.ok || !solved.ok || !onHold.ok) {
    const message =
      (!created.ok && created.message) ||
      (!solved.ok && solved.message) ||
      (!onHold.ok && onHold.message) ||
      "Could not read Zoho Desk dashboard metrics."
    const stale = isZohoRateLimitMessage(message)
      ? await getStaleStoredResponse<DashboardMetricsResult>(cacheKey)
      : null

    if (stale) {
      return {
        ...stale,
        message: "Connected with cached Zoho data while Zoho cools down.",
      }
    }

    return {
      ok: false,
      chartData: [] as ZohoHourlyTicketData[],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message,
    }
  }

  if (!replyCounts.ok && isZohoRateLimitMessage(replyCounts.message)) {
    const stale = await getStaleStoredResponse<DashboardMetricsResult>(cacheKey)

    if (stale) {
      return {
        ...stale,
        message: "Connected with cached Zoho data while Zoho cools down.",
      }
    }
  }

  function countsByHour(metric: ZohoDashboardMetricResponse) {
    return new Map(
      (metric.ticketCount ?? []).map((item) => [
        Number(item.value ?? 0),
        Number(item.count ?? 0),
      ])
    )
  }

  const createdCounts = countsByHour(created.data)
  const solvedCounts = countsByHour(solved.data)
  const onHoldCounts = countsByHour(onHold.data)
  const incomingReplyCounts = replyCounts.ok
    ? replyCounts.counts.incoming
    : new Map<number, number>()
  const outgoingReplyCounts = replyCounts.ok
    ? replyCounts.counts.outgoing
    : new Map<number, number>()
  const chartData = last24HourSlots().map(({ hour, label, isToday }) => ({
    hour: label,
    newTickets: isToday ? (createdCounts.get(hour) ?? 0) : 0,
    closedTickets: isToday ? (solvedCounts.get(hour) ?? 0) : 0,
    onHoldTickets: isToday ? -(onHoldCounts.get(hour) ?? 0) : 0,
    incomingReplies: isToday ? (incomingReplyCounts.get(hour) ?? 0) : 0,
    outgoingReplies: isToday ? (outgoingReplyCounts.get(hour) ?? 0) : 0,
  }))

  const result = {
    ok: true,
    chartData,
    totals: {
      newTickets: Number(created.data.totalTicketCount ?? 0),
      closedTickets: Number(solved.data.totalTicketCount ?? 0),
      onHoldTickets: Number(onHold.data.totalTicketCount ?? 0),
    },
    message: "Connected",
  }

  await setStoredResponse(cacheKey, result)

  return result
}

function hourLabel(date: Date, timeZone = reportTimeZone()) {
  return date
    .toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      hour12: true,
    })
    .replace(" ", "")
}
