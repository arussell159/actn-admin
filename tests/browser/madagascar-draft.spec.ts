import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { PDFDocument } from "pdf-lib"
import { mockStaffSession } from "./mobile-layout-fixtures"
import { createMadagascarLayout } from "../../lib/certificate-layout/seed"

test("Madagascar screenshot draft reviews edits, downloads PDF, and invalidates stale preview", async ({
  page,
}, info) => {
  await mockStaffSession(page.context())
  await page.route("**/api/okf/layouts", (route) =>
    route.fulfill({ json: { ok: true, rows: [createMadagascarLayout()] } })
  )
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }))
  let requests = 0
  await page.route(
    "**/api/cargo-tracking-notes/madagascar/screenshot-draft",
    async (route) => {
      requests++
      expect(route.request().headers()["authorization"]).toContain("Bearer")
      const body = route.request().postDataBuffer()!.toString("latin1")
      expect(body.match(/name="screenshots"/g)).toHaveLength(3)
      expect(body).toContain("image/jpeg")
      await route.fulfill({
        json: {
          ok: true,
          draft: {
            reference: "AWB-TEST",
            warnings: ["Check the invoice value."],
            sections: [
              {
                title: "Parties",
                fields: [
                  { label: "Exporter", value: "Example Exporter" },
                  { label: "Importer", value: "Example Importer" },
                ],
                tables: [],
              },
              {
                title: "Goods",
                fields: [],
                tables: [
                  {
                    title: "Invoice items",
                    columns: ["HS Code", "Description", "Quantity"],
                    rows: [["847149", "Example server", "1"]],
                  },
                ],
              },
            ],
          },
        },
      })
    }
  )
  await page.goto("/cargo-tracking-notes/new")
  const card = page.locator("#madagascar-screenshot-draft")
  await expect(
    card.getByText("Madagascar draft certificate", { exact: true })
  ).toBeVisible()
  await expect(
    card.getByRole("button", { name: "Read screenshots", exact: true })
  ).toBeDisabled()
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 100
    canvas.height = 100
    const context = canvas.getContext("2d")!
    context.fillStyle = "white"
    context.fillRect(0, 0, 100, 100)
    context.fillStyle = "black"
    context.fillText("Synthetic screenshot", 5, 30)
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await card.getByLabel("SGS application screenshots").setInputFiles(
    [1, 2, 3].map((n) => ({
      name: `system-${n}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(base64, "base64"),
    }))
  )
  await card
    .getByRole("button", { name: "Read screenshots", exact: true })
    .click()
  await expect(
    card.getByText("Review your draft", { exact: true })
  ).toBeVisible()
  expect(requests).toBe(1)
  await card.getByLabel("Exporter", { exact: true }).fill("Corrected Exporter")
  await card
    .getByRole("button", { name: "Create draft PDF", exact: true })
    .click()
  const link = card.getByRole("link", { name: "Download draft PDF" })
  await expect(link).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ])
  expect(download.suggestedFilename()).toBe("madagascar-bsc-draft-AWB-TEST.pdf")
  await download.saveAs(info.outputPath("draft.pdf"))
  const downloadedPdf = await PDFDocument.load(
    await readFile(info.outputPath("draft.pdf"))
  )
  expect(downloadedPdf.getPageCount()).toBe(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await card.screenshot({ path: info.outputPath("draft-review.png") })
  await card.getByLabel("Exporter", { exact: true }).fill("Second correction")
  await expect(link).toHaveCount(0)
  await card.getByRole("button", { name: "Remove system-1.png" }).click()
  await expect(
    card.getByText("Review your draft", { exact: true })
  ).toHaveCount(0)
  await expect(
    card.getByRole("button", { name: "Read screenshots", exact: true })
  ).toBeDisabled()
})
