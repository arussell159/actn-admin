import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

// Source inventory, not a runtime percentage: layout HTML and specialised editor
// primitives are counted separately from application controls.
const roots = ["app", "components"]
const rawTags = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "table",
  "dialog",
])
const controlModules = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "table",
  "dialog",
  "checkbox",
  "radio-group",
  "toggle",
  "toggle-group",
])
const controls = new Set([
  "Button",
  "Input",
  "Select",
  "Textarea",
  "Table",
  "Dialog",
  "Checkbox",
  "RadioGroup",
  "Toggle",
  "ToggleGroup",
])
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name).replaceAll("\\", "/")
    return entry.isDirectory()
      ? walk(file)
      : file.endsWith(".tsx")
        ? [file]
        : []
  })
}
const files = roots.flatMap(walk)
const inventory = []
const primitiveImports = new Map()
const rawControls = []
const directPrimitiveImports = []
for (const file of files) {
  if (/^components\/(ui\/|tiptap-)/.test(file)) continue
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const imports = new Map()
  for (const node of source.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue
    const modulePath = node.moduleSpecifier.text
    if (/^(@base-ui\/|@radix-ui\/|radix-ui$)/.test(modulePath))
      directPrimitiveImports.push({ file, module: modulePath })
    if (!modulePath.startsWith("@/components/ui/")) continue
    const name = modulePath.slice("@/components/ui/".length)
    const importers = primitiveImports.get(name) ?? new Set()
    importers.add(file)
    primitiveImports.set(name, importers)
    const bindings = node.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements)
        imports.set(binding.name.text, {
          module: name,
          name: binding.propertyName?.text ?? binding.name.text,
        })
  }
  let sharedUsages = 0,
    sharedControls = 0,
    raw = 0
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const imported = imports.get(tag)
      if (imported) {
        sharedUsages++
        if (controlModules.has(imported.module) && controls.has(imported.name))
          sharedControls++
      }
      if (rawTags.has(tag)) {
        raw++
        const attribute = (name) =>
          node.attributes.properties
            .find(
              (a) => ts.isJsxAttribute(a) && a.name.getText(source) === name
            )
            ?.initializer?.getText(source)
        rawControls.push({
          file,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
          tag,
          type: attribute("type"),
          className: attribute("className"),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  inventory.push({ file, sharedUsages, sharedControls, rawControls: raw })
}
const sum = (key) => inventory.reduce((total, file) => total + file[key], 0)
const shared = sum("sharedControls"),
  raw = sum("rawControls")
console.log(
  JSON.stringify(
    {
      scope:
        "TSX source in app and components; excludes components/ui and Tiptap directories. Shared-control percentage compares Button/Input/Select/Textarea/Table/Dialog/Checkbox/RadioGroup/Toggle/ToggleGroup occurrences with raw button/input/select/textarea/table/dialog occurrences. It is not a percentage of all application components or proof of accessibility.",
      filesScanned: inventory.length,
      filesUsingSharedUi: inventory.filter((file) => file.sharedUsages).length,
      sharedUiUsages: sum("sharedUsages"),
      sharedControlUsages: shared,
      rawControlUsages: raw,
      sharedControlPercent: Math.round((1000 * shared) / (shared + raw)) / 10,
      installedUiModules: fs
        .readdirSync("components/ui")
        .filter((file) => file.endsWith(".tsx")).length,
      sharedModules: [...primitiveImports]
        .map(([module, importers]) => ({
          module,
          importingFiles: importers.size,
        }))
        .sort((a, b) => b.importingFiles - a.importingFiles),
      directPrimitiveImports,
      rawControls,
    },
    null,
    2
  )
)
