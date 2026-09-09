import { NextResponse } from "next/server"

import {
  madagascarFieldCatalog,
  madagascarIncotermOptions,
  normalizeMadagascarAnalysis,
  type MadagascarAnalysis,
  type MadagascarRule,
} from "@/lib/madagascar-bsc"
import {
  getMadagascarDropdownOptions,
  madagascarOfficialRules,
} from "@/lib/madagascar-bsc-server"
import { fetchWithTimeout } from "@/lib/network"

const documentTypes = [
  "Bill of Lading",
  "Commercial Invoice",
  "Packing List",
  "Export/Customs Declaration",
  "Freight Invoice",
  "Unknown",
] as const

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    consigneeCountry: { type: "string" },
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fileName: { type: "string" },
          documentType: { type: "string", enum: documentTypes },
          confidence: { type: "string" },
          note: { type: "string" },
        },
        required: ["fileName", "documentType", "confidence", "note"],
      },
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          value: { type: "string" },
          status: {
            type: "string",
            enum: ["extracted", "derived", "missing", "conflict"],
          },
          source: { type: "string" },
          note: { type: "string" },
        },
        required: ["key", "label", "value", "status", "source", "note"],
      },
    },
    invoiceValues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          status: {
            type: "string",
            enum: ["extracted", "derived", "missing", "conflict"],
          },
          source: { type: "string" },
          note: { type: "string" },
        },
        required: ["label", "value", "status", "source", "note"],
      },
    },
    invoiceItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          hsCode: { type: "string" },
          brand: { type: "string" },
          reference: { type: "string" },
          originCountry: { type: "string" },
          packageType: { type: "string" },
          quantity: { type: "string" },
          unitOfMeasurement: { type: "string" },
          unitPrice: { type: "string" },
          totalPrice: { type: "string" },
          currency: { type: "string" },
          isSecondHand: { type: "string" },
          source: { type: "string" },
          issues: { type: "array", items: { type: "string" } },
        },
        required: [
          "description",
          "hsCode",
          "brand",
          "reference",
          "originCountry",
          "packageType",
          "quantity",
          "unitOfMeasurement",
          "unitPrice",
          "totalPrice",
          "currency",
          "isSecondHand",
          "source",
          "issues",
        ],
      },
    },
    issues: { type: "array", items: { type: "string" } },
    missingCorrectionsMessage: { type: "string" },
  },
  required: [
    "consigneeCountry",
    "documents",
    "fields",
    "invoiceValues",
    "invoiceItems",
    "issues",
    "missingCorrectionsMessage",
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

  return text ? (JSON.parse(text) as MadagascarAnalysis) : undefined
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
    const formData = await request.formData()
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File)
    const rules = JSON.parse(
      String(formData.get("rules") ?? "[]")
    ) as MadagascarRule[]
    const options = await getMadagascarDropdownOptions()

    if (!files.length) {
      return NextResponse.json(
        { ok: false, message: "Upload at least one document." },
        { status: 400 }
      )
    }

    const fileContent = (
      await Promise.all(
        files.map(async (file) => {
          const base64 = Buffer.from(await file.arrayBuffer()).toString(
            "base64"
          )
          const content = file.type.startsWith("image/")
            ? {
                type: "input_image" as const,
                image_url: `data:${file.type};base64,${base64}`,
                detail: "high" as const,
              }
            : {
                type: "input_file" as const,
                filename: file.name,
                file_data: `data:${file.type || "application/pdf"};base64,${base64}`,
              }
          return [
            {
              type: "input_text" as const,
              text: `The next uploaded document is named: ${file.name}`,
            },
            content,
          ]
        })
      )
    ).flat()

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
                      "Classify every uploaded ECTN certificate document and extract the requested entry data.",
                      "Determine consigneeCountry only from the consignee address on the Bill of Lading. Return the full country name, or an empty string if the BL does not establish it.",
                      "Read only the uploaded files. Never invent, assume, autocomplete, or use outside facts for shipment/customer values.",
                      "If a value is absent, return an empty value with status missing. If documents disagree, return status conflict and explain both values.",
                      "Split exporter and importer into name, address, and country fields. Do not combine them.",
                      "Determine the Incoterm from the document when stated. When it is absent, infer it only from the Commercial Invoice value structure: a lone commercial/goods value is FOB; otherwise use the documented charge composition to select the matching Incoterm. Mark an inferred Incoterm derived and explain the evidence. Never infer an Incoterm when the values remain ambiguous.",
                      "Return invoiceValues as the ordered value lines required by the selected Incoterm, and no irrelevant value lines. Put the base value first, followed by each additive charge, then the named Incoterm total when present or deterministically calculable. For example, FOB contains only FOB Value; CFR contains FOB Value then Freight Value and CFR Value; CIF adds Insurance Value; DAP includes FOB Value, Freight Value, Insurance Value, Other Charges, and DAP Value. Apply the equivalent correct composition for every other Incoterm.",
                      "Every invoice value must come from an uploaded document or deterministic arithmetic on document values. Mark arithmetic derived with its operands and calculation. Required value lines that cannot be established must remain present with an empty value and missing status.",
                      "Only deterministic arithmetic using explicit document values may be status derived; identify the operands and calculation in note.",
                      "Source must name the uploaded file and page when visible.",
                      "Apply every official and enabled custom validation rule.",
                      "For any field with supplied dropdown options, output only an exact option. Otherwise leave it blank and flag it.",
                      "Extract every Commercial Invoice line item. Unit of measurement, country, and Yes/No must exactly match supplied workbook options.",
                      "For Unit of Measurement, select the exact Unit option when the goods are counted as individual units and no more specific documented measurement applies. Use another supplied option only when the documents support it; otherwise leave it blank with an issue.",
                      "Unit FOB Value means the per-unit FOB value of the goods. When it is not printed but the line total and quantity are explicit, calculate line total divided by quantity, return that result, and identify it as Derived with the operands and calculation in source. Do not calculate it if either operand is missing or ambiguous.",
                      "For Is Second Hand, use the exact No option when the documents describe ordinary new goods and contain no indication that they are used or second hand. Use Yes only when the documents support it; flag ambiguity instead of guessing.",
                      "For each item's country, use the origin country explicitly stated on the Commercial Invoice. If it is absent there, use the shipper's country explicitly established by the Bill of Lading. Use only an exact supplied country option; otherwise leave it blank with an issue.",
                      "Write the customer-ready Missing / Corrections Needed message document by document in natural prose. Use separate short paragraphs beginning with wording such as 'The Bill of Lading is missing ...' and 'The Commercial Invoice is missing ...'. Group each missing field, conflict, or correction under the document where it belongs. If an entire required document is absent, say that document is missing. Do not produce one generic combined field list and do not repeat issues.",
                    ].join(" "),
                    requiredDocumentTypes: documentTypes.slice(0, 4),
                    optionalDocumentTypes: ["Freight Invoice"],
                    fields: madagascarFieldCatalog,
                    dropdownOptions: options,
                    incoterms: madagascarIncotermOptions,
                    officialRules: madagascarOfficialRules,
                    activeAiRules: rules.filter((rule) => rule.enabled),
                    uploadedFileNames: files.map((file) => file.name),
                  }),
                },
                ...fileContent,
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "ectn_certificate_analysis",
              strict: true,
              schema: analysisSchema,
            },
          },
        }),
      },
      120_000
    )

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new Error(`OpenAI returned ${response.status}: ${detail}`)
    }

    const analysis = parseOpenAiJson(await response.json())
    if (!analysis) throw new Error("OpenAI returned no analysis.")

    return NextResponse.json({
      ok: true,
      analysis: normalizeMadagascarAnalysis(analysis, options),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""

    return NextResponse.json(
      {
        ok: false,
        message: /fetch failed|network|timeout|ENOTFOUND|ECONNRESET/i.test(
          message
        )
          ? "OpenAI could not be reached from localhost. Check your network or API access and try again."
          : message || "Could not analyze documents.",
      },
      { status: 500 }
    )
  }
}
