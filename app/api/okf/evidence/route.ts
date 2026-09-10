import { randomUUID } from "node:crypto"
import {
  databaseError,
  ensureSameOrigin,
  okfFailure,
  okfSession,
  OkfError,
} from "@/lib/okf/server"

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    const { client, user } = await okfSession("edit")
    const data = await request.formData()
    const file = data.get("file")
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
      throw new OkfError("Choose an evidence file up to 10 MB.")
    const safeName = file.name.replace(/[^\w.-]/g, "-").slice(-100)
    const path = `evidence/${user.id}/${randomUUID()}-${safeName}`
    const result = await client.storage
      .from("okf-evidence")
      .upload(path, file, { contentType: file.type, upsert: false })
    databaseError(result.error)
    return Response.json({
      ok: true,
      source: {
        id: `source-${randomUUID()}`,
        title: file.name,
        url: "",
        attachmentPath: path,
        note: "Uploaded evidence; scope and authority require review.",
      },
    })
  } catch (error) {
    return okfFailure(error)
  }
}
export async function GET(request: Request) {
  try {
    const { client, development } = await okfSession()
    const path = new URL(request.url).searchParams.get("path") ?? ""
    if (!/^evidence\/[\w-]+\/[\w.-]+$/.test(path))
      throw new OkfError("Invalid attachment.")
    if (development) {
      const { data, error } = await client.storage
        .from("okf-evidence")
        .download(path)
      databaseError(error)
      return new Response(data, {
        headers: {
          "Content-Type": data!.type,
          "Content-Disposition": "attachment",
          "Cache-Control": "no-store",
        },
      })
    }
    const { data, error } = await client.storage
      .from("okf-evidence")
      .createSignedUrl(path, 60, { download: true })
    databaseError(error)
    return Response.redirect(data!.signedUrl, 303)
  } catch (error) {
    return okfFailure(error)
  }
}
