import { NextResponse } from "next/server"

import type {
  ReportMappingAiTrainingExample,
  ReportMappingField,
} from "@/lib/month-end-template"

type MappingTarget = {
  id: ReportMappingField
  label: string
  aliases: string[]
}

type SampleField = {
  sourceColumn: string
  label: string
  previewValues: string[]
}

type MappingSuggestionRequest = {
  mappingKind?: "countryReport" | "masterReport"
  fields?: MappingTarget[]
  sampleFields?: SampleField[]
  savedAssignments?: Partial<Record<ReportMappingField, string>>
  trainingExamples?: ReportMappingAiTrainingExample[]
  preview?: {
    fileName?: string
    fileType?: string
    textLines?: string[]
    rows?: string[][]
    imageDataUrl?: string
  }
}

type MappingSuggestionResponse = {
  suggestions?: Partial<Record<ReportMappingField, string>>
  table?: {
    columns?: string[]
    rows?: string[][]
  }
  notes?: string[]
}

const maxAiReportRows = 1000
const maxAiReportTextLines = 3000

const reportMappingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "object",
      additionalProperties: false,
      properties: {
        invoiceNumber: { type: ["string", "null"] },
        ctnNumber: { type: ["string", "null"] },
        billOfLadingNumber: { type: ["string", "null"] },
        reference: { type: ["string", "null"] },
        amount: { type: ["string", "null"] },
        secondaryAmount: { type: ["string", "null"] },
        tertiaryAmount: { type: ["string", "null"] },
        sourceCountryName: { type: ["string", "null"] },
        sourceInternalId: { type: ["string", "null"] },
        salesOrderNumber: { type: ["string", "null"] },
        status: { type: ["string", "null"] },
        transactionDate: { type: ["string", "null"] },
        sellingDate: { type: ["string", "null"] },
        sourceClass: { type: ["string", "null"] },
      },
      required: [
        "invoiceNumber",
        "ctnNumber",
        "billOfLadingNumber",
        "reference",
        "amount",
        "secondaryAmount",
        "tertiaryAmount",
        "sourceCountryName",
        "sourceInternalId",
        "salesOrderNumber",
        "status",
        "transactionDate",
        "sellingDate",
        "sourceClass",
      ],
    },
    table: {
      type: "object",
      additionalProperties: false,
      properties: {
        columns: {
          type: "array",
          items: { type: "string" },
        },
        rows: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      required: ["columns", "rows"],
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["suggestions", "table", "notes"],
} as const

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function localSuggestionFallback(request: MappingSuggestionRequest) {
  const suggestions: Partial<Record<ReportMappingField, string>> = {}
  const sampleFields = request.sampleFields ?? []

  for (const field of request.fields ?? []) {
    const aliases = new Set(field.aliases.map(normalizeHeader))
    const exact = sampleFields.find((sampleField) =>
      aliases.has(normalizeHeader(sampleField.label))
    )
    const loose =
      exact ??
      sampleFields.find((sampleField) => {
        const normalizedLabel = normalizeHeader(sampleField.label)

        return field.aliases.some((alias) =>
          normalizedLabel.includes(normalizeHeader(alias))
        )
      })

    if (loose) {
      suggestions[field.id] = loose.sourceColumn
    }
  }

  return suggestions
}

function countSuggestions(
  suggestions: Partial<Record<ReportMappingField, string>>
) {
  return Object.values(suggestions).filter(Boolean).length
}

function normalizeAiTable(table: MappingSuggestionResponse["table"]) {
  const rows = table?.rows ?? []
  const columns = table?.columns ?? []
  const columnCount = Math.max(
    columns.length,
    ...rows.map((row) => row.length),
    0
  )

  return {
    columns: Array.from(
      { length: columnCount },
      (_, index) => columns[index]?.trim() || `Column ${index + 1}`
    ),
    rows,
  }
}

function splitPaymentDescription(value: string) {
  const parts = value.split(/\s+-\s+/).map((part) => part.trim())

  return {
    description: parts[0] ?? value.trim(),
    invoiceNumber: parts[1] ?? "",
    reference: parts.slice(2).join(" - "),
  }
}

function inferRepeatingPaymentTable(lines: string[]) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean)
  const rows: string[][] = []

  for (let index = 0; index < cleanLines.length - 2; index += 3) {
    const descriptionLine = cleanLines[index] ?? ""
    const dateLine = cleanLines[index + 1] ?? ""
    const amountLine = cleanLines[index + 2] ?? ""

    if (
      !/\s+-\s+/.test(descriptionLine) ||
      !/^\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?$/.test(
        dateLine
      ) ||
      !/^\d[\d\s.,]*$/.test(amountLine)
    ) {
      return undefined
    }

    const payment = splitPaymentDescription(descriptionLine)

    rows.push([
      payment.description,
      payment.invoiceNumber,
      payment.reference,
      dateLine,
      amountLine,
    ])
  }

  if (!rows.length || rows.length * 3 !== cleanLines.length) {
    return undefined
  }

  return {
    columns: [
      "Description",
      "Invoice Number",
      "Bill of Lading Number",
      "Date",
      "Amount",
    ],
    rows,
  }
}

function parseOpenAiJson(value: unknown): MappingSuggestionResponse {
  if (
    value &&
    typeof value === "object" &&
    "output_text" in value &&
    typeof value.output_text === "string"
  ) {
    return JSON.parse(value.output_text) as MappingSuggestionResponse
  }

  const output = (value as { output?: unknown[] }).output
  const firstText = output
    ?.flatMap((item) =>
      Array.isArray((item as { content?: unknown[] }).content)
        ? ((item as { content: unknown[] }).content as unknown[])
        : []
    )
    .find(
      (item) =>
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof item.text === "string"
    ) as { text: string } | undefined

  return firstText ? JSON.parse(firstText.text) : {}
}

export async function POST(request: Request) {
  let body: MappingSuggestionRequest

  try {
    body = (await request.json()) as MappingSuggestionRequest
  } catch {
    return NextResponse.json({
      ok: false,
      message: "AI Suggest could not read the request. You can still map manually.",
      suggestions: {},
    })
  }

  const apiKey = process.env.OPENAI_API_KEY
  const fallbackSuggestions = localSuggestionFallback(body)
  const fallbackCount = countSuggestions(fallbackSuggestions)
  const inferredTable = inferRepeatingPaymentTable(body.preview?.textLines ?? [])

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message:
        "OPENAI_API_KEY is not configured, so AI Suggest used local header matching only.",
      suggestions: fallbackSuggestions,
    })
  }

  try {
    const inputContent: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: JSON.stringify({
          task: [
            "You are the AI upload reader and mapper for shipping reconciliation reports.",
            "Read the uploaded or pasted report content, normalize it into a usable table, and map table columns to target reconciliation fields.",
            "Your main job is semantic layout, not preserving the raw PDF, screenshot, spreadsheet, or clipboard extraction grid.",
            "Use common shipping, freight, invoice, CTN, ECTN, BESC, bill of lading, container, payment, date, amount, debit, credit, reference, customer, country, class, and NetSuite report conventions.",
            "Prefer the user's savedAssignments and prior corrected trainingExamples over generic assumptions when a similar report format appears.",
            "Always create a clean normalized table from the preview. Treat sampleFields as a rough previous layout only.",
            "Return suggestion sourceColumn values from your final table.columns exactly.",
            "Never treat any uploaded or pasted row as a header row.",
            "Every visible report row belongs in table.rows, including the first row.",
            "Do not keep spacer columns, visual separator columns, or columns whose values are only empty, '-', repeated dashes, or extraction artifacts.",
            "If adjacent rows together describe one transaction, combine them into one logical row instead of leaving separate broken rows.",
            "For ECTN payment/correction request history, make logical columns such as Timestamp, Company, Payment Method, ECTN Reference, Status, Description, Amount, Currency, Processing Mode, and Processed At when those values are present.",
            "Do not drop payment method rows like 'Payment by reserve credit'; carry that value into the Payment Method column of the related transaction.",
            "When there is both an initial event timestamp and a later processed timestamp, preserve both as Timestamp and Processed At.",
            "Values such as 'ECTN reference : BJ2607A909' should be one ECTN Reference cell, 'AfricaCTN LLC' should be one Company cell, 'Payment of correction request' or 'ECTN Payment' should be one Description cell, and 'Automatic' should be one Processing Mode cell.",
            "Amounts such as '- 40 EUR' or '- 5 EUR' should be one Amount cell, with the currency retained in Amount or separated into Currency if the pattern supports it.",
            "A dash immediately followed by a number or currency is a negative amount, not a spacer or empty value.",
            "Use table.columns only as mapper labels. Prefer meaningful shipping/report labels when the repeated field pattern is clear; otherwise use generic labels such as Column 1, Column 2, Column 3.",
            "For repeating payment blocks like 'Règlement - invoice - reference' followed by a date line and amount line, split them into Description, Invoice Number, Bill of Lading Number, Date, and Amount.",
            "The table should contain the visible report data only, with one column per real report field.",
            "Use null when a target field is absent or uncertain.",
            "Do not explain the mapping unless there is an actual upload/parsing problem.",
          ].join(" "),
          mappingKind: body.mappingKind,
          targetFields: body.fields ?? [],
          savedAssignments: body.savedAssignments ?? {},
          trainingExamples: (body.trainingExamples ?? []).slice(-8),
          knownLayoutHint: inferredTable
            ? {
                reason:
                  "A repeated payment block pattern was detected. Use this only as a hint; return your own final normalized table.",
                table: inferredTable,
              }
            : undefined,
          sampleFields: body.sampleFields ?? [],
          preview: {
            fileName: body.preview?.fileName,
            fileType: body.preview?.fileType,
            textLines:
              body.preview?.textLines?.slice(0, maxAiReportTextLines) ?? [],
            rows: body.preview?.rows?.slice(0, maxAiReportRows) ?? [],
          },
        }),
      },
    ]

    if (body.preview?.imageDataUrl) {
      inputContent.push({
        type: "input_image",
        image_url: body.preview.imageDataUrl,
      })
    }

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
            content: inputContent,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "report_mapping_suggestions",
            strict: true,
            schema: reportMappingSchema,
          },
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()

      return NextResponse.json({
        ok: false,
        message: `AI Suggest could not reach OpenAI (${response.status}). Local header matching was applied instead. ${detail.slice(0, 180)}`,
        suggestions: fallbackSuggestions,
      })
    }

    const payload = parseOpenAiJson(await response.json())
    const normalizedTable = normalizeAiTable(payload.table)
    const tableSampleFields =
      normalizedTable.columns.map((column) => ({
        sourceColumn: column,
        label: column,
        previewValues: [],
      }))
    const tableFallbackSuggestions = localSuggestionFallback({
      ...body,
      sampleFields: tableSampleFields,
    })
    const validSources = new Set(
      [
        ...(body.sampleFields ?? []).map((field) => field.sourceColumn),
        ...normalizedTable.columns,
      ].filter(Boolean)
    )
    const suggestions = Object.fromEntries(
      Object.entries(payload.suggestions ?? {}).filter(([, sourceColumn]) =>
        sourceColumn ? validSources.has(sourceColumn) : false
      )
    ) as Partial<Record<ReportMappingField, string>>
    const mergedSuggestions = {
      ...fallbackSuggestions,
      ...tableFallbackSuggestions,
      ...suggestions,
    }
    const suggestionCount = countSuggestions(mergedSuggestions)

    return NextResponse.json({
      ok: suggestionCount > 0,
      message:
        suggestionCount > 0
          ? `AI mapped ${suggestionCount} column${suggestionCount === 1 ? "" : "s"}.`
          : fallbackCount > 0
            ? `Local matching mapped ${fallbackCount} column${fallbackCount === 1 ? "" : "s"}.`
            : "AI could not identify matching columns from this sample. The upload is still available for review.",
      suggestions: mergedSuggestions,
      table: {
        columns: normalizedTable.columns,
        rows: normalizedTable.rows.slice(0, maxAiReportRows),
      },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message:
        error instanceof Error
          ? `AI Suggest failed: ${error.message}. Local header matching was applied instead.`
          : "AI Suggest failed. Local header matching was applied instead.",
      suggestions: fallbackSuggestions,
    })
  }
}
