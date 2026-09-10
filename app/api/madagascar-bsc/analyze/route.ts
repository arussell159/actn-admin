import { z } from "zod"
import { ensureSameOrigin, okfFailure, okfSession } from "@/lib/okf/server"
import { reviewToAnalysis, reviewUploads } from "@/lib/okf/uploads"
import { stages } from "@/lib/okf/schema"

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const session = await okfSession("edit")
    const data = await request.formData()
    const files = data
      .getAll("files")
      .filter((value): value is File => value instanceof File)
    const requestId = z.string().min(1).max(160).parse(data.get("requestId"))
    const stage = z.enum(stages).parse(data.get("stage") || "intake")
    const date = new Date().toISOString().slice(0, 10)

    if (data.get("stream") === "true") {
      const encoder = new TextEncoder()
      let lastAnalysis: ReturnType<typeof reviewToAnalysis> | undefined
      let streamCancelled = false
      const operationController = new AbortController()
      const cancelFromRequest = () => {
        streamCancelled = true
        operationController.abort(request.signal.reason)
      }
      request.signal.addEventListener("abort", cancelFromRequest, {
        once: true,
      })
      if (request.signal.aborted) cancelFromRequest()
      const body = new ReadableStream({
        start(controller) {
          const send = (event: unknown) => {
            if (!streamCancelled)
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
          }

          void (async () => {
            try {
              send({
                type: "progress",
                label: "Finding the consignee country on the Bill of Lading",
              })
              const review = await reviewUploads(
                session,
                files,
                requestId,
                stage,
                date,
                (progress) => {
                  const partialFields = progress.partialFields ?? []
                  for (const partialField of partialFields) {
                    send({
                      type: "field-delta",
                      label: progress.label,
                      fieldKey: partialField.fieldKey,
                      value: partialField.value,
                    })
                  }
                  if (partialFields.length) return
                  if (!progress.review) return
                  const analysis = reviewToAnalysis(progress.review)
                  lastAnalysis = analysis
                  send({
                    type: progress.stage,
                    label: progress.label,
                    analysis,
                  })
                  const fieldKeys = progress.fieldKeys.flatMap((fieldKey) => {
                    if (fieldKey === "invoiceValues")
                      return analysis.invoiceValues.flatMap((field, index) =>
                        field.status === "extracted" && field.value.trim()
                          ? [`invoiceValue:${index}`]
                          : []
                      )
                    // Line-item completeness can only be judged after every
                    // document pass and reconciliation have finished.
                    if (fieldKey.startsWith("invoiceItems.")) return []
                    const field = analysis.fields.find(
                      (candidate) => candidate.key === fieldKey
                    )
                    return field?.status === "extracted" && field.value.trim()
                      ? [fieldKey]
                      : []
                  })
                  for (const fieldKey of new Set(fieldKeys)) {
                    send({
                      type: "field",
                      label: progress.label,
                      fieldKey,
                      analysis,
                    })
                  }
                },
                operationController.signal
              )
              send({
                type: "complete",
                label: "Certificate review ready",
                analysis: reviewToAnalysis(review),
              })
            } catch (error) {
              console.error("Certificate document extraction failed", error)
              const failure = okfFailure(error)
              const payload = (await failure.json()) as { message?: string }
              send({
                type: "error",
                message: payload.message || "Could not analyze the documents.",
                analysis: lastAnalysis,
              })
            } finally {
              request.signal.removeEventListener("abort", cancelFromRequest)
              if (!streamCancelled) controller.close()
            }
          })()
        },
        cancel() {
          streamCancelled = true
          operationController.abort(
            new DOMException("The document review was cancelled.", "AbortError")
          )
        },
      })

      return new Response(body, {
        headers: {
          "Cache-Control": "no-store, no-transform",
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "X-Accel-Buffering": "no",
        },
      })
    }

    const review = await reviewUploads(
      session,
      files,
      requestId,
      stage,
      date,
      undefined,
      request.signal
    )
    return Response.json(
      { ok: true, analysis: reviewToAnalysis(review) },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
