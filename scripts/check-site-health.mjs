import fs from "node:fs"
import nextEnv from "@next/env"

// Read-only: never logs credentials or business records and never writes to the DB.
nextEnv.loadEnvConfig(process.cwd(), true)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const live = process.argv.find((arg) => arg.startsWith("--live="))?.slice(7)
const report = {
  checkedAt: new Date().toISOString(),
  configuration: {},
  database: [],
  live: null,
}
const names = (
  fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : ""
)
  .split(/\r?\n/)
  .flatMap((line) => /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line)?.[1] ?? [])
report.configuration = {
  supabaseConfigured: Boolean(url && key),
  duplicateLocalNames: [
    ...new Set(names.filter((name, index) => names.indexOf(name) !== index)),
  ],
  serverFeatures: Object.fromEntries(
    [
      "OPENAI_API_KEY",
      "ZOHO_DESK_CLIENT_ID",
      "ZOHO_DESK_CLIENT_SECRET",
      "ZOHO_DESK_REFRESH_TOKEN",
      "ZOHO_DESK_ORG_ID",
      "SUPABASE_SECRET_KEY",
    ].map((name) => [name, Boolean(process.env[name]?.trim())])
  ),
}
const tables = {
  month_end_records:
    "id,period,checked,status,created_at,updated_at,completed_at",
  month_end_templates: "id,template,updated_at",
  month_end_master_records:
    "id,month_end_id,country_id,transaction_date,amount,source_internal_id",
  month_end_country_report_records:
    "id,month_end_id,country_id,secondary_amount,status,transaction_date,selling_date",
  month_end_country_reconciliations:
    "id,month_end_id,country_id,snapshot,updated_at",
  information_notes: "id,parent_id,title,content,pinned,sort_order,updated_at",
  knowledge_base_notes:
    "id,parent_id,title,content,pinned,sort_order,updated_at",
  quote_items: "internal_id,tariff_usd,tariff_eur,sorting_field,country_name",
  quote_records: "id,items,totals,updated_at",
  app_settings: "id,value,updated_at",
  madagascar_bsc_requests: "id,country,documents,analysis,updated_at",
  madagascar_bsc_rules: "id,instruction,enabled",
  okf_certificate_layouts: "country_key,layout,revision",
  okf_state: "id",
  okf_reviews: "id",
  okf_corrections: "id",
}
if (url && key) {
  for (const [table, columns] of Object.entries(tables)) {
    try {
      const response = await fetch(
        `${url}/rest/v1/${table}?select=${columns}&limit=0`,
        {
          headers: {
            apikey: key,
            ...(key.startsWith("eyJ")
              ? { Authorization: `Bearer ${key}` }
              : {}),
            Prefer: "count=exact",
          },
          signal: AbortSignal.timeout(20000),
        }
      )
      const body = await response.json()
      report.database.push({
        table,
        status: response.status,
        ...(response.ok
          ? {
              visibleRows: response.headers.get("content-range"),
              anonymouslyReadable: true,
            }
          : { code: body.code, message: body.message }),
      })
    } catch (error) {
      report.database.push({ table, error: error.message })
    }
  }
}
if (live) {
  const origin = new URL(live).origin
  const response = await fetch(`${origin}/login`, {
    signal: AbortSignal.timeout(20000),
  })
  const html = await response.text()
  const scripts = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((src) => src.startsWith("/_next/"))
    ),
  ]
  let sameUrl = false
  let sameKey = false
  const failedAssets = []
  for (const src of scripts) {
    const asset = await fetch(new URL(src.replaceAll("&amp;", "&"), origin), {
      signal: AbortSignal.timeout(20000),
    })
    if (!asset.ok) failedAssets.push({ path: src, status: asset.status })
    const content = await asset.text()
    if (url && content.includes(url)) sameUrl = true
    if (key && content.includes(key)) sameKey = true
  }
  report.live = {
    origin,
    loginStatus: response.status,
    scriptCount: scripts.length,
    failedAssets,
    samePublicSupabaseUrl: sameUrl,
    samePublicSupabaseKey: sameKey,
  }
}
console.log(JSON.stringify(report, null, 2))
if (
  report.database.some(
    (entry) => entry.error || (entry.status >= 400 && entry.code !== "42501")
  ) ||
  report.live?.failedAssets.length ||
  (report.live &&
    (!report.live.samePublicSupabaseUrl || !report.live.samePublicSupabaseKey))
)
  process.exitCode = 1
