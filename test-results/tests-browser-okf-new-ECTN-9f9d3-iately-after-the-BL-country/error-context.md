# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\browser\okf.spec.ts >> new ECTN streams the Certificate Settings layout immediately after the BL country
- Location: tests\browser\okf.spec.ts:13:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/cargo-tracking-notes/new", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test"
  2   | import { createInitialPages } from "../../lib/okf/seed"
  3   | import { validateChanges, nextVersion } from "../../lib/okf/engine"
  4   | import { mockLayoutData } from "./mobile-layout-fixtures"
  5   | import { madagascarFieldGroups } from "../../lib/madagascar-bsc"
  6   | import type { KnowledgeDraft, KnowledgeState } from "../../lib/okf/schema"
  7   | import { createMadagascarLayout } from "../../lib/certificate-layout/seed"
  8   | 
  9   | test.beforeEach(async ({ page }) => {
  10  |   await page.route("**/api/okf/layouts", route => route.fulfill({ json: { ok: true, rows: [createMadagascarLayout()] } }))
  11  | })
  12  | 
  13  | test("new ECTN streams the Certificate Settings layout immediately after the BL country", async ({ page }, info) => {
  14  |   const certificateLayout = createMadagascarLayout()
  15  |   const evidence = [{ document: "BL.pdf", page: "1", observedText: "Consignee: Antananarivo, Madagascar" }]
  16  |   const observations = {
  17  |     country: { name: "Madagascar", status: "supported", basis: "consignee address", evidence, finalDestination: "Madagascar", dischargePort: "", transitCountries: [], explanation: "Explicit consignee country" },
  18  |     shipments: [],
  19  |     groupingAmbiguous: true,
  20  |     documents: [{ fileName: "BL.pdf", documentType: "Bill of Lading", status: "final", evidence }],
  21  |     fields: [],
  22  |     conditions: [],
  23  |     findings: [],
  24  |   }
  25  |   const analysis = {
  26  |     consigneeCountry: "Madagascar",
  27  |     documents: [{ fileName: "BL.pdf", documentType: "Bill of Lading", confidence: "Evidence available", note: "final" }],
  28  |     fields: certificateLayout.layout.fields.map(field => ({ key: field.id, label: field.label, value: "", status: "missing", source: "", note: "Loading" })),
  29  |     invoiceItems: [],
  30  |     invoiceValues: [],
  31  |     issues: [],
  32  |     missingCorrectionsMessage: "",
  33  |     okf: { certificateLayout, id: "fast-layout", requestId: "fast-layout", createdAt: new Date().toISOString(), stage: "intake", date: "2026-09-10", generation: 0, revisions: [], observations, findings: [], missingDocuments: [], nextActions: [], mappedFields: [] },
  34  |   }
  35  |   await page.addInitScript((streamAnalysis) => {
  36  |     const nativeFetch = window.fetch.bind(window)
  37  |     window.fetch = (input, init) => {
  38  |       if (String(input).includes("/api/cargo-tracking-notes/analyze")) {
  39  |         const encoder = new TextEncoder()
  40  |         return Promise.resolve(new Response(new ReadableStream({
  41  |           start(controller) {
  42  |             controller.enqueue(encoder.encode(JSON.stringify({ type: "progress", label: "Finding the Bill of Lading" }) + "\n"))
  43  |             setTimeout(() => controller.enqueue(encoder.encode(JSON.stringify({ type: "country", label: "Madagascar layout loaded from Certificate Settings", analysis: streamAnalysis }) + "\n")), 20)
  44  |             setTimeout(() => controller.close(), 10_000)
  45  |           },
  46  |         }), { headers: { "Content-Type": "application/x-ndjson" } }))
  47  |       }
  48  |       return nativeFetch(input, init)
  49  |     }
  50  |   }, analysis)
> 51  |   await page.goto("/cargo-tracking-notes/new")
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  52  |   await page.locator('input[type="file"]').setInputFiles({ name: "BL.pdf", mimeType: "application/pdf", buffer: Buffer.from("synthetic BL") })
  53  |   await page.getByRole("button", { name: "Analyze Certificate", exact: true }).click()
  54  |   await expect(page.locator('[data-certificate-country="Madagascar"]')).toBeVisible({ timeout: 2_000 })
  55  |   await expect(page.getByText("Madagascar layout loaded from Certificate Settings", { exact: true })).toBeVisible()
  56  |   const certificateTabs = page.getByRole("tablist", { name: "Certificate sections", exact: true })
  57  |   await expect(certificateTabs.getByRole("tab", { name: "Fields", exact: true })).toHaveAttribute("aria-selected", "true")
  58  |   await expect(page.locator('[data-layout-field="exporterName"] .ai-field-loading input')).toBeVisible()
  59  |   await expect(page.locator('[data-layout-field="exporterName"] [data-slot="skeleton"]')).toHaveCount(0)
  60  |   await page.screenshot({
  61  |     path: `node_modules/.cache/ectn-field-glow-${info.project.name}.png`,
  62  |   })
  63  |   await certificateTabs.getByRole("tab", { name: "Errors", exact: true }).click()
  64  |   await expect(page.getByText("Missing fields and corrections will be checked after all document extraction is complete.", { exact: true })).toBeVisible()
  65  |   await expect(page.getByText("Missing / Corrections Needed", { exact: true })).toHaveCount(0)
  66  |   await certificateTabs.getByRole("tab", { name: "Dashboard", exact: true }).click()
  67  |   await expect(page.getByText("Bill of Lading", { exact: true })).toBeVisible()
  68  | })
  69  | 
  70  | test("certificate tabs edit fields, keep the layout draft and show a clean preview", async ({ page }, info) => {
  71  |   await mockLayoutData(page.context())
  72  |   await mockKnowledge(page)
  73  |   await page.goto("/certificate-settings?country=madagascar")
  74  |   const tabs = page.getByRole("tablist", { name: "Certificate settings sections", exact: true })
  75  |   const fields = tabs.getByRole("tab", { name: "Fields", exact: true })
  76  |   const layout = tabs.getByRole("tab", { name: "Layout", exact: true })
  77  |   const preview = tabs.getByRole("tab", { name: "Preview", exact: true })
  78  |   await expect(layout).toHaveAttribute("aria-selected", "true")
  79  |   await fields.click()
  80  |   await expect(page.getByRole("tabpanel", { name: "Fields", exact: true })).toBeVisible()
  81  |   await expect(page.locator("[data-drag-field]")).toHaveCount(0)
  82  |   const search = page.getByRole("textbox", { name: "Search country fields", exact: true })
  83  |   await search.fill("no such field")
  84  |   await expect(page.getByText("No fields match your search.", { exact: true })).toBeVisible()
  85  |   await search.fill("Exporter Name")
  86  |   await page.getByRole("button", { name: "Edit field Exporter Name", exact: true }).click()
  87  |   await page.getByRole("textbox", { name: "Field label", exact: true }).fill("Exporter legal name")
  88  |   await page.getByRole("button", { name: "Done", exact: true }).click()
  89  |   await search.fill("Exporter legal name")
  90  |   await expect(page.getByRole("button", { name: "Edit field Exporter legal name", exact: true })).toBeVisible()
  91  |   await fields.focus()
  92  |   await fields.press("ArrowRight")
  93  |   await expect(layout).toBeFocused()
  94  |   await expect(fields).toHaveAttribute("aria-selected", "true")
  95  |   await layout.press("Enter")
  96  |   await expect(page.getByRole("tabpanel", { name: "Layout", exact: true })).toBeVisible()
  97  |   await expect(page.locator('[data-layout-group="exporter"]').getByRole("button", { name: "Edit field Exporter legal name", exact: true })).toBeVisible()
  98  |   await fields.click()
  99  |   await expect(search).toHaveValue("Exporter legal name")
  100 |   await page.getByRole("button", { name: "New field", exact: true }).click()
  101 |   await page.getByRole("textbox", { name: "New field name", exact: true }).fill("Exporter registration")
  102 |   await page.getByRole("button", { name: "Add field", exact: true }).click()
  103 |   await search.fill("Exporter")
  104 |   await expect(page.getByRole("button", { name: "Edit field Exporter registration", exact: true })).toBeVisible()
  105 |   await page.screenshot({ path: `node_modules/.cache/certificate-fields-tab-${info.project.name}.png`, animations: "disabled" })
  106 |   await preview.click()
  107 |   await expect(page.getByRole("tabpanel", { name: "Preview", exact: true })).toBeVisible()
  108 |   await expect(page.getByRole("textbox", { name: "Exporter legal name", exact: true })).toBeVisible()
  109 |   await expect(page.getByRole("textbox", { name: "Exporter registration", exact: true })).toBeVisible()
  110 |   await expect(page.getByRole("button", { name: "Add section", exact: true })).toHaveCount(0)
  111 |   await expect(page.locator("[data-drag-field]")).toHaveCount(0)
  112 |   await expect(page.getByRole("button", { name: "Edit layout", exact: true })).toHaveCount(0)
  113 |   await page.screenshot({ path: `node_modules/.cache/certificate-preview-tab-${info.project.name}.png`, animations: "disabled" })
  114 |   await layout.click()
  115 |   await expect(page.getByRole("button", { name: "Edit field Exporter registration", exact: true })).toBeVisible()
  116 |   const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("actn-layout-draft-madagascar") || "{}"))
  117 |   expect(draft.layout.fields.some((field: {label: string}) => field.label === "Exporter registration")).toBe(true)
  118 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  119 | })
  120 | 
  121 | test("country heading searches saved layouts and creates a layout from the last option", async ({ page }, info) => {
  122 |   await mockLayoutData(page.context())
  123 |   await mockKnowledge(page)
  124 |   const madagascar = createMadagascarLayout()
  125 |   const kenya = { ...madagascar, country_key: "kenya", layout: { ...madagascar.layout, country: "Kenya", aliases: [] } }
  126 |   await page.route("**/api/okf/layouts", route => route.fulfill({ json: { ok: true, rows: [madagascar, kenya] } }))
  127 |   await page.goto("/certificate-settings?country=madagascar")
  128 |   const picker = page.getByRole("button", { name: "Certificate layout country", exact: true })
  129 |   await expect(page.locator("h1").filter({ has: picker })).toContainText("Madagascar")
  130 |   await page.evaluate(() => document.fonts.ready)
  131 |   expect(await picker.locator("span").first().evaluate((label) => label.scrollWidth - label.clientWidth)).toBeLessThanOrEqual(1)
  132 |   await expect(page.getByRole("heading", { name: "Certificate layout", exact: true })).toHaveCount(0)
  133 |   await expect(page.getByRole("button", { name: "New country layout", exact: true })).toHaveCount(0)
  134 |   await page.getByRole("button", { name: "Edit section Trade Parties", exact: true }).click()
  135 |   await page.getByRole("textbox", { name: "Section name", exact: true }).fill("Draft trade parties")
  136 |   await page.getByRole("button", { name: "Done", exact: true }).click()
  137 |   await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0)
  138 |   await picker.click()
  139 |   const search = page.getByRole("combobox", { name: "Search country layouts", exact: true })
  140 |   await expect(search).toBeFocused()
  141 |   await expect(page.getByRole("option").last()).toHaveText("Add new country layout")
  142 |   await search.fill("ken")
  143 |   await expect(page.getByRole("option", { name: "Kenya", exact: true })).toBeVisible()
  144 |   await expect(page.getByRole("option", { name: /^Madagascar/ })).toHaveCount(0)
  145 |   await search.press("Enter")
  146 |   await expect(page).toHaveURL(/country=kenya/)
  147 |   await expect(picker).toContainText("Kenya")
  148 |   await picker.click()
  149 |   await expect(search).toHaveValue("")
  150 |   await search.fill("MAD")
  151 |   await search.press("Enter")
```