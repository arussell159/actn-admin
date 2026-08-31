import { NextResponse } from "next/server"

import {
  listZohoDeskEmailTickets,
  listZohoDeskTodayCreatedTickets,
} from "@/lib/zoho-desk"
import {
  listZohoDeskPlaceholderTickets,
  shouldUseZohoDeskPlaceholder,
} from "@/lib/zoho-desk-placeholder"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? 25)
  const viewId = url.searchParams.get("viewId") ?? undefined
  const scope = url.searchParams.get("scope") ?? ""

  try {
    if (shouldUseZohoDeskPlaceholder()) {
      return NextResponse.json(await listZohoDeskPlaceholderTickets())
    }

    if (scope === "created-today") {
      return NextResponse.json(await listZohoDeskTodayCreatedTickets(limit))
    }

    return NextResponse.json(await listZohoDeskEmailTickets(limit, viewId))
  } catch (error) {
    return NextResponse.json({
      ok: false,
      tickets: [],
      message:
        error instanceof Error ? error.message : "Could not reach Zoho Desk.",
    })
  }
}
