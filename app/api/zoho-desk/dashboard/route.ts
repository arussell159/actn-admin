import { NextResponse } from "next/server"

import { getZohoDeskDashboardBundle } from "@/lib/zoho-desk"
import {
  getZohoDeskPlaceholderDashboardMetrics,
  listZohoDeskPlaceholderTickets,
  shouldUseZohoDeskPlaceholder,
} from "@/lib/zoho-desk-placeholder"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? 400)

  try {
    if (shouldUseZohoDeskPlaceholder()) {
      const [tickets, metrics] = await Promise.all([
        listZohoDeskPlaceholderTickets(),
        getZohoDeskPlaceholderDashboardMetrics(),
      ])

      return NextResponse.json({
        ok: tickets.ok && metrics.ok,
        tickets: tickets.tickets,
        todayTickets: tickets.tickets,
        metrics,
        message: metrics.message,
      })
    }

    return NextResponse.json(await getZohoDeskDashboardBundle(limit))
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not read Zoho Desk dashboard."

    return NextResponse.json({
      ok: false,
      tickets: [],
      todayTickets: [],
      metrics: {
        ok: false,
        chartData: [],
        totals: {
          newTickets: 0,
          closedTickets: 0,
          onHoldTickets: 0,
        },
        message,
      },
      message,
    })
  }
}

