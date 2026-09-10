/* eslint-disable @typescript-eslint/no-require-imports -- Test-only CommonJS loading of the existing AI adapter. */
require("./okf-typescript.cjs")
const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")
const assert = require("node:assert/strict")
const { observationSchema } = require("../lib/okf/schema.ts")
const { identificationInstructions } = require("../lib/okf/prompts.ts")
const filename = path.resolve("lib/okf/ai.ts")
const adapter = new Module(filename, module)
adapter.filename = filename
adapter.paths = Module._nodeModulePaths(path.dirname(filename))
const originalRequire = adapter.require.bind(adapter)
adapter.require = id => id === "server-only" ? {} : id === "./server" ? { OkfError: Error } : id === "@/lib/network" ? require("../lib/network.ts") : originalRequire(id)
adapter._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const schema = observationSchema.pick({ country: true, shipments: true, groupingAmbiguous: true, documents: true })
async function main() {
  // Synthetic fixtures only. No customer files or operational knowledge are transmitted.
  for (const [name, document, expected] of [
    ["consignee-only", "SYNTHETIC TEST BILL OF LADING\nReference: TEST-1\nConsignee address: Antananarivo, Madagascar\nNo destination or discharge port is stated.", "supported"],
    ["explicit-destination", "SYNTHETIC TEST FINAL BILL OF LADING\nReference: TEST-2\nConsignee address: Antananarivo, Madagascar\nFinal destination country: Madagascar\nPort of discharge: Toamasina\nTransit country: Mauritius", "supported"],
  ]) {
    const result = await adapter.exports.structuredAi(schema, identificationInstructions, { fileNames: [name + ".txt"], supportedCountries: [{ country: "Madagascar", aliases: ["MG", "MDG"] }, { country: "Kenya", aliases: ["KE"] }], approvedCountryIndex: null }, [new File([document], name + ".txt", { type: "text/plain" })])
    if (expected === "supported") { assert.equal(result.country.status, "supported"); assert.equal(result.country.basis, "consignee address"); assert.equal(result.country.name, "Madagascar") }
    else assert.ok(["ambiguous", "unconfirmed"].includes(result.country.status))
    console.log("PASS:", name, "structured response:", result.country.status)
  }
}
main().catch(error => { console.error("FAIL:", error.message); process.exitCode = 1 })
