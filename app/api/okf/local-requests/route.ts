import { z } from "zod"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
} from "@/lib/okf/server"
import type { MadagascarRequest } from "@/lib/madagascar-bsc"

export async function GET(request: Request) {
  try {
    const { client, development } = await okfSession()
    if (!development) return new Response(null, { status: 404 })
    const id = new URL(request.url).searchParams.get("document")
    const { data, error } = await client
      .from("madagascar_bsc_requests")
      .select("*")
    databaseError(error)
    if (id) {
      const document = data!
        .flatMap((row) => row.documents as MadagascarRequest["documents"])
        .find((doc) => doc.id === id)
      if (!document) return new Response(null, { status: 404 })
      const result = await client.storage
        .from("madagascar-bsc")
        .download(document.storagePath)
      databaseError(result.error)
      return new Response(result.data, {
        headers: {
          "Content-Type": result.data!.type,
          "Cache-Control": "no-store",
        },
      })
    }
    return Response.json(
      { ok: true, rows: data },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const { client, development } = await okfSession("edit")
    if (!development) return new Response(null, { status: 404 })
    const body = await request.formData()
    const saved = JSON.parse(String(body.get("request"))) as MadagascarRequest
    z.object({
      id: z.string().min(1).max(160),
      reference: z.string(),
      documents: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            storagePath: z.string(),
          })
        )
        .max(20),
      analysis: z.object({
        fields: z.array(z.unknown()),
        invoiceItems: z.array(z.unknown()),
      }),
    }).parse(saved)
    let total = 0
    for (const [index, document] of saved.documents.entries()) {
      const file = body.get(`file:${index}`)
      if (!(file instanceof File)) continue
      total += file.size
      if (total > 30 * 1024 * 1024)
        throw Error("Use at most 30 MB per request.")
      document.storagePath = `development/${saved.id}/${document.id}`
      const result = await client.storage
        .from("madagascar-bsc")
        .upload(document.storagePath, file, { upsert: true })
      databaseError(result.error)
    }
    const result = await client
      .from("madagascar_bsc_requests")
      .upsert({
        id: saved.id,
        reference: saved.reference,
        country: saved.country,
        status: saved.status,
        documents: saved.documents,
        analysis: saved.analysis,
        created_at: saved.createdAt,
        updated_at: saved.updatedAt,
      })
    databaseError(result.error)
    return Response.json({ ok: true, request: saved })
  } catch (error) {
    return okfFailure(error)
  }
}

export async function DELETE(request: Request) {
  try {
    ensureSameOrigin(request)
    const { client, development } = await okfSession("edit")
    if (!development) return new Response(null, { status: 404 })
    const result = await client
      .from("madagascar_bsc_requests")
      .delete()
      .eq("id", new URL(request.url).searchParams.get("id"))
    databaseError(result.error)
    return Response.json({ ok: true })
  } catch (error) {
    return okfFailure(error)
  }
}
