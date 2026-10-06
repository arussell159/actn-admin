/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic live-provider verification using the app's TypeScript adapter. */
require("./okf-typescript.cjs")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")

const filename = path.resolve("lib/okf/openai-document-provider.ts")
const adapter = new Module(filename, module)
adapter.filename = filename
adapter.paths = Module._nodeModulePaths(path.dirname(filename))
const originalRequire = adapter.require.bind(adapter)
adapter.require = (id) =>
  id === "server-only"
    ? {}
    : id === "./server"
      ? { OkfError: Error }
      : id === "@/lib/network"
        ? require("../lib/network.ts")
        : originalRequire(id)
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
const provider = adapter.exports

// Tiny, readable in-memory PDFs exercise the same high-detail PDF and streaming
// path as new ECTN uploads. No customer data, database or storage writes occur.
function pdf(name, lines) {
  const escape = (value) => value.replace(/([\\()])/g, "\\$1")
  const content = `BT /F1 12 Tf 45 750 Td 18 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${escape(line)}) Tj`).join("\n")} ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ]
  let body = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new File([body], name, { type: "application/pdf" })
}

function field(id, label, instruction, repeated = false) {
  return { id, label, instruction, repeated, options: [] }
}

const profiles = [
  {
    documentType: "Bill of Lading",
    fields: [
      field(
        "blNumber",
        "Bill of Lading number",
        "Read the BL reference exactly, preserving letters, digits and punctuation."
      ),
      field(
        "shipper",
        "Shipper",
        "Read only the shipper company name, not its address."
      ),
      field(
        "consignee",
        "Consignee",
        "Read only the consignee company name, not notify party or address."
      ),
      field("vessel", "Vessel", "Read the vessel name exactly."),
      field(
        "grossWeight",
        "Gross weight",
        "Read the gross weight number, preserve decimal precision, omit its unit."
      ),
      field(
        "issuanceDate",
        "Issuance date",
        "Read the labelled issuance date and normalize to dd/mm/yyyy."
      ),
      field(
        "insurance",
        "Insurance amount",
        "Read an explicit insurance amount. Return null if absent; never calculate or infer it."
      ),
    ],
  },
  {
    documentType: "Commercial Invoice",
    fields: [
      field(
        "invoiceNumber",
        "Invoice number",
        "Read the invoice reference exactly."
      ),
      field(
        "invoiceTotal",
        "Invoice total",
        "Read the final invoice total number exactly, omit its currency. If two totals conflict without supersession, preserve both alternatives and mark the field uncertain or conflicting; do not choose."
      ),
      field(
        "currency",
        "Currency",
        "Read the ISO currency code for the invoice total."
      ),
      field(
        "exchangeRate",
        "EUR exchange rate",
        "Read the explicitly labelled EUR exchange rate, preserving all six decimal places."
      ),
      field(
        "ambiguousDate",
        "Unspecified date",
        "Read Unspecified date only if the document explicitly gives its date format. If day/month order is ambiguous, return null and list it as uncertain. Do not infer from other dates or country."
      ),
      field(
        "goods",
        "Goods",
        "Read each invoice line's goods description without its item number, unit or quantity. Keep line alignment.",
        true
      ),
      field(
        "quantity",
        "Quantity",
        "Read each invoice line's quantity as a number without its unit. Keep line alignment.",
        true
      ),
    ],
  },
]

function value(result, id, row = null) {
  return result.analysis.fields.find(
    (item) => item.id === id && item.row === row
  )?.value
}

async function main() {
  assert.ok(
    provider.documentExtractionConfigured(),
    "OPENAI_API_KEY must be configured"
  )
  const files = [
    pdf("synthetic-bill-of-lading.pdf", [
      "FINAL BILL OF LADING - SYNTHETIC VERIFICATION ONLY",
      "Bill of Lading number: TEST-BL-001/26",
      "Shipper: ACME EXPORTS LTD",
      "Shipper address: Rotterdam, Netherlands",
      "Consignee: TEST IMPORTS SARL",
      "Consignee address: Antananarivo, Madagascar",
      "Notify party: OTHER COMPANY, Nairobi, Kenya",
      "Vessel: OCEAN TEST 07",
      "Gross weight: 12345.678 KG",
      "Issuance date: 26 September 2026",
    ]),
    pdf("synthetic-commercial-invoice.pdf", [
      "FINAL COMMERCIAL INVOICE - SYNTHETIC VERIFICATION ONLY",
      "Invoice number: TEST-INV-091/26",
      "Invoice total: USD 12345.67",
      "EUR exchange rate: 0.912345",
      "Unspecified date: 03/04/2026 (format not stated)",
      "Line 1 - White rice - Quantity: 1250 KG",
      "Line 2 - Brown rice - Quantity: 375 KG",
    ]),
  ]
  let deltas = 0
  const start = performance.now()
  const inspected = await provider.inspectDocuments(
    files,
    profiles,
    [{ country: "Madagascar", aliases: ["MG", "MDG"] }],
    undefined,
    () => {
      deltas += 1
    }
  )
  assert.equal(
    inspected.failures.length,
    0,
    inspected.failures
      .map((failure) => `${failure.filename}: ${failure.error.message}`)
      .join("; ")
  )
  const bill = inspected.documents.find(
    (item) => item.classification.originalFilename === files[0].name
  )
  const invoice = inspected.documents.find(
    (item) => item.classification.originalFilename === files[1].name
  )
  assert.equal(bill.classification.documentType, "Bill of Lading")
  assert.equal(bill.classification.consigneeCountry, "Madagascar")
  assert.equal(invoice.classification.documentType, "Commercial Invoice")
  for (const [id, expected] of Object.entries({
    blNumber: "TEST-BL-001/26",
    shipper: "ACME EXPORTS LTD",
    consignee: "TEST IMPORTS SARL",
    vessel: "OCEAN TEST 07",
    grossWeight: "12345.678",
    issuanceDate: "26/09/2026",
  }))
    assert.equal(value(bill, id), expected, id)
  assert.equal(value(bill, "insurance"), null)
  for (const [id, expected] of Object.entries({
    invoiceNumber: "TEST-INV-091/26",
    invoiceTotal: "12345.67",
    currency: "USD",
    exchangeRate: "0.912345",
  }))
    assert.equal(value(invoice, id), expected, id)
  assert.equal(value(invoice, "ambiguousDate"), null)
  assert.equal(value(invoice, "goods", 0), "White rice")
  assert.equal(value(invoice, "quantity", 0), "1250")
  assert.equal(value(invoice, "goods", 1), "Brown rice")
  assert.equal(value(invoice, "quantity", 1), "375")
  for (const item of inspected.documents) {
    const definitions = profiles.find(
      (profile) => profile.documentType === item.classification.documentType
    ).fields
    for (const observation of provider.observationsFromDocumentAnalysis(
      item.analysis,
      definitions
    )) {
      if (observation.value)
        assert.equal(observation.status, "passed", observation.id)
    }
  }
  console.log(
    JSON.stringify({
      case: "exact-streamed-bl-and-invoice",
      elapsedMs: Math.round(performance.now() - start),
      streamedFieldUpdates: deltas,
      models: inspected.documents.map((item) => item.analysis.model),
      outcome: "PASS",
    })
  )

  const conflictStart = performance.now()
  const conflicts = await provider.inspectDocuments(
    [
      pdf("synthetic-conflicting-invoice.pdf", [
        "FINAL COMMERCIAL INVOICE - SYNTHETIC VERIFICATION ONLY",
        "Invoice number: TEST-CONFLICT-001",
        "Invoice total: USD 12345.67",
        "Invoice total: USD 19345.67",
        "Both totals apply to the same invoice; no revision priority stated.",
      ]),
    ],
    [{ documentType: "Commercial Invoice", fields: [profiles[1].fields[1]] }],
    []
  )
  assert.equal(conflicts.failures.length, 0)
  const conflicting = conflicts.documents[0]
  const observations = provider.observationsFromDocumentAnalysis(
    conflicting.analysis,
    [profiles[1].fields[1]]
  )
  assert.ok(
    conflicting.analysis.possibleConflicts.some(
      (item) => item.fieldId === "invoiceTotal"
    ),
    "Conflicting invoice totals must be preserved"
  )
  assert.ok(
    observations.every((item) => item.status !== "passed"),
    "Unresolved conflicting totals must never pass"
  )
  console.log(
    JSON.stringify({
      case: "unresolved-invoice-conflict",
      elapsedMs: Math.round(performance.now() - conflictStart),
      model: conflicting.analysis.model,
      outcome: "PASS",
    })
  )
}

main().catch((error) => {
  console.error("FAIL:", error.message)
  process.exitCode = 1
})
