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
import type {
  MadagascarAnalysis,
  MadagascarDocument,
} from "@/lib/madagascar-bsc"
import { verifyCorrectionSources } from "@/lib/okf/openai-document-provider"
import {
  correctionLearningReason,
  normalizedCorrectionTarget,
  parseCorrectionLearning,
  type CorrectionSourceLearning,
} from "@/lib/okf/correction-learning"

function requestPayload(row: Record<string, unknown>) {
  return {
    id: row.id,
    reference: row.reference,
    country: row.country,
    status: row.status,
    documents: row.documents,
    analysis: row.analysis,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(request: Request) {
  try {
    const { client } = await okfSession()
    const id = new URL(request.url).searchParams.get("id") ?? ""
    const [reviews, corrections, state, intake] = await Promise.all([
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
      client
        .from("okf_intake")
        .select("result")
        .like("page_id", "correction-learning:%")
        .order("created_at", { ascending: false })
        .limit(500),
    ])
    databaseError(reviews.error)
    databaseError(corrections.error)
    databaseError(intake.error)
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
    const answeredCorrectionIds = new Set(
      (intake.data ?? []).flatMap((entry) => {
        const correctionId = (entry.result as { correctionId?: unknown } | null)
          ?.correctionId
        return typeof correctionId === "string" ? [correctionId] : []
      })
    )
    const sourceQuestions = (corrections.data ?? []).flatMap((correction) => {
      const learning = parseCorrectionLearning(correction.reason)
      return learning &&
        !learning.verified &&
        !answeredCorrectionIds.has(String(correction.id))
        ? [
            {
              correctionId: String(correction.id),
              target: String(correction.target),
              label: learning.label,
              question: `I could not verify ${learning.label} in the uploaded documents. Where did this value come from?`,
            },
          ]
        : []
    })
    return Response.json(
      {
        ok: true,
        reviews: reviews.data?.map((r) => r.review),
        corrections: corrections.data,
        sourceQuestions,
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
    if (body.action === "explain-source") {
      const parsed = z
        .object({
          correctionId: z.string().uuid(),
          explanation: z.string().trim().min(2).max(4000),
        })
        .parse(body)
      const correctionResult = await session.client
        .from("okf_corrections")
        .select("*")
        .eq("id", parsed.correctionId)
        .single()
      databaseError(correctionResult.error)
      const originalLearning = parseCorrectionLearning(
        correctionResult.data!.reason
      )
      if (!originalLearning)
        throw new OkfError("This correction has no pending source question.")
      const requestResult = await session.client
        .from("madagascar_bsc_requests")
        .select("country,analysis")
        .eq("id", correctionResult.data!.request_id)
        .single()
      databaseError(requestResult.error)
      const analysis = requestResult.data!.analysis as MadagascarAnalysis
      const explanation = parsed.explanation.toLocaleLowerCase()
      const aliases: Array<[RegExp, string]> = [
        [/\b(?:bill of lading|rated b\/?l|b\/?l)\b/i, "Bill of Lading"],
        [/\bcommercial invoice\b|\bci\b/i, "Commercial Invoice"],
        [/\bfreight invoice\b/i, "Freight Invoice"],
        [/\bpacking list\b|\bpl\b/i, "Packing List"],
        [/\b(?:export|customs) declaration\b/i, "Export/Customs Declaration"],
        [/\bcertificate of origin\b|\bcoo\b/i, "Certificate of Origin"],
      ]
      const namedType = aliases.find(([pattern]) =>
        pattern.test(explanation)
      )?.[1]
      const sourceDocument = analysis.documents.find(
        (document) =>
          (namedType &&
            (document.documentType === namedType ||
              (namedType === "Export/Customs Declaration" &&
                ["Export Declaration", "Customs Declaration"].includes(
                  document.documentType
                )))) ||
          explanation.includes(document.fileName.toLocaleLowerCase())
      )
      if (!sourceDocument)
        throw new OkfError(
          "I could not match that explanation to an uploaded document. Name the document, such as rated Bill of Lading, Commercial Invoice, or Packing List."
        )
      const resolvedDocumentType =
        sourceDocument.documentType === "Unknown" && namedType
          ? namedType
          : sourceDocument.documentType
      const learning: CorrectionSourceLearning = {
        ...originalLearning,
        verified: true,
        documentType: resolvedDocumentType,
        filename: sourceDocument.fileName,
        supportingText: parsed.explanation,
        confidence: 1,
        basis: "staff explanation",
        explanation: parsed.explanation,
      }
      const intake = await session.client.from("okf_intake").insert({
        page_id: `correction-learning:${parsed.correctionId}`,
        note: parsed.explanation,
        sources: [sourceDocument.fileName],
        result: {
          classification: "staff-confirmed field source",
          correctionId: parsed.correctionId,
          country: String(requestResult.data!.country),
          learning,
        },
      })
      databaseError(intake.error)
      return Response.json({ ok: true, learning })
    }
    if (body.action === "correct-batch") {
      const parsed = z
        .object({
          requestId: z.string().min(1),
          expectedUpdatedAt: z.string(),
          reviewId: z.string().uuid().nullable(),
          edits: z
            .array(
              z.object({
                target: z.string().min(1),
                label: z.string().trim().min(1).max(160),
                value: z.string().max(40000),
              })
            )
            .min(1)
            .max(50),
        })
        .parse(body)
      const requestResult = await session.client
        .from("madagascar_bsc_requests")
        .select("*")
        .eq("id", parsed.requestId)
        .single()
      databaseError(requestResult.error)
      const savedRequest = requestResult.data! as Record<string, unknown> & {
        country: string
        documents: MadagascarDocument[]
        analysis: MadagascarAnalysis
      }
      const documentTypes = new Map(
        savedRequest.analysis.documents.map((document) => [
          document.fileName,
          document.documentType,
        ])
      )
      const retainedDocuments: Array<{ file: File; documentType: string }> = []
      for (const document of savedRequest.documents) {
        if (!document.storagePath) continue
        const downloaded = await session.client.storage
          .from("madagascar-bsc")
          .download(document.storagePath)
        if (downloaded.error || !downloaded.data) continue
        retainedDocuments.push({
          file: new File([downloaded.data], document.name, {
            type: document.type,
          }),
          documentType: documentTypes.get(document.name) ?? "Unknown",
        })
      }
      const candidates = await verifyCorrectionSources(
        retainedDocuments,
        parsed.edits.filter((edit) => edit.value.trim()),
        request.signal
      ).catch((error) => {
        if (request.signal.aborted) throw error
        console.error("Correction source verification failed", error)
        return []
      })
      const candidatesByTarget = new Map(
        candidates.map((candidate) => [candidate.target, candidate])
      )
      let expectedUpdatedAt = parsed.expectedUpdatedAt
      let latestRow = savedRequest
      const corrections: unknown[] = []
      const sourceLearnings: CorrectionSourceLearning[] = []
      const sourceQuestions: Array<{
        correctionId: string
        target: string
        label: string
        question: string
      }> = []
      for (const edit of parsed.edits) {
        const candidate = candidatesByTarget.get(edit.target)
        const learning: CorrectionSourceLearning = {
          version: 1,
          target: normalizedCorrectionTarget(edit.target),
          label: edit.label,
          verified: Boolean(candidate),
          documentType: candidate?.documentType ?? "",
          filename: candidate?.filename ?? "",
          page: candidate?.page ?? null,
          supportingText: candidate?.supportingText ?? "",
          matchedValue: candidate?.matchedValue ?? edit.value,
          confidence: candidate?.confidence ?? 0,
          basis: candidate ? "document evidence" : undefined,
        }
        const result = await session.client.rpc("okf_correct_request", {
          p_request_id: parsed.requestId,
          p_target: edit.target,
          p_value: edit.value,
          p_reason: correctionLearningReason(savedRequest.country, learning),
          p_expected_updated_at: expectedUpdatedAt,
          p_review_id: parsed.reviewId,
        })
        databaseError(result.error)
        latestRow = result.data.request
        expectedUpdatedAt = String(latestRow.updated_at)
        if (result.data.correction) corrections.push(result.data.correction)
        if (!candidate && result.data.correction)
          sourceQuestions.push({
            correctionId: String(result.data.correction.id),
            target: edit.target,
            label: edit.label,
            question: `I could not verify ${edit.label} in the uploaded documents. Where did this value come from?`,
          })
        sourceLearnings.push(learning)
      }
      return Response.json({
        ok: true,
        corrections,
        sourceLearnings,
        sourceQuestions,
        request: requestPayload(latestRow),
      })
    }
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
        request: requestPayload(row),
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
