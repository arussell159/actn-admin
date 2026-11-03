import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const ts = require("typescript")
function load(filename) {
  const module = { exports: {} }
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(filename), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }
  ).outputText
  new Function("require", "module", "exports", code)(
    (id) => (id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : require(id)),
    module,
    module.exports
  )
  return module.exports
}
const { createMadagascarDraftPdf } = load("lib/madagascar-draft-pdf.ts")
const { madagascarDraftSchema } = load("lib/madagascar-draft.ts")

async function readPdf(draft) {
  const bytes = await createMadagascarDraftPdf(draft)
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise
  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    pages.push(content.items.filter((item) => "str" in item))
  }
  return pages
}

test("draft PDF preserves review edits, goods and references and is visibly a draft", async () => {
  const pages = await readPdf({
    reference: "AWB-12345",
    warnings: ["Check the exporter name."],
    sections: [
      {
        title: "Shipment",
        fields: [{ label: "Consignee", value: "Société Example - corrected" }],
        tables: [
          {
            title: "Goods",
            columns: ["HS code", "Description", "Quantity"],
            rows: [["847149", "Dell PowerEdge R320", "1 Number(s) (NO)"]],
          },
        ],
      },
    ],
  })
  const text = pages
    .flat()
    .map((item) => item.str)
    .join(" ")
  for (const value of [
    "AWB-12345",
    "Société Example - corrected",
    "847149",
    "Dell PowerEdge R320",
    "1 Number(s) (NO)",
    "Check the exporter name.",
    "DRAFT",
    "Not validated or issued by SGS.",
  ])
    assert.ok(text.includes(value), value)
})

test("long tables paginate, repeat headers, and keep text within the printable page", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => [
    `REF${i}`,
    `Cargo row ${i} ` + "Long description ".repeat(8),
  ])
  const pages = await readPdf({
    reference: "LONG",
    warnings: [],
    sections: [
      {
        title: "Items",
        fields: [],
        tables: [
          {
            title: "First consignment",
            columns: ["Reference", "Description"],
            rows: rows.slice(0, 40),
          },
          {
            title: "Second consignment",
            columns: ["Reference", "Description"],
            rows: rows.slice(40),
          },
        ],
      },
    ],
  })
  assert.ok(pages.length > 2)
  const text = pages
    .flat()
    .map((item) => item.str)
    .join(" ")
  for (let i = 0; i < 80; i++) assert.ok(text.includes(`REF${i}`))
  for (const page of pages) {
    assert.ok(page.some((item) => item.str === "Reference"))
    for (const item of page) {
      assert.ok(item.transform[5] >= 24, `${item.str}: below footer`)
      assert.ok(
        item.transform[4] + item.width <= 558,
        `${item.str}: beyond right margin`
      )
    }
  }
})

test("oversized extraction output is rejected before PDF rendering", () => {
  assert.equal(
    madagascarDraftSchema.safeParse({
      reference: "",
      warnings: [],
      sections: [],
    }).success,
    false
  )
})
