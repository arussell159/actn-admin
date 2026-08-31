import type { ZohoDeskThread, ZohoDeskTicket } from "@/lib/zoho-desk"
import { createPublicClient } from "@/lib/public-client"
import { hasSupabaseConfig } from "@/lib/supabase-env"

type ZohoDeskPlaceholderData = {
  tickets: ZohoDeskTicket[]
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
  readers: Record<string, ZohoDeskThread[]>
}

type AppSettingRow = {
  id: string
  value: ZohoDeskPlaceholderData | null
  updated_at: string
}

const tableName = "app_settings"
const settingId = "zoho_desk_placeholder_dashboard"

let placeholderCache: ZohoDeskPlaceholderData | null = null

export function shouldUseZohoDeskPlaceholder() {
  return process.env.ZOHO_DESK_USE_PLACEHOLDER === "true"
}

function hoursAgo(hours: number) {
  const date = new Date()
  date.setHours(date.getHours() - hours, 0, 0, 0)
  return date.toISOString()
}

function hourLabel(hoursBack: number) {
  const date = new Date()
  date.setHours(date.getHours() - hoursBack, 0, 0, 0)

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
  })
}

function createPlaceholderChartData() {
  const newTickets = [
    2, 1, 0, 3, 2, 1, 4, 6, 5, 7, 4, 3, 5, 8, 11, 14, 17, 24, 12, 3, 4, 2, 1,
    2,
  ]
  const closedTickets = [
    0, 2, 1, 4, 3, 2, 6, 8, 7, 10, 9, 6, 8, 12, 18, 22, 30, 46, 21, 5, 7, 4,
    3, 2,
  ]
  const onHoldTickets = [
    0, 0, 1, 0, 1, 0, 1, 2, 1, 2, 1, 0, 1, 1, 2, 2, 3, 1, 0, 0, 1, 0, 0, 0,
  ]
  const incomingReplies = [
    3, 2, 1, 4, 3, 2, 6, 7, 5, 8, 6, 4, 7, 9, 12, 15, 18, 21, 13, 4, 5, 3, 2,
    4,
  ]
  const outgoingReplies = [
    1, 2, 0, 3, 2, 1, 5, 6, 4, 7, 5, 3, 6, 8, 10, 13, 15, 19, 11, 3, 4, 2, 1,
    3,
  ]

  return Array.from({ length: 24 }, (_, index) => ({
    hour: hourLabel(23 - index),
    newTickets: newTickets[index] ?? 0,
    closedTickets: closedTickets[index] ?? 0,
    onHoldTickets: onHoldTickets[index] ?? 0,
    incomingReplies: incomingReplies[index] ?? 0,
    outgoingReplies: outgoingReplies[index] ?? 0,
  }))
}

function chartTotals(chartData: ZohoDeskPlaceholderData["chartData"]) {
  return chartData.reduce(
    (totals, hour) => ({
      newTickets: totals.newTickets + hour.newTickets,
      closedTickets: totals.closedTickets + hour.closedTickets,
      onHoldTickets: totals.onHoldTickets + hour.onHoldTickets,
    }),
    {
      newTickets: 0,
      closedTickets: 0,
      onHoldTickets: 0,
    }
  )
}

function hasCurrentHourReplyCounts(
  chartData: ZohoDeskPlaceholderData["chartData"]
) {
  const currentHour = chartData[chartData.length - 1]

  return (
    typeof currentHour?.incomingReplies === "number" &&
    typeof currentHour?.outgoingReplies === "number"
  )
}

function hasPlaceholderTicketCountries(tickets: ZohoDeskTicket[]) {
  return tickets.every((ticket) => ticket.countryCode || ticket.countryName)
}

function hasPlaceholderTicketTeams(tickets: ZohoDeskTicket[]) {
  return tickets.every((ticket) => ticket.teamName)
}

function hasFullPlaceholderTicketSet(tickets: ZohoDeskTicket[]) {
  return tickets.length >= 14
}

function countryTeamName(countryCode: string, countryName: string) {
  if (["NE", "CF", "GW"].includes(countryCode)) {
    return "Antaser"
  }

  if (["TG", "BI", "GQ", "SS"].includes(countryCode)) {
    return "Antaser Afrique"
  }

  return countryName
}

function ticket(
  id: string,
  ticketNumber: string,
  subject: string,
  assigneeName: string,
  countryCode: string,
  countryName: string,
  responseDueTime: string,
  createdTime: string
): ZohoDeskTicket {
  return {
    id,
    ticketNumber,
    subject,
    status: "Open",
    statusType: "Open",
    channel: "Email",
    departmentId: "812317000000006907",
    departmentName: "Info",
    teamId: "",
    teamName: countryTeamName(countryCode, countryName),
    responseDueTime,
    repliedTime: createdTime,
    customerResponseTime: createdTime,
    threadCount: 4 + (Number(id.replace(/\D/g, "").slice(-1)) % 7),
    createdTime,
    closedTime: "",
    modifiedTime: createdTime,
    contactName: "",
    assigneeName,
    countryCode,
    countryName,
  }
}

function thread(
  id: string,
  authorName: string,
  direction: "in" | "out",
  createdTime: string,
  plainText: string,
  content: string
): ZohoDeskThread {
  return {
    id,
    summary: plainText,
    content,
    plainText,
    direction,
    channel: "EMAIL",
    status: "SUCCESS",
    visibility: "public",
    createdTime,
    fromEmailAddress:
      direction === "out" ? "info@africactn.com" : "customer@example.com",
    author: {
      name: authorName,
      type: direction === "out" ? "agent" : "contact",
      email: direction === "out" ? "info@africactn.com" : "customer@example.com",
    },
  }
}

function createDefaultPlaceholderData(): ZohoDeskPlaceholderData {
  const chartData = createPlaceholderChartData()
  const tickets = [
    ticket(
      "placeholder-ticket-1001",
      "1001",
      "Draft ECTN approval for TM Engineering shipment",
      "Alex Russell",
      "NE",
      "Niger",
      hoursAgo(-2),
      hoursAgo(1)
    ),
    ticket(
      "placeholder-ticket-1006",
      "1006",
      "Antaser draft pending consignee confirmation",
      "Alex Russell",
      "CF",
      "Central African Republic",
      hoursAgo(-1),
      hoursAgo(1)
    ),
    ticket(
      "placeholder-ticket-1007",
      "1007",
      "Niger final document request",
      "Alex Russell",
      "GW",
      "Guinea Bissau",
      hoursAgo(2),
      hoursAgo(2)
    ),
    ticket(
      "placeholder-ticket-1002",
      "1002",
      "Missing export declaration for Angola file",
      "Kristal Koski",
      "AO",
      "Angola",
      hoursAgo(-1),
      hoursAgo(2)
    ),
    ticket(
      "placeholder-ticket-1008",
      "1008",
      "Angola consignee address correction",
      "Kristal Koski",
      "AO",
      "Angola",
      hoursAgo(1),
      hoursAgo(3)
    ),
    ticket(
      "placeholder-ticket-1009",
      "1009",
      "Angola OOT record follow up",
      "Kristal Koski",
      "AO",
      "Angola",
      hoursAgo(2),
      hoursAgo(3)
    ),
    ticket(
      "placeholder-ticket-1003",
      "1003",
      "Confirm prepaid payment posting",
      "Sherri Brum",
      "SN",
      "Senegal",
      hoursAgo(3),
      hoursAgo(4)
    ),
    ticket(
      "placeholder-ticket-1010",
      "1010",
      "Senegal BL copy needed for validation",
      "Sherri Brum",
      "SN",
      "Senegal",
      hoursAgo(4),
      hoursAgo(4)
    ),
    ticket(
      "placeholder-ticket-1011",
      "1011",
      "Kenya certificate status check",
      "Sherri Brum",
      "KE",
      "Kenya",
      hoursAgo(5),
      hoursAgo(5)
    ),
    ticket(
      "placeholder-ticket-1004",
      "1004",
      "Certificate copy request for Guinea consignee",
      "Damien McConnell",
      "GN",
      "Republic of Guinea",
      hoursAgo(5),
      hoursAgo(5)
    ),
    ticket(
      "placeholder-ticket-1012",
      "1012",
      "Republic of Guinea invoice approval",
      "Damien McConnell",
      "GN",
      "Republic of Guinea",
      hoursAgo(6),
      hoursAgo(6)
    ),
    ticket(
      "placeholder-ticket-1013",
      "1013",
      "Cameroon draft amendment",
      "Damien McConnell",
      "CM",
      "Cameroon",
      hoursAgo(7),
      hoursAgo(7)
    ),
    ticket(
      "placeholder-ticket-1005",
      "1005",
      "Invoice correction before final CTN",
      "",
      "BI",
      "Burundi",
      hoursAgo(6),
      hoursAgo(7)
    ),
    ticket(
      "placeholder-ticket-1014",
      "1014",
      "Togo vessel departure date update",
      "Unassigned",
      "TG",
      "Togo",
      hoursAgo(8),
      hoursAgo(8)
    ),
    ticket(
      "placeholder-ticket-1015",
      "1015",
      "Equatorial Guinea missing commercial invoice",
      "Unassigned",
      "GQ",
      "Equatorial Guinea",
      hoursAgo(9),
      hoursAgo(9)
    ),
    ticket(
      "placeholder-ticket-1016",
      "1016",
      "Burundi final certificate copy",
      "Alex Russell",
      "BI",
      "Burundi",
      hoursAgo(10),
      hoursAgo(10)
    ),
  ]

  return {
    tickets,
    chartData,
    totals: chartTotals(chartData),
    readers: {
      "placeholder-ticket-1001": [
        thread(
          "thread-1001-1",
          "TM Engineering Ltd. - Sam Kim",
          "in",
          hoursAgo(1),
          "Hello, we confirm the draft ECTN. Please proceed with issuing the final document. If you have any questions, please feel free to contact us.",
          "<p>Hello, we confirm the draft ECTN. Please proceed with issuing the final document.</p><p>If you have any questions, please feel free to contact us.</p><p>Thank you,<br />Sam Kim<br />Shipping Coordinator</p>"
        ),
        thread(
          "thread-1001-2",
          "Kristal Koski",
          "out",
          hoursAgo(2),
          "Thank you. We will look out for your comments on the draft. Please find attached the draft and invoice for your review.",
          "<p>Thank you. We will look out for your comments on the draft.</p><p>Please find attached the draft and invoice for your review. Ensure all information in the draft CTN is correct before final issuance.</p>"
        ),
      ],
      "placeholder-ticket-1002": [
        thread(
          "thread-1002-1",
          "Customer",
          "in",
          hoursAgo(2),
          "Please note that the following document is missing: Export Declaration. Kindly send this at your earliest convenience.",
          "<p>Please note that the following document is missing:</p><ul><li>Export Declaration</li></ul><p>Kindly send this at your earliest convenience so we can proceed further.</p>"
        ),
      ],
    },
  }
}

async function readPlaceholderFromDatabase() {
  if (!hasSupabaseConfig()) {
    return null
  }

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", settingId)
      .maybeSingle<AppSettingRow>()

    if (error) {
      return null
    }

    return data?.value ?? null
  } catch {
    return null
  }
}

async function savePlaceholderToDatabase(data: ZohoDeskPlaceholderData) {
  if (!hasSupabaseConfig()) {
    return
  }

  try {
    const supabase = createPublicClient()

    await supabase.from(tableName).upsert(
      {
        id: settingId,
        value: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
  } catch {}
}

export async function getZohoDeskPlaceholderData() {
  if (placeholderCache) {
    if (
      (placeholderCache.chartData?.length ?? 0) < 24 ||
      !hasCurrentHourReplyCounts(placeholderCache.chartData) ||
      !hasPlaceholderTicketCountries(placeholderCache.tickets) ||
      !hasPlaceholderTicketTeams(placeholderCache.tickets) ||
      !hasFullPlaceholderTicketSet(placeholderCache.tickets)
    ) {
      const chartData = createPlaceholderChartData()
      const defaultData = createDefaultPlaceholderData()

      placeholderCache = {
        ...placeholderCache,
        tickets: defaultData.tickets,
        chartData,
        totals: chartTotals(chartData),
      }
      await savePlaceholderToDatabase(placeholderCache)
    }

    return placeholderCache
  }

  const databaseData = await readPlaceholderFromDatabase()

  if (databaseData) {
    if (
      (databaseData.chartData?.length ?? 0) < 24 ||
      !hasCurrentHourReplyCounts(databaseData.chartData) ||
      !hasPlaceholderTicketCountries(databaseData.tickets) ||
      !hasPlaceholderTicketTeams(databaseData.tickets) ||
      !hasFullPlaceholderTicketSet(databaseData.tickets)
    ) {
      const chartData = createPlaceholderChartData()
      const defaultData = createDefaultPlaceholderData()

      placeholderCache = {
        ...databaseData,
        tickets: defaultData.tickets,
        chartData,
        totals: chartTotals(chartData),
      }
      await savePlaceholderToDatabase(placeholderCache)

      return placeholderCache
    }

    placeholderCache = databaseData
    return placeholderCache
  }

  placeholderCache = createDefaultPlaceholderData()
  await savePlaceholderToDatabase(placeholderCache)

  return placeholderCache
}

export async function listZohoDeskPlaceholderTickets() {
  const data = await getZohoDeskPlaceholderData()

  return {
    ok: true,
    tickets: data.tickets,
    message: "Using placeholder Zoho Desk data",
  }
}

export async function getZohoDeskPlaceholderDashboardMetrics() {
  const data = await getZohoDeskPlaceholderData()

  return {
    ok: true,
    chartData: data.chartData,
    totals: data.totals,
    message: "Using placeholder Zoho Desk data",
  }
}

export async function getZohoDeskPlaceholderTicketReader(ticketId: string) {
  const data = await getZohoDeskPlaceholderData()
  const ticket = data.tickets.find((item) => item.id === ticketId) ?? null

  return {
    ok: Boolean(ticket),
    ticket,
    threads: data.readers[ticketId] ?? [],
    message: ticket
      ? "Using placeholder Zoho Desk data"
      : "Placeholder ticket not found.",
  }
}
