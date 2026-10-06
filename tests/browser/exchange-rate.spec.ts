import { expect, test } from "@playwright/test"
import { mockLayoutData } from "./mobile-layout-fixtures"

test.beforeEach(async ({ context }) => {
  await mockLayoutData(context)
  let record = {
    id: "2026-08",
    period: "2026-08",
    checked: {
      "frabemar-gabon__invoice": true,
      frabemar__frabemar_invoice_package: JSON.stringify({
        invoices: [{ fileName: "gabon-invoice.pdf" }],
        countryValues: {
          "frabemar-gabon": {
            invoiceTotal: 10000,
            commission: 0,
            invoiceNumber: "TEST-100",
          },
        },
        pastedReportText: "Fixture invoice data",
        savedAt: "2026-08-01T12:00:00.000Z",
      }),
    } as Record<string, string | number | boolean>,
    status: "Open",
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    completed_at: null,
  }
  await context.route("**/rest/v1/month_end_records*", async (route) => {
    const request = route.request()
    if (request.method() === "POST") {
      const body = request.postDataJSON()
      record = Array.isArray(body) ? body[0] : body
    }
    const singular = request.headers().accept?.includes("vnd.pgrst.object")
    await route.fulfill({
      json: singular ? record : [record],
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          request.headers()["access-control-request-headers"] ?? "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
    })
  })
})

test("month-end rate editor saves all six decimals and reloads the same value", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Month-end exchange-rate table is shown on desktop.")
  await page.goto("/month-end")
  await expect(page.getByText("Total Revenue", { exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "Countries", exact: true }).click()
  const edit = page.getByRole("button", {
    name: "Edit exchange rate for Madagascar",
    exact: true,
  })
  await edit.click()
  const input = page.getByRole("textbox", {
    name: "Exchange rate for Madagascar",
    exact: true,
  })
  await input.fill("1.234567")
  await expect(input).toHaveValue("1.234567")
  await input.press("7")
  await expect(input).toHaveValue("1.234567")
  await input.press("Enter")
  await expect(edit).toHaveText("1.234567")
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = JSON.parse(
          localStorage.getItem("actn-month-end-records-v1") ?? "[]"
        )
        return records.find(
          (record: { period: string }) => record.period === "2026-08"
        )?.checked.madagascar__exchange_rate
      })
    )
    .toBe(1.234567)
  await page.reload()
  await page.getByRole("tab", { name: "Countries", exact: true }).click()
  await expect(edit).toHaveText("1.234567")
  await edit.click()
  await expect(input).toHaveValue("1.234567")
})

for (const country of ["frabemar-gabon", "frabemar"]) {
  test(`${country} journal rate editor saves six decimals and reloads comma decimals`, async ({
    page,
  }) => {
    await page.goto(
      `/month-end/country?period=2026-08&country=${country}&view=journal`
    )
    const input = page.getByRole("textbox", {
      name: "Exchange rate",
      exact: true,
    })
    await input.fill("1,234567")
    await expect(input).toHaveValue("1,234567")
    await input.press("8")
    await expect(input).toHaveValue("1,234567")
    const save = page.waitForRequest(
      (request) =>
        request.url().includes("/rest/v1/month_end_records") &&
        request.method() === "POST"
    )
    await input.press("Enter")
    const request = await save
    const body = request.postDataJSON()
    const saved = Array.isArray(body) ? body[0] : body
    await expect(input).toHaveValue("1.234567")
    expect(saved.checked["frabemar-gabon__exchange_rate"]).toBe(1.234567)
    expect(saved.checked["frabemar-gabon__exchange_rate_display"]).toBe(
      "1.234567"
    )
    if (country === "frabemar") {
      for (const childId of [
        "frabemar-dr-congo",
        "frabemar-mali",
        "frabemar-republic-of-guinea",
      ]) {
        expect(saved.checked[`${childId}__exchange_rate`]).toBe(1.234567)
        expect(saved.checked[`${childId}__exchange_rate_display`]).toBe(
          "1.234567"
        )
      }
      await expect(
        page.getByText("12,345.67", { exact: true }).first()
      ).toBeVisible()
    }
    await page.reload()
    await expect(input).toHaveValue("1.234567")
  })
}
