import {
  madagascarFieldGroups,
  madagascarOfficialRuleDefinitions,
} from "../madagascar-bsc"
import { type KnowledgeContent, type KnowledgePage } from "./schema"
import { requiredDocumentsForCountry } from "./required-documents"

export const documentHeadings = [
  "When required",
  "Requirements",
  "Fields to extract",
  "Cross-document checks",
  "If missing or incorrect",
  "Examples and templates",
  "Sources",
]
export const templates: Record<string, string[]> = {
  standards: [
    "Structure",
    "Page templates",
    "Writing rules",
    "Approval rules",
    "Versioning",
  ],
  overview: [
    "Certificate",
    "Authority and system",
    "Applicability",
    "Timing",
    "Responsibilities",
    "Sources",
  ],
  process: [
    "1. Intake",
    "2. Drafting",
    "3. Submission",
    "4. Validation",
    "5. Release",
  ],
  document: documentHeadings,
  system: [
    "Portal",
    "Navigation",
    "Submission",
    "Statuses",
    "Corrections",
    "Sources",
  ],
  exceptions: ["Condition", "Affected rules", "Required action", "Sources"],
  references: ["Linked sources", "Example documents", "Blank templates"],
  index: [
    "Country names and aliases",
    "Certificate names",
    "Identification evidence",
  ],
  mappings: ["System Field Map"],
}
const slug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
export const countryPagePrefix = (country: string) =>
  country === "Madagascar" ? "mg" : slug(country)
export const documentPageId = (name: string, country = "Madagascar") =>
  `${countryPagePrefix(country)}-document-${slug(name)}`

// These are the country configurations already present in production Certificate
// Settings. Form layouts remain separately versioned and are never generated here.
export const configuredCountries = [
  "Angola",
  "Djibouti",
  "Kenya",
  "Madagascar",
  "Somalia",
  "Sudan",
  "Yemen",
] as const
// Legacy stable field IDs for document mappings. Displayed labels, order and controls
// are configured separately through Certificate Settings.
export const formPresentation = [
  ...madagascarFieldGroups.flatMap((group) =>
    group.fields.map(([id, label]) => ({
      id,
      label,
      section: group.title,
      repeated: false,
    }))
  ),
  ...[
    ["hsCode", "HS Code"],
    ["description", "Description"],
    ["quantity", "Quantity"],
    ["unitOfMeasurement", "Unit of Measurement"],
    ["unitPrice", "Unit FOB Value"],
    ["isSecondHand", "Is Second Hand"],
    ["originCountry", "Country"],
  ].map(([id, label]) => ({
    id: `invoiceItems.${id}`,
    label,
    section: "Invoice Items",
    repeated: true,
  })),
  {
    id: "invoiceValues",
    label: "Invoice Values",
    section: "Invoices",
    repeated: true,
  },
]
function sourceDocument(fieldId: string) {
  if (fieldId.startsWith("packing")) return "Packing List"
  if (fieldId.startsWith("exportDeclaration"))
    return "Export/Customs Declaration"
  if (fieldId === "exporterName" || fieldId === "importerName")
    return "Bill of Lading"
  if (
    /^(exporter|importer|incoterm|fob|currency|commercialInvoice|invoice)/.test(
      fieldId
    )
  )
    return "Commercial Invoice"
  return "Bill of Lading"
}
const sourceFieldId = (id: string) => `mg-source-${id.replaceAll(".", "-")}`
export const sharedExtractionInstructions: Record<string, string> = {
  incoterm:
    "Read an explicitly stated Incoterm first. If it is absent, infer it from the Commercial Invoice's value composition: when the only stated total is Commercial Value, Goods Value, Merchandise Value or an equivalent goods total and the invoice does not add freight or insurance, return FOB; use CFR when the invoiced total includes goods plus freight; use CIF when the invoiced total includes goods plus freight plus insurance. A separately itemized freight or insurance amount is evidence of inclusion only when the invoice total or wording shows that it is part of the invoiced value. The commercial-value-only case must not be left blank merely because the letters FOB are not printed. Return the three-letter uppercase term and keep it consistent with Incoterm Place and FOB Value. Leave blank only when the documented amounts genuinely support more than one case.",
  incotermPlace:
    "Derive this together with Incoterm. For FOB, use the named port or place of loading. For CFR or CIF, use the named destination or port of discharge. Prefer the place printed beside the Incoterm, then the corresponding named port elsewhere on the Commercial Invoice. Preserve the port or city name. Leave blank only when the invoice does not identify the required place.",
  fobValue:
    "Return the total FOB goods value as a decimal number without a currency symbol or thousands separators. Prefer an explicitly labeled FOB total. Otherwise derive it from the Commercial Invoice: for FOB, use the total commercial or goods value; for CFR, subtract separately stated freight from the CFR invoice total; for CIF, subtract separately stated freight and insurance from the CIF invoice total. If no reliable total is printed but all line amounts are present, sum the line amounts; calculate quantity multiplied by unit price only when needed. Derive this together with Incoterm and Incoterm Place, use only amounts from this invoice, and leave blank if the necessary components are ambiguous or incomplete.",
  currency:
    "Return an ISO currency code. Normalize an unambiguous symbol: $ to USD, € to EUR and £ to GBP. Use document context when a symbol can denote more than one currency; leave blank if it remains ambiguous.",
  commercialInvoiceReference:
    "Return only the reference value. Remove labels and words before it, such as Invoice or Invoice #. Remove hyphens and other decorative punctuation, but preserve forward slashes. Example: Invoice # 81 becomes 81.",
  commercialInvoiceDate:
    "Read the invoice issue date and normalize it to YYYY-MM-DD. Resolve day and month order from the document's locale and surrounding text. Leave blank if the date is incomplete or genuinely ambiguous.",
  packingListReference:
    "Return only the reference value. Remove labels and words before it. Remove hyphens and other decorative punctuation, but preserve forward slashes.",
  packingListDate:
    "Read the packing-list issue date and normalize it to YYYY-MM-DD. Leave blank if the date is incomplete or genuinely ambiguous.",
  shipmentMethod:
    "Return Sea for an ocean, liner, sea waybill or maritime Bill of Lading. Return Air for an airway bill or air waybill. Do not infer another method.",
  cargoType:
    "Return Full container load when the Bill of Lading identifies one or more shipping containers. Otherwise use only an explicitly supported cargo type and leave blank when it cannot be determined.",
  grossWeight:
    "Return the total gross shipment weight required by the certificate, normalized to kilograms as a decimal number without a unit suffix. Prefer an explicitly labeled total gross weight. Convert another explicit weight unit to kilograms only when the source unit is clear.",
  volume:
    "Return explicit shipment volume in cubic metres as a decimal number without a unit suffix. If volume is absent but container sizes are explicit, use 25 per 20-foot container and 50 per 40-foot container and sum multiple containers. Otherwise leave blank.",
  containerType:
    "Normalize container notation to an allowed certificate option. RF or RH means Reefer; OT means Open Top; FR means FlatRack; TK means Tank; DV, DC, GP, HC or HQ normally means Dry unless other evidence establishes a different type. Use the full container code and description together and leave blank if uncertain.",
  containerSize:
    "Normalize an explicit container size to the exact allowed certificate option: a 20-foot code to 20 Feet and a 40-foot code to 40 Feet. Use Other for another explicit length. Leave blank when no size is stated or encoded.",
  loadingCountry:
    "Return the country containing the named port or place of loading, using the exact allowed country name. Geographic lookup is permitted when the port is explicit; for example, Newark is in the United States.",
  loadingDate:
    "Use an explicitly stated departure or shipped-on-board date and normalize it to YYYY-MM-DD. Do not invent a current schedule date; leave blank for later carrier tracking when it is not in the documents.",
  unloadingDate:
    "Use an explicitly stated arrival or unloading date and normalize it to YYYY-MM-DD. Do not invent a current schedule date; leave blank for later carrier tracking when it is not in the documents.",
  exportDeclarationReference:
    "Return only the declaration reference value. Remove labels and words before it. Remove hyphens and other decorative punctuation, but preserve forward slashes.",
  exportDeclarationDate:
    "Read the declaration issue date and normalize it to YYYY-MM-DD. Leave blank if the date is incomplete or genuinely ambiguous.",
  billOfLadingReference:
    "Return only the Bill of Lading or waybill number. Remove labels and words before it. Remove hyphens and other decorative punctuation, but preserve forward slashes.",
  billOfLadingDate:
    "Read the Bill of Lading or waybill issue date and normalize it to YYYY-MM-DD. Keep shipped-on-board and issue dates distinct. Leave blank if the issue date is not present.",
}
export const sharedMappingGuidance: Record<
  string,
  {
    transform?: "none" | "trim" | "uppercase" | "decimal" | "date-iso"
    unit?: string
  }
> = {
  incoterm: { transform: "uppercase" },
  currency: { transform: "uppercase" },
  commercialInvoiceDate: { transform: "date-iso" },
  packingListDate: { transform: "date-iso" },
  grossWeight: { transform: "decimal", unit: "kg" },
  volume: { transform: "decimal", unit: "m³" },
  loadingDate: { transform: "date-iso" },
  unloadingDate: { transform: "date-iso" },
  exportDeclarationDate: { transform: "date-iso" },
  billOfLadingDate: { transform: "date-iso" },
}
function content(template: string): KnowledgeContent {
  return {
    sections: templates[template].map((heading) => ({
      heading,
      text: "",
      references: [],
    })),
    rules: [],
    fields: [],
    mappings: [],
    sources: [],
    aliases: [],
  }
}
export function createCountryDefinitionPages(
  country: string,
  definedFields: {
    id: string
    label: string
    sourceDocument: string
    instruction: string
  }[] = []
): KnowledgePage[] {
  const prefix = countryPagePrefix(country)
  const sourceId = `${prefix}-staff-required-documents`
  const page = (
    id: string,
    title: string,
    template: string
  ): KnowledgePage => ({
    id,
    title,
    template,
    country,
    content: content(template),
    revision: 0,
    version: null,
    publishedAt: null,
    metadata: { certificate_definition: true },
  })
  const overview = page(`${prefix}-overview`, "Required documents", "overview")
  const requiredDocuments = requiredDocumentsForCountry(country)
  const documentNames = [
    ...new Set([
      ...requiredDocuments,
      ...definedFields
        .map(({ sourceDocument }) => sourceDocument.trim())
        .filter(Boolean),
    ]),
  ]
  const documents = documentNames.map((name) => {
    const document = page(documentPageId(name, country), name, "document")
    if (requiredDocuments.includes(name as (typeof requiredDocuments)[number]))
      document.content.rules.push({
        id: `${prefix}-required-${slug(name)}`,
        country,
        document: name,
        instruction: "Required document.",
        requirement: "always required",
        condition: "",
        stage: "intake",
        consequence: "Flag the request for staff review.",
        sourceIds: [sourceId],
        effectiveFrom: "",
        effectiveTo: "",
        kind: "document",
        check: { operator: "present", fieldIds: [], expected: "" },
      })
    document.content.fields = definedFields
      .filter((field) => field.sourceDocument.trim() === name)
      .map((field) => ({
        id: `${prefix}-source-${field.id.replaceAll(".", "-")}`,
        label: field.label,
        document: name,
        location: "",
        requiredWhen: "",
        instruction: field.instruction,
        portalFieldIds: [field.id],
        ruleIds: [],
      }))
    return document
  })
  overview.content.sections[0].text = `The documents below are required for every ${country} Cargo Tracking Note request.`
  overview.content.sections[0].references = documents.map(({ id }) => id)
  const references = page(`${prefix}-references`, "References", "references")
  references.content.sources.push({
    id: sourceId,
    title: `Current ${country} staff instructions`,
    url: "",
    attachmentPath: "",
    note: "Required-document list supplied by AfricaCTN staff.",
  })
  return [overview, ...documents, references]
}
export function createInitialPages(): KnowledgePage[] {
  const page = (
    id: string,
    title: string,
    template: string,
    country = "Madagascar"
  ): KnowledgePage => ({
    id,
    title,
    template,
    country,
    content: content(template),
    revision: 0,
    version: null,
    publishedAt: null,
  })
  // Keep stable internal IDs for existing consumers; only populated working pages are shown.
  const standards = page("standards", "Standards", "standards", "Shared")
  standards.content.sections[2].text =
    "Write only operational knowledge. Use short Markdown sentences and bullets. Edit requirements, extraction instructions, process notes, and exceptions as text. Do not edit stable IDs, sources, mappings, form fields, headings, or metadata through routine text editing. Use AI Update with evidence for new rules, sources, links, or structural proposals. Keep one rule in one canonical document page and link to it elsewhere. Leave unsupported or ambiguous values unconfirmed."
  standards.content.sections[3].text =
    "Direct text edits create a draft and preserve all protected metadata. New rules, changed requirements, contradictions, exceptions, deletions, and structural changes require a reviewed proposal before publication. Duplicate updates make no change."
  standards.content.sections[4].text =
    "Use major versions for approved structural changes, minor versions for operational changes, and patch versions for wording that does not change meaning. Formatting-only and duplicate updates do not create versions."
  const shared = page("shared-process", "Shared Process", "process", "Shared")
  const index = page("country-index", "Country Index", "index", "Shared")
  index.content.aliases = [...configuredCountries, "MG", "MDG"]
  const overview = page("mg-overview", "Required documents", "overview")
  const process = page("mg-process", "Process", "process")
  process.content.sections[0].text =
    "Upload the shipment documents to create a certificate request.\nReview the extracted fields from top to bottom, using the available dropdown options.\nResolve missing or incorrect values before submission."
  const workingSource = "mg-current-working-instructions"
  const docs = requiredDocumentsForCountry("Madagascar").map((name) => {
    const canonicalName =
      name === "Export Declaration" ? "Export/Customs Declaration" : name
    const p = page(documentPageId(canonicalName), canonicalName, "document")
    p.content.rules.push({
      id: `mg-required-${documentPageId(canonicalName)}`,
      country: "Madagascar",
      document: canonicalName,
      instruction: "Required document.",
      requirement: "always required",
      condition: "",
      stage: "intake",
      consequence: "",
      sourceIds: [workingSource],
      effectiveFrom: "",
      effectiveTo: "",
      kind: "document",
      check: { operator: "present", fieldIds: [], expected: "" },
    })
    p.content.fields = formPresentation
      .filter((f) => sourceDocument(f.id) === canonicalName)
      .map((f) => ({
        id: sourceFieldId(f.id),
        label: f.id.startsWith("exporter")
          ? "Exporter " + f.label.toLowerCase()
          : f.id.startsWith("importer")
            ? "Importer " + f.label.toLowerCase()
            : f.label,
        document: canonicalName,
        location: "",
        requiredWhen: "",
        instruction: sharedExtractionInstructions[f.id] ?? "",
        portalFieldIds: [f.id],
        ruleIds: [],
      }))
    const legacy = madagascarOfficialRuleDefinitions.filter(
      (r) => r.documentType === canonicalName
    )
    if (legacy.length) {
      legacy.forEach((r) =>
        p.content.rules.push({
          id: r.id,
          country: "Madagascar",
          document: canonicalName,
          instruction: r.instruction,
          requirement: "always required",
          condition: "",
          stage: "intake",
          consequence: "",
          sourceIds: [workingSource],
          effectiveFrom: "",
          effectiveTo: "",
          kind: "acceptance",
          check: { operator: "interpret", fieldIds: [], expected: "" },
        })
      )
    }
    if (canonicalName === "Bill of Lading")
      p.content.rules.push({
        id: "mg-bill-of-lading-final-dated-mbl",
        country: "Madagascar",
        document: canonicalName,
        instruction: "A final, dated master Bill of Lading is required.",
        requirement: "always required",
        condition: "",
        stage: "intake",
        consequence: "Flag the request for staff review.",
        sourceIds: [workingSource],
        effectiveFrom: "",
        effectiveTo: "",
        kind: "acceptance",
        check: {
          operator: "interpret",
          fieldIds: [sourceFieldId("billOfLadingDate")],
          expected: "final master Bill of Lading with a stated date",
        },
      })
    if (canonicalName === "Commercial Invoice")
      p.content.rules.push({
        id: "mg-commercial-invoice-country-of-origin",
        country: "Madagascar",
        document: canonicalName,
        instruction: "Country of origin must be stated.",
        requirement: "always required",
        condition: "",
        stage: "intake",
        consequence: "Flag the request for staff review.",
        sourceIds: [workingSource],
        effectiveFrom: "",
        effectiveTo: "",
        kind: "acceptance",
        check: {
          operator: "present",
          fieldIds: [sourceFieldId("invoiceItems.originCountry")],
          expected: "",
        },
      })
    return p
  })
  overview.content.sections[0].text =
    "The documents below are required for every Madagascar Cargo Tracking Note request."
  overview.content.sections[0].references = docs.map((document) => document.id)

  const otherCountryPages = configuredCountries
    .filter((country) => country !== "Madagascar")
    .flatMap((country) => createCountryDefinitionPages(country))
  const fieldMap = page("mg-field-map", "Field Map", "mappings")
  fieldMap.content.mappings = formPresentation.map((f) => {
    const guidance = sharedMappingGuidance[f.id]
    return {
      id: `mg-map-${f.id.replaceAll(".", "-")}`,
      systemFieldId: f.id,
      sourceFieldIds: [sourceFieldId(f.id)],
      entryRule:
        sharedExtractionInstructions[f.id] ??
        "Use the documented value and existing dropdown options.",
      ifMissing: "Leave blank and flag for staff review.",
      fallbackSourceIds: [],
      transform: guidance?.transform ?? ("none" as const),
      unit: guidance?.unit ?? "",
      repeated: f.repeated,
      ruleIds: [],
    }
  })
  const references = page("mg-references", "References", "references")
  references.content.sources.push({
    id: workingSource,
    title: "Current Madagascar working instructions",
    url: "",
    attachmentPath: "",
    note: "Required documents, document requirements and process retained from the existing application.",
  })
  references.content.sources.push({
    id: "mg-invoice-workbook",
    title: "Existing invoice items workbook",
    url: "/madagascar-bsc/invoice_template_En.xlsx",
    attachmentPath: "",
    note: "Existing application template and dropdown values; does not establish country requirements.",
  })
  references.content.sections[2].references = ["mg-invoice-workbook"]
  return [
    standards,
    shared,
    index,
    overview,
    process,
    ...docs,
    page("mg-system", "System Guide", "system"),
    fieldMap,
    page("mg-exceptions", "Exceptions", "exceptions"),
    references,
    ...otherCountryPages,
  ]
}
