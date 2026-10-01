import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import test from "node:test"

const require = createRequire(import.meta.url)
const ts = require("typescript")

function load(filename) {
  const fullPath = path.resolve(filename)
  const loadedModule = { exports: {} }
  const localRequire = (id) =>
    id.startsWith("@/") ? load(id.slice(2) + ".ts") : require(id)
  const source = fs
    .readFileSync(fullPath, "utf8")
    .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(fullPath).href))
  const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
  new Function("require", "module", "exports", code)(
    localRequire,
    loadedModule,
    loadedModule.exports
  )
  return loadedModule.exports
}

const {
  extractWorkbookRows,
  getCameroonCountryReportTotals,
  parseCameroonCountryReportCsv,
} = load("lib/country-report-import.ts")

test("Cameroon BESC report maps MI, booking, dates, and both currencies", () => {
  const csv = [
    'N°,DATE, BOOKING , BESC ,VAL (Euro),Com (USD)',
    '1,30/09/2026,NAM8653112,MI2661513,100,40',
    '2,29/09/2026,MEDUW5454667,MI2661708,55,40',
    'TOTAL COMMISSION AMOUNT PAYABLE (USD),,,,,80',
  ].join("\n")
  const records = parseCameroonCountryReportCsv(csv)

  assert.equal(records.length, 2)
  assert.deepEqual(
    records.map((record) => [
      record.invoiceNumber,
      record.ctnNumber,
      record.billOfLadingNumber,
      record.amount,
      record.secondaryAmount,
      record.transactionDate,
    ]),
    [
      ["MI2661513", "MI2661513", "NAM8653112", 100, 40, "30/09/2026"],
      ["MI2661708", "MI2661708", "MEDUW5454667", 55, 40, "29/09/2026"],
    ]
  )
  assert.deepEqual(getCameroonCountryReportTotals(csv), {
    amount: 155,
    secondaryAmount: 80,
  })
})

test("the attached Cameroon workbook imports only its first worksheet", {
  skip: !process.env.CAMEROON_REPORT_FILE,
}, async () => {
  const filename = process.env.CAMEROON_REPORT_FILE
  const bytes = fs.readFileSync(filename)
  const file = new File([bytes], path.basename(filename))
  const csvText = await extractWorkbookRows(file, { period: "2026-09" })
  const records = parseCameroonCountryReportCsv(csvText)

  assert.equal(records.length, 84)
  assert.ok(csvText.startsWith("N°,DATE"))
  assert.equal(records.reduce((sum, record) => sum + record.amount, 0), 10020)
  assert.equal(
    records.reduce((sum, record) => sum + record.secondaryAmount, 0),
    3360
  )
  assert.deepEqual(getCameroonCountryReportTotals(csvText), {
    amount: 10020,
    secondaryAmount: 3360,
  })
  assert.ok(records.some((record) => record.invoiceNumber === "MI2661513"))
  assert.ok(records.every((record) => !record.invoiceNumber.startsWith("DMI")))
})
