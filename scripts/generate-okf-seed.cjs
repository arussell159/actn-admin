/* eslint-disable @typescript-eslint/no-require-imports -- Seed generation uses the test-only CommonJS TypeScript loader. */
require("./okf-typescript.cjs")
const fs = require("node:fs")
const { createInitialPages, formPresentation } = require("../lib/okf/seed.ts")
const pages = createInitialPages()
const file = "supabase-okf.sql"
const sql = fs.readFileSync(file, "utf8")
const seedJson = JSON.stringify(pages).replaceAll("'", "''")
const insert =
  "insert into public.okf_form_schema(id,presentation) values(true,'" +
  JSON.stringify(formPresentation).replaceAll("'", "''") +
  "'::jsonb) on conflict(id) do nothing;\n" +
  "insert into public.okf_state(id,generation,pages) values(true,0,'" +
  seedJson +
  "'::jsonb) on conflict(id) do nothing;\n" +
  // Add new concepts without replacing authored content in an existing bundle.
  "with seed(page) as (select value from jsonb_array_elements('" +
  seedJson +
  "'::jsonb)) update public.okf_state s set pages=s.pages || coalesce((select jsonb_agg(seed.page) from seed where not exists (select 1 from jsonb_array_elements(s.pages) current where current->>'id'=seed.page->>'id')),'[]'::jsonb) where s.id=true;\n" +
  // Correct only the three staff-confirmed Madagascar rules in existing rows.
  "with seed(page) as (select value from jsonb_array_elements('" +
  seedJson +
  "'::jsonb)), target(rule,page_id) as (select rule,page->>'id' from seed cross join lateral jsonb_array_elements(page->'content'->'rules') rule where rule->>'id' in ('mg-required-mg-document-freight-invoice','mg-bill-of-lading-final-dated-mbl','mg-commercial-invoice-country-of-origin')) update public.okf_state s set pages=(select jsonb_agg(case when exists(select 1 from target where page_id=p->>'id') then jsonb_set(p,'{content,rules}',coalesce((select jsonb_agg(r) from jsonb_array_elements(p->'content'->'rules') r where r->>'id' not in (select rule->>'id' from target where page_id=p->>'id')),'[]'::jsonb) || coalesce((select jsonb_agg(rule) from target where page_id=p->>'id'),'[]'::jsonb)) else p end) from jsonb_array_elements(s.pages) p) where s.id=true;"
fs.writeFileSync(
  file,
  sql.replace(
    /-- GENERATED_SEED[\s\S]*?\ncommit;/,
    "-- GENERATED_SEED\n" + insert + "\ncommit;"
  )
)
console.log(
  "Generated",
  pages.length,
  "unpublished setup pages; existing rows are preserved."
)
