import assert from "node:assert/strict"
import test from "node:test"
import { createKnowledgeReviewSession, knowledgeVersion, nextKnowledgeVersion, prepareKnowledgeProposal } from "../lib/ctn-knowledge-review.ts"

const record = (id = "angola") => ({ id, country: id, format: "okf.ctn.country.v1", version: "v1.4", updatedAt: "initial",
  sections: [{ id: "procedure", title: "Create Certificate", kind: "procedures", summary: "Procedure", updatedAt: "initial",
    body: ["Enter the BL number.", "Submit at least 48 hours before arrival.", "Keep this unrelated instruction."] }], changeLog: [] })
const review = () => ({ classification: "UPDATE", assistantMessage: "Official deadline changed.",
  references: [{ recordId: "angola", sectionId: "procedure", existingText: "Submit at least 48 hours before arrival." }], conflict: null,
  files: [{ recordId: "angola", newRecord: null, versionImpact: "major", versionReason: "Previous deadline is invalid.", changeLogSummary: "Submission deadline changed from 48 to 72 hours.",
    edits: [{ action: "UPDATE", sectionId: "procedure", newSection: null, startIndex: 1,
      currentContent: ["Submit at least 48 hours before arrival."], proposedContent: ["Submit at least 72 hours before arrival."], reason: "Official superseding rule." }] }] })

test("versions are conservative, compact, and accept legacy numeric versions", () => {
  assert.equal(knowledgeVersion(2), "v2")
  assert.equal(knowledgeVersion("1.0.0"), "v1")
  for (const [version, impact, expected] of [["v1.3", "none", "v1.3"], ["v2", "patch", "v2.0.1"], ["v1.1", "patch", "v1.1.1"], ["v1.3.2", "minor", "v1.4"], ["v1.4", "major", "v2"]]) {
    assert.equal(nextKnowledgeVersion(version, impact), expected)
  }
})

test("database approval waits for persistence and retains the exact proposal after a failure", async () => {
  const records = [record()]
  const session = createKnowledgeReviewSession()
  const proposal = session.stage(review(), records)
  await assert.rejects(session.approveAsync(proposal.id, records, async () => { throw new Error("database offline") }), /database offline/)
  let release
  const pending = session.approveAsync(proposal.id, records, () => new Promise((resolve) => { release = resolve }))
  let completed = false
  pending.then(() => { completed = true })
  await Promise.resolve()
  assert.equal(completed, false)
  release()
  const result = await pending
  assert.equal(result.records[0].version, "v2")
  await assert.rejects(session.approveAsync(proposal.id, records, async () => {}), /no pending/)
})

test("analysis is read-only; approval commits the private exact proposal once", () => {
  const records = [record()]
  const before = structuredClone(records)
  const session = createKnowledgeReviewSession()
  let writes = 0
  const proposal = session.stage(review(), records)
  assert.deepEqual(records, before)
  assert.equal(proposal.files[0].proposedVersion, "v2")
  proposal.files[0].nextRecord.sections[0].body[1] = "Tampered after display"
  proposal.files[0].proposedVersion = "v99"
  const result = session.approve(proposal.id, records, () => writes++)
  assert.equal(result.records[0].sections[0].body[1], "Submit at least 72 hours before arrival.")
  assert.equal(result.records[0].sections[0].body[2], records[0].sections[0].body[2])
  assert.equal(result.records[0].version, "v2")
  assert.match(result.records[0].changeLog[0].summary, /^v2 —/)
  assert.equal(result.proposal.navigation[0].anchor, "okf-entry-procedure-1")
  assert.equal(writes, 1)
  assert.throws(() => session.approve(proposal.id, records, () => writes++), /no pending/)
})

test("cancel, no-change and conflict cannot authorize writes", () => {
  const records = [record()]
  const session = createKnowledgeReviewSession()
  const pending = session.stage(review(), records)
  session.cancel()
  assert.throws(() => session.approve(pending.id, records, assert.fail), /no pending/)
  for (const classification of ["NO CHANGE", "CONFLICT"]) {
    const input = { ...review(), classification, files: [], conflict: classification === "CONFLICT" ? { newInformation: "72 hours", issue: "Authority unclear", question: "Which rule is authoritative?" } : null }
    assert.equal(session.stage(input, records), null)
    assert.throws(() => session.approve("anything", records, assert.fail), /no pending/)
    assert.throws(() => session.stage({ ...input, files: review().files }, records), /cannot contain edits/)
  }
})

test("copyediting saves without changing version or log", () => {
  const input = review()
  Object.assign(input.files[0], { versionImpact: "none", versionReason: "Equivalent terminology", changeLogSummary: "" })
  Object.assign(input.files[0].edits[0], { startIndex: 0, currentContent: ["Enter the BL number."], proposedContent: ["Enter the BL No."] })
  const pending = prepareKnowledgeProposal(input, [record()])
  assert.equal(pending.files[0].nextRecord.version, "v1.4")
  assert.deepEqual(pending.files[0].nextRecord.changeLog, [])
  assert.equal(pending.files[0].changeLogEntry, null)
})

test("stale content blocks every file atomically; storage failure preserves retry", () => {
  const records = [record(), record("madagascar")]
  const input = review()
  input.files.push({ ...structuredClone(input.files[0]), recordId: "madagascar" })
  const session = createKnowledgeReviewSession()
  const pending = session.stage(input, records)
  const stale = structuredClone(records)
  stale[1].sections[0].body[2] = "Changed in another tab"
  assert.throws(() => session.approve(pending.id, stale, assert.fail), /changed since/)
  assert.throws(() => session.approve(pending.id, records, () => { throw new Error("Quota exceeded") }), /Quota/)
  let saved
  session.approve(pending.id, records, (next) => { saved = next })
  assert.deepEqual(saved.map((file) => file.version), ["v2", "v2"])
  assert.deepEqual(records.map((file) => file.version), ["v1.4", "v1.4"])
})

test("multiple edits receive one per-file version and preserve insertion navigation", () => {
  const input = review()
  input.classification = "ADD + UPDATE"
  input.files[0].versionImpact = "minor"
  input.files[0].edits.push({ action: "ADD", sectionId: "procedure", newSection: null, startIndex: 0, currentContent: [], proposedContent: ["- New document required.", "- New field required."], reason: "New checks." })
  const second = structuredClone(input.files[0])
  Object.assign(second, { recordId: "madagascar", versionImpact: "none", changeLogSummary: "" })
  second.edits = [{ ...second.edits[0], startIndex: 0, currentContent: ["Enter the BL number."], proposedContent: ["Enter the BL No."] }]
  input.files.push(second)
  const pending = prepareKnowledgeProposal(input, [record(), record("madagascar")])
  assert.deepEqual(pending.files.map((file) => file.proposedVersion), ["v1.5", "v1.4"])
  assert.equal(pending.files[0].nextRecord.changeLog.length, 1)
  assert.equal(pending.navigation[1].anchor, "okf-entry-procedure-3")
})

test("new files start at v1 and new sections use explicit metadata", () => {
  const input = review()
  input.classification = "ADD"
  Object.assign(input.files[0], { recordId: "new-country", newRecord: { country: "New Country" } })
  Object.assign(input.files[0].edits[0], { action: "ADD", startIndex: 0, currentContent: [], newSection: { id: "procedure", kind: "timing-and-deadlines", title: "Timing and Deadlines", summary: "Submission timing." } })
  const pending = prepareKnowledgeProposal(input, [record()])
  assert.equal(pending.files[0].proposedVersion, "v1")
  assert.equal(pending.files[0].nextRecord.sections[0].kind, "timing-and-deadlines")
})

test("hallucinated evidence, mismatched current text and overlapping edits fail closed", () => {
  const input = review()
  input.references[0].existingText = "Invented rule"
  assert.throws(() => prepareKnowledgeProposal(input, [record()]), /cites content/)
  const mismatch = review()
  mismatch.files[0].edits[0].currentContent = ["Invented current wording"]
  assert.throws(() => prepareKnowledgeProposal(mismatch, [record()]), /does not match/)
  const overlap = review()
  overlap.files[0].edits.push(structuredClone(overlap.files[0].edits[0]))
  assert.throws(() => prepareKnowledgeProposal(overlap, [record()]), /overlap/)
})
