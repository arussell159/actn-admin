import { test as base, expect, type BrowserContext } from "@playwright/test"

const timestamp = "2026-08-01T12:00:00.000Z"
export const records = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7 - index, 1))
  const period = date.toISOString().slice(0, 7)
  return {
    id: period,
    period,
    checked: {},
    status: index ? "Closed" : "Open",
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: index ? timestamp : null,
  }
})
const notes = [
  {
    id: "test-folder",
    parent_id: null,
    type: "folder",
    title: "Stability notebook",
    content: null,
    pinned: true,
    sort_order: 0,
    created_at: timestamp,
    updated_at: timestamp,
  },
  ...Array.from({ length: 35 }, (_, index) => ({
    id: `test-note-${index}`,
    parent_id: "test-folder",
    type: "note",
    title: `Note ${index + 1}`,
    pinned: false,
    sort_order: index + 1,
    created_at: timestamp,
    updated_at: timestamp,
    content: JSON.stringify({
      type: "doc",
      content: Array.from({ length: 60 }, (_, line) => ({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Line ${line + 1}. This long note verifies that the editor can reach its final paragraph above the application navigation.`,
          },
        ],
      })),
    }),
  })),
]
const tickets = Array.from({ length: 28 }, (_, index) => ({
  id: String(index),
  ticketNumber: String(1000 + index),
  subject: `Mobile stability test ticket ${index + 1}`,
  status: "Open",
  statusType: "Open",
  channel: "Email",
  teamName: "Info",
  responseDueTime: timestamp,
  repliedTime: timestamp,
  createdTime: timestamp,
  closedTime: "",
  contactName: "Test Customer",
  assigneeName: "Test Agent",
  countryCode: "AO",
  countryName: "Angola",
}))
export const dashboard = {
  ok: true,
  tickets,
  todayTickets: tickets,
  message: "Test fixture",
  metrics: {
    ok: true,
    chartData: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      newTickets: i % 5,
      closedTickets: i % 3,
      onHoldTickets: 0,
    })),
    totals: { newTickets: 28, closedTickets: 16, onHoldTickets: 0 },
    message: "Test fixture",
  },
}

// Every external data request is fulfilled locally, including mutations. These
// regression tests never read or change the user's Supabase/Zoho records.
export async function installFixtures(context: BrowserContext, delayMs = 0) {
  await context.route(
    /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/,
    async (route) => {
      const url = new URL(route.request().url())
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      if (url.pathname.includes("/rest/v1/")) {
        const table = url.pathname.split("/").at(-1)
        let result: unknown[] = []
        if (table === "information_notes") result = notes
        if (table === "month_end_records") {
          const period = url.searchParams.get("period")?.replace(/^eq\./, "")
          result = period ? records.filter((r) => r.period === period) : records
        }
        if (route.request().method() !== "GET") result = []
        const singular = route
          .request()
          .headers()
          .accept?.includes("vnd.pgrst.object")
        return route.fulfill({
          json: singular ? (result[0] ?? null) : result,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers":
              route.request().headers()["access-control-request-headers"] ??
              "authorization,apikey,x-client-info,content-type,prefer,accept-profile,content-profile,x-supabase-api-version",
            "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          },
        })
      }
      if (url.pathname.includes("/auth/"))
        return route.fulfill({ json: { user: null, session: null } })
      // A small dimensioned image keeps country flags deterministic.
      if (route.request().resourceType() === "image")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><path fill="#ddd" d="M0 0h24v16H0z"/></svg>',
        })
      return route.fulfill({ json: {} })
    }
  )
  await context.route("**/api/**", async (route) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    await route.fulfill({ json: dashboard })
  })
}

export const test = base.extend({
  serviceWorkers: "block",
  context: async ({ context }, runFixture) => {
    await installFixtures(context)
    await runFixture(context)
  },
})
export { expect }
