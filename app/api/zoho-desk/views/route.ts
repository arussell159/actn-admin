import { NextResponse } from "next/server"

import { listZohoDeskTicketViews } from "@/lib/zoho-desk"

function isLocalhost(request: Request) {
  const host = request.headers.get("host") ?? ""

  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
}

export async function GET(request: Request) {
  if (!isLocalhost(request)) {
    return NextResponse.json(
      { message: "Zoho Desk view setup is only available on localhost." },
      { status: 404 }
    )
  }

  try {
    return NextResponse.json(await listZohoDeskTicketViews())
  } catch (error) {
    return NextResponse.json({
      ok: false,
      views: [],
      message:
        error instanceof Error
          ? error.message
          : "Could not read Zoho Desk ticket views.",
    })
  }
}
