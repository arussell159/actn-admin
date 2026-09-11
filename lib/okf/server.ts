import "server-only"
import { headers } from "next/headers"
import { createClient } from "@/lib/server"
import { pageSchema, type KnowledgeState } from "./schema"

export class OkfError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}
export async function okfSession(
  permission: "read" | "edit" | "publish" = "read"
) {
  const authorization = (await headers()).get("authorization") ?? ""
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  const client = await createClient(accessToken)
  const {
    data: { user },
    error,
  } = await client.auth.getUser(accessToken)
  if (error || !user) {
    if (error && (!error.status || error.status >= 500))
      throw new OkfError(
        "The server could not reach the sign-in service. Please try again.",
        503
      )
    throw new OkfError("Sign in with your staff account to use the OKF.", 401)
  }
  const role = String(user.app_metadata?.okf_role ?? "staff")
  const canEdit = ["staff", "editor", "publisher", "admin"].includes(role)
  const canPublish = ["staff", "publisher", "admin"].includes(role)
  if (
    (permission === "edit" && !canEdit) ||
    (permission === "publish" && !canPublish)
  )
    throw new OkfError(
      "Your staff account does not have permission for this action.",
      403
    )
  return { client, user, canEdit, canPublish, development: false }
}
export async function readKnowledge(
  client: Awaited<ReturnType<typeof okfSession>>["client"]
): Promise<KnowledgeState> {
  const { data, error } = await client
    .from("okf_state")
    .select("generation,pages")
    .eq("id", true)
    .single()
  if (error || !data)
    throw new OkfError(
      "OKF storage is not ready. Apply supabase-okf.sql to this app's Supabase project, then reload.",
      503
    )
  return {
    generation: data.generation,
    pages: pageSchema.array().parse(data.pages),
  }
}
export function databaseError(error: { message: string } | null) {
  if (error)
    throw new OkfError(
      error.message,
      /changed|stale|Refresh/i.test(error.message) ? 409 : 400
    )
}
export function okfFailure(error: unknown) {
  return Response.json(
    {
      ok: false,
      message:
        error instanceof Error ? error.message : "The OKF operation failed.",
    },
    {
      status: error instanceof OkfError ? error.status : 400,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
export function ensureSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    throw new OkfError("Cross-origin changes are not permitted.", 403)
}
