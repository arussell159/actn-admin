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
import {
  nextVersion,
  validateChanges,
  validatePublicationDependencies,
} from "@/lib/okf/engine"
import { getMadagascarDropdownOptions } from "@/lib/madagascar-bsc-server"
import {
  parseCorrectionLearning,
  type VisibleCorrectionLearning,
} from "@/lib/okf/correction-learning"

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
      const country = typeof result?.country === "string" ? result.country : ""
      if (learning?.version !== 1 || !learning.verified || !country) continue
      const key = `${country}:${learning.target}:${learning.documentType}`
      if (learnedKeys.has(key)) continue
      learnedKeys.add(key)
      sourceLearnings.push({
        ...learning,
        country,
        createdAt: String(entry.created_at),
      })
    }
    for (const correction of corrections.data ?? []) {
      const learning = parseCorrectionLearning(correction.reason)
      const country = countries.get(String(correction.request_id)) ?? ""
      if (!learning?.verified || !country) continue
      const key = `${country}:${learning.target}:${learning.documentType}`
      if (learnedKeys.has(key)) continue
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
      const state = await readKnowledge(client)
      if (state.generation !== input.baseGeneration)
        throw new OkfError(
          "Published content changed. Refresh the comparison before saving.",
          409
        )
      const changes = validateChanges(state, input.changes)
      if (!changes.length) {
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
      const { data, error } = await client.rpc("okf_save_draft", {
        p_id: input.id,
        p_expected_edit: input.expectedEdit,
        p_base_generation: input.baseGeneration,
        p_changes: changes,
        p_reason: input.reason,
        p_source: input.source,
      })
      databaseError(error)
      return Response.json({ ok: true, draft: data })
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
      if (
        body.token !== preview.token ||
        preview.state.generation !== preview.draft.base_generation
      )
        throw new OkfError("Comparison is stale. Refresh before approval.", 409)
      validatePublicationDependencies(preview.state, changes)
      const result = await client.rpc("okf_publish", {
        p_id: id,
        p_token: z.string().min(1).parse(body.token),
      })
      databaseError(result.error)
      return Response.json({ ok: true, publication: result.data })
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
