/* eslint-disable @typescript-eslint/no-require-imports -- Database seed generation. */
const fs = require("node:fs")
require("./okf-typescript.cjs")
const { createMadagascarLayout } = require("../lib/certificate-layout/seed.ts")
const filename = "supabase-certificate-layouts.sql"
let sql = fs.readFileSync(filename, "utf8")
const seed = createMadagascarLayout()
const seedSql = `insert into public.okf_certificate_layouts(country_key,layout,revision,updated_at) values('madagascar','${JSON.stringify(seed.layout).replaceAll("'", "''")}'::jsonb,1,'${seed.updated_at}') on conflict(country_key) do nothing;`
sql = sql.replace(/-- GENERATED MADAGASCAR LAYOUT[\s\S]*?-- GENERATED CORRECTION FUNCTION/, "-- GENERATED MADAGASCAR LAYOUT\n" + seedSql + "\n\n-- GENERATED CORRECTION FUNCTION")
const original = fs.readFileSync("supabase-okf.sql", "utf8")
let correction = original.slice(original.indexOf("create or replace function public.okf_correct_request"), original.indexOf("revoke all on function public.okf_save_draft"))
correction = correction.replace("item_key text;", "item_key text; definition jsonb;")
correction = correction.replace("if before_value is null then raise exception 'Unknown request field'; end if;", `if before_value is null then
      select f into definition from public.okf_certificate_layouts l cross join lateral jsonb_array_elements(l.layout->'fields') f
        where f->>'id'=p_target and p_target not like 'invoiceItems.%' and p_target<>'invoiceValues'
        and exists(select 1 from jsonb_array_elements_text(jsonb_build_array(l.layout->>'country') || (l.layout->'aliases')) n where public.okf_country_key(n)=public.okf_country_key(r.country));
      if definition is null then raise exception 'Unknown request field'; end if;
      after_value := jsonb_build_object('key',p_target,'label',definition->>'label','value',p_value,'status',case when trim(p_value)='' then 'missing' else 'extracted' end,'source','Staff correction','note','');
      next_analysis := jsonb_set(next_analysis,'{fields}',coalesce(next_analysis->'fields','[]') || jsonb_build_array(after_value));
    else`)
correction = correction.replace("next_analysis := jsonb_set(next_analysis,'{fields}',fields);", "next_analysis := jsonb_set(next_analysis,'{fields}',fields);\n    end if;")
sql = sql.replace(/-- GENERATED CORRECTION FUNCTION[\s\S]*?commit;/, () => "-- GENERATED CORRECTION FUNCTION\n" + correction + "commit;")
fs.writeFileSync(filename, sql)
