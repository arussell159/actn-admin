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
    if (body.action === "save-goods-table") {
      const parsed = z
        .object({
          requestId: z.string().min(1),
          expectedUpdatedAt: z.string(),
          items: z
            .array(
              z.record(
                z.string().max(160),
                z.union([z.string().max(40000), z.array(z.string().max(4000))])
              )
            )
            .max(1000),
        })
        .parse(body)
      const current = await session.client
        .from("madagascar_bsc_requests")
        .select("analysis")
        .eq("id", parsed.requestId)
        .eq("updated_at", parsed.expectedUpdatedAt)
        .single()
      databaseError(current.error)
      const analysis = current.data!.analysis as MadagascarAnalysis
      const result = await session.client
        .from("madagascar_bsc_requests")
        .update({
          analysis: { ...analysis, invoiceItems: parsed.items },
          status: "Needs review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.requestId)
        .eq("updated_at", parsed.expectedUpdatedAt)
        .select("*")
        .single()
      databaseError(result.error)
      return Response.json({ ok: true, request: requestPayload(result.data!) })
    }
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
      if (namedType && !sourceDocument)
        throw new OkfError(
          "That document was not found in this shipment. Check its name, or explain the calculation, field relationship, or assumption instead."
        )
      const resolvedDocumentType =
        sourceDocument?.documentType === "Unknown" && namedType
          ? namedType
          : sourceDocument?.documentType || "Workflow reasoning"
      const reasonedInference = !sourceDocument
      const assumption =
        /\b(?:assum|default|best judgement|best judgment|normally|usually)\b/i.test(
          parsed.explanation
        )
      const learning: CorrectionSourceLearning = {
        ...originalLearning,
        verified: true,
        documentType: resolvedDocumentType,
        filename: sourceDocument?.fileName ?? "",
        supportingText: parsed.explanation,
        confidence: 1,
        basis: reasonedInference ? "reasoned inference" : "staff explanation",
        explanation: parsed.explanation,
        reasoning: parsed.explanation,
        reproduction: reasonedInference
          ? `${parsed.explanation} Apply this only when the same relationship is present in the current shipment; otherwise ask for confirmation.`
          : undefined,
        assumption,
      }
      const intake = await session.client.from("okf_intake").insert({
        page_id: `correction-learning:${parsed.correctionId}`,
        note: parsed.explanation,
        sources: sourceDocument ? [sourceDocument.fileName] : [],
        result: {
          classification: reasonedInference
            ? "staff-confirmed decision rule"
            : "staff-confirmed field source",
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
      for (const edit of parsed.edits) {
        const candidate = candidatesByTarget.get(edit.target)
        const relatedField = !candidate
          ? savedRequest.analysis.fields.find(
              (field) =>
                field.key !== edit.target &&
                Boolean(edit.value.trim()) &&
                field.value.trim().toLocaleLowerCase() ===
                  edit.value.trim().toLocaleLowerCase()
            )
          : undefined
        const learning: CorrectionSourceLearning = {
          version: 1,
          target: normalizedCorrectionTarget(edit.target),
          label: edit.label,
          verified: Boolean(candidate?.missedReason),
          documentType: candidate?.documentType ?? "",
          filename: candidate?.filename ?? "",
          page: candidate?.page ?? null,
          supportingText: candidate?.supportingText ?? "",
          matchedValue: candidate?.matchedValue ?? edit.value,
          confidence: candidate?.confidence ?? 0,
          basis: candidate
            ? "document evidence"
            : relatedField
              ? "observed correction"
              : undefined,
          relatedTarget: relatedField?.key,
          relatedLabel: relatedField?.label,
          missedReason: candidate?.missedReason ?? undefined,
          reasoning:
            candidate?.missedReason ||
            (relatedField
              ? `The corrected value matches ${relatedField.label}. This is one observation, not a rule.`
              : "The documents were rescanned, but the reason for the miss could not be verified."),
          reproduction: candidate?.missedReason
            ? `For ${edit.label}, also check ${candidate.documentType} for the cited label, section, or format.`
            : relatedField
              ? `Compare ${edit.label} with ${relatedField.label} only after this relationship repeats on another request.`
              : "Do not create a rule from this correction unless comparable evidence is found again.",
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
        sourceLearnings.push(learning)
      }
      return Response.json({
        ok: true,
        corrections,
        sourceLearnings,
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
