import { z } from "zod"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
  readKnowledge,
  OkfError,
} from "@/lib/okf/server"
import {
  draftInputSchema,
  type KnowledgeDraft,
  type KnowledgeState,
} from "@/lib/okf/schema"
import { nextVersion, validateChanges } from "@/lib/okf/engine"
import { getMadagascarDropdownOptions } from "@/lib/madagascar-bsc-server"
import {
  correctionLearningKey,
  normalizeCorrectionLearning,
  parseCorrectionLearning,
  type VisibleCorrectionLearning,
} from "@/lib/okf/correction-learning"
import { buildOkfBundle, buildOkfSearchIndex } from "@/lib/okf/bundle"
import {
  publishKnowledgeDraft,
  saveKnowledgeDraft,
} from "@/lib/okf/write-service"

export async function GET() {
  try {
    const session = await okfSession()
    const [
      state,
      drafts,
      history,
      options,
      intake,
      corrections,
      requests,
      layouts,
      learningIntake,
    ] = await Promise.all([
      readKnowledge(session.client),
      session.client
        .from("okf_drafts")
        .select("*")
        .eq("status", "pending")
        .order("updated_at", { ascending: false }),
      session.client
        .from("okf_publications")
        .select("*")
        .order("created_at", { ascending: false }),
      getMadagascarDropdownOptions(),
      session.client
        .from("okf_intake")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      session.client
        .from("okf_corrections")
        .select("request_id,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      session.client
        .from("madagascar_bsc_requests")
        .select("id,country")
        .limit(1000),
      session.client
        .from("okf_certificate_layouts")
        .select("layout")
        .limit(300),
      session.client
        .from("okf_intake")
        .select("result,created_at")
        .like("page_id", "correction-learning:%")
        .order("created_at", { ascending: false })
        .limit(1000),
    ])
    databaseError(drafts.error)
    databaseError(history.error)
    databaseError(intake.error)
    databaseError(corrections.error)
    databaseError(requests.error)
    databaseError(layouts.error)
    databaseError(learningIntake.error)
    const countries = new Map(
      (requests.data ?? []).map((row) => [String(row.id), String(row.country)])
    )
    const learnedKeys = new Set<string>()
    const sourceLearnings: VisibleCorrectionLearning[] = []
    for (const entry of learningIntake.data ?? []) {
      const result = entry.result as
        | {
            country?: unknown
            learning?: VisibleCorrectionLearning
          }
        | undefined
      const learning = result?.learning
        ? normalizeCorrectionLearning(result.learning)
        : undefined
      const country = typeof result?.country === "string" ? result.country : ""
      if (learning?.version !== 1 || !country) continue
      const visibleLearning =
        learning.basis === "reasoned inference" &&
        (learning.occurrences ?? 0) < 2
          ? normalizeCorrectionLearning({ ...learning, verified: false })
          : learning
      const key = correctionLearningKey(country, visibleLearning)
      if (learnedKeys.has(key)) continue
      learnedKeys.add(key)
      sourceLearnings.push({
        ...visibleLearning,
        country,
        createdAt: String(entry.created_at),
      })
    }
    const patternRequests = new Map<string, Set<string>>()
    for (const correction of corrections.data ?? []) {
      const learning = parseCorrectionLearning(correction.reason)
      const country = countries.get(String(correction.request_id)) ?? ""
      const signature = learning?.relatedTarget
        ? `relation:${learning.relatedTarget}`
        : learning?.verified && learning.missedReason && learning.documentType
          ? `document:${learning.documentType}`
          : ""
      if (!learning || !country || !signature) continue
      const key = `${country.toLocaleLowerCase()}:${learning.target.toLocaleLowerCase()}:${signature.toLocaleLowerCase()}`
      const requestIds = patternRequests.get(key) ?? new Set<string>()
      requestIds.add(String(correction.request_id))
      patternRequests.set(key, requestIds)
    }
    for (const correction of corrections.data ?? []) {
      const parsedLearning = parseCorrectionLearning(correction.reason)
      const country = countries.get(String(correction.request_id)) ?? ""
      if (!parsedLearning || !country) continue
      const signature = parsedLearning.relatedTarget
        ? `relation:${parsedLearning.relatedTarget}`
        : parsedLearning.verified &&
            parsedLearning.missedReason &&
            parsedLearning.documentType
          ? `document:${parsedLearning.documentType}`
          : ""
      const patternKey = `${country.toLocaleLowerCase()}:${parsedLearning.target.toLocaleLowerCase()}:${signature.toLocaleLowerCase()}`
      const occurrences = signature
        ? (patternRequests.get(patternKey)?.size ?? 0)
        : 0
      const learning =
        occurrences >= 2
          ? normalizeCorrectionLearning({
              ...parsedLearning,
              verified: true,
              basis: "reasoned inference",
              occurrences,
              reasoning: parsedLearning.relatedTarget
                ? `${parsedLearning.label} matched ${parsedLearning.relatedLabel || parsedLearning.relatedTarget} on ${occurrences} independent requests.`
                : `${parsedLearning.missedReason} This was verified on ${occurrences} independent requests.`,
              reproduction: parsedLearning.relatedTarget
                ? `Use the current request's ${parsedLearning.relatedLabel || parsedLearning.relatedTarget} value only when the same relationship is supported.`
                : `Check ${parsedLearning.documentType} for the same label, section, or format before marking ${parsedLearning.label} missing.`,
            })
          : parsedLearning
      const key = correctionLearningKey(country, learning)
      if (learnedKeys.has(key)) {
        const existingIndex = sourceLearnings.findIndex(
          (item) => correctionLearningKey(item.country, item) === key
        )
        const existing = sourceLearnings[existingIndex]
        const rank = (item: VisibleCorrectionLearning) =>
          (item.occurrences ?? 0) >= 2 ? 3 : item.verified ? 2 : 1
        const candidate = {
          ...learning,
          country,
          createdAt: String(correction.created_at),
        }
        if (existing && rank(candidate) > rank(existing))
          sourceLearnings[existingIndex] = candidate
        continue
      }
      learnedKeys.add(key)
      sourceLearnings.push({
        ...learning,
        country,
        createdAt: String(correction.created_at),
      })
    }
    return Response.json(
      {
        ok: true,
        state,
        bundle: buildOkfBundle(state),
        searchIndex: buildOkfSearchIndex(state),
        drafts: drafts.data,
        history: history.data,
        intake: intake.data,
        sourceLearnings,
        layoutCountries: (layouts.data ?? []).flatMap((row) => {
          const country = (row.layout as { country?: unknown } | null)?.country
          return typeof country === "string" && country.trim()
            ? [country.trim()]
            : []
        }),
        layoutDefinitions: (layouts.data ?? []).flatMap((row) => {
          const layout = row.layout as {
            country?: unknown
            fields?: { sourceDocument?: unknown }[]
          } | null
          if (typeof layout?.country !== "string" || !layout.country.trim())
            return []
          return [
            {
              country: layout.country.trim(),
              fields: (layout.fields ?? []).flatMap((field) => {
                const value = field as Record<string, unknown>
                return typeof value.id === "string" &&
                  typeof value.label === "string" &&
                  typeof value.sourceDocument === "string" &&
                  value.sourceDocument.trim()
                  ? [
                      {
                        id: value.id,
                        label: value.label,
                        sourceDocument: value.sourceDocument.trim(),
                        instruction:
                          typeof value.instruction === "string"
                            ? value.instruction
                            : "",
                      },
                    ]
                  : []
              }),
            },
          ]
        }),
        options,
        userId: session.user.id,
        canEdit: session.canEdit,
        canPublish: session.canPublish,
        development: session.development,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const raw = await request.text()
    if (raw.length > 2_000_000) throw new OkfError("Change set is too large.")
    const body = JSON.parse(raw)
    const session = await okfSession(
      body.action === "publish"
        ? "publish"
        : body.action === "preview"
          ? "read"
          : "edit"
    )
    const { client } = session
    if (body.action === "propose-structure") {
      const proposal = z
        .object({
          change: z.string().trim().min(1).max(12000),
          migration: z.string().trim().min(1).max(12000),
        })
        .parse(body)
      const result = await client.from("okf_intake").insert({
        page_id: "standards",
        note: proposal.change,
        sources: [],
        result: {
          classification: "structural proposal",
          message: `Consumer migration: ${proposal.migration}`,
          question:
            "Requires an explicit structural release. No page or form changes have been published.",
          draftId: null,
        },
      })
      databaseError(result.error)
      return Response.json({ ok: true })
    }
    if (body.action === "save") {
      const input = draftInputSchema.parse(body.draft)
      const saved = await saveKnowledgeDraft(client, input)
      if (saved.duplicate) {
        if (input.expectedEdit > 0) {
          const discarded = await client.rpc("okf_draft_action", {
            p_id: input.id,
            p_edit: input.expectedEdit,
            p_action: "discard",
          })
          databaseError(discarded.error)
        }
        return Response.json({
          ok: true,
          duplicate: true,
          message: "Already covered",
        })
      }
      return Response.json({ ok: true, draft: saved.draft })
    }
    if (body.action === "preview" || body.action === "publish") {
      const id = z.string().uuid().parse(body.id)
      const { data, error } = await client.rpc("okf_preview", { p_id: id })
      databaseError(error)
      const preview = data as {
        state: KnowledgeState
        draft: KnowledgeDraft
        token: string
      }
      const changes = validateChanges(preview.state, preview.draft.changes)
      if (body.action === "preview")
        return Response.json({
          ok: true,
          ...preview,
          stale: preview.state.generation !== preview.draft.base_generation,
          comparisons: changes.map((c) => {
            const page = preview.state.pages.find((p) => p.id === c.pageId)!
            return {
              pageId: page.id,
              title: page.title,
              before: page.content,
              after: c.content,
              currentVersion: page.version,
              proposedVersion: nextVersion(page.version, c.level),
              mappingChanged:
                JSON.stringify(page.content.mappings) !==
                JSON.stringify(c.content.mappings),
            }
          }),
        })
      const publication = await publishKnowledgeDraft(client, {
        id,
        token: z.string().min(1).parse(body.token),
      })
      return Response.json({ ok: true, publication })
    }
    if (body.action === "discard") {
      const result = await client.rpc("okf_draft_action", {
        p_id: z.string().uuid().parse(body.id),
        p_edit: z.number().int().parse(body.edit),
        p_action: "discard",
      })
      databaseError(result.error)
      return Response.json({ ok: true })
    }
    throw new OkfError("Unknown OKF action.")
  } catch (error) {
    return okfFailure(error)
  }
}
