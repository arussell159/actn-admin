import "server-only"

export type ZohoDeskCredentials = {
  clientId: string
  clientSecret: string
  refreshToken: string
  orgId: string
  redirectUri: string
  accountsUrl: string
  apiBaseUrl: string
  portalSlug: string
}

export function getZohoDeskCredentials() {
  return {
    clientId: process.env.ZOHO_DESK_CLIENT_ID ?? "",
    clientSecret: process.env.ZOHO_DESK_CLIENT_SECRET ?? "",
    refreshToken: process.env.ZOHO_DESK_REFRESH_TOKEN ?? "",
    orgId: process.env.ZOHO_DESK_ORG_ID ?? "",
    redirectUri:
      process.env.ZOHO_DESK_REDIRECT_URI ??
      "http://localhost:3000/api/zoho-desk/oauth/callback",
    accountsUrl: process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.com",
    apiBaseUrl: process.env.ZOHO_DESK_API_BASE_URL ?? "https://desk.zoho.com/api/v1",
    portalSlug: process.env.ZOHO_DESK_PORTAL_SLUG ?? "africactnllc",
  } satisfies ZohoDeskCredentials
}

export function missingZohoDeskCredentialNames(
  credentials = getZohoDeskCredentials()
) {
  return [
    ["ZOHO_DESK_CLIENT_ID", credentials.clientId],
    ["ZOHO_DESK_CLIENT_SECRET", credentials.clientSecret],
    ["ZOHO_DESK_REFRESH_TOKEN", credentials.refreshToken],
    ["ZOHO_DESK_ORG_ID", credentials.orgId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
}
