import { NextResponse } from "next/server"

import { getZohoDeskDashboardMetrics } from "@/lib/zoho-desk"
import {
  getZohoDeskPlaceholderDashboardMetrics,
  shouldUseZohoDeskPlaceholder,
} from "@/lib/zoho-desk-placeholder"

export async function GET() {
  try {
    if (shouldUseZohoDeskPlaceholder()) {
      return NextResponse.json(await getZohoDeskPlaceholderDashboardMetrics())
    }

    return NextResponse.json(await getZohoDeskDashboardMetrics())
  } catch (error) {
    return NextResponse.json({
      ok: false,
      chartData: [],
      totals: {
        newTickets: 0,
        closedTickets: 0,
        onHoldTickets: 0,
      },
      message:
        error instanceof Error
          ? error.message
          : "Could not read Zoho Desk dashboard metrics.",
    })
  }
}
