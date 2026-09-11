import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
require("../scripts/okf-typescript.cjs")
const {
  certificateLayoutSchema,
  layoutPlacements,
  resolveLayout,
} = require("../lib/certificate-layout/schema.ts")
const { createMadagascarLayout } = require("../lib/certificate-layout/seed.ts")
const {
  knowledgeWithLayout,
} = require("../lib/certificate-layout/knowledge.ts")
const {
  appendImportedPage,
  createEmptyCertificateLayout,
  layoutWithoutFields,
  moveLayoutField,
  newLayoutGroup,
} = require("../lib/certificate-layout/editing.ts")
const { createInitialPages } = require("../lib/okf/seed.ts")
const {
  editableCertificateLayout,
} = require("../lib/certificate-layout/default-sections.ts")

test("legacy corrections blocks leave the editor without losing custom fields or nested groups", () => {
  const { layout } = createMadagascarLayout()
  const correction = {
    id: "corrections",
    title: "",
    kind: "corrections",
    columns: 4,
    span: 1,
    separator: false,
    breakpoint: "md",
    fields: [],
    groups: [],
  }
  layout.sections.unshift({
    id: "fixed-corrections",
    title: "Missing / Corrections Needed",
    columns: 1,
    groups: [correction],
  })
  const clean = editableCertificateLayout(layout)
  assert.equal(clean.sections.length, 4)
  assert.equal(layout.sections.length, 5)
  correction.groups = [layout.sections[1].groups.shift()]
  correction.groups[0].span = 4
  const nested = editableCertificateLayout(layout)
  assert.equal(nested.sections[0].groups[0].span, 1)
  assert.equal(nested.sections[0].groups[0].fields[0].fieldId, "exporterName")
  assert.equal(certificateLayoutSchema.safeParse(nested).success, true)
  correction.fields = correction.groups[0].fields
  correction.groups = []
  assert.equal(
    editableCertificateLayout(layout).sections[0].groups[0].kind,
    "fields"
  )
})

test("dragging fields between groups preserves IDs and labels, clamps widths and reorders within a row", () => {
  const { layout } = createMadagascarLayout()
  const source = layout.sections[1].groups[0]
  source.fields[0].label = "Trade term"
  source.fields[0].span = 2
  assert.equal(moveLayoutField(layout, "incoterm", "exporter"), true)
  const exporter = layout.sections[0].groups[0]
  assert.deepEqual(exporter.fields[1], {
    fieldId: "incoterm",
    span: 1,
    label: "Trade term",
  })
  assert.equal(source.fields.length, 1)
  moveLayoutField(layout, "exporterName", "exporter", "incoterm")
  assert.deepEqual(
    exporter.fields.map((field) => field.fieldId),
    ["incoterm", "exporterName"]
  )
  assert.equal(moveLayoutField(layout, "exporterName", "invoice-items"), false)
  assert.equal(certificateLayoutSchema.safeParse(layout).success, true)
})

test("reusing a country layout keeps its structure without transferring fields", () => {
  const { layout } = createMadagascarLayout()
  const copy = layoutWithoutFields(layout)
  assert.equal(copy.fields.length, 0)
  assert.equal(layout.fields.length > 0, true)
  assert.deepEqual(
    copy.sections.map((section) => section.title),
    layout.sections.map((section) => section.title)
  )
  assert.equal(layoutPlacements(copy).length, 0)
  assert.equal(certificateLayoutSchema.safeParse(copy).success, true)
})

test("a new subsection can start on a fresh full-width row", () => {
  const group = newLayoutGroup(4)
  assert.equal(group.span, 4)
  assert.equal(group.kind, "fields")
  assert.deepEqual(group.fields, [])
})

test("AI setup can be skipped with a valid empty country layout", () => {
  const layout = createEmptyCertificateLayout(" Kenya ")
  assert.equal(layout.country, "Kenya")
  assert.equal(layout.fields.length, 0)
  assert.equal(layout.sections.length, 1)
  assert.equal(certificateLayoutSchema.safeParse(layout).success, true)
})

test("page imports replace the empty starter and append later pages without ID collisions", () => {
  const country = createEmptyCertificateLayout("Kenya")
  const page = createEmptyCertificateLayout("Kenya")
  page.fields = [
    {
      id: "reference",
      label: "Reference",
      control: "text",
      options: [],
      sourceDocument: "",
      instruction: "",
    },
  ]
  page.sections[0].id = "page"
  page.sections[0].title = "Page 1"
  page.sections[0].groups[0].id = "details"
  page.sections[0].groups[0].columns = 2
  page.sections[0].groups[0].fields = [
    { fieldId: "reference", span: 1, row: 2, column: 2 },
  ]
  const first = appendImportedPage(country, page)
  assert.deepEqual(
    first.sections.map((section) => section.title),
    ["Page 1"]
  )
  assert.deepEqual(first.sections[0].groups[0].fields[0], {
    fieldId: "reference",
    span: 1,
    row: 2,
    column: 2,
  })
  const second = appendImportedPage(first, page)
  assert.deepEqual(
    second.fields.map((field) => field.id),
    ["reference", "reference-2"]
  )
  assert.deepEqual(
    second.sections.map((section) => section.id),
    ["page", "page-2"]
  )
  assert.equal(certificateLayoutSchema.safeParse(second).success, true)
})

test("Madagascar seed preserves the visible certificate structure and columns", () => {
  const { layout } = createMadagascarLayout()
  assert.deepEqual(
    layout.sections.map((section) => section.title),
    ["Trade Parties", "Invoices", "Shipment", "Uploaded Documents"]
  )
  assert.equal(layout.sections[0].columns, 2)
  assert.deepEqual(
    layout.sections[2].groups.map((group) => group.columns),
    [2, 4, 1, 1]
  )
  assert.equal(layout.sections[2].groups[2].groups[0].columns, 3)
  assert.deepEqual(
    layout.sections[1].groups[3].fields.map((field) => field.fieldId),
    [
      "hsCode",
      "description",
      "quantity",
      "unitOfMeasurement",
      "unitPrice",
      "isSecondHand",
      "originCountry",
    ].map((key) => "invoiceItems." + key)
  )
  const placed = layoutPlacements(layout).map((placement) => placement.fieldId)
  assert.ok(!placed.includes("exporterAddress"))
  assert.ok(!placed.includes("importerCountry"))
  assert.equal(placed.length, new Set(placed).size)
  assert.equal(
    resolveLayout([createMadagascarLayout()], "MDG").country_key,
    "madagascar"
  )
  assert.equal(resolveLayout([createMadagascarLayout()], "Kenya"), undefined)
  assert.equal(
    resolveLayout([createMadagascarLayout(), createMadagascarLayout()], "MG"),
    undefined
  )
})

test("layout validation rejects broken references, duplicate placements and impossible columns", () => {
  for (const corrupt of [
    (layout) => {
      layout.sections[0].columns = 5
    },
    (layout) => {
      layout.sections[0].groups[0].fields[0].fieldId = "unknown"
    },
    (layout) => {
      layout.sections[0].groups[0].fields[0].span = 2
    },
    (layout) => {
      layout.sections[0].groups[1].fields[0].fieldId = "exporterName"
    },
    (layout) => {
      layout.fields.push(layout.fields[0])
    },
    (layout) => {
      layout.sections[1].groups[3].kind = "fields"
    },
  ]) {
    const { layout } = createMadagascarLayout()
    corrupt(layout)
    assert.equal(certificateLayoutSchema.safeParse(layout).success, false)
  }
  const { layout } = createMadagascarLayout()
  const nested = structuredClone(layout.sections[0].groups[0])
  nested.fields = []
  nested.id = "nested"
  layout.sections[0].groups[0].groups = [nested]
  nested.groups = [{ ...nested, id: "third", groups: [] }]
  assert.equal(certificateLayoutSchema.safeParse(layout).success, true)
  nested.groups[0].groups.push({ ...nested, id: "fourth", groups: [] })
  assert.equal(certificateLayoutSchema.safeParse(layout).success, false)
})

test("Certificate Settings layout owns certificate mappings without adding requirements", () => {
  const state = {
    generation: 1,
    pages: createInitialPages().map((page) => ({
      ...page,
      revision: 1,
      version: "1.0.0",
      publishedAt: "2026-09-10",
    })),
  }
  const layout = createMadagascarLayout()
  layout.layout.fields.push({
    id: "registration",
    label: "Registration",
    control: "text",
    options: [],
    sourceDocument: "Bill of Lading",
    instruction: "Read exporter registration",
  })
  layout.layout.sections[0].groups[0].fields.push({
    fieldId: "registration",
    span: 1,
  })
  const exporter = layout.layout.fields.find(
    (field) => field.id === "exporterName"
  )
  exporter.sourceDocument = "Commercial Invoice"
  exporter.instruction = "Read the exporter from Certificate Settings"
  const next = knowledgeWithLayout(state, layout)
  assert.equal(
    next.pages
      .slice(0, state.pages.length)
      .flatMap((page) => page.content.mappings)
      .filter((mapping) => mapping.systemFieldId === "exporterName").length,
    0
  )
  assert.equal(
    next.pages
      .flatMap((page) => page.content.mappings)
      .filter((mapping) => mapping.systemFieldId === "exporterName").length,
    1
  )
  const additional = next.pages.slice(state.pages.length)
  assert.ok(additional.every((page) => !page.content.rules.length))
  assert.equal(
    additional
      .flatMap((page) => page.content.fields)
      .find((field) => field.id.endsWith("-registration")).instruction,
    "Read exporter registration"
  )
  assert.equal(
    additional
      .flatMap((page) => page.content.fields)
      .find((field) => field.id.endsWith("-exporterName")).document,
    "Commercial Invoice"
  )
  assert.equal(
    additional
      .flatMap((page) => page.content.mappings)
      .find((mapping) => mapping.systemFieldId === "exporterName").entryRule,
    "Read the exporter from Certificate Settings"
  )
})

test("layout cache checks the full catalogue, reuses it and cannot roll back a just-published revision", async () => {
  const Module = require("node:module"),
    ts = require("typescript")
  const filename = path.resolve("lib/certificate-layout/client.ts")
  const adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const original = adapter.require.bind(adapter)
  adapter.require = (id) =>
    id === "./schema"
      ? require("../lib/certificate-layout/schema.ts")
      : id === "@/lib/client"
        ? {
            authenticatedFetch: (...args) => globalThis.fetch(...args),
            createClient: () => ({}),
          }
      : original(id)
  adapter._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  )
  const old = {
    window: globalThis.window,
    fetch: globalThis.fetch,
  }
  let calls = 0
  let pending
  globalThis.window = new EventTarget()
  globalThis.fetch = async () => {
    calls++
    return pending
      ? await pending
      : Response.json(
          { rows: [createMadagascarLayout()] },
          { headers: { ETag: '"revision-1"' } }
        )
  }
  try {
    const { loadCertificateLayouts, cachePublishedLayout, cacheDeletedLayout } =
      adapter.exports
    await loadCertificateLayouts()
    await loadCertificateLayouts()
    assert.equal(calls, 1)
    let resolve
    pending = new Promise((done) => {
      resolve = done
    })
    const reload = loadCertificateLayouts(true)
    cachePublishedLayout({ ...createMadagascarLayout(), revision: 2 })
    resolve(new Response(null, { status: 304 }))
    assert.equal((await reload)[0].revision, 2)
    pending = new Promise((done) => {
      resolve = done
    })
    const staleReload = loadCertificateLayouts(true)
    cacheDeletedLayout("madagascar", 2)
    resolve(
      Response.json({ rows: [{ ...createMadagascarLayout(), revision: 2 }] })
    )
    assert.deepEqual(await staleReload, [])
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})

test("upload analysis selects another published country and extracts its configured fields", async () => {
  const Module = require("node:module"),
    ts = require("typescript")
  const filename = path.resolve("lib/okf/uploads.ts"),
    adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const original = adapter.require.bind(adapter)
  const record = createMadagascarLayout()
  record.country_key = "kenya"
  record.layout.country = "Kenya"
  record.layout.aliases = ["KE"]
  record.layout.fields = [
    {
      id: "registration",
      label: "Registration",
      control: "text",
      options: [],
      sourceDocument: "Bill of Lading",
      instruction: "Read the consignee registration",
    },
  ]
  record.layout.sections = [
    {
      id: "parties",
      title: "Parties",
      columns: 1,
      groups: [
        {
          ...record.layout.sections[0].groups[0],
          fields: [{ fieldId: "registration", span: 1 }],
        },
      ],
    },
  ]
  const evidence = [
    {
      document: "bl.pdf",
      page: "1",
      observedText: "Consignee Kenya, registration 123",
    },
  ]
  let calls = 0,
    stored
  adapter.require = (id) => {
    if (id === "server-only") return {}
    if (id === "./server")
      return {
        readKnowledge: async () => ({ generation: 0, pages: [] }),
        OkfError: Error,
        databaseError: (error) => {
          if (error) throw Error(error.message)
        },
      }
    if (id === "@/lib/certificate-layout/server")
      return { readCertificateLayouts: async () => [record] }
    if (id.startsWith("@/lib/certificate-layout/"))
      return require(
        "../lib/certificate-layout/" + id.split("/").at(-1) + ".ts"
      )
    if (id === "@/lib/madagascar-bsc-server")
      return { getMadagascarDropdownOptions: async () => ({}) }
    if (id === "@/lib/madagascar-bsc")
      return require("../lib/madagascar-bsc.ts")
    if (id === "./ai")
      return {
        likelyBillOfLadingFiles: async (files) => files,
        localBillOfLadingCountry: async () => ({
          country: "Kenya",
          fileName: "bl.pdf",
          page: "1",
          observedText: "Consignee Kenya",
        }),
        localDocumentPages: async () => [],
        structuredAi: async (schema, _prompt, context) => {
          calls++
          if (context.fileNames) {
            assert.equal(context.supportedCountries[0].country, "Kenya")
            return schema.parse({
              country: {
                name: "KE",
                status: "supported",
                basis: "consignee address",
                evidence,
                finalDestination: "Kenya",
                dischargePort: "",
                transitCountries: [],
                explanation: "Explicit consignee country",
              },
              shipments: [{ id: "one", documentNames: ["bl.pdf"], evidence }],
              groupingAmbiguous: false,
              documents: [
                {
                  fileName: "bl.pdf",
                  documentType: "Bill of Lading",
                  status: "final",
                  evidence,
                },
              ],
            })
          }
          assert.equal(context.extraction.length, 1)
          assert.equal(
            context.extraction[0].instruction,
            "Read the consignee registration"
          )
          return schema.parse({
            fields: [
              {
                id: context.extraction[0].id,
                observedText: "123",
                value: "123",
                status: "passed",
                evidence,
                note: "",
                row: null,
                rowLabel: "",
              },
            ],
            conditions: [],
            findings: [],
          })
        },
      }
    if (id === "./openai-document-provider")
      return {
        classifyDocuments: async (files, supportedCountries) => {
          calls++
          assert.equal(supportedCountries[0].country, "Kenya")
          return files.map((file) => ({
            originalFilename: file.name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            documentStatus: "final",
            documentStatusConfidence: 0.99,
            classificationSource: {
              page: 1,
              text: "Bill of Lading",
            },
            consigneeCountry: "KE",
            consigneeCountryConfidence: 0.99,
            consigneeCountrySource: {
              page: 1,
              text: "Consignee Kenya",
            },
            shipmentReferences: ["one"],
            warnings: [],
            missingFields: [],
            uncertainFields: [],
            possibleConflicts: [],
          }))
        },
        inspectDocuments: async (
          files,
          profiles,
          _supportedCountries,
          _signal,
          _onFieldDelta,
          onDocument
        ) => {
          calls++
          const extraction = profiles.find(
            (profile) => profile.documentType === "Bill of Lading"
          ).fields
          assert.equal(extraction.length, 1)
          assert.equal(
            extraction[0].instruction,
            "Read the consignee registration"
          )
          const classification = {
            originalFilename: files[0].name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            documentStatus: "final",
            documentStatusConfidence: 0.99,
            classificationSource: { page: 1, text: "Bill of Lading" },
            consigneeCountry: "KE",
            consigneeCountryConfidence: 0.99,
            consigneeCountrySource: { page: 1, text: "Consignee Kenya" },
            shipmentReferences: ["one"],
            warnings: [],
            missingFields: [],
            uncertainFields: [],
            possibleConflicts: [],
          }
          const analysis = {
            originalFilename: files[0].name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            fields: [
              {
                id: extraction[0].id,
                value: "123",
                confidence: 0.99,
                sourcePage: 1,
                supportingText: "123",
                row: null,
                rowLabel: "",
              },
            ],
            warnings: [],
            missingFields: [],
            uncertainFields: [],
            possibleConflicts: [],
            model: "gpt-5.6-luna",
            escalated: false,
            escalationReasons: [],
          }
          const result = { classification, analysis }
          await onDocument?.(files[0], result)
          return { documents: [result], failures: [] }
        },
        observationsFromDocumentAnalysis: (analysis) =>
          analysis.fields.map((field) => ({
            id: field.id,
            observedText: field.supportingText,
            value: field.value,
            status: "passed",
            evidence,
            note: "",
            row: field.row,
            rowLabel: field.rowLabel,
          })),
        reconcileDocuments: async () => ({
          resolvedFields: [],
          matchedDocumentGroups: [],
          warnings: [],
        }),
      }
    return original(id)
  }
  adapter._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  )
  const session = {
    user: { id: "staff" },
    client: {
      from: () => ({
        insert: async (row) => {
          stored = row
          return { error: null }
        },
      }),
    },
  }
  const review = await adapter.exports.reviewUploads(
    session,
    [new File(["synthetic"], "bl.pdf")],
    "request",
    "intake",
    "2026-09-10"
  )
  assert.equal(calls, 1)
  assert.equal(review.observations.country.name, "Kenya")
  assert.deepEqual(stored.review.certificateLayout, record)
  const analysis = adapter.exports.reviewToAnalysis(review)
  assert.equal(analysis.fields.length, 1)
  assert.equal(analysis.fields[0].value, "123")
  assert.ok(
    review.findings.every((finding) => finding.status === "unconfirmed")
  )
})
