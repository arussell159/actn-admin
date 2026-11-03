import { structuredAi } from "@/lib/okf/ai"
import {
  ensureSameOrigin,
  okfFailure,
  okfSession,
  OkfError,
} from "@/lib/okf/server"
import {
  draftExtractionInstructions,
  madagascarDraftSchema,
  screenshotTypes,
} from "@/lib/madagascar-draft"

export const runtime = "nodejs"
export const maxDuration = 180

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request)
    await okfSession("edit")
    const data = await request.formData()
    const screenshots = data
      .getAll("screenshots")
      .filter((value): value is File => value instanceof File)
    if (screenshots.length !== 3)
      throw new OkfError("Add all three system screenshots.")
    if (
      screenshots.some(
        (file) => !screenshotTypes.includes(file.type) || !file.size
      )
    )
      throw new OkfError("Use PNG, JPEG or WebP screenshots.")
    if (screenshots.reduce((total, file) => total + file.size, 0) > 3_500_000)
      throw new OkfError(
        "The screenshots are too large. Choose smaller images and try again."
      )
    const draft = await structuredAi(
      madagascarDraftSchema,
      draftExtractionInstructions,
      {
        country: "Madagascar",
        purpose: "Unvalidated customer review draft",
        screenshotCount: 3,
      },
      screenshots
    )
    return Response.json(
      { ok: true, draft },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return okfFailure(error)
  }
}
