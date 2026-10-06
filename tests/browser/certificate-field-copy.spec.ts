import { expect, test } from "@playwright/test"
import { createMadagascarLayout } from "../../lib/certificate-layout/seed"
import { mockLayoutData } from "./mobile-layout-fixtures"

const issuanceDates = {
  commercialInvoiceDate: "2026-10-06",
  packingListDate: "2024-02-29",
  exportDeclarationDate: "2026-01-09",
  billOfLadingDate: "2026-12-31",
}

test.beforeEach(async ({ page, context }) => {
  await mockLayoutData(context)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const layout = createMadagascarLayout()
  layout.layout.fields.find((field) => field.id === "importerName")!.control =
    "textarea"
  layout.layout.fields.find((field) => field.id === "grossWeight")!.control =
    "number"
  await page.route("**/api/okf/layouts", (route) =>
    route.fulfill({ json: { ok: true, rows: [layout] } })
  )
  await page.route("**/api/okf/requests**", (route) =>
    route.fulfill({
      json: { ok: true, reviews: [], corrections: [], recheckAvailable: false },
    })
  )
  const values: Record<string, string> = {
    ...issuanceDates,
    exporterName: "Original exporter",
    importerName: "Importer SARL\nAntananarivo",
    grossWeight: "1234.56",
    shipmentMethod: "Sea",
  }
  const stamp = "2026-10-06T12:00:00Z"
  const request = {
    id: "certificate-copy-fixture",
    reference: "Certificate copy fixture",
    country: "Madagascar",
    status: "Initiated",
    documents: [],
    createdAt: stamp,
    updatedAt: stamp,
    analysis: {
      consigneeCountry: "Madagascar",
      documents: [],
      fields: layout.layout.fields.map((field) => ({
        key: field.id,
        label: field.label,
        value: values[field.id] ?? "",
        status: values[field.id] ? "extracted" : "missing",
        source: "Synthetic document",
        note: "",
      })),
      invoiceValues: [],
      invoiceItems: [],
      issues: [],
      missingCorrectionsMessage: "",
    },
  }
  await context.route("**/rest/v1/madagascar_bsc_requests**", (route) =>
    route.fulfill({
      json: [
        {
          ...request,
          created_at: request.createdAt,
          updated_at: request.updatedAt,
        },
      ],
      headers: { "access-control-allow-origin": "*" },
    })
  )
  await page.goto("/cargo-tracking-notes/requests?id=certificate-copy-fixture")
  await expect(
    page.locator('[data-layout-field="exporterName"] input')
  ).toHaveValue("Original exporter")
})

test("all Madagascar issuance dates copy as dd/mm/yyyy through buttons and Ctrl-click", async ({
  page,
}) => {
  for (const [key, stored] of Object.entries(issuanceDates)) {
    const field = page.locator(`[data-layout-field="${key}"]`)
    const date = field.getByRole("button", {
      name: "Issuance Date",
      exact: true,
    })
    const [year, month, day] = stored.split("-")
    await expect(date).toContainText(`${month}-${day}-${year}`)
    await field
      .getByRole("button", { name: "Copy Issuance Date", exact: true })
      .click()
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(`${day}/${month}/${year}`)
    await date.click({ modifiers: ["Control"] })
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(`${day}/${month}/${year}`)
    await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)
    await expect(date).toContainText(`${month}-${day}-${year}`)
  }
})

test("Ctrl updates an already hovered text, textarea and number cursor without moving the mouse", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A physical mouse hover is a desktop interaction")
  for (const key of ["exporterName", "importerName", "grossWeight"]) {
    const input = page
      .locator(`[data-layout-field="${key}"]`)
      .locator("input, textarea")
    await input.hover()
    await expect(input).not.toHaveCSS("cursor", "pointer")
    await page.keyboard.down("Control")
    await expect(input).toHaveCSS("cursor", "pointer")
    await page.keyboard.up("Control")
    await expect(input).not.toHaveCSS("cursor", "pointer")
  }
  const missing = page.locator('[data-layout-field="shippingLine"] input')
  await missing.hover()
  await page.keyboard.down("Control")
  await expect(missing).not.toHaveCSS("cursor", "pointer")
  await page.keyboard.up("Control")

  const input = page.locator('[data-layout-field="exporterName"] input')
  await input.hover()
  await page.keyboard.down("Control")
  await expect(input).toHaveCSS("cursor", "pointer")
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(input).not.toHaveCSS("cursor", "pointer")
  await page.keyboard.up("Control")
})

test("focused controls cannot hide Ctrl changes, current drafts copy and normal editing still works", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A physical mouse hover is a desktop interaction")
  const input = page.locator('[data-layout-field="exporterName"] input')
  await input.fill("Edited exporter")
  await input.evaluate((element) => {
    element.addEventListener("keydown", (event) => event.stopPropagation())
    element.addEventListener("keyup", (event) => event.stopPropagation())
  })
  await input.hover()
  await page.keyboard.down("Control")
  await expect(input).toHaveCSS("cursor", "pointer")
  await input.click({ modifiers: ["Control"] })
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Edited exporter")
  await page.keyboard.up("Control")
  await expect(input).not.toHaveCSS("cursor", "pointer")
  await input.press("End")
  await input.press("!")
  await expect(input).toHaveValue("Edited exporter!")
  await input.press("Tab")
  await expect(input).toHaveValue("Edited exporter!")
})

test("calendar edits and choice selection still work, and Ctrl-copy keeps menus closed", async ({
  page,
}) => {
  const field = page.locator('[data-layout-field="commercialInvoiceDate"]')
  const date = field.getByRole("button", { name: "Issuance Date", exact: true })
  await date.click()
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
  await page.keyboard.press("9")
  await page.keyboard.press("Enter")
  await expect(date).toContainText("10-09-2026")
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)
  await field
    .getByRole("button", { name: "Copy Issuance Date", exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("09/10/2026")

  const choice = page.locator(
    '[data-layout-field="shipmentMethod"] [data-slot="combobox-trigger"]'
  )
  await choice.click({ modifiers: ["Control"] })
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Sea")
  await expect(page.locator('[data-slot="combobox-content"]')).toHaveCount(0)
  await choice.click()
  await page.getByRole("option", { name: "Air", exact: true }).click()
  await expect(choice).toContainText("Air")
  await expect(page.locator('[data-slot="combobox-content"]')).toHaveCount(0)
})
