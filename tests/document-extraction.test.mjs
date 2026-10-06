import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const require = createRequire(import.meta.url)
require("../scripts/okf-typescript.cjs")
const {
  documentReconciliationRequired,
  selectReconciliationCandidate,
} = require("../lib/okf/document-reconciliation.ts")

function provider(fetchResponse) {
  const Module = require("node:module")
  const ts = require("typescript")
  const filename = path.resolve("lib/okf/openai-document-provider.ts")
  const adapter = new Module(filename)
  adapter.filename = filename
  adapter.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = adapter.require.bind(adapter)
  adapter.require = (id) => {
    if (id === "server-only") return {}
    if (id === "./server") return { OkfError: Error }
    if (id === "@/lib/network")
      return {
        RequestTimeoutError: class RequestTimeoutError extends Error {},
        fetchWithTimeout: fetchResponse,
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
  return adapter.exports
}

const definition = {
  id: "shipper",
  label: "Shipper",
  instruction: "Read the shipper",
  repeated: false,
  options: [],
}
const field = (overrides = {}) => ({
  id: "shipper",
  value: "ACME EXPORTS",
  confidence: 0.99,
  sourcePage: 1,
  supportingText: "Shipper: ACME EXPORTS",
  row: null,
  rowLabel: null,
  ...overrides,
})
const analysis = (overrides = {}) => ({
  originalFilename: "bill.pdf",
  documentType: "Bill of Lading",
  documentTypeConfidence: 0.99,
  fields: [field()],
  warnings: [],
  missingFields: [],
  uncertainFields: [],
  possibleConflicts: [],
  model: "test-model",
  escalated: false,
  escalationReasons: [],
  ...overrides,
})

test("extraction requires a source excerpt and honors uncertainty and conflicts", () => {
  const { observationsFromDocumentAnalysis } = provider()
  const observe = (value, fields = [definition]) =>
    observationsFromDocumentAnalysis(value, fields)[0]
  assert.equal(observe(analysis()).status, "passed")
  const unsupported = observe(
    analysis({ fields: [field({ supportingText: null })] })
  )
  assert.equal(unsupported.status, "unconfirmed")
  assert.deepEqual(unsupported.evidence, [])
  assert.equal(
    observe(analysis({ uncertainFields: ["shipper"] })).status,
    "unconfirmed"
  )
  assert.equal(
    observe(analysis({ missingFields: ["shipper"] })).status,
    "unconfirmed"
  )
  assert.equal(
    observe(
      analysis({
        possibleConflicts: [
          {
            fieldId: "shipper",
            values: ["ACME", "OTHER"],
            explanation: "Conflict",
          },
        ],
      })
    ).status,
    "conflicting"
  )
  assert.equal(
    observe(analysis(), [{ ...definition, repeated: true }]).status,
    "unconfirmed"
  )
  assert.equal(
    observe(analysis(), [{ ...definition, options: ["OTHER EXPORTER"] }])
      .status,
    "unconfirmed"
  )
  assert.equal(
    observe(analysis(), [{ ...definition, options: ["acme exports"] }]).status,
    "unconfirmed"
  )
})

test("JSON reconciliation cannot upgrade uncertain or internally conflicting evidence", () => {
  const candidate = {
    value: "12345.67",
    status: "passed",
    evidence: [{ document: "invoice.pdf" }],
  }
  const resolved = {
    value: "12345.67",
    confidence: 1,
    source: { filename: "invoice.pdf" },
  }
  assert.equal(selectReconciliationCandidate([candidate], resolved), candidate)
  for (const status of ["unconfirmed", "missing", "failed", "conflicting"]) {
    assert.equal(
      selectReconciliationCandidate([{ ...candidate, status }], resolved),
      undefined
    )
  }
  assert.equal(
    selectReconciliationCandidate([candidate], {
      ...resolved,
      source: { filename: "different.pdf" },
    }),
    undefined
  )
  const uncertain = {
    ...candidate,
    status: "unconfirmed",
    evidence: [{ document: "uncertain.pdf" }],
  }
  assert.equal(
    selectReconciliationCandidate([uncertain, candidate], {
      ...resolved,
      source: { filename: "uncertain.pdf" },
    }),
    undefined
  )
  assert.equal(
    selectReconciliationCandidate([uncertain, candidate], {
      ...resolved,
      source: null,
    }),
    candidate
  )
})

test("agreeing document values skip arbitration while conflicts retain it", () => {
  const mappings = [
    {
      sourceFieldId: "shipper",
      systemFieldId: "exporterName",
      repeated: false,
    },
  ]
  const bill = analysis()
  const invoice = analysis({
    originalFilename: "invoice.pdf",
    fields: [field({ value: " ACME EXPORTS " })],
  })
  const required = (documents, map = mappings) =>
    documentReconciliationRequired(documents, map, 0.72)
  assert.equal(required([bill, invoice]), false)
  assert.equal(
    required([
      bill,
      { ...invoice, fields: [field({ value: "ACME   EXPORTS" })] },
    ]),
    true
  )
  assert.equal(
    required([
      bill,
      analysis({
        originalFilename: "invoice.pdf",
        fields: [field({ value: "OTHER EXPORTS" })],
      }),
    ]),
    true
  )
  assert.equal(
    required([bill, { ...invoice, uncertainFields: ["shipper"] }]),
    true
  )
  assert.equal(
    required([bill, { ...invoice, missingFields: ["shipper"] }]),
    true
  )
  assert.equal(
    required([bill, { ...invoice, fields: [field({ confidence: 0.2 })] }]),
    true
  )
  assert.equal(
    required([bill, { ...invoice, fields: [field({ supportingText: null })] }]),
    true
  )
  assert.equal(
    required([analysis({ possibleConflicts: [{ fieldId: "shipper" }] })]),
    true
  )
  assert.equal(
    required([bill, invoice], [{ ...mappings[0], repeated: true }]),
    false
  )
  assert.equal(required([bill]), false)
})

test("source omissions escalate and an unresolved omission never passes", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  const requests = []
  const adapter = provider(async (_url, init) => {
    requests.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output_text: JSON.stringify(
          analysis({ fields: [field({ supportingText: null })] })
        ),
      }),
    }
  })
  const result = await adapter.extractDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    "Bill of Lading",
    [definition]
  )
  assert.equal(requests.length, 2)
  assert.ok(
    result.analyses[0].escalationReasons.includes("missing_field_evidence")
  )
  assert.equal(result.fields[0].status, "unconfirmed")
})

test("blank noncritical ambiguity stays blank without a redundant second read", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  let requests = 0
  const adapter = provider(async () => {
    requests += 1
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output_text: JSON.stringify(
          analysis({
            fields: [
              field({ value: null, sourcePage: null, supportingText: null }),
            ],
            uncertainFields: ["shipper"],
          })
        ),
      }),
    }
  })
  const result = await adapter.extractDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    "Bill of Lading",
    [definition]
  )
  assert.equal(requests, 1)
  assert.equal(result.fields[0].value, "")
  assert.equal(result.fields[0].status, "unconfirmed")
})

test("streaming emits one complete value instead of unvalidated string fragments", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  const text = JSON.stringify(analysis())
  const split = text.indexOf("ACME") + 2
  const events = [
    { type: "response.output_text.delta", delta: text.slice(0, split) },
    { type: "response.output_text.delta", delta: text.slice(split) },
    {
      type: "response.completed",
      response: { status: "completed", output_text: text },
    },
  ]
  const body = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")
  const adapter = provider(
    async () =>
      new Response(body, { headers: { "Content-Type": "text/event-stream" } })
  )
  const deltas = []
  const result = await adapter.extractDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    "Bill of Lading",
    [definition],
    undefined,
    (_file, delta) => deltas.push(delta)
  )
  assert.equal(result.failures.length, 0)
  assert.deepEqual(deltas, [{ id: "shipper", value: "ACME EXPORTS" }])
})

test("repeated fields do not replay previous rows on every streamed token", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  const text = JSON.stringify(
    analysis({
      fields: [
        field({ value: "White rice", row: 0 }),
        field({ value: "Brown rice", row: 1 }),
      ],
    })
  )
  const events = [...text].map((delta) => ({
    type: "response.output_text.delta",
    delta,
  }))
  events.push({
    type: "response.completed",
    response: { status: "completed", output_text: text },
  })
  const body = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")
  const adapter = provider(async () => new Response(body))
  const deltas = []
  const result = await adapter.extractDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    "Bill of Lading",
    [{ ...definition, repeated: true }],
    undefined,
    (_file, delta) => deltas.push(delta)
  )
  assert.equal(result.failures.length, 0)
  assert.deepEqual(
    deltas.map(({ value }) => value),
    ["White rice", "Brown rice"]
  )
})

test("a closed stream without a completion event fails even with complete-looking JSON", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  const text = JSON.stringify(analysis())
  const body = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n`
  const adapter = provider(
    async () =>
      new Response(body, { headers: { "Content-Type": "text/event-stream" } })
  )
  const result = await adapter.extractDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    "Bill of Lading",
    [definition],
    undefined,
    () => {}
  )
  assert.equal(result.analyses.length, 0)
  assert.equal(result.failures.length, 1)
  assert.match(result.failures[0].error.message, /ended before completion/)
})

test("the matching profile discards unrelated fields and flags conflicting duplicates", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() =>
    previousKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = previousKey)
  )
  const adapter = provider(async () => ({
    ok: true,
    json: async () => ({
      status: "completed",
      output_text: JSON.stringify({
        classification: {
          originalFilename: "bill.pdf",
          documentType: "Bill of Lading",
          documentTypeConfidence: 0.99,
          documentStatus: "final",
          documentStatusConfidence: 0.99,
          classificationSource: { page: 1, text: "Bill of Lading" },
          consigneeCountry: "Madagascar",
          consigneeCountryConfidence: 0.99,
          consigneeCountrySource: { page: 1, text: "Madagascar" },
          shipmentReferences: [],
          warnings: [],
          missingFields: [],
          uncertainFields: [],
          possibleConflicts: [],
        },
        extraction: analysis({
          fields: [
            field(),
            field({ value: "OTHER EXPORTS" }),
            field({ id: "invoiceValue", value: "999" }),
          ],
        }),
      }),
    }),
  }))
  const result = await adapter.inspectDocuments(
    [new File(["pdf"], "bill.pdf", { type: "application/pdf" })],
    [
      { documentType: "Bill of Lading", fields: [definition] },
      {
        documentType: "Commercial Invoice",
        fields: [{ ...definition, id: "invoiceValue" }],
      },
    ],
    [{ country: "Madagascar", aliases: [] }]
  )
  const extracted = result.documents[0].analysis
  assert.deepEqual(
    extracted.fields.map(({ id }) => id),
    ["shipper"]
  )
  assert.equal(
    adapter.observationsFromDocumentAnalysis(extracted, [definition])[0].status,
    "conflicting"
  )
})
