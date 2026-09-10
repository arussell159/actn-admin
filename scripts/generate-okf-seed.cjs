/* eslint-disable @typescript-eslint/no-require-imports -- Seed generation uses the test-only CommonJS TypeScript loader. */
require("./okf-typescript.cjs")
const fs = require("node:fs")
const { createInitialPages, formPresentation } = require("../lib/okf/seed.ts")
const pages = createInitialPages()
const file = "supabase-okf.sql"
const sql = fs.readFileSync(file, "utf8")
const insert = "insert into public.okf_form_schema(id,presentation) values(true,'" + JSON.stringify(formPresentation).replaceAll("'", "''") + "'::jsonb) on conflict(id) do nothing;\n" + "insert into public.okf_state(id,generation,pages) values(true,0,'" + JSON.stringify(pages).replaceAll("'", "''") + "'::jsonb) on conflict(id) do nothing;"
fs.writeFileSync(file, sql.replace(/-- GENERATED_SEED[\s\S]*?\ncommit;/, "-- GENERATED_SEED\n" + insert + "\ncommit;"))
console.log("Generated", pages.length, "unpublished setup pages; existing rows are preserved.")
