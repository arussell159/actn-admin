import { z } from "zod"
import { certificateLayoutSchema } from "@/lib/certificate-layout/schema"
import {
  deleteCertificateLayout,
  layoutCatalogTag,
  publishCertificateLayout,
  readCertificateLayouts,
} from "@/lib/certificate-layout/server"
import {
  ensureSameOrigin,
  okfFailure,
  okfSession,
  OkfError,
} from "@/lib/okf/server"

export async function GET(request: Request) {
  try {
    const session = await okfSession()
    const rows = await readCertificateLayouts(session.client)
    const etag = layoutCatalogTag(rows)
    const headers = {
      ETag: etag,
      "Cache-Control": "private, no-cache",
      Vary: "Cookie, Authorization",
    }
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers })
    return Response.json(
      { ok: true, rows, canPublish: session.canPublish },
      { headers }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const session = await okfSession("publish")
    const text = await request.text()
    if (text.length > 400_000) throw new OkfError("Layout is too large.")
    const body = z
      .object({
        layout: certificateLayoutSchema,
        expectedRevision: z.number().int().nonnegative(),
      })
      .parse(JSON.parse(text))
    const row = await publishCertificateLayout(
      session.client,
      body.layout,
      body.expectedRevision
    )
    return Response.json(
      { ok: true, row },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
export async function DELETE(request: Request) {
  try {
    ensureSameOrigin(request)
    const session = await okfSession("publish")
    const body = z
      .object({
        countryKey: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/),
        expectedRevision: z.number().int().positive(),
      })
      .parse(await request.json())
    await deleteCertificateLayout(
      session.client,
      body.countryKey,
      body.expectedRevision
    )
    return Response.json(
      { ok: true, countryKey: body.countryKey },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
