// Optional focused PostgreSQL verification. Pass the temporary PGlite package path.
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
process.on("uncaughtException", error => { console.error("FAIL:", error.message, error.where ?? "", error instanceof assert.AssertionError ? error.stack : ""); process.exit(1) })
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite")
const db = new PGlite()
const user = "11111111-1111-4111-8111-111111111111"
await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text,name text);
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
  grant usage on schema public,auth,storage to authenticated,anon;
  set request.jwt.claim.sub='${user}';
`)
await db.exec(await fs.readFile("supabase-okf.sql", "utf8"))
await db.exec(await fs.readFile("supabase-certificate-layouts.sql", "utf8"))
console.log("PASS: migration executes against PostgreSQL")
const query = async (sql, args = []) => (await db.query(sql, args)).rows
const state = (await query("select * from public.okf_state"))[0]
assert.equal(state.pages.length, 14)
assert.equal(state.pages.filter(p => p.revision > 0).length, 0)
const changes = state.pages.map(p => ({ pageId: p.id, content: p.content, level: "minor" }))
const id = "22222222-2222-4222-8222-222222222222"
const save = (draftId, edit, generation, cs) => query("select public.okf_save_draft($1,$2,$3,$4::jsonb,$5,$6) as draft", [draftId, edit, generation, JSON.stringify(cs), "Test reviewed change", "Synthetic test evidence"])
await db.exec("set role authenticated")
const mgLayout = (await query("select * from public.okf_certificate_layouts where country_key='madagascar'"))[0]
const publishLayout = (key, layout, revision) => query("select public.okf_publish_certificate_layout($1,$2::jsonb,$3) as row", [key, JSON.stringify(layout), revision])
await assert.rejects(query("update public.okf_certificate_layouts set revision=42"), /permission denied/)
assert.equal((await publishLayout("madagascar", mgLayout.layout, 1))[0].row.revision, 1)
const newLayout = structuredClone(mgLayout.layout)
newLayout.sections[0].title = "Trading parties"
newLayout.fields.push({ id: "customField", label: "Custom field", control: "text", options: [], sourceDocument: "Bill of Lading", instruction: "Read the declared value" })
const savedLayout = (await publishLayout("madagascar", newLayout, 1))[0].row
assert.equal(savedLayout.revision, 2)
assert.equal((await query("select * from public.okf_certificate_layout_history")).length, 1)
await assert.rejects(publishLayout("madagascar", newLayout, 1), /changed/)
await assert.rejects(publishLayout("kenya", { ...newLayout, country: "Kenya" }, 0), /alias/)
await assert.rejects(publishLayout("kenya", { ...newLayout, country: "Kenya", aliases: [], sections: [{ ...newLayout.sections[0], columns: 0 }] }, 0), /Invalid/)
const broken = structuredClone(newLayout); broken.sections[0].groups[0].fields[0].fieldId = "nonexistent"
await assert.rejects(publishLayout("madagascar", broken, 2), /placement/)
await db.exec("set request.jwt.claims='{\"app_metadata\":{\"okf_role\":\"viewer\"}}'")
await assert.rejects(publishLayout("madagascar", newLayout, 2), /permission/)
await db.exec("set request.jwt.claims='{}'")
console.log("PASS: layouts persist, unchanged saves do not bump revisions, stale/invalid/alias collisions reject, history immutable")
await assert.rejects(query("update public.okf_state set generation=10"), /permission denied/)
await assert.rejects(query("insert into public.okf_publications(draft_id,before_pages,after_pages,proposer,approver,reason,source) values($1,'[]','[]',$2,$2,'x','x')", [id, user]), /permission denied/)
await save(id, 0, 0, changes)
assert.equal((await query("select * from public.okf_state"))[0].generation, 0)
let preview = (await query("select public.okf_preview($1) as p", [id]))[0].p
const changed = structuredClone(changes)
changed[0].content.sections[0].text += " Test wording."
await save(id, 1, 0, changed)
await assert.rejects(query("select public.okf_publish($1,$2)", [id, preview.token]), /stale/)
preview = (await query("select public.okf_preview($1) as p", [id]))[0].p
await query("select public.okf_publish($1,$2)", [id, preview.token])
let after = (await query("select * from public.okf_state"))[0]
assert.equal(after.generation, 1)
assert.ok(after.pages.every(p => p.version === "1.0.0" && p.revision === 1))
assert.equal((await query("select * from public.okf_publications")).length, 1)
await assert.rejects(query("select public.okf_publish($1,$2)", [id, preview.token]), /stale/)
console.log("PASS: draft isolation, atomic publication, exact-preview approval, immutable audit, replay protection")

const id2 = "33333333-3333-4333-8333-333333333333"
const id3 = "44444444-4444-4444-8444-444444444444"
const patch = [{ pageId: after.pages[0].id, content: structuredClone(after.pages[0].content), level: "patch" }]
patch[0].content.sections[0].text += " Patch."
await save(id2, 0, 1, patch)
const other = structuredClone(patch); other[0].content.sections[0].text += " Concurrent."
await save(id3, 0, 1, other)
const p2 = (await query("select public.okf_preview($1) as p", [id2]))[0].p
const p3 = (await query("select public.okf_preview($1) as p", [id3]))[0].p
await query("select public.okf_publish($1,$2)", [id2, p2.token])
await assert.rejects(query("select public.okf_publish($1,$2)", [id3, p3.token]), /stale/)
after = (await query("select * from public.okf_state"))[0]
assert.equal(after.pages[0].version, "1.0.1")
assert.equal(after.pages[1].version, "1.0.0")
console.log("PASS: concurrent publication conflict and one version increment per affected page")

const bad = [{ pageId: after.pages[5].id, content: structuredClone(after.pages[5].content), level: "minor" }]
bad[0].content.rules.push({ ...bad[0].content.rules[0], id: "duplicate-rule" })
await assert.rejects(save("55555555-5555-4555-8555-555555555555", 0, 2, bad), /Already covered/)
bad[0].content = structuredClone(after.pages[5].content); bad[0].content.sections.reverse()
await assert.rejects(save("55555555-5555-4555-8555-555555555555", 0, 2, bad), /Structural/)
await db.exec("set request.jwt.claims='{\"app_metadata\":{\"okf_role\":\"viewer\"}}'")
await assert.rejects(save("55555555-5555-4555-8555-555555555555", 0, 2, patch), /permission/)
await db.exec("set request.jwt.claims='{}'")
console.log("PASS: duplicate, structural-change and viewer permission rejection")

const reviewId = "66666666-6666-4666-8666-666666666666"
await query("insert into public.okf_reviews(id,request_id,review) values($1,'request-test',$2::jsonb)", [reviewId, JSON.stringify({ id: reviewId, requestId: "request-test", findings: [{ id: "finding-test", status: "failed", explanation: "Synthetic failure" }] })])
await query("insert into public.madagascar_bsc_requests(id,reference,analysis) values('request-test','Synthetic request',$1::jsonb)", [JSON.stringify({ fields: [{ key: "incoterm", value: "FOB", status: "extracted", source: "shipment.pdf" }], invoiceValues: [{ label: "FOB Value", value: "123" }], invoiceItems: [{ quantity: "5" }] })])
let req = (await query("select * from public.madagascar_bsc_requests where id='request-test'"))[0]
const correct = (target, value, reason, timestamp) => query("select public.okf_correct_request('request-test',$1,$2,$3,$4,$5) as result", [target, value, reason, timestamp, reviewId])
await assert.rejects(correct("incoterm", "CIF", "", req.updated_at), /reason/)
const corrected = (await correct("incoterm", "CIF", "Staff checked signed invoice", req.updated_at))[0].result
assert.equal(corrected.correction.before_value.value, "FOB")
assert.equal(corrected.correction.after_value.value, "CIF")
assert.equal(corrected.correction.actor, user)
await assert.rejects(correct("incoterm", "DAP", "Another correction", req.updated_at), /changed/)
req = corrected.request
const overridden = (await correct("finding:finding-test", "not applicable", "Confirmed shipment exception", req.updated_at))[0].result
assert.equal(overridden.request.analysis.okfOverrides["finding-test"].status, "not applicable")
assert.equal((await query("select review from public.okf_reviews where id=$1", [reviewId]))[0].review.findings[0].status, "failed")
const lineCorrected = (await correct("invoiceItem:0:quantity", "6", "Corrected line quantity from invoice", overridden.request.updated_at))[0].result
assert.equal(lineCorrected.request.analysis.invoiceItems[0].quantity, "6")
assert.equal(lineCorrected.correction.before_value, "5")
assert.equal((await query("select * from public.okf_corrections")).length, 3)
await query("update public.madagascar_bsc_requests set country='Madagascar' where id='request-test'")
const addedField = (await correct("customField", "New value", "Entered from signed document", lineCorrected.request.updated_at))[0].result
assert.equal(addedField.correction.before_value, null)
assert.equal(addedField.request.analysis.fields.find(field => field.key === "customField").value, "New value")
await assert.rejects(correct("unpublishedField", "value", "Unknown field", addedField.request.updated_at), /Unknown request field/)
console.log("PASS: newly configured scalar fields accept audited corrections on older records")
await assert.rejects(query("update public.okf_corrections set reason='tampered'"), /permission denied/)
await db.exec("reset role; set request.jwt.claim.sub=''; set role anon")
await assert.rejects(query("select * from public.okf_state"), /permission denied/)
await assert.rejects(query("select public.okf_publish($1,$2)", [id2, p2.token]), /permission denied/)
console.log("PASS: request corrections and overrides preserve originals, reasons, actor and immutable history; anonymous access rejected")
await db.close()
