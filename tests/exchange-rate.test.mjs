import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const ts = require("typescript")

function load(filename) {
  const loadedModule = { exports: {} }
  const localRequire = (id) =>
    id.startsWith("@/") ? load(id.slice(2) + ".ts") : require(id)
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(filename), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText
  new Function("require", "module", "exports", code)(
    localRequire,
    loadedModule,
    loadedModule.exports
  )
  return loadedModule.exports
}

const { formatExchangeRate, isExchangeRateDraft, parseExchangeRate } = load(
  "lib/exchange-rate.ts"
)
const { parseExchangeRates } = load("lib/month-end-exchange-rates.ts")

test("exchange-rate editors accept every precision through six decimal places", () => {
  for (const value of [
    "1",
    "1.2",
    "1.23",
    "1.234",
    "1.2345",
    "1.23456",
    "1.234567",
    "1,234567",
    "0.000001",
  ]) {
    assert.equal(isExchangeRateDraft(value), true, value)
    assert.equal(
      parseExchangeRate(value),
      Number(value.replace(",", ".")),
      value
    )
  }

  for (const value of ["", "1.", "1,", "."]) {
    assert.equal(isExchangeRateDraft(value), true, value)
    assert.equal(parseExchangeRate(value), undefined, value)
  }

  for (const value of [
    "1.2345678",
    "1,2345678",
    "-1",
    "1e-6",
    "1.2.3",
    "NaN",
  ]) {
    assert.equal(isExchangeRateDraft(value), false, value)
    assert.equal(parseExchangeRate(value), undefined, value)
  }
  assert.equal(parseExchangeRate("0.000000"), undefined)
})

test("rate formatting, JSON persistence, and calculations retain six-place precision", () => {
  const rate = parseExchangeRate("1.234567")
  const persisted = JSON.parse(JSON.stringify({ rate }))

  assert.equal(persisted.rate, 1.234567)
  assert.equal(formatExchangeRate(persisted.rate), "1.234567")
  assert.equal(formatExchangeRate(0.000001), "0.000001")
  assert.equal(formatExchangeRate(1234.567891), "1234.567891")
  assert.equal(Math.round(10000 * persisted.rate * 100) / 100, 12345.67)
})

test("prepaid report import retains the latest six-place rate and its entered precision", () => {
  const country = { id: "madagascar", name: "Madagascar", checkable: true }
  const rates = parseExchangeRates(
    [
      "Account,Exchange Rate,Date",
      "Prepaid: Madagascar,1.111111,2026-08-01",
      "Prepaid: Madagascar,1.234567,2026-09-30",
      "Prepaid: Madagascar,1.999999,2026-09-01",
    ].join("\n"),
    [country]
  )

  assert.equal(rates.length, 1)
  assert.equal(rates[0].rate, 1.234567)
  assert.equal(rates[0].display, "1.234567")
  assert.equal(rates[0].country.id, "madagascar")
})

test("prepaid report import accepts comma decimals and preserves trailing zeroes", () => {
  const rates = parseExchangeRates(
    'Account,Exchange Rate\nPrepaid: Madagascar,"1,230000"',
    [{ id: "madagascar", name: "Madagascar", checkable: true }]
  )
  assert.equal(rates[0].rate, 1.23)
  assert.equal(rates[0].display, "1.230000")
})
