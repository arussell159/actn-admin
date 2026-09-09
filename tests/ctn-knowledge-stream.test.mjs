import assert from "node:assert/strict"
import test from "node:test"
import { knowledgeStreamPreview, readKnowledgeEvents } from "../lib/ctn-knowledge-stream.ts"

test("stream decoding handles split UTF-8, CRLF, multiline data and event boundaries", async () => {
  const text = 'event: preview\r\ndata: {"type":"preview",\r\ndata: "text":"Café → certificate"}\r\n\r\ndata: {"type":"complete"}\n\ndata: [DONE]\n\n'
  const bytes = new TextEncoder().encode(text)
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
    controller.close()
  } })
  const events = []
  for await (const event of readKnowledgeEvents(stream)) events.push(event)
  assert.deepEqual(events, [{ type: "preview", text: "Café → certificate" }, { type: "complete" }])
})

test("human-readable preview grows before JSON is complete without exposing JSON keys", () => {
  const json = JSON.stringify({ classification: "UPDATE", assistantMessage: 'Check the "BL No".\nPreserve Café.', references: [], conflict: null,
    files: [{ recordId: "angola", edits: [{ sectionId: "procedure", startIndex: 3, currentContent: ["Original rule."], proposedContent: ["New requirement."], reason: "Official change." }], versionReason: "Supersedes the old rule." }] })
  const partial = json.slice(0, json.indexOf('requirement.') + 4)
  assert.match(knowledgeStreamPreview(partial), /Proposed Wording:\nNew requ$/)
  assert.match(knowledgeStreamPreview(partial), /Check the "BL No"\.\nPreserve Café\./)
  for (let index = 0; index <= json.length; index++) {
    const preview = knowledgeStreamPreview(json.slice(0, index))
    assert.doesNotMatch(preview, /startIndex|assistantMessage|proposedContent/)
  }
  assert.match(knowledgeStreamPreview(json), /New requirement\./)
  assert.match(knowledgeStreamPreview('{"assistantMessage":"Field \\u004e\\u00'), /Field N$/)
})

test("leaving a stream cancels its reader", async () => {
  let cancelled = false
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"preview"}\n\n')) }, cancel() { cancelled = true } })
  for await (const event of readKnowledgeEvents(stream)) { assert.equal(event.type, "preview"); break }
  assert.equal(cancelled, true)
})
