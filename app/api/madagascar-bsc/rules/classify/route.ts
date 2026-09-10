import { okfSession, okfFailure } from "@/lib/okf/server"

// Older client-supplied knowledge must not become a second operational corpus.
export async function POST() {
  try {
    await okfSession("edit")
    return Response.json({ ok: false, message: "This knowledge editor has been replaced. Open /knowledge-base to edit the durable OKF and approve a proposal.", path: "/knowledge-base" }, { status: 410 })
  } catch (error) { return okfFailure(error) }
}
