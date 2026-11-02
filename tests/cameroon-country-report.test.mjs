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
  parseKenyaCountryReportCsv,
  parseCountryReportFile,
} = load("lib/country-report-import.ts")

test("Cameroon booking-only export keeps identifiers and both currencies", () => {
  const csv = [
    "N°,DATE,BOOKING,ETA,Val (Euro),Com (USD)",
    "1,31/10/2026,BOOKING001,31/10/2026,200,40",
    "2,31/10/2026,MI1234567,31/10/2026,100,40",
    "TOTAL COMMISSION AMOUNT PAYABLE (USD),,,,,80",
  ].join("\n")
  const records = parseCameroonCountryReportCsv(csv)
  assert.equal(records.length, 2)
  assert.equal(records[0].billOfLadingNumber, "BOOKING001")
  assert.equal(records[0].reference, "BOOKING001")
  assert.equal(records[1].invoiceNumber, "")
  assert.equal(records[1].ctnNumber, "")
  assert.deepEqual(getCameroonCountryReportTotals(csv), {
    amount: 300,
    secondaryAmount: 80,
  })
})

test("Kenya headerless approval export retains first row and uses approval month", () => {
  const csv = [
    "29.10.2026 08:30,BL001,Approved,SHIPPER,CONSIGNEE,30.10.2026,,,,,,,,,,",
    "21.09.2026 13:01,BL002,Approved,SHIPPER,CONSIGNEE,1.10.2026,,,,,,,,,,",
    "29.09.2026 09:58,BL003,Approved,SHIPPER,CONSIGNEE,30.09.2026,,,,,,,,,,",
  ].join("\n")
  const records = parseKenyaCountryReportCsv(csv, { period: "2026-10" })
  assert.equal(records.length, 2)
  assert.deepEqual(records[0], {
    invoiceNumber: "",
    ctnNumber: "",
    billOfLadingNumber: "BL001",
    reference: "BL001",
    amount: 0,
    sourceRowCount: 1,
    status: "Approved",
    sellingDate: "2026-10-29",
    transactionDate: "2026-10-30",
  })
  assert.equal(records[1].transactionDate, "2026-10-01")
  assert.deepEqual(parseKenyaCountryReportCsv("invoice,amount\nINV001,100"), [])
})

test(
  "new supplied workbooks import all shipment rows",
  {
    skip: !process.env.NEW_REPORT_DIRECTORY,
  },
  async () => {
    for (const [name, count, amount] of [
      ["cameroon", 97, 20485],
      ["kenya", 114, 0],
    ]) {
      const filename = path.join(
        process.env.NEW_REPORT_DIRECTORY,
        `${name}.xlsx`
      )
      const file = new File([fs.readFileSync(filename)], `${name}.xlsx`)
      const records = await parseCountryReportFile(file, { period: "2026-10" })
      assert.equal(records.length, count, name)
      assert.equal(
        records.reduce((sum, record) => sum + record.amount, 0),
        amount,
        name
      )
      assert.ok(
        records.every((record) => record.billOfLadingNumber),
        name
      )
      if (name === "cameroon")
        assert.equal(
          records.reduce((sum, record) => sum + record.secondaryAmount, 0),
          3880
        )
      if (name === "kenya") {
        assert.equal(records[0].billOfLadingNumber, "MEDUAAE61680")
        assert.ok(
          records.every((record) =>
            record.transactionDate.startsWith("2026-10-")
          )
        )
      }
    }
  }
)

test("Cameroon BESC report maps MI, booking, dates, and both currencies", () => {
  const csv = [
    "N°,DATE, BOOKING , BESC ,VAL (Euro),Com (USD)",
    "1,30/09/2026,NAM8653112,MI2661513,100,40",
    "2,29/09/2026,MEDUW5454667,MI2661708,55,40",
    "TOTAL COMMISSION AMOUNT PAYABLE (USD),,,,,80",
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

test(
  "the attached Cameroon workbook imports only its first worksheet",
  {
    skip: !process.env.CAMEROON_REPORT_FILE,
  },
  async () => {
    const filename = process.env.CAMEROON_REPORT_FILE
    const bytes = fs.readFileSync(filename)
    const file = new File([bytes], path.basename(filename))
    const csvText = await extractWorkbookRows(file, { period: "2026-09" })
    const records = parseCameroonCountryReportCsv(csvText)

    assert.equal(records.length, 84)
    assert.ok(csvText.startsWith("N°,DATE"))
    assert.equal(
      records.reduce((sum, record) => sum + record.amount, 0),
      10020
    )
    assert.equal(
      records.reduce((sum, record) => sum + record.secondaryAmount, 0),
      3360
    )
    assert.deepEqual(getCameroonCountryReportTotals(csvText), {
      amount: 10020,
      secondaryAmount: 3360,
    })
    assert.ok(records.some((record) => record.invoiceNumber === "MI2661513"))
    assert.ok(
      records.every((record) => !record.invoiceNumber.startsWith("DMI"))
    )
  }
)
