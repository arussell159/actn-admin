import { NextResponse } from "next/server"

import type { MadagascarRule } from "@/lib/madagascar-bsc"
import { fetchWithTimeout } from "@/lib/network"

const ruleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: ["update", "create", "delete", "no_change"],
    },
    relationship: {
      type: "string",
      enum: [
        "same_rule",
        "different_section",
        "new_rule",
        "remove_information",
        "no_change",
      ],
    },
    matchedRuleId: { type: ["string", "null"] },
    documentType: {
      type: "string",
      enum: [
        "Bill of Lading",
        "Commercial Invoice",
        "Packing List",
        "Export/Customs Declaration",
        "Freight Invoice",
        "Cross-document",
      ],
    },
    title: { type: "string" },
    instruction: { type: "string" },
    explanation: { type: "string" },
  },
  required: [
    "action",
    "relationship",
    "matchedRuleId",
    "documentType",
    "title",
    "instruction",
    "explanation",
  ],
} as const

function parseOpenAiJson(payload: unknown) {
  const response = payload as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string }> }>
  }
  const text =
    response.output_text ??
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? "")
      .join("")
  return text
    ? (JSON.parse(text) as {
        action: "update" | "create" | "delete" | "no_change"
        relationship:
          | "same_rule"
          | "different_section"
          | "new_rule"
          | "remove_information"
          | "no_change"
        matchedRuleId: string | null
        documentType: MadagascarRule["documentType"]
        title: string
        instruction: string
        explanation: string
      })
    : undefined
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as {
      rejectionReason?: string
      rules?: MadagascarRule[]
    }
    const rejectionReason = body.rejectionReason?.trim()
    if (!rejectionReason) {
      return NextResponse.json(
        { ok: false, message: "Enter a rejection reason." },
        { status: 400 }
      )
    }

    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_MADAGASCAR_MODEL ??
            process.env.OPENAI_REPORT_MAPPING_MODEL ??
            "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify({
                    task: [
                      "Treat the existing rules as one polished Madagascar BSC rules document organized by document section, rule heading, and notes.",
                      "Interpret the new text as an instruction that may add, clarify, expand, reduce, move, or remove rule information.",
                      "Compare meaning across every rule and every document section, not only matching words.",
                      "If it belongs to an existing rule, update that rule into concise polished notes without duplicating information.",
                      "If it belongs under another document section, choose that section and update or create the appropriate rule there.",
                      "Use delete only when the user clearly asks to remove the entire matched rule. Use no_change when the polished rules already fully cover the text.",
                      "For update, return the matched rule id and the complete final title and instruction after additions or subtractions. For create, matchedRuleId must be null.",
                      "Do not invent requirements or discard unrelated useful information from an existing rule.",
                    ].join(" "),
                    rejectionReason,
                    existingRules: body.rules ?? [],
                  }),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "madagascar_bsc_rule_decision",
              strict: true,
              schema: ruleSchema,
            },
          },
        }),
      },
      45_000
    )

    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}.`)
    }
    const decision = parseOpenAiJson(await response.json())
    if (!decision) throw new Error("OpenAI returned no rule decision.")

    const matched = (body.rules ?? []).find(
      (rule) => rule.id === decision.matchedRuleId
    )
    if (decision.action === "update" && !matched) {
      decision.action = "create"
      decision.relationship = "new_rule"
      decision.matchedRuleId = null
    } else if (decision.action === "delete" && !matched) {
      decision.action = "no_change"
      decision.relationship = "no_change"
      decision.matchedRuleId = null
    }

    return NextResponse.json({ ok: true, decision })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not review the rule.",
      },
      { status: 500 }
    )
  }
}
