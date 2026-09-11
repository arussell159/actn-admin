import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import fs from "node:fs"
const require = createRequire(import.meta.url)
require("../scripts/okf-typescript.cjs")
const {
  createInitialPages,
  documentHeadings,
  formPresentation,
  sharedExtractionInstructions,
} = require("../lib/okf/seed.ts")
const {
  certificateDocumentDownloadName,
  certificateDocumentTypeRank,
  documentTypeAbbreviation,
  madagascarFieldGroups,
} = require("../lib/madagascar-bsc.ts")
const {
  publishedPages,
  nextVersion,
  validateChanges,
  validatePublicationDependencies,
  evaluateReview,
} = require("../lib/okf/engine.ts")
const {
  correctionLearningReason,
  normalizedCorrectionTarget,
  parseCorrectionLearning,
} = require("../lib/okf/correction-learning.ts")
const seed = () => ({ generation: 0, pages: createInitialPages() })
const evidence = [
  {
    document: "shipment.pdf",
    page: "1",
    observedText: "Final destination Madagascar",
  },
]
const observations = () => ({
  country: {
    name: "Madagascar",
    status: "supported",
    basis: "final destination",
    evidence,
    finalDestination: "Madagascar",
    dischargePort: "Toamasina",
    transitCountries: [],
    explanation: "Explicit final destination",
  },
  shipments: [{ id: "shipment-1", documentNames: ["shipment.pdf"], evidence }],
  groupingAmbiguous: false,
  documents: [
    {
      fileName: "shipment.pdf",
      documentType: "Bill of Lading",
      status: "final",
      evidence,
    },
  ],
  fields: [],
  conditions: [],
  findings: [],
})
const context = {
  id: "review-1",
  requestId: "request-1",
  stage: "intake",
  date: "2026-09-10",
}
const publish = (state) => ({
  ...state,
  pages: state.pages.map((p) => ({
    ...p,
    revision: 1,
    version: "1.0.0",
    publishedAt: "2026-09-10T00:00:00Z",
  })),
})

test("certificate documents use classified download names", () => {
  assert.equal(documentTypeAbbreviation("Bill of Lading"), "BL")
  assert.equal(documentTypeAbbreviation("Certificate of Origin"), "COO")
  assert.equal(documentTypeAbbreviation("DU (Documento Unico)"), "DU")
  assert.equal(
    certificateDocumentDownloadName(
      "Bill of Lading",
      "272767989",
      "original.PDF"
    ),
    "BL_272767989.PDF"
  )
  assert.equal(
    certificateDocumentDownloadName(
      "Commercial Invoice",
      "MAEU/123 456",
      "invoice.pdf"
    ),
    "CI_MAEU_123_456.pdf"
  )
})

test("certificate documents follow the fixed optional document order", () => {
  const documentTypes = [
    "Certificate of Insurance",
    "Export Declaration",
    "Freight Invoice",
    "Other",
    "Bill of Lading",
    "FDI",
    "Commercial Invoice",
    "DU",
    "Certificate of Origin",
  ]

  assert.deepEqual(
    documentTypes.toSorted(
      (left, right) =>
        certificateDocumentTypeRank(left) - certificateDocumentTypeRank(right)
    ),
    [
      "Bill of Lading",
      "Commercial Invoice",
      "Freight Invoice",
      "Export Declaration",
      "DU",
      "FDI",
      "Certificate of Origin",
      "Certificate of Insurance",
      "Other",
    ]
  )
})

test("initial pages use fixed templates, no invented approval or effective dates, and preserve the complete form catalog", () => {
  const state = seed()
  assert.equal(state.pages.length, 18)
  assert.equal(publishedPages(state).length, 0)
  for (const p of state.pages) {
    assert.equal(p.version, null)
    if (p.template === "document")
      assert.deepEqual(
        p.content.sections.map((s) => s.heading),
        documentHeadings
      )
    for (const r of p.content.rules) {
      assert.ok(r.sourceIds.length)
      assert.equal(r.effectiveFrom, "")
      assert.equal(r.effectiveTo, "")
    }
  }
  assert.deepEqual(
    formPresentation.filter((f) => !f.repeated).map((f) => [f.id, f.label]),
    madagascarFieldGroups.flatMap((g) => g.fields)
  )
  const billFields = state.pages.find((p) => p.title === "Bill of Lading")
    .content.fields
  assert.ok(state.pages.some((p) => p.title === "DU (Documento Unico)"))
  assert.ok(billFields.some((f) => f.portalFieldIds.includes("exporterName")))
  assert.ok(billFields.some((f) => f.portalFieldIds.includes("importerName")))
  assert.ok(
    !state.pages
      .find((p) => p.title === "Commercial Invoice")
      .content.fields.some((f) =>
        ["exporterName", "importerName"].some((id) =>
          f.portalFieldIds.includes(id)
        )
      )
  )
  assert.equal(
    validateChanges(
      state,
      state.pages.map((p) => ({
        pageId: p.id,
        content: p.content,
        level: "minor",
      }))
    ).length,
    18
  )
})
test("commercial invoice guidance coordinates Incoterm, place and FOB value derivation", () => {
  assert.match(sharedExtractionInstructions.incoterm, /infer it from/i)
  assert.match(sharedExtractionInstructions.incotermPlace, /For FOB/i)
  assert.match(
    sharedExtractionInstructions.fobValue,
    /subtract separately stated freight/i
  )

  const commercialInvoice = seed().pages.find(
    (page) => page.title === "Commercial Invoice"
  )
  for (const fieldId of ["incoterm", "incotermPlace", "fobValue"]) {
    const field = commercialInvoice.content.fields.find((candidate) =>
      candidate.portalFieldIds.includes(fieldId)
    )
    assert.ok(field)
    assert.equal(field.instruction, sharedExtractionInstructions[fieldId])
  }
})
test("draft knowledge cannot fill a form or falsely pass document checks", () => {
  const review = evaluateReview(seed(), observations(), {}, context)
  assert.deepEqual(review.revisions, [])
  assert.deepEqual(review.mappedFields, [])
  assert.equal(review.findings.length, 0)
  assert.ok(review.findings.every((f) => f.status === "unconfirmed"))
  assert.deepEqual(review.missingDocuments, [])
})
test("country evidence, unsupported destinations and shipment ambiguity gate form population", () => {
  for (const patch of [
    { country: { ...observations().country, evidence: [] } },
    {
      country: {
        ...observations().country,
        name: "Kenya",
        status: "unsupported",
      },
    },
    { country: { ...observations().country, finalDestination: "" } },
    { groupingAmbiguous: true },
    {
      shipments: [
        ...observations().shipments,
        { id: "second", documentNames: [], evidence: [] },
      ],
    },
  ]) {
    const review = evaluateReview(
      publish(seed()),
      { ...observations(), ...patch },
      {},
      context
    )
    assert.deepEqual(review.mappedFields, [])
    assert.ok(review.nextActions.length)
  }
})
test("an explicit consignee country on the Bill of Lading can select the country OKF", () => {
  const o = observations()
  o.country = {
    ...o.country,
    basis: "consignee address",
    finalDestination: "Madagascar",
    evidence: [
      {
        document: "shipment.pdf",
        page: "1",
        observedText: "Consignee: Antananarivo, Madagascar",
      },
    ],
  }
  const review = evaluateReview(publish(seed()), o, {}, context)
  assert.ok(
    !review.nextActions.some((action) =>
      /clarify the final destination/i.test(action)
    )
  )
})
test("known later-stage documents are not intake blockers; conditional and effective rules need evidence", () => {
  const state = publish(seed())
  const p = state.pages.find((p) => p.title === "Commercial Invoice")
  const r = p.content.rules[0]
  Object.assign(r, {
    requirement: "always required",
    stage: "submission",
    effectiveFrom: "2026-09-01",
  })
  assert.ok(
    !evaluateReview(
      state,
      observations(),
      {},
      context
    ).missingDocuments.includes("Commercial Invoice")
  )
  assert.ok(
    evaluateReview(
      state,
      observations(),
      {},
      { ...context, stage: "submission" }
    ).missingDocuments.includes("Commercial Invoice")
  )
  r.requirement = "conditionally required"
  assert.equal(
    evaluateReview(
      state,
      observations(),
      {},
      { ...context, stage: "submission" }
    ).findings.find((f) => f.ruleId === r.id).status,
    "unconfirmed"
  )
  r.requirement = "always required"
  r.effectiveFrom = "2027-01-01"
  assert.ok(
    !evaluateReview(
      state,
      observations(),
      {},
      { ...context, stage: "submission" }
    ).findings.some((f) => f.ruleId === r.id)
  )
})
test("mapping retains observed text, rejects conflicts and invalid dropdown values, and requires published fields", () => {
  const state = publish(seed())
  const map = state.pages
    .find((p) => p.id === "mg-field-map")
    .content.mappings.find((m) => m.systemFieldId === "incoterm")
  const o = observations()
  o.fields = [
    {
      id: map.sourceFieldIds[0],
      observedText: "Terms: FOB",
      value: "FOB",
      status: "passed",
      evidence,
      note: "Printed",
      row: null,
    },
  ]
  const get = () =>
    evaluateReview(
      state,
      o,
      { incoterm: ["FOB", "CIF"] },
      context
    ).mappedFields.find((f) => f.key === "incoterm")
  assert.equal(get().value, "FOB")
  assert.equal(get().observedText, "Terms: FOB")
  o.fields[0].value = "F.O.B."
  assert.equal(get().value, "")
  assert.equal(get().status, "failed")
  o.fields[0].status = "conflicting"
  assert.equal(get().value, "")
  assert.equal(get().status, "conflicting")
  state.pages.find((p) => p.title === "Commercial Invoice").revision = 0
  assert.equal(get().value, "")
})
test("duplicate changes, fixed structure, evidence and versioning are enforced", () => {
  const state = publish(seed())
  const p = state.pages.find((p) => p.title === "Commercial Invoice")
  const c = {
    pageId: p.id,
    content: structuredClone(p.content),
    level: "minor",
  }
  assert.deepEqual(validateChanges(state, [c]), [])
  c.content.sections.reverse()
  assert.throws(() => validateChanges(state, [c]), /headings/)
  c.content = structuredClone(p.content)
  c.content.rules[0].requirement = "always required"
  c.content.rules[0].sourceIds = []
  assert.throws(() => validateChanges(state, [c]), /evidence/)
  c.content = structuredClone(p.content)
  c.content.rules.push({ ...c.content.rules[0], id: "duplicate" })
  assert.throws(() => validateChanges(state, [c]), /Already covered/)
  c.content = structuredClone(p.content)
  c.content.fields[0].instruction = "Changed"
  c.level = "patch"
  assert.throws(() => validateChanges(state, [c]), /minor/)
  assert.equal(nextVersion(null, "minor"), "1.0.0")
  assert.equal(nextVersion("1.0.0", "patch"), "1.0.1")
  assert.equal(nextVersion("1.0.1", "minor"), "1.1.0")
})
test("publishing mappings requires publishing dependent extraction pages in the same transaction", () => {
  const state = seed()
  const map = state.pages.find((p) => p.id === "mg-field-map")
  assert.throws(
    () =>
      validatePublicationDependencies(state, [
        { pageId: map.id, content: map.content, level: "minor" },
      ]),
    /still a draft/
  )
  assert.doesNotThrow(() =>
    validatePublicationDependencies(
      state,
      state.pages.map((p) => ({
        pageId: p.id,
        content: p.content,
        level: "minor",
      }))
    )
  )
})
test("explicit comparisons never pass without required evidence", () => {
  const state = publish(seed())
  const p = state.pages.find((p) => p.title === "Bill of Lading")
  const ids = p.content.fields.slice(0, 2).map((f) => f.id)
  const r = {
    ...p.content.rules[0],
    id: "compare",
    kind: "comparison",
    requirement: "always required",
    check: { operator: "equal", fieldIds: ids, expected: "" },
  }
  p.content.rules.push(r)
  const o = observations()
  const get = () =>
    evaluateReview(state, o, {}, context).findings.find(
      (f) => f.ruleId === r.id
    )
  assert.equal(get().status, "missing")
  o.fields = ids.map((id) => ({
    id,
    value: "123",
    observedText: "123",
    status: "passed",
    evidence,
    note: "",
    row: null,
  }))
  assert.equal(get().status, "passed")
  o.fields[1].value = "456"
  assert.equal(get().status, "failed")
  o.fields[1].evidence = []
  assert.equal(get().status, "unconfirmed")
})
test("migration is additive, approval is atomic and corrections retain identity and reason", () => {
  const sql = fs.readFileSync(
    new URL("../supabase-okf.sql", import.meta.url),
    "utf8"
  )
  assert.ok(!/drop table|truncate|delete from public\.madagascar/i.test(sql))
  assert.match(sql, /s\.generation <> d\.base_generation/)
  assert.match(sql, /p_token is distinct from md5/)
  assert.match(sql, /for update/)
  assert.match(sql, /before_pages,after_pages,proposer,approver/)
  assert.match(sql, /before_value,after_value,reason,actor/)
  const layoutsSql = fs.readFileSync(
    new URL("../supabase-certificate-layouts.sql", import.meta.url),
    "utf8"
  )
  assert.match(layoutsSql, /okf_certificate_layout_drafts/)
  assert.match(layoutsSql, /okf_save_certificate_layout_draft/)
  assert.match(layoutsSql, /Draft changed\. Reload before saving\./)
  assert.match(layoutsSql, /supabase_realtime add table public\.okf_certificate_layouts/)
  assert.match(
    layoutsSql,
    /greatest\(coalesce\(previous\.revision,0\),coalesce\(max\(h\.revision\),0\)\)\+1/
  )
})

test("field corrections retain verified source evidence for bounded OKF learning", () => {
  const learning = {
    version: 1,
    target: normalizedCorrectionTarget("invoiceValue:2"),
    label: "Freight Value",
    verified: true,
    documentType: "Bill of Lading",
    filename: "rated-bl.pdf",
    page: 2,
    supportingText: "Ocean freight USD 1,250.00",
    matchedValue: "1,250.00",
    confidence: 0.98,
  }
  const reason = correctionLearningReason("Madagascar", learning)
  assert.deepEqual(parseCorrectionLearning(reason), learning)
  assert.equal(learning.target, "invoiceValues")
  assert.match(reason, /Bill of Lading/)
})

test("upload adapter persists exact published revisions and maps approved extraction only", async () => {
  const Module = require("node:module")
  const path = require("node:path")
  const ts = require("typescript")
  const filename = path.resolve("lib/okf/uploads.ts")
  const adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = adapter.require.bind(adapter)
  let state = seed()
  let layouts = []
  const calls = []
  const sequence = []
  const saved = []
  let storageError = null
  adapter.require = (id) => {
    if (id === "server-only") return {}
    if (id === "@/lib/certificate-layout/server")
      return { readCertificateLayouts: async () => layouts }
    if (id.startsWith("@/lib/certificate-layout/"))
      return require(
        "../lib/certificate-layout/" + id.split("/").at(-1) + ".ts"
      )
    if (id === "./server")
      return {
        readKnowledge: async () => state,
        OkfError: Error,
        databaseError: (error) => {
          if (error) throw Error(error.message)
        },
      }
    if (id === "@/lib/madagascar-bsc-server")
      return { getMadagascarDropdownOptions: async () => ({}) }
    if (id === "@/lib/madagascar-bsc")
      return require("../lib/madagascar-bsc.ts")
    if (id === "./ai")
      return {
        likelyBillOfLadingFiles: async (files) => files,
        localBillOfLadingCountry: async () => undefined,
        localDocumentPages: async () => [
          {
            page: "1",
            text: "Ocean Bill of Lading. Vessel TEST SHIP. Port of Loading Newark. Container ABCU1234567 40 DRY.",
          },
        ],
        structuredAi: async (schema, prompt, context) => {
          calls.push(context)
          sequence.push(context.purpose ?? "extract")
          if (context.fileNames)
            return schema.parse(
              context.purpose === "classify-complete-upload"
                ? { ...observations(), shipments: [], groupingAmbiguous: true }
                : observations()
            )
          const extracted =
            context.extraction.find((field) =>
              field.id.endsWith("-billOfLadingReference")
            ) ?? context.extraction[0]
          return schema.parse({
            fields: [
              {
                id: extracted.id,
                document: "Bill of Lading",
                observedText: "TEST-BL-001",
                value: "TEST-BL-001",
                status: "passed",
                note: "Directly observed",
                evidence: [
                  {
                    document: "shipment.pdf",
                    page: "1",
                    observedText: "BL reference TEST-BL-001",
                  },
                ],
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
          calls.push({
            purpose: "classify-complete-upload",
            supportedCountries,
          })
          sequence.push("classify-complete-upload")
          return files.map((file) => ({
            originalFilename: file.name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            documentStatus: "final",
            documentStatusConfidence: 0.99,
            classificationSource: { page: 1, text: "Bill of Lading" },
            consigneeCountry: "Madagascar",
            consigneeCountryConfidence: 0.99,
            consigneeCountrySource: {
              page: 1,
              text: "Consignee: Madagascar",
            },
            shipmentReferences: ["TEST-BL-001"],
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
          calls.push({ profiles })
          sequence.push("inspect")
          const extraction = profiles.find(
            (profile) => profile.documentType === "Bill of Lading"
          ).fields
          const valueFor = (field) =>
            field.id.endsWith("-billOfLadingReference")
              ? "TEST-BL-001"
              : field.id.endsWith("-exporterName")
                ? "TEST EXPORTER"
                : field.id.endsWith("-importerName")
                  ? "TEST IMPORTER"
                  : null
          const classification = {
            originalFilename: files[0].name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            documentStatus: "final",
            documentStatusConfidence: 0.99,
            classificationSource: { page: 1, text: "Bill of Lading" },
            consigneeCountry: "Madagascar",
            consigneeCountryConfidence: 0.99,
            consigneeCountrySource: {
              page: 1,
              text: "Consignee: Madagascar",
            },
            shipmentReferences: ["TEST-BL-001"],
            warnings: [],
            missingFields: [],
            uncertainFields: [],
            possibleConflicts: [],
          }
          const analysis = {
            originalFilename: files[0].name,
            documentType: "Bill of Lading",
            documentTypeConfidence: 0.99,
            fields: extraction.map((field) => ({
              id: field.id,
              value: valueFor(field),
              confidence: valueFor(field) ? 0.99 : 0,
              sourcePage: valueFor(field) ? 1 : null,
              supportingText: valueFor(field)
                ? `Observed ${valueFor(field)}`
                : null,
              row: null,
              rowLabel: "",
            })),
            warnings: [],
            missingFields: extraction
              .filter((field) => !valueFor(field))
              .map((field) => field.id),
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
            observedText: field.supportingText ?? "",
            value: field.value ?? "",
            status: field.value ? "passed" : "unconfirmed",
            evidence: field.value
              ? [
                  {
                    document: analysis.originalFilename,
                    page: String(field.sourcePage),
                    observedText: field.supportingText,
                  },
                ]
              : [],
            note: "Directly observed",
            row: field.row,
            rowLabel: field.rowLabel,
          })),
        reconcileDocuments: async () => ({
          resolvedFields: [],
          matchedDocumentGroups: [],
          warnings: [],
        }),
      }
    return originalRequire(id)
  }
  adapter._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename
  )
  const session = {
    user: { id: "staff-fixture" },
    client: {
      from: (table) => {
        assert.equal(table, "okf_reviews")
        return {
          insert: async (row) => {
            saved.push(row)
            return { error: storageError }
          },
        }
      },
    },
  }
  const files = [
    new File(["synthetic"], "shipment.pdf", { type: "application/pdf" }),
  ]
  const setup = await adapter.exports.reviewUploads(
    session,
    files,
    "fixture",
    "intake",
    "2026-09-10"
  )
  assert.equal(calls.length, 1)
  assert.deepEqual(setup.mappedFields, [])
  assert.deepEqual(setup.revisions, [])
  state = publish(seed())
  layouts = [
    require("../lib/certificate-layout/seed.ts").createMadagascarLayout(),
  ]
  calls.length = 0
  sequence.length = 0
  const progress = []
  const review = await adapter.exports.reviewUploads(
    session,
    files,
    "fixture",
    "intake",
    "2026-09-10",
    (event) => {
      progress.push(event)
      sequence.push(event.stage)
    }
  )
  assert.equal(calls.length, 2)
  assert.deepEqual(sequence.slice(0, 2), [
    "classify-complete-upload",
    "country",
  ])
  assert.deepEqual(progress[0].review.certificateLayout, layouts[0])
  const fieldProgress = progress.filter((event) => event.fieldKeys.length)
  assert.deepEqual(fieldProgress[0].fieldKeys.slice(0, 2), [
    "exporterName",
    "importerName",
  ])
  assert.ok(
    fieldProgress.some((event) =>
      event.fieldKeys.includes("billOfLadingReference")
    )
  )
  const inspectedFields = calls[1].profiles.find(
    (profile) => profile.documentType === "Bill of Lading"
  ).fields
  assert.ok(inspectedFields.some((field) => field.id.endsWith("-exporterName")))
  assert.ok(
    inspectedFields.some((field) => field.id.endsWith("-billOfLadingReference"))
  )
  assert.ok(
    !inspectedFields.some(
      (field) => field.id === "mg-source-billOfLadingReference"
    )
  )
  assert.equal(saved.at(-1).review.id, review.id)
  assert.equal(saved.at(-1).actor, "staff-fixture")
  assert.ok(
    review.revisions
      .filter((r) => !r.pageId.startsWith("layout-"))
      .every((r) => r.revision === 1 && r.version === "1.0.0")
  )
  assert.deepEqual(review.certificateLayout, layouts[0])
  assert.equal(review.observations.groupingAmbiguous, false)
  assert.deepEqual(review.observations.shipments[0].documentNames, [
    "shipment.pdf",
  ])
  const analysis = adapter.exports.reviewToAnalysis(review)
  assert.equal(
    analysis.fields.find((f) => f.key === "billOfLadingReference").value,
    "TEST-BL-001"
  )
  assert.equal(
    analysis.fields.find((f) => f.key === "shipmentMethod").value,
    "Sea"
  )
  assert.equal(
    analysis.fields.find((f) => f.key === "cargoType").value,
    "Full container load"
  )
  assert.equal(
    analysis.fields.find((f) => f.key === "containerType").value,
    "Dry"
  )
  assert.equal(
    analysis.fields.find((f) => f.key === "containerSize").value,
    "40 Feet"
  )
  storageError = { message: "Storage unavailable" }
  await assert.rejects(
    adapter.exports.reviewUploads(
      session,
      files,
      "fixture",
      "intake",
      "2026-09-10"
    ),
    /Storage unavailable/
  )
})

test("local Bill of Lading text resolves the consignee country without AI", async () => {
  const Module = require("node:module")
  const path = require("node:path")
  const ts = require("typescript")
  const filename = path.resolve("lib/okf/ai.ts")
  const adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = adapter.require.bind(adapter)
  adapter.require = (id) => {
    if (id === "server-only") return {}
    if (id === "./server") return { OkfError: Error }
    if (id === "@/lib/network") return {}
    return originalRequire(id)
  }
  adapter._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename
  )

  const result = await adapter.exports.localBillOfLadingCountry(
    [
      new File(
        [
          "NON-NEGOTIABLE WAYBILL. To enable the Consignee to sue, the Shipper acts on behalf of the Consignee. Delivery will be made to the Consignee. Vessel MAERSK SENTOSA. Port of Loading Newark. Notify Party Same as Consignee. PARTICULARS FURNISHED BY SHIPPER. Consignee (Negotiable only if consigned to order) Association Iraka Mitory Filazantsara Lot IVZ 77 IMF Ambodirano Ampefiloha BP 8293 Antananarivo, Madagascar NIF: 3004271279 Port of Discharge TAMATAVE Signed for the Carrier",
        ],
        "BL_272767989_Bill_of_Lading.txt",
        { type: "text/plain" }
      ),
    ],
    [
      { country: "Djibouti", aliases: ["DJI"] },
      { country: "Madagascar", aliases: ["MG", "MDG"] },
    ]
  )

  assert.equal(result.country, "Madagascar")
  assert.equal(result.fileName, "BL_272767989_Bill_of_Lading.txt")
  assert.match(result.observedText, /Antananarivo, Madagascar/)
})

test("OpenAI sends PDFs as high-detail input files and maps strict extraction results", async () => {
  const Module = require("node:module")
  const path = require("node:path")
  const ts = require("typescript")
  const filename = path.resolve("lib/okf/openai-document-provider.ts")
  const adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = adapter.require.bind(adapter)
  const payloads = []
  adapter.require = (id) => {
    if (id === "server-only") return {}
    if (id === "./server") return { OkfError: Error }
    if (id === "@/lib/network")
      return {
        RequestTimeoutError: class RequestTimeoutError extends Error {},
        fetchWithTimeout: async (_url, init) => {
          const payload = JSON.parse(init.body)
          payloads.push(payload)
          const inputFile = payload.input[0].content.find(
            (item) => item.type === "input_file"
          )
          const isClassification =
            payload.text.format.name === "shipment_document_classification"
          const isInspection =
            payload.text.format.name === "shipment_document_inspection"
          const lowConfidence =
            inputFile.filename === "low.pdf" && payload.model === "gpt-5.6-luna"
          return {
            ok: true,
            json: async () => ({
              status: "completed",
              usage: {
                input_tokens: 10,
                output_tokens: 10,
                total_tokens: 20,
              },
              output_text: JSON.stringify(
                isClassification
                  ? {
                      originalFilename: inputFile.filename,
                      documentType: "Other or Unknown",
                      documentTypeConfidence: 0.99,
                      documentStatus: "final",
                      documentStatusConfidence: 0.99,
                      classificationSource: { page: 1, text: "Document" },
                      consigneeCountry: null,
                      consigneeCountryConfidence: 0,
                      consigneeCountrySource: { page: null, text: null },
                      shipmentReferences: [],
                      warnings: [],
                      missingFields: [],
                      uncertainFields: [],
                      possibleConflicts: [],
                    }
                  : isInspection
                    ? {
                        classification: {
                          originalFilename: inputFile.filename,
                          documentType: "Bill of Lading",
                          documentTypeConfidence: 0.99,
                          documentStatus: "final",
                          documentStatusConfidence: 0.99,
                          classificationSource: {
                            page: 1,
                            text: "Bill of Lading",
                          },
                          consigneeCountry: "Madagascar",
                          consigneeCountryConfidence: 0.99,
                          consigneeCountrySource: {
                            page: 1,
                            text: "Consignee Madagascar",
                          },
                          shipmentReferences: ["TEST-BL-001"],
                          warnings: [],
                          missingFields: [],
                          uncertainFields: [],
                          possibleConflicts: [],
                        },
                        extraction: {
                          originalFilename: inputFile.filename,
                          documentType: "Bill of Lading",
                          documentTypeConfidence: 0.99,
                          fields: [
                            {
                              id: "shipper",
                              value: "ACME EXPORTS",
                              confidence: 0.99,
                              sourcePage: 1,
                              supportingText: "Shipper: ACME EXPORTS",
                              row: null,
                              rowLabel: null,
                            },
                          ],
                          warnings: [],
                          missingFields: [],
                          uncertainFields: [],
                          possibleConflicts: [],
                        },
                      }
                    : {
                        originalFilename: "bill.pdf",
                        documentType: "Bill of Lading",
                        documentTypeConfidence: 0.99,
                        fields: [
                          {
                            id: "shipper",
                            value: "ACME EXPORTS",
                            confidence: lowConfidence ? 0.2 : 0.99,
                            sourcePage: 1,
                            supportingText: "Shipper: ACME EXPORTS",
                            row: null,
                            rowLabel: null,
                          },
                          {
                            id: "goods",
                            value: "Rice",
                            confidence: lowConfidence ? 0.2 : 0.99,
                            sourcePage: 2,
                            supportingText: "Rice",
                            row: 0,
                            rowLabel: null,
                          },
                        ],
                        warnings: [],
                        missingFields: [],
                        uncertainFields: [],
                        possibleConflicts: [],
                      }
              ),
            }),
          }
        },
      }
    return originalRequire(id)
  }
  adapter._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename
  )
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const result = await adapter.exports.extractDocuments(
      [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
      "Bill of Lading",
      [
        {
          id: "shipper",
          label: "Shipper",
          instruction: "Read shipper",
          repeated: false,
          options: [],
        },
        {
          id: "goods",
          label: "Goods",
          instruction: "Read goods",
          repeated: true,
          options: [],
        },
      ]
    )
    assert.deepEqual(
      result.fields.map((field) => [
        field.id,
        field.value,
        field.row,
        field.status,
      ]),
      [
        ["shipper", "ACME EXPORTS", null, "passed"],
        ["goods", "Rice", 0, "passed"],
      ]
    )
    assert.deepEqual(result.fields[0].evidence, [
      {
        document: "bill.pdf",
        page: "1",
        observedText: "Shipper: ACME EXPORTS",
      },
    ])
    assert.equal(payloads.length, 1)
    assert.equal(payloads[0].model, "gpt-5.6-luna")
    assert.equal(payloads[0].reasoning.effort, "none")
    assert.equal(payloads[0].text.format.strict, true)
    const fileInput = payloads[0].input[0].content.find(
      (item) => item.type === "input_file"
    )
    assert.equal(fileInput.filename, "bill.pdf")
    assert.equal(fileInput.detail, "high")

    payloads.length = 0
    await adapter.exports.classifyDocuments(
      [
        new File(["native text PDF bytes"], "native.pdf", {
          type: "application/pdf",
        }),
        new File(["scanned image PDF bytes"], "scanned.pdf", {
          type: "application/pdf",
        }),
      ],
      []
    )
    assert.deepEqual(
      payloads.map((payload) => {
        const item = payload.input[0].content.find(
          (content) => content.type === "input_file"
        )
        return [item.filename, item.detail]
      }),
      [
        ["native.pdf", "high"],
        ["scanned.pdf", "high"],
      ]
    )

    payloads.length = 0
    const inspected = await adapter.exports.inspectDocuments(
      [new File(["pdf"], "combined.pdf", { type: "application/pdf" })],
      [
        {
          documentType: "Bill of Lading",
          fields: [
            {
              id: "shipper",
              label: "Shipper",
              instruction: "Read shipper",
              repeated: false,
              options: [],
            },
          ],
        },
      ],
      [{ country: "Madagascar", aliases: ["MG"] }]
    )
    assert.equal(payloads.length, 1)
    assert.equal(payloads[0].text.format.name, "shipment_document_inspection")
    assert.equal(payloads[0].input[0].content[0].detail, "high")
    assert.equal(
      inspected.documents[0].classification.documentType,
      "Bill of Lading"
    )
    assert.equal(
      inspected.documents[0].analysis.fields[0].value,
      "ACME EXPORTS"
    )

    payloads.length = 0
    const escalated = await adapter.exports.extractDocuments(
      [new File(["pdf"], "low.pdf", { type: "application/pdf" })],
      "Bill of Lading",
      [
        {
          id: "shipper",
          label: "Shipper",
          instruction: "Read shipper",
          repeated: false,
          options: [],
        },
        {
          id: "goods",
          label: "Goods",
          instruction: "Read goods",
          repeated: true,
          options: [],
        },
      ]
    )
    assert.deepEqual(
      payloads.map((payload) => [payload.model, payload.reasoning.effort]),
      [
        ["gpt-5.6-luna", "none"],
        ["gpt-5.6-terra", "low"],
      ]
    )
    assert.equal(escalated.analyses[0].escalated, true)
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
