import { NextResponse } from "next/server"
import { z } from "zod"

import { knowledgeEditorInstructions } from "@/lib/ctn-knowledge-prompt"
import {
  knowledgeAnalysisSchema,
  prepareKnowledgeProposal,
} from "@/lib/ctn-knowledge-review"
import {
  knowledgeStreamPreview,
  readKnowledgeEvents,
} from "@/lib/ctn-knowledge-stream"

const recordSchema = z.object({
  id: z.string().min(1),
  country: z.string(),
  format: z.literal("okf.ctn.country.v1"),
  version: z.union([z.string(), z.number()]),
  updatedAt: z.string(),
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string(),
      kind: z.string(),
      summary: z.string(),
      body: z.array(z.string()),
      updatedAt: z.string(),
    })
  ),
  changeLog: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      source: z.enum(["seed", "chat"]),
      instruction: z.string(),
      summary: z.string(),
    })
  ),
})
const requestSchema = z
  .object({
    records: z.array(recordSchema).max(200),
    selectedRecordId: z.string(),
    messages: z
      .array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
      )
      .max(100),
    userMessage: z.string().trim().min(1).max(40_000),
  })
  .strict()

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>
  try {
    const raw = await request.text()
    if (raw.length > 1_500_000) throw new Error("Request too large")
    body = requestSchema.parse(JSON.parse(raw))
    if (
      new Set(body.records.map((record) => record.id)).size !==
        body.records.length ||
      body.records.some(
        (record) =>
          new Set(record.sections.map((section) => section.id)).size !==
          record.sections.length
      )
    )
      throw new Error("Duplicate OKF locations")
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid or oversized OKF review request. No changes were made.",
      },
      { status: 400 }
    )
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      {
        ok: false,
        message:
          "OPENAI_API_KEY is not configured. The OKF could not be reviewed; no changes were made.",
      },
      { status: 503 }
    )
  const upstreamAbort = new AbortController()
  const timeout = setTimeout(() => upstreamAbort.abort(), 90_000)
  try {
    // Full-corpus semantic comparison avoids losing equivalent wording to a
    // keyword filter in this small browser-backed store. No write tools exist.
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.any([request.signal, upstreamAbort.signal]),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stream: true,
        model:
          process.env.OPENAI_KNOWLEDGE_BASE_MODEL ??
          process.env.OPENAI_REPORT_MAPPING_MODEL ??
          "gpt-4.1-mini",
        instructions: knowledgeEditorInstructions,
        input: [
          {
            role: "user",
            content: JSON.stringify({
              liveRecords: body.records,
              selectedRecordId: body.selectedRecordId,
              conversation: body.messages,
              userMessage: body.userMessage,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ectn_okf_review",
            strict: true,
            schema: z.toJSONSchema(knowledgeAnalysisSchema, {
              target: "draft-7",
            }),
          },
        },
      }),
    })
    if (!response.ok)
      throw new Error(`Review service returned ${response.status}.`)
    if (!response.body) throw new Error("No response stream.")
    const upstream = response.body
    const encoder = new TextEncoder()
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: unknown) => {
          if (!cancelled)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            )
        }
        try {
          let output = ""
          let preview = ""
          let completed = false
          for await (const event of readKnowledgeEvents(upstream)) {
            if (
              event.type === "response.output_text.delta" &&
              typeof event.delta === "string"
            ) {
              output += event.delta
              if (output.length > 1_000_000)
                throw new Error("The review is too large.")
              const text = knowledgeStreamPreview(output)
              if (text !== preview) {
                preview = text
                send({ type: "preview", text })
              }
            } else if (event.type === "response.completed") {
              const analysis = knowledgeAnalysisSchema.parse(JSON.parse(output))
              prepareKnowledgeProposal(analysis, body.records)
              // Only this fully validated result can enter pending approval.
              send({ type: "complete", analysis })
              completed = true
              break
            } else if (
              [
                "error",
                "response.failed",
                "response.incomplete",
                "response.refusal.delta",
              ].includes(String(event.type))
            ) {
              throw new Error("The review did not complete.")
            }
          }
          if (!completed) throw new Error("The review stream ended early.")
        } catch {
          send({
            type: "error",
            message:
              "The OKF review was interrupted or could not be validated. No changes were made. Please retry.",
          })
        } finally {
          clearTimeout(timeout)
          upstreamAbort.abort()
          if (!cancelled) controller.close()
        }
      },
      cancel() {
        cancelled = true
        clearTimeout(timeout)
        upstreamAbort.abort()
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  } catch {
    clearTimeout(timeout)
    upstreamAbort.abort()
    return NextResponse.json(
      {
        ok: false,
        message:
          "The OKF review could not be completed or validated. No changes were made. Please retry.",
      },
      { status: 502 }
    )
  }
}
