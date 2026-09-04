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

function html(message: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family: system-ui; padding: 24px;"><h1>${message}</h1><p>You can close this tab and return to the dashboard.</p></body></html>`,
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
      { message: "Zoho OAuth setup is only available on localhost." },
      { status: 404 }
    )
  }

  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const oauthError = requestUrl.searchParams.get("error")

  if (oauthError) {
    return html(`Zoho authorization failed: ${oauthError}`)
  }

  if (!code) {
    return html("Zoho did not return an authorization code.")
  }

  const credentials = getZohoDeskCredentials()
  const tokenUrl = new URL("/oauth/v2/token", credentials.accountsUrl)

  tokenUrl.searchParams.set("code", code)
  tokenUrl.searchParams.set("client_id", credentials.clientId)
  tokenUrl.searchParams.set("client_secret", credentials.clientSecret)
  tokenUrl.searchParams.set("grant_type", "authorization_code")
  tokenUrl.searchParams.set("redirect_uri", credentials.redirectUri)

  const tokenResponse = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    cache: "no-store",
  })
  const tokenData = (await tokenResponse.json()) as ZohoTokenResponse

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    return html(
      tokenData.error_description ||
        tokenData.error ||
        `Zoho token exchange failed with ${tokenResponse.status}.`
    )
  }

  updateLocalEnvValue("ZOHO_DESK_REFRESH_TOKEN", tokenData.refresh_token)

  return html("Zoho refresh token saved.")
}
