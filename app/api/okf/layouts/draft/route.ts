import { z } from "zod"
import {
  certificateLayoutSchema,
  layoutDraftRecordSchema,
} from "@/lib/certificate-layout/schema"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
  OkfError,
} from "@/lib/okf/server"

const draftKeySchema = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/)

export async function GET(request: Request) {
  try {
    const session = await okfSession()
    const key = draftKeySchema.parse(new URL(request.url).searchParams.get("key"))
    const { data, error } = await session.client
      .from("okf_certificate_layout_drafts")
      .select("*")
      .eq("draft_key", key)
      .maybeSingle()
    databaseError(error)
    return Response.json(
      { ok: true, draft: data ? layoutDraftRecordSchema.parse(data) : null },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}

export async function PUT(request: Request) {
  try {
    ensureSameOrigin(request)
    const session = await okfSession("edit")
    const text = await request.text()
    if (text.length > 400_000) throw new OkfError("Layout draft is too large.")
    const body = z
      .object({
        draftKey: draftKeySchema,
        layout: certificateLayoutSchema,
        baseRevision: z.number().int().nonnegative(),
        expectedEdit: z.number().int().nonnegative(),
      })
      .parse(JSON.parse(text))
    const { data, error } = await session.client.rpc(
      "okf_save_certificate_layout_draft",
      {
        p_draft_key: body.draftKey,
        p_layout: body.layout,
        p_base_revision: body.baseRevision,
        p_expected_edit: body.expectedEdit,
      }
    )
    databaseError(error)
    return Response.json(
      { ok: true, draft: layoutDraftRecordSchema.parse(data) },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}

export async function DELETE(request: Request) {
  try {
    ensureSameOrigin(request)
    const session = await okfSession("edit")
    const body = z
      .object({
        draftKey: draftKeySchema,
        expectedEdit: z.number().int().positive().nullable().optional(),
      })
      .parse(await request.json())
    const { error } = await session.client.rpc(
      "okf_delete_certificate_layout_draft",
      {
        p_draft_key: body.draftKey,
        p_expected_edit: body.expectedEdit ?? null,
      }
    )
    databaseError(error)
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
