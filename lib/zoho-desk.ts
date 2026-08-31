import "server-only"

import {
  getZohoDeskCredentials,
  missingZohoDeskCredentialNames,
} from "@/lib/zoho-desk-env"

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
  ticketCount?: {
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

type ZohoDashboardMetricKey = "createdTickets" | "solvedTickets" | "onholdTickets"

const CACHE_TTL_MS = 60_000
const accessTokenCache = {
  accessToken: "",
  expiresAt: 0,
}
const responseCache = new Map<string, { expiresAt: number; data: unknown }>()

function getCachedResponse<T>(key: string) {
  const cached = responseCache.get(key)

  if (!cached || cached.expiresAt <= Date.now()) {
    return null
  }

  return cached.data as T
}

function setCachedResponse(key: string, data: unknown) {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

function configuredInfoDepartmentId() {
  return process.env.ZOHO_DESK_INFO_DEPARTMENT_ID ?? ""
}

function excludedTicketTeamId() {
  return process.env.ZOHO_DESK_EXCLUDED_TICKET_TEAM_ID ?? "812317000000700244"
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
  viewId = process.env.ZOHO_DESK_TICKET_VIEW_ID ?? ""
) {
  const credentials = getZohoDeskCredentials()
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

  const ticketsUrl = new URL("/api/v1/tickets", credentials.apiBaseUrl)
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
  const cacheKey = `tickets:v2:${limit}:${viewId}:${infoDepartmentResult.department.id}:status-open:not-team-${excludedTeamId}`
  const cached = getCachedResponse<{
    ok: boolean
    tickets: ZohoDeskTicket[]
    message: string
  }>(cacheKey)

  if (cached) {
    return cached
  }

  ticketsUrl.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)))
  ticketsUrl.searchParams.set("departmentId", infoDepartmentResult.department.id)
  if (viewId) {
    ticketsUrl.searchParams.set("viewId", viewId)
  }
  ticketsUrl.searchParams.set("sortBy", "-createdTime")
  ticketsUrl.searchParams.set("include", "contacts,assignee,departments,team,isRead")

  const ticketsResponse = await fetch(ticketsUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessTokenResult.accessToken}`,
      orgId: credentials.orgId,
    },
    cache: "no-store",
  })

  if (!ticketsResponse.ok) {
    return {
      ok: false,
      tickets: [] as ZohoDeskTicket[],
      message: `Zoho Desk returned ${ticketsResponse.status}: ${(
        await ticketsResponse.text()
      ).slice(0, 300)}`,
    }
  }

  const ticketData = (await ticketsResponse.json()) as ZohoTicketResponse
  const tickets = (ticketData.data ?? [])
    .filter((ticket) => {
      const ticketTeamId = ticket.teamId ?? ticket.team?.id ?? ""
      const ticketDepartmentId = ticket.departmentId ?? ticket.department?.id ?? ""
      const ticketDepartmentName = ticket.department?.name ?? ""
      const isInfoDepartment =
        ticketDepartmentId === infoDepartmentResult.department.id ||
        isInfoDepartmentName(ticketDepartmentName)

      return (
        isInfoDepartment &&
        ticket.status === "Open" &&
        ticketTeamId !== excludedTeamId
      )
    })
    .map((ticket) => ({
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
      repliedTime:
        ticket.repliedTime ??
        ticket.lastRepliedTime ??
        ticket.latestThreadTime ??
        ticket.lastThreadTime ??
        ticket.responseTime ??
        ticket.modifiedTime ??
        "",
      createdTime: ticket.createdTime ?? "",
      closedTime: ticket.closedTime ?? "",
      modifiedTime: ticket.modifiedTime ?? "",
      contactName: personName(ticket.contact),
      assigneeName: personName(ticket.assignee),
    }))

  const result = {
    ok: true,
    tickets,
    message: "Connected",
  }

  setCachedResponse(cacheKey, result)

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

  const cached = getCachedResponse<{
    ok: true
    department: {
      id: string
      name: string
    }
  }>("department:info")

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

  setCachedResponse("department:info", result)

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

export async function getZohoDeskDashboardMetrics() {
  const accessTokenResult = await getZohoDeskAccessToken()

  if (!accessTokenResult.ok) {
    return {
      ok: false,
      chartData: [] as {
        hour: string
        newTickets: number
        closedTickets: number
        onHoldTickets: number
      }[],
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
      chartData: [] as {
        hour: string
        newTickets: number
        closedTickets: number
        onHoldTickets: number
      }[],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message: infoDepartmentResult.message,
    }
  }

  const cacheKey = `dashboard-metrics:TODAY:hour:${infoDepartmentResult.department.id}`
  const cached = getCachedResponse<{
    ok: boolean
    chartData: {
      hour: string
      newTickets: number
      closedTickets: number
      onHoldTickets: number
    }[]
    totals: {
      newTickets: number
      closedTickets: number
      onHoldTickets: number
    }
    message: string
  }>(cacheKey)

  if (cached) {
    return cached
  }

  const [created, solved, onHold] = await Promise.all([
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
  ])

  if (!created.ok || !solved.ok || !onHold.ok) {
    return {
      ok: false,
      chartData: [] as {
        hour: string
        newTickets: number
        closedTickets: number
        onHoldTickets: number
      }[],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message:
        (!created.ok && created.message) ||
        (!solved.ok && solved.message) ||
        (!onHold.ok && onHold.message) ||
        "Could not read Zoho Desk dashboard metrics.",
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
  const hours = Array.from(
    new Set([
      ...createdCounts.keys(),
      ...solvedCounts.keys(),
      ...onHoldCounts.keys(),
    ])
  ).sort((left, right) => left - right)

  const chartData = hours.map((hour) => {
    const date = new Date()

    date.setHours(hour, 0, 0, 0)

    return {
      hour: hourLabel(date),
      newTickets: createdCounts.get(hour) ?? 0,
      closedTickets: solvedCounts.get(hour) ?? 0,
      onHoldTickets: -(onHoldCounts.get(hour) ?? 0),
    }
  })

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

  setCachedResponse(cacheKey, result)

  return result
}

function hourLabel(date: Date) {
  return date
    .toLocaleTimeString([], {
      hour: "numeric",
      hour12: true,
    })
    .replace(" ", "")
}
