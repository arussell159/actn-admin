import { z } from "zod"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
  readKnowledge,
  OkfError,
} from "@/lib/okf/server"
import { reviewUploads } from "@/lib/okf/uploads"
import { stages, type KnowledgeReview } from "@/lib/okf/schema"
import type { MadagascarDocument } from "@/lib/madagascar-bsc"

export async function GET(request: Request) {
  try {
    const { client } = await okfSession()
    const id = new URL(request.url).searchParams.get("id") ?? ""
    const [reviews, corrections, state] = await Promise.all([
      client
        .from("okf_reviews")
        .select("review")
        .eq("request_id", id)
        .order("created_at", { ascending: false }),
      client
        .from("okf_corrections")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: true }),
      readKnowledge(client),
    ])
    databaseError(reviews.error)
    databaseError(corrections.error)
    const latest = reviews.data?.[0]?.review as KnowledgeReview | undefined
    const recheckAvailable =
      !!latest &&
      state.pages.some(
        (p) =>
          p.revision > 0 &&
          (p.country === "Shared" ||
            p.country === latest.observations.country.name) &&
          !latest.revisions.some(
            (r) => r.pageId === p.id && r.revision === p.revision
          )
      )
    return Response.json(
      {
        ok: true,
        reviews: reviews.data?.map((r) => r.review),
        corrections: corrections.data,
        recheckAvailable,
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
    const session = await okfSession("edit")
    const body = await request.json()
    if (body.action === "correct") {
      const parsed = z
        .object({
          requestId: z.string().min(1),
          target: z.string().min(1),
          value: z.string().max(40000),
          reason: z.string().trim().min(1),
          expectedUpdatedAt: z.string(),
          reviewId: z.string().uuid().nullable(),
        })
        .parse(body)
      const { data, error } = await session.client.rpc("okf_correct_request", {
        p_request_id: parsed.requestId,
        p_target: parsed.target,
        p_value: parsed.value,
        p_reason: parsed.reason,
        p_expected_updated_at: parsed.expectedUpdatedAt,
        p_review_id: parsed.reviewId,
      })
      databaseError(error)
      const row = data.request
      return Response.json({
        ok: true,
        correction: data.correction,
        request: {
          id: row.id,
          reference: row.reference,
          country: row.country,
          status: row.status,
          documents: row.documents,
          analysis: row.analysis,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      })
    }
    if (body.action === "recheck") {
      const id = z.string().min(1).parse(body.requestId)
      const stage = z.enum(stages).parse(body.stage)
      const { data, error } = await session.client
        .from("madagascar_bsc_requests")
        .select("documents")
        .eq("id", id)
        .single()
      databaseError(error)
      const files: File[] = []
      for (const doc of data!.documents as MadagascarDocument[]) {
        if (!doc.storagePath)
          throw new OkfError(
            "An original document is only stored locally. Re-upload the shipment documents to run a new review."
          )
        const { data: file, error } = await session.client.storage
          .from("madagascar-bsc")
          .download(doc.storagePath)
        databaseError(error)
        files.push(new File([file!], doc.name, { type: doc.type }))
      }
      const review = await reviewUploads(
        session,
        files,
        id,
        stage,
        new Date().toISOString().slice(0, 10),
        undefined,
        request.signal
      )
      return Response.json({ ok: true, review })
    }
    throw new OkfError("Unknown request action.")
  } catch (error) {
    return okfFailure(error)
  }
}
