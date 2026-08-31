import { NextResponse } from "next/server"

import { getZohoDeskCredentials } from "@/lib/zoho-desk-env"

function isLocalhost(request: Request) {
  const host = request.headers.get("host") ?? ""

  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
}

export async function GET(request: Request) {
  if (!isLocalhost(request)) {
    return NextResponse.json(
      { message: "Zoho OAuth setup is only available on localhost." },
      { status: 404 }
    )
  }

  const credentials = getZohoDeskCredentials()

  if (!credentials.clientId) {
    return NextResponse.json(
      { message: "Missing ZOHO_DESK_CLIENT_ID in .env.local." },
      { status: 400 }
    )
  }

  const authUrl = new URL("/oauth/v2/auth", credentials.accountsUrl)

  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("client_id", credentials.clientId)
  authUrl.searchParams.set(
    "scope",
    "Desk.tickets.READ,Desk.basic.READ,Desk.settings.READ"
  )
  authUrl.searchParams.set("redirect_uri", credentials.redirectUri)
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")

  return NextResponse.redirect(authUrl)
}
