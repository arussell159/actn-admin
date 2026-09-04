import { NextResponse } from "next/server"

import { updateLocalEnvValue } from "@/lib/local-env-file"
import { getZohoDeskCredentials } from "@/lib/zoho-desk-env"
import { fetchWithTimeout } from "@/lib/network"

type ZohoTokenResponse = {
  refresh_token?: string
  access_token?: string
  error?: string
  error_description?: string
}

function isLocalhost(request: Request) {
  const host = request.headers.get("host") ?? ""

  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function page(message = "") {
  const escapedMessage = escapeHtml(message)

  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zoho Desk Self Client</title>
  </head>
  <body style="margin:0; min-height:100vh; display:grid; place-items:center; background:#f6f7f8; color:#111827; font-family:Inter, system-ui, sans-serif;">
    <main style="width:min(560px, calc(100vw - 32px)); background:white; border:1px solid #d8dde3; border-radius:8px; padding:24px; box-shadow:0 12px 36px rgba(15,23,42,.08);">
      <h1 style="margin:0 0 8px; font-size:22px;">Zoho Desk Self Client</h1>
      <p style="margin:0 0 18px; color:#4b5563; line-height:1.5;">Paste the one-time grant token from Zoho API Console. Use scopes Desk.tickets.READ, Desk.basic.READ, and Desk.settings.READ. This route only works on localhost and saves the refresh token into .env.local.</p>
      ${
        escapedMessage
          ? `<p style="margin:0 0 16px; border:1px solid #f3c2c2; background:#fff1f1; color:#991b1b; border-radius:6px; padding:10px 12px;">${escapedMessage}</p>`
          : ""
      }
      <form method="post">
        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:8px;" for="code">Grant token</label>
        <textarea id="code" name="code" rows="5" autofocus style="width:100%; box-sizing:border-box; resize:vertical; border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px; font:14px ui-monospace, SFMono-Regular, Consolas, monospace;"></textarea>
        <button style="margin-top:14px; width:100%; height:42px; border:0; border-radius:6px; background:#111827; color:white; font-weight:700; cursor:pointer;" type="submit">Save Refresh Token</button>
      </form>
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    }
  )
}

export async function GET(request: Request) {
  if (!isLocalhost(request)) {
    return NextResponse.json(
      { message: "Zoho Self Client setup is only available on localhost." },
      { status: 404 }
    )
  }

  return page()
}

export async function POST(request: Request) {
  if (!isLocalhost(request)) {
    return NextResponse.json(
      { message: "Zoho Self Client setup is only available on localhost." },
      { status: 404 }
    )
  }

  const formData = await request.formData()
  const code = String(formData.get("code") ?? "").trim()

  if (!code) {
    return page("Paste the Zoho grant token first.")
  }

  const credentials = getZohoDeskCredentials()

  if (!credentials.clientId || !credentials.clientSecret) {
    return page(
      "Missing ZOHO_DESK_CLIENT_ID or ZOHO_DESK_CLIENT_SECRET in .env.local."
    )
  }

  const tokenUrl = new URL("/oauth/v2/token", credentials.accountsUrl)
  const body = new URLSearchParams({
    code,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: "authorization_code",
  })

  const tokenResponse = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    body,
    cache: "no-store",
  })
  const tokenData = (await tokenResponse.json()) as ZohoTokenResponse

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    return page(
      tokenData.error_description ||
        tokenData.error ||
        `Zoho token exchange failed with ${tokenResponse.status}.`
    )
  }

  updateLocalEnvValue("ZOHO_DESK_REFRESH_TOKEN", tokenData.refresh_token)

  return new NextResponse(
    `<!doctype html><html><body style="font-family:Inter, system-ui, sans-serif; padding:24px;"><h1>Zoho refresh token saved.</h1><p>Restart localhost, then open the Dashboard.</p></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    }
  )
}
