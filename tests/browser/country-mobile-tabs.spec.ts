import { expect, test } from "@playwright/test"

test.beforeEach(async ({ context }) => {
  // Fulfill all external requests locally, including writes. No live records
  // are read or changed by these navigation tests.
  await context.route(/https?:\/\/(?!localhost:3100\/)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const records = url.pathname.endsWith("/month_end_records")
      ? [
          {
            id: "2026-08",
            period: "2026-08",
            checked: {},
            status: "Open",
            created_at: "2026-08-01T12:00:00.000Z",
            updated_at: "2026-08-01T12:00:00.000Z",
            completed_at: null,
          },
        ]
      : []
    const singular = request.headers().accept?.includes("vnd.pgrst.object")
    await route.fulfill({
      json: singular ? (records[0] ?? null) : records,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          request.headers()["access-control-request-headers"] ?? "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
    })
  })
  await context.route("**/api/**", (route) => route.fulfill({ json: {} }))
})

test("touch tabs change the country page and stay in sync with browser history", async ({
  page,
}) => {
  await page.goto(
    "/month-end/country?period=2026-08&country=benin&view=dashboard"
  )
  await expect(
    page.getByRole("navigation", { name: "Mobile app navigation" })
  ).toBeVisible()
  await expect(
    page.getByText("Could not load this country record.")
  ).toHaveCount(0)

  for (const [label, view] of [
    ["Recon", "reconciliation"],
    ["Journal", "journal"],
    ["Dashboard", "dashboard"],
    ["Journal", "journal"],
    ["Recon", "reconciliation"],
    ["Dashboard", "dashboard"],
  ]) {
    const tab = page.getByRole("tab", { name: label, exact: true })
    await tab.tap()
    await expect(page).toHaveURL(new RegExp(`view=${view}(?:&|$)`))
    await expect(tab).toHaveAttribute("aria-selected", "true")
    if (view === "journal") {
      await expect(
        page.getByRole("heading", { name: "Create Journal Entry" })
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole("heading", { name: "Create Journal Entry" })
      ).toHaveCount(0)
    }
  }

  await page.goBack()
  await expect(page).toHaveURL(/view=reconciliation(?:&|$)/)
  await expect(
    page.getByRole("tab", { name: "Recon", exact: true })
  ).toHaveAttribute("aria-selected", "true")
  await page.goForward()
  await expect(page).toHaveURL(/view=dashboard(?:&|$)/)
  await expect(
    page.getByRole("tab", { name: "Dashboard", exact: true })
  ).toHaveAttribute("aria-selected", "true")
})
