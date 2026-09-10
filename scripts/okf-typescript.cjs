/* eslint-disable @typescript-eslint/no-require-imports -- Test-only CommonJS loader for TypeScript modules. */
// Small loader for the existing Node test runner and seed generation, not app runtime.
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  module._compile(outputText, filename)
}
