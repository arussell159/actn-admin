import type { BrowserContext } from "@playwright/test"

export async function mockLayoutData(context: BrowserContext) {
  const timestamp = "2026-08-01T12:00:00.000Z"
  let notes = [
    {
      id: "qa-folder",
      parent_id: null,
      type: "folder",
      title: "Test folder",
      content: null,
      pinned: true,
      sort_order: 0,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "qa-note",
      parent_id: "qa-folder",
      type: "note",
      title: "Long test note",
      content: JSON.stringify({
        type: "doc",
        content: Array.from({ length: 40 }, (_, i) => ({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `Paragraph ${i + 1}. Notes typing and scrolling must stay visible.`,
            },
          ],
        })),
      }),
      pinned: false,
      sort_order: 0,
      created_at: timestamp,
      updated_at: timestamp,
    },
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `qa-folder-${i}`,
      parent_id: null,
      type: "folder",
      title: `Folder ${i + 1}`,
      content: null,
      pinned: false,
      sort_order: i + 1,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  ]
  const records = Array.from({ length: 24 }, (_, i) => ({
    id: new Date(Date.UTC(2026, 7 - i, 1)).toISOString().slice(0, 7),
    period: new Date(Date.UTC(2026, 7 - i, 1)).toISOString().slice(0, 7),
    checked: {},
    status: i ? "Closed" : "Open",
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: i ? timestamp : null,
  }))
  // All external requests, including writes, stay inside the browser fixture.
  await context.route(/https?:\/\/(?!localhost:\d+\/)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.resourceType() === "image")
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><path fill="#ccc" d="M0 0h24v16H0z"/></svg>',
      })
    let result: unknown[] = []
    if (url.pathname.endsWith("/information_notes")) {
      if (request.method() === "POST") {
        const body = request.postDataJSON()
        const updates = Array.isArray(body) ? body : [body]
        notes = [
          ...notes.filter(
            (note) => !updates.some((update) => update.id === note.id)
          ),
          ...updates,
        ]
      }
      if (request.method() === "DELETE") {
        const ids = (url.searchParams.get("id") ?? "")
          .replace(/^in\(|\)$/g, "")
          .split(",")
          .map((id) => id.replaceAll('"', ""))
        notes = notes.filter((note) => !ids.includes(note.id))
      }
      result = notes
    }
    if (url.pathname.endsWith("/month_end_records")) {
      const period = url.searchParams.get("period")?.replace("eq.", "")
      result = period
        ? records.filter((record) => record.period === period)
        : records
    }
    const singular = request.headers().accept?.includes("vnd.pgrst.object")
    await route.fulfill({
      json: singular ? (result[0] ?? null) : result,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          request.headers()["access-control-request-headers"] ?? "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
    })
  })
  await context.route("**/api/**", (route) =>
    route.fulfill({
      json: {
        ok: true,
        tickets: [],
        todayTickets: [],
        metrics: {
          ok: true,
          chartData: [],
          totals: { newTickets: 0, closedTickets: 0, onHoldTickets: 0 },
        },
      },
    })
  )
}
