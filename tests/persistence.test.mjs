import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire, Module } from "node:module"
const require = createRequire(import.meta.url)
const ts = require("typescript")

function loadApplication(overrides = {}) {
  const cache = new Map()
  function load(filename) {
    filename = path.resolve(filename)
    if (cache.has(filename)) return cache.get(filename).exports
    const adapter = new Module(filename)
    cache.set(filename, adapter)
    adapter.filename = filename
    adapter.paths = Module._nodeModulePaths(path.dirname(filename))
    adapter.require = (id) => {
      if (id in overrides) return overrides[id]
      if (id.startsWith("@/")) return load(id.slice(2) + ".ts")
      if (id.startsWith("."))
        return load(
          path.resolve(
            path.dirname(filename),
            id.endsWith(".ts") ? id : id + ".ts"
          )
        )
      return require(id)
    }
    adapter._compile(
      ts.transpileModule(
        fs
          .readFileSync(filename, "utf8")
          .replaceAll(
            "import.meta.url",
            JSON.stringify(pathToFileURL(filename).href)
          ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }
      ).outputText,
      filename
    )
    return adapter.exports
  }
  return load
}

function browser(hostname = "localhost") {
  const values = new Map()
  globalThis.window = {
    location: { hostname },
    dispatchEvent() {},
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  }
  return values
}

function database(handler) {
  return {
    from(table) {
      const calls = []
      const query = new Proxy(
        {},
        {
          get(_target, name) {
            if (name === "then")
              return (resolve, reject) =>
                Promise.resolve()
                  .then(() => handler(table, calls))
                  .then(resolve, reject)
            return (...args) => {
              calls.push([name, ...args])
              return query
            }
          },
        }
      )
      return query
    },
  }
}

const env = {
  assertSupabaseConfig() {},
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabasePublishableKey: () => "public",
}
const loadWithDb = (db) =>
  loadApplication({
    "@/lib/public-client": { createPublicClient: () => db },
    "@/lib/supabase-env": env,
  })

test("all report rows are fetched beyond the database's single-request limit", async () => {
  const { readAllRows } = loadApplication()("lib/database-records.ts")
  const expected = Array.from({ length: 1251 }, (_, id) => ({ id }))
  const ranges = []
  const rows = await readAllRows((from, to) => {
    ranges.push([from, to])
    return Promise.resolve({ data: expected.slice(from, to + 1), error: null })
  })
  assert.deepEqual(rows, expected)
  assert.deepEqual(ranges, [
    [0, 499],
    [500, 999],
    [1000, 1499],
  ])
  await assert.rejects(
    readAllRows(() =>
      Promise.resolve({ data: null, error: new Error("offline") })
    ),
    /offline/
  )
})

test("localhost cannot report a failed month or reconciliation save as successful", async () => {
  const values = browser()
  const failure = new Error("database unavailable")
  const load = loadWithDb(database(() => ({ data: null, error: failure })))
  const month = load("lib/month-end-db.ts")
  const reconciliation = load("lib/month-end-country-reconciliations.ts")
  await assert.rejects(
    month.saveMonthEndRecord({
      id: "test",
      period: "2099-01",
      checked: {},
      status: "Open",
      createdAt: "",
      updatedAt: "",
    }),
    /database unavailable/
  )
  await assert.rejects(
    month.deleteMonthEndRecord("2099-01"),
    /database unavailable/
  )
  await assert.rejects(
    reconciliation.saveMonthEndCountryReconciliation({
      monthEndId: "test",
      period: "2099-01",
      countryId: "angola",
      snapshot: { complete: true },
    }),
    /database unavailable/
  )
  assert.equal(values.size, 0)
})

test("localhost reads shared months without resurrecting deleted browser copies", async () => {
  const values = browser()
  values.set(
    "actn-month-end-records-v1",
    JSON.stringify([
      {
        id: "old-local",
        period: "2099-01",
        checked: {},
        status: "Open",
        createdAt: "",
        updatedAt: "",
      },
    ])
  )
  const load = loadWithDb(database(() => ({ data: [], error: null })))
  assert.deepEqual(await load("lib/month-end-db.ts").listMonthEndRecords(), [])
  assert.ok(
    values.get("actn-month-end-records-v1"),
    "Legacy copy remains recoverable"
  )
})

test("report saves retain every field and stop before deletion on a schema failure", async () => {
  browser()
  const operations = []
  const load = loadWithDb(
    database((_table, calls) => {
      operations.push(calls)
      return calls.some(([method]) => method === "upsert")
        ? { data: null, error: new Error("secondary_amount is missing") }
        : { data: [{ id: "existing" }], error: null }
    })
  )
  const records = [
    {
      id: "new",
      monthEndId: "test",
      period: "2099-01",
      countryId: "angola",
      countryName: "Angola",
      invoiceNumber: "1",
      ctnNumber: "1",
      billOfLadingNumber: "1",
      reference: "1",
      amount: 1,
      secondaryAmount: 2,
      status: "Complete",
      transactionDate: "2099-01-01",
      sellingDate: "2099-01-02",
      parserKey: "test",
      sourceRowCount: 1,
    },
  ]
  await assert.rejects(
    load(
      "lib/month-end-country-report-records.ts"
    ).replaceMonthEndCountryReportRecords({
      monthEndId: "test",
      countryId: "angola",
      records,
    }),
    /secondary_amount/
  )
  const writes = operations.flat().filter(([method]) => method === "upsert")
  assert.equal(writes.length, 1)
  assert.equal(writes[0][1][0].secondary_amount, 2)
  assert.equal(writes[0][1][0].selling_date, "2099-01-02")
  assert.ok(!operations.flat().some(([method]) => method === "delete"))
})

test("overlapping saves commit in order and failed drafts remain retryable", async () => {
  browser()
  const { saveDatabaseDraft, readPendingDatabaseSave, pendingDatabaseSaves } =
    loadApplication()("lib/persistence.ts")
  const committed = []
  let release
  const first = saveDatabaseDraft(
    "settings",
    "Settings",
    { revision: 1 },
    async (value) => {
      await new Promise((resolve) => {
        release = resolve
      })
      committed.push(value.revision)
    }
  )
  const second = saveDatabaseDraft(
    "settings",
    "Settings",
    { revision: 2 },
    async (value) => {
      committed.push(value.revision)
    }
  )
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(committed, [])
  assert.equal(readPendingDatabaseSave("settings").revision, 2)
  release()
  await Promise.all([first, second])
  assert.deepEqual(committed, [1, 2])
  assert.equal(readPendingDatabaseSave("settings"), undefined)
  let fail = true
  await assert.rejects(
    saveDatabaseDraft("settings", "Settings", { revision: 3 }, async () => {
      if (fail) throw new Error("offline")
    }),
    /offline/
  )
  assert.equal(readPendingDatabaseSave("settings").revision, 3)
  assert.equal(pendingDatabaseSaves()[0].failed, true)
  fail = false
  pendingDatabaseSaves()[0].retry()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(pendingDatabaseSaves(), [])
})

test("pricing upload failure keeps the existing catalog instead of deleting it first", async () => {
  browser()
  const methods = []
  const load = loadWithDb(
    database((_table, calls) => {
      methods.push(...calls.map(([method]) => method))
      return calls.some(([method]) => method === "upsert")
        ? { data: null, error: new Error("upload rejected") }
        : { data: [{ internal_id: "old" }], error: null }
    })
  )
  await assert.rejects(
    load("lib/quote-items-db.ts").replaceQuoteItemCatalog([
      { internalId: "new" },
    ]),
    /upload rejected/
  )
  assert.ok(!methods.includes("delete"))
})
