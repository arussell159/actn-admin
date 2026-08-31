import { NextResponse } from "next/server"

import { getZohoDeskTicketReader } from "@/lib/zoho-desk"
import {
  getZohoDeskPlaceholderTicketReader,
  shouldUseZohoDeskPlaceholder,
} from "@/lib/zoho-desk-placeholder"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params

  if (!ticketId) {
    return NextResponse.json(
      {
        ok: false,
        ticket: null,
        threads: [],
        message: "Missing ticket ID.",
      },
      { status: 400 }
    )
  }

  try {
    if (shouldUseZohoDeskPlaceholder()) {
      return NextResponse.json(
        await getZohoDeskPlaceholderTicketReader(ticketId)
      )
    }

    return NextResponse.json(await getZohoDeskTicketReader(ticketId))
  } catch (error) {
    return NextResponse.json({
      ok: false,
      ticket: null,
      threads: [],
      message:
        error instanceof Error
          ? error.message
          : "Could not read Zoho Desk ticket.",
    })
  }
}
