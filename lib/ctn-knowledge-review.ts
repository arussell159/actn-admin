import { z } from "zod"
import type {
  CtnKnowledgeCountryRecord,
  CtnKnowledgeSection,
} from "./ctn-knowledge-base"

const text = z.string()
const newSectionSchema = z
  .object({ id: text, title: text, kind: text, summary: text })
  .strict()
const editSchema = z
  .object({
    action: z.enum(["ADD", "UPDATE"]),
    sectionId: text,
    newSection: newSectionSchema.nullable(),
    startIndex: z.number().int().nonnegative(),
    currentContent: z.array(text),
    proposedContent: z.array(text),
    reason: text,
  })
  .strict()

export const knowledgeAnalysisSchema = z
  .object({
    classification: z
      .enum(["ADD", "UPDATE", "ADD + UPDATE", "NO CHANGE", "CONFLICT"])
      .describe(
        "Compare meanings first. A contradictory new assertion is CONFLICT unless the user explicitly establishes supersession/authority. Stating a different deadline alone is NOT authority. Equivalent existing knowledge is NO CHANGE."
      ),
    assistantMessage: text,
    // Evidence comes from the full live corpus, not a keyword-filtered subset.
    references: z.array(
      z.object({ recordId: text, sectionId: text, existingText: text }).strict()
    ),
    conflict: z
      .object({ newInformation: text, issue: text, question: text })
      .strict()
      .nullable(),
    files: z.array(
      z
        .object({
          recordId: text,
          newRecord: z.object({ country: text }).strict().nullable(),
          edits: z.array(editSchema),
          versionImpact: z
            .enum(["none", "patch", "minor", "major"])
            .describe(
              "none for identical operational meaning, including BL number -> BL No; patch for small factual clarification; minor for ADDITIVE knowledge while old rules remain valid; major for replacing an invalidated rule, including an official deadline change 48 -> 72 hours. A replaced deadline is never minor. Decide once per file."
            ),
          versionReason: text,
          changeLogSummary: text.describe(
            "Empty string for versionImpact none on an existing file. Otherwise a short factual revision description, without version prefix. New files require a creation summary."
          ),
        })
        .strict()
    ),
  })
  .strict()

export type KnowledgeAnalysis = z.infer<typeof knowledgeAnalysisSchema>
export type KnowledgeNavigation = {
  recordId: string
  sectionId: string
  anchor: string
  label: string
}
export type KnowledgePendingProposal = {
  id: string
  classification: KnowledgeAnalysis["classification"]
  approvalRequired: true
  files: Array<
    KnowledgeAnalysis["files"][number] & {
      location: string
      currentVersion: string | null
      proposedVersion: string
      changeLogEntry: string | null
      snapshot: string | null
      nextRecord: CtnKnowledgeCountryRecord
    }
  >
  navigation: KnowledgeNavigation[]
}

export function knowledgeVersion(value: string | number) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(value))
  if (!match)
    throw new Error(
      "The OKF version is invalid. Correct it before proposing a change."
    )
  const [major, minor, patch] = match.slice(1).map((part) => Number(part ?? 0))
  if (!major || ![major, minor, patch].every(Number.isSafeInteger))
    throw new Error("Invalid OKF version.")
  return `v${major}${patch ? `.${minor}.${patch}` : minor ? `.${minor}` : ""}`
}

export function nextKnowledgeVersion(
  value: string | number,
  impact: KnowledgeAnalysis["files"][number]["versionImpact"]
) {
  const current = knowledgeVersion(value)
  const [major, minor = 0, patch = 0] = current.slice(1).split(".").map(Number)
  if (impact === "major") return knowledgeVersion(`${major + 1}`)
  if (impact === "minor") return knowledgeVersion(`${major}.${minor + 1}`)
  if (impact === "patch")
    return knowledgeVersion(`${major}.${minor}.${patch + 1}`)
  return current
}

export function knowledgeLocation(recordId: string, sectionId?: string) {
  return `okf://ctn/countries/${recordId}${sectionId ? `#${sectionId}` : ""}`
}

export function knowledgeAnchor(sectionId: string, index?: number) {
  return index === undefined
    ? `okf-section-${sectionId}`
    : `okf-entry-${sectionId}-${index}`
}

// Read-only: validates evidence, resolves precise patches and calculates versions
// before the approval UI is shown. No storage or model calls belong here.
export function prepareKnowledgeProposal(
  input: unknown,
  records: CtnKnowledgeCountryRecord[]
): KnowledgePendingProposal | null {
  const analysis = knowledgeAnalysisSchema.parse(input)
  for (const reference of analysis.references) {
    const section = records
      .find((record) => record.id === reference.recordId)
      ?.sections.find((item) => item.id === reference.sectionId)
    if (
      !section ||
      !reference.existingText.trim() ||
      ![section.title, section.summary, ...section.body]
        .join("\n")
        .includes(reference.existingText)
    ) {
      throw new Error(
        "The review cites content that is no longer in the OKF. Please review again."
      )
    }
  }
  if (records.length && !analysis.references.length)
    throw new Error(
      "The review must cite the existing OKF before proposing changes."
    )
  if (["NO CHANGE", "CONFLICT"].includes(analysis.classification)) {
    if (analysis.files.length)
      throw new Error("No-change and conflict reviews cannot contain edits.")
    if (
      analysis.classification === "CONFLICT" &&
      (!analysis.conflict?.question.trim() || !analysis.conflict.issue.trim())
    )
      throw new Error(
        "The conflict needs an authority or clarification question."
      )
    return null
  }
  if (analysis.conflict || !analysis.files.length)
    throw new Error("Resolve the conflict before proposing an edit.")
  const actions = new Set(
    analysis.files.flatMap((file) => file.edits.map((edit) => edit.action))
  )
  const classification = actions.size === 2 ? "ADD + UPDATE" : [...actions][0]
  if (classification !== analysis.classification)
    throw new Error("The action does not match the proposed edits.")
  const navigation: KnowledgeNavigation[] = []
  const seen = new Set<string>()
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()
  const files = analysis.files.map((file) => {
    if (seen.has(file.recordId))
      throw new Error("Group all changes to a file into one version decision.")
    seen.add(file.recordId)
    const existing = records.find((record) => record.id === file.recordId)
    if (Boolean(existing) === Boolean(file.newRecord))
      throw new Error(
        "The proposed file does not match the live OKF structure."
      )
    if (
      !file.recordId.trim() ||
      !file.edits.length ||
      !file.versionReason.trim()
    )
      throw new Error("Incomplete OKF proposal.")
    const base: CtnKnowledgeCountryRecord = existing ?? {
      id: file.recordId,
      country: file.newRecord!.country,
      format: "okf.ctn.country.v1",
      version: "v1",
      updatedAt: createdAt,
      sections: [],
      changeLog: [],
    }
    const sections = structuredClone(base.sections)
    const bySection = new Map<string, typeof file.edits>()
    for (const edit of file.edits)
      bySection.set(edit.sectionId, [
        ...(bySection.get(edit.sectionId) ?? []),
        edit,
      ])
    for (const [sectionId, edits] of bySection) {
      let section = sections.find((item) => item.id === sectionId)
      if (!section) {
        const metadata = edits[0].newSection
        if (
          !metadata ||
          metadata.id !== sectionId ||
          !metadata.title.trim() ||
          !metadata.kind.trim()
        )
          throw new Error("A new section needs an explicit location and title.")
        if (edits.length !== 1 || edits[0].action !== "ADD")
          throw new Error("Propose a new section as one addition.")
        section = {
          ...metadata,
          body: [],
          updatedAt: createdAt,
        } as CtnKnowledgeSection
        sections.push(section)
      } else if (edits.some((edit) => edit.newSection))
        throw new Error("An existing section cannot be recreated.")
      const original = [...section.body]
      let offset = 0
      let previousEnd = -1
      let previousStart = -1
      for (const edit of [...edits].sort(
        (a, b) => a.startIndex - b.startIndex
      )) {
        const end = edit.startIndex + edit.currentContent.length
        if (
          edit.startIndex < previousEnd ||
          edit.startIndex === previousStart ||
          end > original.length
        )
          throw new Error(
            "The proposed edits overlap or point outside the section."
          )
        if (
          JSON.stringify(original.slice(edit.startIndex, end)) !==
          JSON.stringify(edit.currentContent)
        )
          throw new Error(
            "The proposed current wording does not match the OKF."
          )
        if (
          (edit.action === "ADD" && edit.currentContent.length) ||
          (edit.action === "UPDATE" && !edit.currentContent.length)
        )
          throw new Error("Invalid addition or replacement.")
        if (
          !edit.reason.trim() ||
          edit.proposedContent.some((line) => !line.trim()) ||
          JSON.stringify(edit.currentContent) ===
            JSON.stringify(edit.proposedContent)
        )
          throw new Error("The proposal does not contain a usable change.")
        if (
          edit.action === "ADD" &&
          edit.proposedContent.some((line) => original.includes(line))
        )
          throw new Error(
            "The addition duplicates existing wording. Review it again."
          )
        const targetIndex = edit.startIndex + offset
        section.body.splice(
          targetIndex,
          edit.currentContent.length,
          ...edit.proposedContent
        )
        navigation.push({
          recordId: file.recordId,
          sectionId,
          anchor: knowledgeAnchor(
            sectionId,
            edit.proposedContent.length ? targetIndex : undefined
          ),
          label: `${base.country} / ${section.title}`,
        })
        offset += edit.proposedContent.length - edit.currentContent.length
        previousEnd = end
        previousStart = edit.startIndex
      }
      section.updatedAt = createdAt
    }
    const currentVersion = existing ? knowledgeVersion(existing.version) : null
    const proposedVersion = existing
      ? nextKnowledgeVersion(existing.version, file.versionImpact)
      : "v1"
    const changedVersion = currentVersion !== proposedVersion
    if (changedVersion && !file.changeLogSummary.trim())
      throw new Error("A knowledge revision needs a short change-log entry.")
    if (!changedVersion && file.changeLogSummary)
      throw new Error("Copyediting must not create a change-log entry.")
    const changeLogEntry = changedVersion
      ? `${proposedVersion} — ${file.changeLogSummary}`
      : null
    return {
      ...file,
      location: knowledgeLocation(file.recordId),
      currentVersion,
      proposedVersion,
      changeLogEntry,
      snapshot: existing ? JSON.stringify(existing) : null,
      nextRecord: {
        ...base,
        version: changedVersion ? proposedVersion : base.version,
        sections,
        updatedAt: createdAt,
        changeLog: changeLogEntry
          ? [
              {
                id: `${id}-${file.recordId}`,
                createdAt,
                source: "chat" as const,
                instruction: file.edits
                  .flatMap((edit) => edit.proposedContent)
                  .join("\n"),
                summary: changeLogEntry,
              },
              ...base.changeLog,
            ]
          : base.changeLog,
      },
    }
  })
  return {
    id,
    classification: analysis.classification,
    approvalRequired: true,
    files,
    navigation,
  }
}

// Browser storage is the existing source of truth. Only the explicit Approve
// handler receives this session's commit capability; analysis cannot write.
export function createKnowledgeReviewSession() {
  let pending: KnowledgePendingProposal | null = null
  return {
    stage(input: unknown, records: CtnKnowledgeCountryRecord[]) {
      pending = null
      pending = prepareKnowledgeProposal(input, records)
      return structuredClone(pending)
    },
    cancel() {
      pending = null
    },
    approve(
      id: string,
      records: CtnKnowledgeCountryRecord[],
      persist: (records: CtnKnowledgeCountryRecord[]) => void
    ) {
      if (!pending || pending.id !== id)
        throw new Error("There is no pending proposal to approve.")
      for (const file of pending.files) {
        const current = records.find((record) => record.id === file.recordId)
        if ((current ? JSON.stringify(current) : null) !== file.snapshot)
          throw new Error(
            "The OKF changed since this proposal. Cancel and request a fresh review."
          )
      }
      const nextRecords = records.map(
        (record) =>
          pending!.files.find((file) => file.recordId === record.id)
            ?.nextRecord ?? record
      )
      nextRecords.push(
        ...pending.files
          .filter((file) => file.newRecord)
          .map((file) => file.nextRecord)
      )
      const result = structuredClone({
        records: nextRecords,
        proposal: pending,
      })
      // A single storage write commits content, versions and history together.
      // Retain the original pending proposal when storage throws, allowing retry.
      persist(result.records)
      pending = null
      return result
    },
  }
}
