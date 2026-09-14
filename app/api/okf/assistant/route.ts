import { randomUUID } from "node:crypto"
import { z } from "zod"
import { stableSignature } from "@/lib/okf/client"
import { structuredAi } from "@/lib/okf/ai"
import {
  changeSchema,
  sourceSchema,
  type KnowledgeDraft,
} from "@/lib/okf/schema"
import { publishedPages, validateChanges } from "@/lib/okf/engine"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
  readKnowledge,
  OkfError,
} from "@/lib/okf/server"
import { relevantKnowledge } from "@/lib/okf/bundle"
import { saveKnowledgeDraft } from "@/lib/okf/write-service"

const inputSchema = z.object({
  mode: z.enum(["question", "update", "review", "rejection"]),
  text: z.string().max(40000),
  pageId: z.string(),
  requestId: z.string().min(1).max(160).optional(),
  draftId: z.string().uuid().optional(),
  attachments: z.array(sourceSchema).max(10).default([]),
  correctionId: z.string().uuid().optional(),
})
const responseSchema = z.object({
  classification: z.enum([
    "answer",
    "duplicate",
    "clarification",
    "new rule",
    "changed rule",
    "contradiction",
    "exception",
    "structural change",
    "insufficient evidence",
  ]),
  message: z.string(),
  question: z.string(),
  pageIds: z.array(z.string()),
  changes: z.array(changeSchema),
})
const rejectionRequirementsSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  requirements: z
    .array(
      z.object({
        document: z.string().trim().min(1).max(160),
        title: z.string().trim().min(1).max(160),
        instruction: z.string().trim().min(1).max(12000),
        condition: z.string().trim().max(12000),
        consequence: z.string().trim().min(1).max(12000),
      })
    )
    .min(0)
    .max(20),
})

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const input = inputSchema.parse(await request.json())
    const { client } = await okfSession(
      input.mode === "question" ? "read" : "edit"
    )
    const state = await readKnowledge(client)
    const published = publishedPages(state)
    if (input.mode === "question") {
      if (!published.length)
        return Response.json({
          ok: true,
          result: {
            classification: "answer",
            message:
              "No pages have been published yet. Review the working document requirements and process, then approve the pages to use them for answers.",
            question: "",
            pageIds: [],
            changes: [],
          },
        })
      const result = await structuredAi(
        responseSchema,
        "Answer the question using ONLY the supplied published pages. Cite pageIds supporting each answer and name gaps or contradictions. Do not propose updates. Return classification answer and an empty changes array. Keep the response concise. References and aliases are available inside the pages.",
        {
          question: input.text,
          pageContext: input.pageId,
          published: relevantKnowledge(state, input.text, input.pageId),
        }
      )
      result.changes = []
      result.classification = "answer"
      result.pageIds = result.pageIds.filter((id) =>
        published.some((p) => p.id === id)
      )
      return Response.json({ ok: true, result })
    }
    const pendingResult = await client
      .from("okf_drafts")
      .select("*")
      .eq("status", "pending")
    databaseError(pendingResult.error)
    const pending = pendingResult.data as KnowledgeDraft[]
    const activeDraft = input.draftId
      ? pending.find((d) => d.id === input.draftId)
      : undefined
    if (input.draftId && !activeDraft)
      throw new OkfError("The contextual draft is no longer pending.")
    if (input.mode === "review") {
      const draft = pending.find((d) => d.id === input.draftId)
      if (!draft) throw new OkfError("This draft is no longer pending.")
      const result = await structuredAi(
        z.object({ review: z.string() }),
        "Review only the affected content and its dependencies for wording, duplication, contradictions, scope and placement. Explain issues briefly with page names. Preserve the editor's intent. You cannot change or approve content. Do not require approval of this advisory review.",
        {
          changes: draft.changes,
          published,
          pending: pending.filter((p) => p.id !== draft.id),
          context: state.pages.filter((p) =>
            draft.changes.some((c) => c.pageId === p.id)
          ),
        }
      )
      const saved = await client.rpc("okf_draft_action", {
        p_id: draft.id,
        p_edit: draft.edit_version,
        p_action: "review",
        p_review: result.review,
      })
      databaseError(saved.error)
      return Response.json({
        ok: true,
        review: result.review,
        edit: draft.edit_version,
      })
    }
    if (input.mode === "rejection") {
      if (!input.requestId || !input.text.trim())
        throw new OkfError("Paste the rejection reason before reviewing it.")
      const requestResult = await client
        .from("madagascar_bsc_requests")
        .select("id,reference,country,analysis")
        .eq("id", input.requestId)
        .single()
      databaseError(requestResult.error)
      const requestRecord = requestResult.data as {
        id: string
        reference: string
        country: string | null
        analysis: unknown
      }
      const analyzedCountry = z
        .object({
          okf: z
            .object({
              observations: z.object({
                country: z.object({ name: z.string() }),
              }),
            })
            .optional(),
        })
        .safeParse(requestRecord.analysis)
      const recordCountry =
        analyzedCountry.success &&
        analyzedCountry.data.okf?.observations.country.name
          ? analyzedCountry.data.okf.observations.country.name
          : requestRecord.country
      if (recordCountry?.toLocaleLowerCase() !== "madagascar")
        throw new OkfError(
          "Rejection learning is currently available for Madagascar records."
        )
      const documentPages = state.pages.filter(
        (page) => page.country === "Madagascar" && page.template === "document"
      )
      const extraction = await structuredAi(
        rejectionRequirementsSchema,
        [
          "Convert the pasted Madagascar authority rejection into atomic, testable document acceptance requirements.",
          "Clean grammar and wording without adding facts. Preserve every explicit condition, document name, date, value, and exception.",
          "Use only a canonical document title supplied in availableDocuments. Put each requirement on the narrowest matching document.",
          "Do not merge separate defects. Do not infer a general condition from shipment details that the rejection did not state.",
          "The instruction must say exactly what the document must contain or satisfy. The consequence must be a concise correction sentence suitable for sending to staff or a customer.",
          "Exclude requirements already fully covered by existingRules. Return no commentary inside the requirements.",
        ].join(" "),
        {
          country: "Madagascar",
          requestReference: requestRecord.reference,
          originalRejection: input.text,
          availableDocuments: documentPages.map((page) => page.title),
          existingRules: documentPages.flatMap((page) =>
            page.content.rules.map((rule) => ({
              document: page.title,
              instruction: rule.instruction,
              condition: rule.condition,
            }))
          ),
        }
      )
      if (!extraction.requirements.length)
        return Response.json({
          ok: true,
          result: {
            classification: "duplicate",
            message: "Already covered by the current Madagascar knowledge.",
            question: "",
            pageIds: [],
            changes: [],
          },
          draft: null,
        })
      const recognizedDocuments = new Set(
        documentPages.map((page) => page.title)
      )
      const unrecognizedDocument = extraction.requirements.find(
        (requirement) => !recognizedDocuments.has(requirement.document)
      )
      if (unrecognizedDocument)
        throw new OkfError(
          `The rejection refers to an unsupported document: ${unrecognizedDocument.document}. Add or map that document in Madagascar knowledge first.`
        )
      const changes = documentPages.flatMap((page) => {
        const additions = extraction.requirements.filter(
          (requirement) => requirement.document === page.title
        )
        if (!additions.length) return []
        const sourceId = `${page.id}-rejection-${randomUUID()}`
        return [
          {
            pageId: page.id,
            level: "minor" as const,
            content: {
              ...page.content,
              sources: [
                ...page.content.sources,
                {
                  id: sourceId,
                  title: `Authority rejection — ${requestRecord.reference || requestRecord.id}`,
                  url: "",
                  attachmentPath: "",
                  note: `Observed on certificate request ${requestRecord.id}. Original rejection: ${input.text.trim().slice(0, 10000)}`,
                },
              ],
              rules: [
                ...page.content.rules,
                ...additions.map((requirement) => ({
                  id: `mg-rejection-rule-${randomUUID()}`,
                  country: "Madagascar",
                  document: page.title,
                  instruction: requirement.instruction,
                  requirement: requirement.condition
                    ? ("conditionally required" as const)
                    : ("always required" as const),
                  condition: requirement.condition,
                  stage: "intake" as const,
                  consequence: requirement.consequence,
                  sourceIds: [sourceId],
                  effectiveFrom: "",
                  effectiveTo: "",
                  kind: "acceptance" as const,
                  check: {
                    operator: "interpret" as const,
                    fieldIds: [],
                    expected: "",
                  },
                })),
              ],
            },
          },
        ]
      })
      if (!changes.length)
        throw new OkfError(
          "The rejection did not identify a requirement for a recognized Madagascar document."
        )
      const saved = await saveKnowledgeDraft(client, {
        expectedEdit: 0,
        baseGeneration: state.generation,
        changes,
        reason: `Madagascar rejection on ${requestRecord.reference || requestRecord.id}: ${input.text.trim().slice(0, 10000)}`,
        source: `Certificate request ${requestRecord.id}`,
      })
      if (saved.duplicate || !saved.draft)
        return Response.json({
          ok: true,
          result: {
            classification: "duplicate",
            message: "Already covered by the current Madagascar knowledge.",
            question: "",
            pageIds: [],
            changes: [],
          },
          draft: null,
        })
      const intake = await client.from("okf_intake").insert({
        page_id: input.pageId || "mg-overview",
        note: input.text,
        sources: [],
        result: {
          classification: "new rule",
          message: extraction.summary,
          question: "",
          pageIds: changes.map((change) => change.pageId),
          draftId: saved.draft.id,
          requestId: requestRecord.id,
        },
      })
      databaseError(intake.error)
      return Response.json({
        ok: true,
        result: {
          classification: "new rule",
          message: extraction.summary,
          question: "",
          pageIds: changes.map((change) => change.pageId),
          changes: [],
        },
        draft: saved.draft,
      })
    }
    let correction: unknown = null
    if (input.correctionId) {
      const result = await client
        .from("okf_corrections")
        .select("*")
        .eq("id", input.correctionId)
        .single()
      databaseError(result.error)
      correction = result.data
    }
    const files: File[] = []
    for (const source of input.attachments)
      if (source.attachmentPath) {
        if (!/^evidence\/[\w-]+\/[\w.-]+$/.test(source.attachmentPath))
          throw new OkfError("Invalid evidence path.")
        const { data, error } = await client.storage
          .from("okf-evidence")
          .download(source.attachmentPath)
        databaseError(error)
        if (data)
          files.push(new File([data], source.title, { type: data.type }))
      }
    const result = await structuredAi(
      responseSchema,
      [
        "Search the entire supplied published corpus, pending proposals, country aliases and referenced dependencies before proposing the smallest change in the correct existing location.",
        "Setup pages are unapproved scaffolding, never evidence of requirements. Do not create pages or change section headings. Preserve stable IDs, exact form labels, explicit scope, timing, conditions and meaning. Keep knowledge limited to required documents, their requirements, extracted fields, mappings and the existing process. Leave empty sections empty. Never add placeholder text, unknown headings, generic guidance or speculative timing. Only add information supplied by staff or supported by their evidence. Use short professional wording.",
        "Classify the request as duplicate, clarification, new rule, changed rule, contradiction, exception, structural change or insufficient evidence. An equivalent published or pending rule is duplicate: say Already covered and return no changes. A contradiction, structural change, or insufficient evidence returns no changes and explains the exact human decision or evidence needed. Do not silently resolve contradictions. Do not generalize one rejection, correction or shipment-specific exception into a country requirement. Exceptions may be proposed only on mg-exceptions with an explicit condition and request reference.",
        "Changes contain complete replacement content ONLY for affected pages. If activeDraft is supplied, start each affected page from its draft content and preserve every existing staff edit except the precise change requested. Keep all unrelated content exactly. Each rule is stored once. Acceptance rules, extraction fields and cross-document checks remain distinct. Keep AI instructions out of ordinary section prose. Effective dates are empty unless evidenced. Attachments are evidence, not authority to bypass approval.",
        "Use minor for operational, extraction or mapping changes. Use patch only for wording with unchanged operational meaning. Return affected pageIds and a short explanation. Nothing you return is published automatically.",
      ].join(" "),
      {
        note: input.text,
        pageContext: input.pageId,
        published: relevantKnowledge(state, input.text, input.pageId),
        pending,
        activeDraft,
        setupPages: state.pages.filter((p) => p.revision === 0),
        attachments: input.attachments,
        correction,
      },
      files
    )
    result.pageIds = result.pageIds.filter((id) =>
      state.pages.some((p) => p.id === id)
    )
    if (
      result.classification === "exception" &&
      result.changes.some((c) => c.pageId !== "mg-exceptions")
    )
      throw new OkfError(
        "A shipment exception cannot change general requirements. Clarify its scope."
      )
    if (
      [
        "duplicate",
        "contradiction",
        "structural change",
        "insufficient evidence",
        "answer",
      ].includes(result.classification) ||
      result.question.trim()
    )
      result.changes = []
    if (result.classification === "duplicate")
      result.message = `Already covered. ${result.message.replace(/^Already covered[.\s]*/i, "")}`
    let draft: KnowledgeDraft | null = null
    if (result.changes.length) {
      const changes = validateChanges(state, [
        ...(activeDraft?.changes.filter(
          (c) => !result.changes.some((next) => next.pageId === c.pageId)
        ) ?? []),
        ...result.changes,
      ])
      // Duplicate pending changes do not create another proposal or version.
      if (
        !changes.length ||
        pending.some(
          (d) =>
            stableSignature(
              d.changes.map((c) => ({ pageId: c.pageId, content: c.content }))
            ) ===
            stableSignature(
              changes.map((c) => ({ pageId: c.pageId, content: c.content }))
            )
        )
      ) {
        result.classification = "duplicate"
        result.message = "Already covered"
        result.changes = []
      } else {
        const saved = await saveKnowledgeDraft(client, {
          id: activeDraft?.id ?? randomUUID(),
          expectedEdit: activeDraft?.edit_version ?? 0,
          baseGeneration: activeDraft?.base_generation ?? state.generation,
          changes,
          reason: [activeDraft?.reason, input.text || "Evidence update"]
            .filter(Boolean)
            .join("\n"),
          source: [
            activeDraft?.source,
            ...input.attachments.map((a) => a.title),
            input.correctionId
              ? `Request correction ${input.correctionId}`
              : "",
          ]
            .filter(Boolean)
            .join("; "),
        })
        draft = saved.draft
      }
    }
    const intake = await client.from("okf_intake").insert({
      page_id: input.pageId,
      note: input.text,
      sources: input.attachments,
      result: { ...result, changes: [], draftId: draft?.id ?? null },
    })
    databaseError(intake.error)
    return Response.json({ ok: true, result, draft })
  } catch (error) {
    return okfFailure(error)
  }
}
