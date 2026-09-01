import { NextResponse } from "next/server"

type RefineCountryAiNotesRequest = {
  countryId?: string
  countryName?: string
  rules?: string[]
  currentNotes?: string
  editText?: string
}

const countryAiNotesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    notes: { type: "string" },
  },
  required: ["notes"],
}

function fallbackNotes(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

function parseOpenAiJson(payload: unknown) {
  const response = payload as {
    output_text?: string
    output?: Array<{
      content?: Array<{
        text?: string
      }>
    }>
  }
  const text =
    response.output_text ??
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? "")
      .join("")

  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as { notes?: string }
  } catch {
    return undefined
  }
}

export async function POST(request: Request) {
  let body: RefineCountryAiNotesRequest

  try {
    body = (await request.json()) as RefineCountryAiNotesRequest
  } catch {
    return NextResponse.json({
      ok: false,
      notes: "",
    })
  }

  const editText = body.editText?.trim() ?? ""

  if (!editText) {
    return NextResponse.json({
      ok: true,
      notes: "",
    })
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      notes: fallbackNotes(editText),
    })
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MAPPING_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  task: [
                    "You polish country-specific AI reconciliation notes for an internal shipping month-end app.",
                    "Keep the user's operational meaning intact.",
                    "Make the note clear, specific, and useful for future AI mapping and reconciliation behavior.",
                    "Elaborate only where it removes ambiguity.",
                    "Do not contradict the built-in rules.",
                    "Return the complete saved notes text, not an explanation.",
                  ].join(" "),
                  countryId: body.countryId,
                  countryName: body.countryName,
                  builtInRules: body.rules ?? [],
                  currentNotes: body.currentNotes ?? "",
                  editedNotes: editText,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "country_ai_notes",
            strict: true,
            schema: countryAiNotesSchema,
          },
        },
      }),
    })

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        notes: fallbackNotes(editText),
      })
    }

    const payload = parseOpenAiJson(await response.json())

    return NextResponse.json({
      ok: true,
      notes: payload?.notes?.trim() || fallbackNotes(editText),
    })
  } catch {
    return NextResponse.json({
      ok: false,
      notes: fallbackNotes(editText),
    })
  }
}
