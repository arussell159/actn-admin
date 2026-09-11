import { expect, test, type Page } from "@playwright/test"
import { createInitialPages } from "../../lib/okf/seed"
import { validateChanges, nextVersion } from "../../lib/okf/engine"
import { mockLayoutData, mockStaffSession } from "./mobile-layout-fixtures"
import { madagascarFieldGroups } from "../../lib/madagascar-bsc"
import type { KnowledgeDraft, KnowledgeState } from "../../lib/okf/schema"
import { createMadagascarLayout } from "../../lib/certificate-layout/seed"

test.beforeEach(async ({ page, context }) => {
  await mockStaffSession(context)
  await page.route("**/api/okf/layouts", (route) =>
    route.fulfill({ json: { ok: true, rows: [createMadagascarLayout()] } })
  )
})

test("new ECTN streams the Certificate Settings layout immediately after the BL country", async ({
  page,
}, info) => {
  const certificateLayout = createMadagascarLayout()
  const evidence = [
    {
      document: "BL.pdf",
      page: "1",
      observedText: "Consignee: Antananarivo, Madagascar",
    },
  ]
  const observations = {
    country: {
      name: "Madagascar",
      status: "supported",
      basis: "consignee address",
      evidence,
      finalDestination: "Madagascar",
      dischargePort: "",
      transitCountries: [],
      explanation: "Explicit consignee country",
    },
    shipments: [],
    groupingAmbiguous: true,
    documents: [
      {
        fileName: "BL.pdf",
        documentType: "Bill of Lading",
        status: "final",
        evidence,
      },
    ],
    fields: [],
    conditions: [],
    findings: [],
  }
  const analysis = {
    consigneeCountry: "Madagascar",
    documents: [
      {
        fileName: "BL.pdf",
        documentType: "Bill of Lading",
        confidence: "Evidence available",
        note: "final",
      },
    ],
    fields: certificateLayout.layout.fields.map((field) => ({
      key: field.id,
      label: field.label,
      value: "",
      status: "missing",
      source: "",
      note: "Loading",
    })),
    invoiceItems: [],
    invoiceValues: [],
    issues: [],
    missingCorrectionsMessage: "",
    okf: {
      certificateLayout,
      id: "fast-layout",
      requestId: "fast-layout",
      createdAt: new Date().toISOString(),
      stage: "intake",
      date: "2026-09-10",
      generation: 0,
      revisions: [],
      observations,
      findings: [],
      missingDocuments: [],
      nextActions: [],
      mappedFields: [],
    },
  }
  await page.addInitScript((streamAnalysis) => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      if (String(input).includes("/api/cargo-tracking-notes/analyze")) {
        const encoder = new TextEncoder()
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "progress",
                      label: "Finding the Bill of Lading",
                    }) + "\n"
                  )
                )
                setTimeout(
                  () =>
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "country",
                          label:
                            "Madagascar layout loaded from Certificate Settings",
                          analysis: streamAnalysis,
                        }) + "\n"
                      )
                    ),
                  20
                )
                setTimeout(() => controller.close(), 10_000)
              },
            }),
            { headers: { "Content-Type": "application/x-ndjson" } }
          )
        )
      }
      return nativeFetch(input, init)
    }
  }, analysis)
  await page.goto("/cargo-tracking-notes/new")
  await page.locator('input[type="file"]').setInputFiles({
    name: "BL.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("synthetic BL"),
  })
  await page
    .getByRole("button", { name: "Analyze Certificate", exact: true })
    .click()
  await expect(
    page.locator('[data-certificate-country="Madagascar"]')
  ).toBeVisible({ timeout: 2_000 })
  await expect(
    page.getByText("Madagascar layout loaded from Certificate Settings", {
      exact: true,
    })
  ).toBeVisible()
  const certificateTabs = page.getByRole("tablist", {
    name: "Certificate sections",
    exact: true,
  })
  await expect(
    certificateTabs.getByRole("tab", { name: "Fields", exact: true })
  ).toHaveAttribute("aria-selected", "true")
  await expect(
    page.locator('[data-layout-field="exporterName"] [aria-busy="true"] input')
  ).toBeVisible()
  await expect(
    page.locator('[data-layout-field="exporterName"] [data-slot="skeleton"]')
  ).toHaveCount(0)
  await page.screenshot({
    path: `node_modules/.cache/ectn-field-glow-${info.project.name}.png`,
  })
  await certificateTabs
    .getByRole("tab", { name: "Errors", exact: true })
    .click()
  await expect(
    page.getByText(
      "Missing fields and corrections will be checked after all document extraction is complete.",
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByText("Missing / Corrections Needed", { exact: true })
  ).toHaveCount(0)
  await certificateTabs
    .getByRole("tab", { name: "Dashboard", exact: true })
    .click()
  await expect(page.getByText("Bill of Lading", { exact: true })).toBeVisible()
})

test("certificate editor preserves field edits across preview and reload", async ({
  page,
}) => {
  await mockLayoutData(page.context())
  await mockKnowledge(page)
  let draft: Record<string, unknown> | null = null
  await page.route("**/api/okf/layouts/draft*", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON()
      draft = {
        draft_key: body.draftKey,
        layout: body.layout,
        base_revision: body.baseRevision,
        edit: body.expectedEdit + 1,
        updated_at: new Date().toISOString(),
        updated_by: "11111111-1111-4111-8111-111111111111",
      }
    }
    await route.fulfill({ json: { ok: true, draft } })
  })
  await page.goto("/certificate-settings?country=madagascar")
  const exporter = page.locator('[data-layout-group="exporter"]')
  await exporter
    .getByRole("button", { name: "Edit field Name", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Field label", exact: true })
    .fill("Exporter legal name")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  const view = page.getByRole("group", { name: "Editor view", exact: true })
  await view.getByRole("button", { name: "Preview", exact: true }).click()
  await expect(
    page.getByRole("textbox", { name: "Exporter legal name", exact: true })
  ).toBeVisible()
  await expect(page.locator("[data-drag-field]")).toHaveCount(0)
  await view.getByRole("button", { name: "Edit", exact: true }).click()
  await expect(
    exporter.getByRole("button", {
      name: "Edit field Exporter legal name",
      exact: true,
    })
  ).toBeVisible()
  await expect.poll(() => draft !== null).toBe(true)
  await page.reload()
  await expect(
    exporter.getByRole("button", {
      name: "Edit field Exporter legal name",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Publish", exact: true })
  ).toBeEnabled()
})

test("country heading searches saved layouts and creates a layout from the last option", async ({
  page,
}, info) => {
  await mockLayoutData(page.context())
  await mockKnowledge(page)
  const madagascar = createMadagascarLayout()
  const kenya = {
    ...madagascar,
    country_key: "kenya",
    layout: { ...madagascar.layout, country: "Kenya", aliases: [] },
  }
  await page.route("**/api/okf/layouts", (route) =>
    route.fulfill({ json: { ok: true, rows: [madagascar, kenya] } })
  )
  await page.goto("/certificate-settings?country=madagascar")
  const picker = page.getByRole("button", {
    name: "Certificate layout country",
    exact: true,
  })
  await expect(page.locator("h1").filter({ has: picker })).toContainText(
    "Madagascar"
  )
  await page.evaluate(() => document.fonts.ready)
  expect(
    await picker
      .locator("span")
      .first()
      .evaluate((label) => label.scrollWidth - label.clientWidth)
  ).toBeLessThanOrEqual(1)
  await expect(
    page.getByRole("heading", { name: "Certificate layout", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "New country layout", exact: true })
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Edit section Trade Parties", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Section name", exact: true })
    .fill("Draft trade parties")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    0
  )
  await picker.click()
  const search = page.getByRole("combobox", {
    name: "Search country layouts",
    exact: true,
  })
  await expect(search).toBeFocused()
  await expect(page.getByRole("option").last()).toHaveText(
    "Add new country layout"
  )
  await search.fill("ken")
  await expect(
    page.getByRole("option", { name: "Kenya", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("option", { name: /^Madagascar/ })).toHaveCount(0)
  await search.press("Enter")
  await expect(page).toHaveURL(/country=kenya/)
  await expect(picker).toContainText("Kenya")
  await picker.click()
  await expect(search).toHaveValue("")
  await search.fill("MAD")
  await search.press("Enter")
  await expect(page).toHaveURL(/country=madagascar/)
  await expect(
    page.getByRole("button", {
      name: "Edit section Draft trade parties",
      exact: true,
    })
  ).toBeVisible()
  await picker.click()
  await search.press("Escape")
  await expect(picker).toBeFocused()
  await picker.click()
  await search.fill("Rwanda")
  await expect(
    page.getByText("No country layouts found.", { exact: true })
  ).toBeVisible()
  await expect(page.getByRole("option").last()).toHaveText(
    "Add new country layout"
  )
  await page.screenshot({
    path: `node_modules/.cache/certificate-country-picker-${info.project.name}.png`,
    animations: "disabled",
  })
  await search.press("Enter")
  await expect(page).toHaveURL(/country=new/)
  await expect(picker).toContainText("New country layout")
  await page
    .getByRole("textbox", { name: "Layout country", exact: true })
    .fill("Rwanda")
  await expect(picker).toContainText("Rwanda")
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    0
  )
})

test("visual editor drags fields between groups and duplicates a country draft", async ({
  page,
}, info) => {
  await mockLayoutData(page.context())
  await mockKnowledge(page)
  await page.goto("/knowledge-base?page=layout-madagascar")
  await expect(page).toHaveURL(/certificate-settings\?country=madagascar/)
  await expect(
    page.getByRole("heading", {
      name: "Missing / Corrections Needed",
      exact: true,
    })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: "Edit section Trade Parties",
      exact: true,
    })
  ).toBeVisible()
  const sourceId = "exporterAddress"
  if (info.project.name === "desktop") {
    const handle = page
      .locator(`[data-drag-field="${sourceId}"]`)
      .getByRole("button", { name: /^Drag/ })
    const destination = page.locator('[data-drop-group="exporter"]')
    await expect(handle).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const a = (await handle.boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, {
      steps: 3,
    })
    await expect(handle).toHaveAttribute("aria-pressed", "true")
    const b = (await destination.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 })
    await expect(destination).toHaveText("Drop here")
    await page.mouse.up()
  } else {
    await page.locator("aside summary").click()
    await page
      .getByRole("button", { name: "Add field Exporter Address", exact: true })
      .click()
    await page.getByRole("button", { name: "Add field", exact: true }).click()
  }
  await expect(
    page.locator(
      '[data-layout-group="exporter"] [data-drag-field="exporterAddress"]'
    )
  ).toBeVisible()
  await page
    .locator(
      '[data-layout-group="exporter"] [data-drag-field="exporterAddress"]'
    )
    .getByRole("button", { name: /^Edit field/ })
    .click()
  await page.getByRole("combobox", { name: "Move to", exact: true }).click()
  await page
    .getByRole("option", { name: "Trade Parties / Importer", exact: true })
    .click()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(
    page.locator(
      '[data-layout-group="importer"] [data-drag-field="exporterAddress"]'
    )
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Duplicate layout", exact: true })
    .click()
  await page.getByRole("textbox", { name: "New country name" }).fill("Kenya")
  await page
    .getByRole("button", { name: "Create country draft", exact: true })
    .click()
  await expect(page).toHaveURL(/certificate-settings\?country=new/)
  await expect(
    page.getByRole("textbox", { name: "Layout country", exact: true })
  ).toHaveValue("Kenya")
  await expect(
    page.locator(
      '[data-layout-group="importer"] [data-drag-field="exporterAddress"]'
    )
  ).toBeVisible()
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("actn-layout-draft-new") || "{}")
  )
  expect(draft.revision).toBe(0)
  expect(draft.layout.country).toBe("Kenya")
  expect(draft.layout.sections).toHaveLength(4)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})

test("Settings layout publishes columns and new fields, then certificates use the cached layout", async ({
  page,
}, info) => {
  await mockLayoutData(page.context())
  await mockKnowledge(page)
  let record = createMadagascarLayout()
  let publishes = 0
  await page.route("**/api/okf/layouts", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON()
      expect(body.expectedRevision).toBe(record.revision)
      record = { ...record, layout: body.layout, revision: record.revision + 1 }
      publishes++
      return route.fulfill({ json: { ok: true, row: record } })
    }
    await route.fulfill({
      headers: { ETag: `"layout-${record.revision}"` },
      json: { ok: true, rows: [record] },
    })
  })
  await page.goto("/knowledge-base?page=layout-madagascar")
  await expect(
    page.getByRole("button", {
      name: "Certificate layout country",
      exact: true,
    })
  ).toContainText("Madagascar")
  await page
    .getByRole("button", { name: "Edit section Trade Parties", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Section name", exact: true })
    .fill("Trading parties")
  await page
    .getByRole("combobox", { name: "Subsections per row", exact: true })
    .click()
  await page.getByRole("option", { name: "1", exact: true }).click()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await page.locator('[data-drop-group="exporter"]').getByRole("button").click()
  await page
    .getByRole("textbox", { name: "New field name" })
    .fill("Exporter registration")
  await page.getByRole("button", { name: "Add field", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(publishes).toBe(0)
  await page
    .getByRole("button", { name: "Certificate layout country", exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `node_modules/.cache/certificate-layout-editor-${info.project.name}.png`,
  })
  await page.getByRole("tab", { name: "Preview", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Trading parties", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Exporter registration", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Publish layout", exact: true })
    .click()
  await expect(
    page.getByRole("status").filter({ hasText: "Layout published" })
  ).toContainText("revision 2")
  expect(publishes).toBe(1)
  expect(record.layout.sections[0].columns).toBe(1)
  const custom = record.layout.fields.find(
    (field) => field.label === "Exporter registration"
  )!
  const stamp = "2026-09-10T12:00:00Z"
  const request = {
    id: "layout-fixture",
    reference: "Layout fixture",
    country: "Madagascar",
    status: "Needs review",
    documents: [],
    createdAt: stamp,
    updatedAt: stamp,
    analysis: {
      consigneeCountry: "Madagascar",
      documents: [],
      fields: [
        {
          key: custom.id,
          label: custom.label,
          value: "REG-123",
          status: "extracted",
          source: "Fixture",
          note: "",
        },
      ],
      invoiceValues: [],
      invoiceItems: [],
      issues: [],
      missingCorrectionsMessage: "",
    },
  }
  await page.evaluate(
    (request) =>
      localStorage.setItem(
        "actn-madagascar-bsc-requests-v1",
        JSON.stringify([request])
      ),
    request
  )
  await page.route("**/api/okf/local-requests**", (route) =>
    route.fulfill({ status: 400, json: { ok: false, message: "Fixture only" } })
  )
  await page.route("**/api/okf/requests**", (route) =>
    route.fulfill({
      json: { ok: true, reviews: [], corrections: [], recheckAvailable: false },
    })
  )
  await page.goto("/cargo-tracking-notes/requests?id=layout-fixture")
  await expect(
    page.getByRole("heading", { name: "Trading parties", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Exporter registration", exact: true })
  ).toHaveValue("REG-123")
  await expect(
    page.getByRole("heading", {
      name: "Missing / Corrections Needed",
      exact: true,
    })
  ).toHaveCount(1)
  const cached = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("actn-certificate-layouts-v1") || "{}")
  )
  expect(cached.rows[0].revision).toBe(2)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: `node_modules/.cache/certificate-layout-record-${info.project.name}.png`,
  })
})

test("separate settings menu pages and browser history preserve the layout draft", async ({
  page,
  isMobile,
}, info) => {
  await mockLayoutData(page.context())
  await mockKnowledge(page)
  await page.goto(
    "/template-builder?tab=certificate-layouts&country=madagascar"
  )
  await expect(page).toHaveURL(/certificate-settings\?country=madagascar/)
  await expect(
    page.getByRole("navigation", { name: "Settings", exact: true })
  ).toHaveCount(0)
  await expect(
    page
      .getByRole("heading", { name: "Certificate settings", exact: true })
      .filter({ visible: true })
  ).toBeVisible()
  async function settingsMenu() {
    if (isMobile) {
      await page.getByRole("button", { name: "Open more navigation" }).click()
      return page.getByRole("dialog")
    }
    return page.locator('[data-slot="sidebar-group"]').filter({
      has: page
        .locator('[data-slot="sidebar-group-label"]')
        .getByText("Settings", { exact: true }),
    })
  }
  let menu = await settingsMenu()
  await expect(
    menu.getByRole("link", { name: "Accounting settings", exact: true })
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Certificate settings", exact: true })
  ).toHaveAttribute("aria-current", "page")
  if (isMobile)
    await page.getByRole("button", { name: "Close", exact: true }).click()
  await page
    .getByRole("button", { name: "Edit section Trade Parties", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Section name", exact: true })
    .fill("Draft parties")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  menu = await settingsMenu()
  await menu
    .getByRole("link", { name: "Accounting settings", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(/\/template-builder$/)
  await expect(
    page.getByRole("button", {
      name: "Certificate layout country",
      exact: true,
    })
  ).toHaveCount(0)
  await expect(
    page.getByRole("navigation", { name: "Settings", exact: true })
  ).toHaveCount(0)
  await page.screenshot({
    path: `node_modules/.cache/accounting-settings-${info.project.name}.png`,
  })
  await page.goBack()
  await expect(
    page.getByRole("button", {
      name: "Edit section Draft parties",
      exact: true,
    })
  ).toBeVisible()
  menu = await settingsMenu()
  await menu
    .getByRole("link", { name: "Accounting settings", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(/\/template-builder$/)
  menu = await settingsMenu()
  await expect(
    menu.getByRole("link", { name: "Accounting settings", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await menu
    .getByRole("link", { name: "Certificate settings", exact: true })
    .press("Enter")
  await expect(
    page.getByRole("button", {
      name: "Edit section Draft parties",
      exact: true,
    })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Country settings", exact: true })
    .click()
  await page.getByRole("button", { name: "Reset draft", exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole("button", {
      name: "Edit section Trade Parties",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Edit section Draft parties",
      exact: true,
    })
  ).toHaveCount(0)
  await page.screenshot({
    path: `node_modules/.cache/certificate-settings-${info.project.name}.png`,
  })
  await page.goto("/knowledge-base?page=mg-overview")
  await expect(page.locator("article h1")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Certificate layout", exact: true })
  ).toHaveCount(0)
})

async function mockKnowledge(
  page: Page,
  dynamic: {
    layoutCountries?: string[]
    sourceLearnings?: unknown[]
  } = {}
) {
  const state: KnowledgeState = {
    generation: 1,
    pages: createInitialPages().map((p) => ({
      ...p,
      revision: 1,
      version: "1.0.0",
      publishedAt: "2026-09-10T12:00:00Z",
    })),
  }
  const drafts = new Map<string, KnowledgeDraft>()
  const published: unknown[] = []
  let readCount = 0
  await page.route("**/api/okf/assistant", async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      json:
        body.mode === "review"
          ? {
              ok: true,
              review: "Focused review complete.",
              edit: drafts.get(body.draftId)?.edit_version,
            }
          : {
              ok: true,
              result: {
                classification: "duplicate",
                message: "Already covered",
                question: "",
                pageIds: ["mg-overview"],
                changes: [],
              },
              draft: null,
            },
    })
  })
  await page.route(/\/api\/okf$/, async (route) => {
    const body =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : null
    let result: unknown
    if (!body) {
      readCount += 1
      result = {
        ok: true,
        state,
        drafts: [...drafts.values()],
        history: [],
        intake: [],
        layoutCountries: dynamic.layoutCountries ?? [],
        sourceLearnings: dynamic.sourceLearnings ?? [],
        options: {},
        userId: "test-staff",
        canEdit: true,
        canPublish: true,
      }
    } else if (body.action === "save") {
      const input = body.draft
      const changes = validateChanges(state, input.changes)
      if (!changes.length) {
        drafts.delete(input.id)
        result = { ok: true, duplicate: true }
      } else {
        // Mimic jsonb key ordering so autosave cannot rely on JS insertion order.
        const reordered = JSON.parse(
          JSON.stringify(changes, (_k, v) =>
            v && typeof v === "object" && !Array.isArray(v)
              ? Object.fromEntries(
                  Object.entries(v).sort(([a], [b]) => a.localeCompare(b))
                )
              : v
          )
        )
        const d = {
          id: input.id,
          edit_version: input.expectedEdit + 1,
          base_generation: input.baseGeneration,
          changes: reordered,
          reason: input.reason,
          source: input.source,
          proposer: "test-staff",
          updated_at: "2026-09-10T12:01:00Z",
          status: "pending",
          review: "",
          review_edit: null,
        }
        drafts.set(d.id, d)
        result = { ok: true, draft: d }
      }
    } else if (body.action === "preview") {
      const draft = drafts.get(body.id)!
      result = {
        ok: true,
        draft,
        state,
        token: "preview-token",
        stale: false,
        comparisons: draft.changes.map((c) => {
          const p = state.pages.find((p) => p.id === c.pageId)!
          return {
            pageId: p.id,
            title: p.title,
            before: p.content,
            after: c.content,
            currentVersion: p.version,
            proposedVersion: nextVersion(p.version, c.level),
            mappingChanged: false,
          }
        }),
      }
    } else if (body.action === "publish") {
      expect(body.token).toBe("preview-token")
      const d = drafts.get(body.id)!
      published.push(d)
      for (const change of d.changes) {
        const p = state.pages.find((p) => p.id === change.pageId)!
        p.content = change.content
        p.revision++
        p.version = nextVersion(p.version, change.level)
      }
      state.generation++
      drafts.delete(body.id)
      result = { ok: true }
    } else if (body.action === "discard") {
      drafts.delete(body.id)
      result = { ok: true }
    }
    await route.fulfill({ json: result })
  })
  return { state, drafts, published, readCount: () => readCount }
}

test("country layouts and verified learning are visible in the OKF", async ({
  page,
}) => {
  const mocked = await mockKnowledge(page, {
    layoutCountries: ["Kenya", "Somalia", "Sudan", "Madagascar", "Djibouti"],
    sourceLearnings: [
      {
        version: 1,
        target: "invoiceValues",
        label: "Freight Value",
        verified: true,
        documentType: "Bill of Lading",
        filename: "rated-bl.pdf",
        page: 2,
        supportingText: "Ocean freight USD 1,250.00",
        matchedValue: "1,250.00",
        confidence: 0.98,
        basis: "document evidence",
        country: "Kenya",
        createdAt: "2026-09-10T12:00:00Z",
      },
    ],
  })
  await page.goto("/knowledge-base?node=knowledge-country-kenya-ai-learning")
  await expect.poll(mocked.readCount).toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("africa-ctn-knowledge-base-notes") ?? "[]"
          ).filter((node: { title?: string }) =>
            ["Kenya", "Somalia", "Sudan", "Madagascar", "Djibouti"].includes(
              node.title ?? ""
            )
          ).length === 5
      )
    )
    .toBe(true)
  await expect(page.getByRole("heading", { name: "AI Learning" })).toBeVisible()
  await expect(page.getByText(/Evidence: Bill of Lading/)).toBeVisible()
})

test("direct edits autosave, preserve published content until exact preview approval, and retain the fixed template", async ({
  page,
}, info) => {
  const model = await mockKnowledge(page)
  await page.goto("/knowledge-base?page=mg-overview")
  await page.getByRole("button", { name: "Edit page", exact: true }).click()
  await page
    .getByLabel("Notes", { exact: true })
    .fill("BSC — training wording confirmed by staff.")
  await expect.poll(() => model.drafts.size).toBe(1)
  await expect(page.getByText(/Draft · 1 page · Saved/)).toBeVisible()
  expect(
    model.state.pages.find((p) => p.id === "mg-overview")!.content.sections[0]
      .text
  ).not.toContain("training wording")
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("Current wording")
  await expect(page.getByRole("dialog")).toContainText(
    "BSC — training wording confirmed by staff."
  )
  await page
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(model.published).toHaveLength(1)
  await expect(page.getByText("Published 1.1.0", { exact: true })).toBeVisible()
  if (info.project.name === "mobile") {
    await page
      .getByRole("button", { name: "Back to knowledge folder", exact: true })
      .click()
    await page.getByRole("button", { name: "Documents 5", exact: true }).click()
    await page
      .getByRole("button", { name: "Bill of Lading", exact: true })
      .click()
  } else
    await page
      .getByRole("navigation", { name: "OKF navigation" })
      .getByRole("button", { name: "Bill of Lading", exact: true })
      .click()
  await expect(page.locator("article h1")).toHaveText("Bill of Lading")
  await expect(page.locator("h1")).toHaveCount(1)
  await expect(page.locator("article h2")).toHaveText(["Fields to extract"])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBeTruthy()
})

test("duplicate AI update and questions do not publish or create versions", async ({
  page,
}) => {
  const model = await mockKnowledge(page)
  await page.goto("/knowledge-base?page=mg-overview")
  await page
    .getByRole("button", { name: "Update with AI", exact: true })
    .click()
  await page
    .getByLabel("Update notes", { exact: true })
    .fill("Already documented certificate name.")
  await page
    .getByRole("button", { name: "Propose update", exact: true })
    .click()
  await expect(page.getByText("Already covered", { exact: true })).toBeVisible()
  expect(model.drafts.size).toBe(0)
  expect(model.published).toHaveLength(0)
  await page
    .getByRole("button", { name: "Ask published OKF", exact: true })
    .click()
  await page
    .getByLabel("Question", { exact: true })
    .fill("What is still unconfirmed?")
  await page.getByRole("button", { name: "Ask question", exact: true }).click()
  await expect(page.getByText("Already covered", { exact: true })).toBeVisible()
  expect(model.state.generation).toBe(1)
})

test("unauthenticated localhost API requests cannot read or publish staff knowledge", async ({
  request,
}) => {
  for (const url of ["/api/okf", "/api/okf/layouts"]) {
    const response = await request.get(url)
    expect(response.status()).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false })
  }
  for (const url of [
    "/api/okf",
    "/api/okf/requests",
    "/api/okf/layouts",
    "/api/cargo-tracking-notes/analyze",
  ]) {
    const response = await request.post(url, {
      data: { action: "publish", id: "invalid" },
    })
    expect(response.status()).toBe(401)
    expect(await response.json()).toMatchObject({ ok: false })
  }
})

test("OKF and Notebook use the same document frame", async ({
  page,
  context,
}, info) => {
  await mockLayoutData(context)
  await page.goto("/information?node=qa-note")
  await expect(page.locator(".tiptap h1")).toHaveText("Long test note")
  const frame = () =>
    page.locator('[data-slot="card-content"]').first().boundingBox()
  const notebook = await frame()
  const tree = await page.locator("aside.notebook-tree").boundingBox()
  await mockKnowledge(page)
  await page.goto("/knowledge-base?page=mg-document-commercial-invoice")
  await expect(page.locator("article h1")).toHaveText("Commercial Invoice")
  const knowledge = await frame()
  expect(knowledge!.x).toBeCloseTo(notebook!.x, 0)
  expect(knowledge!.width).toBeCloseTo(notebook!.width, 0)
  expect(knowledge!.y).toBeCloseTo(notebook!.y, 0)
  if (info.project.name === "desktop")
    expect(
      (await page.locator("aside.notebook-tree").boundingBox())!.width
    ).toBe(tree!.width)
  await page.screenshot({
    path: "node_modules/.cache/okf-" + info.project.name + ".png",
  })
})

test("request form order stays intact and corrections save without a dialog", async ({
  page,
}) => {
  const stamp = "2026-09-10T12:00:00Z"
  const request = {
    id: "okf-request-fixture",
    reference: "Synthetic request",
    country: "Madagascar",
    status: "Needs review",
    documents: [],
    createdAt: stamp,
    updatedAt: stamp,
    analysis: {
      consigneeCountry: "",
      documents: [],
      fields: madagascarFieldGroups.flatMap((group) =>
        group.fields.map(([key, label]) => ({
          key,
          label,
          value: key === "exporterName" ? "Original exporter" : "",
          status: "extracted",
          source: "Synthetic invoice",
          note: "",
        }))
      ),
      invoiceValues: [],
      invoiceItems: [],
      issues: [],
      missingCorrectionsMessage: "",
    },
  }
  const corrections: unknown[] = []
  await page.addInitScript(
    (r) =>
      localStorage.setItem(
        "actn-madagascar-bsc-requests-v1",
        JSON.stringify([r])
      ),
    request
  )
  await page.route(/https?:\/\/(?!localhost:\d+\/)/, (route) =>
    route.fulfill({
      status: 404,
      json: { message: "Fixture only" },
      headers: { "access-control-allow-origin": "*" },
    })
  )
  await page.route("**/api/okf/local-requests**", (route) =>
    route.fulfill({ status: 400, json: { ok: false, message: "Fixture only" } })
  )
  await page.route("**/api/okf/requests**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { ok: true, reviews: [], corrections, recheckAvailable: false },
      })
    const body = route.request().postDataJSON()
    if (body.action === "explain-source") {
      expect(body.correctionId).toBe("correction-fixture")
      expect(body.explanation).toContain("Bill of Lading")
      return route.fulfill({
        json: {
          ok: true,
          learning: {
            version: 1,
            target: "exporterName",
            label: "Name",
            verified: true,
            documentType: "Bill of Lading",
            filename: "BL.pdf",
            page: null,
            supportingText: body.explanation,
            matchedValue: "Corrected exporter",
            confidence: 1,
            basis: "staff explanation",
          },
        },
      })
    }
    expect(body.action).toBe("correct-batch")
    expect(body.edits).toHaveLength(1)
    expect(body.edits[0].target).toBe("exporterName")
    const field = request.analysis.fields.find(
      (f) => f.key === body.edits[0].target
    )!
    corrections.push({
      id: "correction-fixture",
      target: body.edits[0].target,
      before_value: { ...field },
      after_value: { ...field, value: body.edits[0].value },
      reason: "Automatically recorded correction",
      actor: "test-staff",
      created_at: stamp,
    })
    field.value = body.edits[0].value
    await route.fulfill({
      json: {
        ok: true,
        request,
        corrections,
        sourceLearnings: [],
        sourceQuestions: [
          {
            correctionId: "correction-fixture",
            target: "exporterName",
            label: "Name",
            question:
              "I could not verify Name in the uploaded documents. Where did this value come from?",
          },
        ],
      },
    })
  })
  await page.goto("/cargo-tracking-notes/requests?id=okf-request-fixture")
  for (const heading of [
    "Trade Parties",
    "Invoices",
    "Shipment",
    "Uploaded Documents",
  ])
    await expect(
      page.getByRole("heading", { name: heading, exact: true })
    ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "Missing / Corrections Needed",
      exact: true,
    })
  ).toHaveCount(0)
  const input = page.getByRole("textbox", { name: "Name", exact: true }).first()
  await input.fill("Corrected exporter")
  await input.press("Tab")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator('input[value="Corrected exporter"]')).toBeVisible()
  await expect(page.getByText(/saved to the AI learning history/)).toBeVisible()
  await page
    .getByLabel("Explain the source for Name")
    .fill("It came from the rated Bill of Lading.")
  await page.getByRole("button", { name: "Save explanation" }).click()
  await expect(
    page.getByText(/source explanation saved to the OKF learning history/)
  ).toBeVisible()
  await expect(page.getByText("Knowledge review", { exact: true })).toHaveCount(
    0
  )
  expect(corrections).toHaveLength(1)
})
