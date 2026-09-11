import "server-only"
import { readCertificateLayouts } from "@/lib/certificate-layout/server"
import {
  layoutPlacements,
  resolveLayout,
} from "@/lib/certificate-layout/schema"
import { knowledgeWithLayout } from "@/lib/certificate-layout/knowledge"
import { randomUUID } from "node:crypto"
import { type KnowledgeReview, type Observations, type Stage } from "./schema"
import { effectiveRules, evaluateReview, publishedPages } from "./engine"
import {
  localDocumentPages,
  likelyBillOfLadingFiles,
  localBillOfLadingCountry,
} from "./ai"
import {
  classifyDocuments,
  inspectDocuments,
  observationsFromDocumentAnalysis,
  reconcileDocuments,
  type DocumentAnalysis,
  type DocumentClassification,
  type DocumentExtractionProfile,
  type SupportedCountry,
} from "./openai-document-provider"
import {
  databaseError,
  type okfSession,
  readKnowledge,
  OkfError,
} from "./server"
import { getMadagascarDropdownOptions } from "@/lib/madagascar-bsc-server"
import {
  madagascarFieldCatalog,
  type MadagascarAnalysis,
  type MadagascarInvoiceItem,
} from "@/lib/madagascar-bsc"
import { sharedExtractionInstructions } from "./seed"
import {
  correctionLearningInstruction,
  correctionLearningKey,
  correctionLearningSummary,
  normalizeCorrectionLearning,
  normalizedCorrectionTarget,
  parseCorrectionLearning,
  type CorrectionSourceLearning,
} from "./correction-learning"

type Session = Awaited<ReturnType<typeof okfSession>>
type CorrectionExample = {
  country: string
  target: string
  label: string
  before: string
  after: string
  reason: string
  verified: boolean
  documentType: string
  basis?: CorrectionSourceLearning["basis"]
  explanation?: string
  reasoning?: string
  reproduction?: string
}
export type UploadReviewProgress = {
  stage: "country" | "document"
  label: string
  review: KnowledgeReview | null
  fieldKeys: string[]
  partialFields?: Array<{ fieldKey: string; value: string }>
}

type UploadReviewProgressHandler = (
  progress: UploadReviewProgress
) => void | Promise<void>

const documentPriority = new Map([
  ["Bill of Lading", 0],
  ["Commercial Invoice", 1],
  ["Packing List", 2],
  ["Export/Customs Declaration", 3],
  ["Export Declaration", 3],
  ["Customs Declaration", 3],
  ["DU (Documento Unico)", 4],
  ["Certificate of Origin", 5],
  ["Freight Invoice", 6],
])
const priorityPortalFields: Record<string, string[]> = {
  "Bill of Lading": [
    "exporterName",
    "importerName",
    "loadingCity",
    "unloadingCity",
  ],
  "Commercial Invoice": [
    "incoterm",
    "incotermPlace",
    "fobValue",
    "currency",
    "commercialInvoiceReference",
    "commercialInvoiceDate",
  ],
}
const progressFieldLabels: Record<string, string> = {
  exporterName: "exporter name",
  importerName: "importer name",
  incoterm: "Incoterm",
  incotermPlace: "Incoterm place",
  fobValue: "FOB value",
  currency: "currency",
  commercialInvoiceReference: "commercial invoice reference",
  commercialInvoiceDate: "commercial invoice date",
}

function extractionInstruction(systemFieldId: string, published: string) {
  const shared = sharedExtractionInstructions[systemFieldId]?.trim() ?? ""
  const country = published.trim()
  if (!shared) return country
  if (!country || country === shared) return shared
  return `${country}\n\nApply this shared extraction convention unless the country instruction explicitly overrides it: ${shared}`
}

function applicationDocumentType(
  documentType: DocumentClassification["documentType"]
): Observations["documents"][number]["documentType"] {
  if (documentType === "Other or Unknown") return "Unknown"
  return documentType
}

function identificationFromClassifications(
  classifications: DocumentClassification[],
  files: File[],
  supportedCountries: SupportedCountry[]
): Pick<
  Observations,
  "country" | "shipments" | "groupingAmbiguous" | "documents"
> {
  const canonicalCountry = (candidate: string | null) => {
    if (!candidate) return ""
    const normalized = candidate.trim().toLowerCase()
    return (
      supportedCountries.find(({ country, aliases }) =>
        [country, ...aliases].some(
          (value) => value.trim().toLowerCase() === normalized
        )
      )?.country ?? ""
    )
  }
  const bills = classifications.filter(
    (classification) => classification.documentType === "Bill of Lading"
  )
  const billCountries = bills.flatMap((classification) => {
    const country = canonicalCountry(classification.consigneeCountry)
    return country ? [{ classification, country }] : []
  })
  const countries = [...new Set(billCountries.map(({ country }) => country))]
  const selected = countries.length === 1 ? countries[0] : ""
  const selectedEvidence = billCountries.flatMap(
    ({ classification, country }) =>
      country === selected && classification.consigneeCountrySource.page
        ? [
            {
              document: classification.originalFilename,
              page: String(classification.consigneeCountrySource.page),
              observedText:
                classification.consigneeCountrySource.text ?? country,
            },
          ]
        : []
  )
  const references = classifications.flatMap(
    (classification) => classification.shipmentReferences
  )
  const shipmentEvidence = classifications.flatMap((classification) =>
    classification.classificationSource.page
      ? [
          {
            document: classification.originalFilename,
            page: String(classification.classificationSource.page),
            observedText:
              classification.classificationSource.text ??
              applicationDocumentType(classification.documentType),
          },
        ]
      : []
  )
  return {
    country: {
      name: selected,
      status:
        countries.length > 1
          ? "ambiguous"
          : selected
            ? "supported"
            : "unconfirmed",
      basis: selected ? "consignee address" : "unconfirmed",
      evidence: selectedEvidence,
      finalDestination: selected,
      dischargePort: "",
      transitCountries: [],
      explanation:
        countries.length > 1
          ? "Bills of Lading contain conflicting consignee countries."
          : selected
            ? "The consignee country was read from the Bill of Lading and matched to Certificate Settings."
            : "No supported consignee country could be confirmed from a Bill of Lading.",
    },
    shipments: [
      {
        id: references[0] || "uploaded-certificate",
        documentNames: files.map((file) => file.name),
        evidence: shipmentEvidence,
      },
    ],
    groupingAmbiguous: false,
    documents: classifications.map((classification) => ({
      fileName: classification.originalFilename,
      documentType: applicationDocumentType(classification.documentType),
      status: classification.documentStatus,
      evidence: classification.classificationSource.page
        ? [
            {
              document: classification.originalFilename,
              page: String(classification.classificationSource.page),
              observedText:
                classification.classificationSource.text ??
                applicationDocumentType(classification.documentType),
            },
          ]
        : [],
    })),
  }
}

function correctionText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object") {
    const candidate = (value as { value?: unknown }).value
    if (typeof candidate === "string") return candidate.trim()
  }
  return ""
}

async function readCorrectionMemory(
  client: Session["client"]
): Promise<CorrectionExample[]> {
  try {
    const [corrections, requests, intake] = await Promise.all([
      client
        .from("okf_corrections")
        .select("request_id,target,before_value,after_value,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      client.from("madagascar_bsc_requests").select("id,country").limit(500),
      client
        .from("okf_intake")
        .select("page_id,note,result,created_at")
        .like("page_id", "correction-learning:%")
        .order("created_at", { ascending: false })
        .limit(200),
    ])
    if (corrections.error || requests.error || intake.error) return []
    const countries = new Map(
      (requests.data ?? []).map((request) => [
        String(request.id),
        String(request.country),
      ])
    )
    const explained = (intake.data ?? []).flatMap((entry) => {
      const result = entry.result as
        | {
            country?: unknown
            learning?: CorrectionSourceLearning
          }
        | undefined
      const learning = result?.learning
        ? normalizeCorrectionLearning(result.learning)
        : undefined
      const country = typeof result?.country === "string" ? result.country : ""
      if (learning?.version !== 1 || !learning.verified || !country) return []
      return [
        {
          country,
          target: learning.target,
          label: learning.label,
          before: "",
          after: learning.matchedValue.slice(0, 500),
          reason: correctionLearningSummary(learning).slice(0, 500),
          verified: true,
          documentType: learning.documentType,
          basis: learning.basis,
          explanation: learning.explanation,
          reasoning: learning.reasoning,
          reproduction: learning.reproduction,
        },
      ]
    })
    const corrected = (corrections.data ?? []).flatMap((correction) => {
      const country = countries.get(String(correction.request_id)) ?? ""
      const before = correctionText(correction.before_value)
      const after = correctionText(correction.after_value)
      const learning = parseCorrectionLearning(correction.reason)
      if (learning && !learning.verified) return []
      const target =
        learning?.target ??
        normalizedCorrectionTarget(String(correction.target ?? ""))
      if (!country || !target || !after || before === after) return []
      return [
        {
          country,
          target,
          label: learning?.label ?? target,
          before: before.slice(0, 500),
          after: after.slice(0, 500),
          reason: learning
            ? correctionLearningSummary(learning).slice(0, 500)
            : String(correction.reason ?? "").slice(0, 500),
          verified: Boolean(learning?.verified),
          documentType: learning?.documentType ?? "",
          basis: learning?.basis,
          explanation: learning?.explanation,
          reasoning: learning?.reasoning,
          reproduction: learning?.reproduction,
        },
      ]
    })
    const unique = new Map<string, CorrectionExample>()
    for (const learning of [...explained, ...corrected]) {
      const key = `${learning.country.toLocaleLowerCase()}:${learning.target.toLocaleLowerCase()}`
      if (!unique.has(key)) unique.set(key, learning)
    }
    return [...unique.values()].slice(0, 200)
  } catch {
    // Corrections improve extraction but must never block a new certificate.
    return []
  }
}

export async function reviewUploads(
  session: Session,
  files: File[],
  requestId: string,
  stage: Stage,
  date: string,
  onProgress?: UploadReviewProgressHandler,
  signal?: AbortSignal
) {
  if (!files.length)
    throw new OkfError("Upload at least one shipment document.")
  if (new Set(files.map((f) => f.name)).size !== files.length)
    throw new OkfError(
      "Use distinct file names so source evidence can identify each document."
    )
  const originalStatePromise = readKnowledge(session.client)
  const originalOptionsPromise = getMadagascarDropdownOptions()
  const correctionMemoryPromise = readCorrectionMemory(session.client)
  const filenameBills = files.filter((file) =>
    /(?:^|[^a-z])(?:bill[\s._-]*of[\s._-]*lading|waybill)(?:[^a-z]|$)/i.test(
      file.name
    )
  )
  const localBillCandidatesPromise = filenameBills.length
    ? Promise.resolve(filenameBills)
    : likelyBillOfLadingFiles(files)
  const layouts = await readCertificateLayouts(session.client)
  const supportedCountries = layouts.map((row) => ({
    country: row.layout.country,
    aliases: row.layout.aliases,
  }))
  const localBillCandidates = await localBillCandidatesPromise
  const fastFiles = localBillCandidates.length ? localBillCandidates : files
  const localCountry = await localBillOfLadingCountry(
    fastFiles,
    supportedCountries
  )
  let bootstrapClassifications: DocumentClassification[] = []
  if (!localCountry) {
    const firstCandidates = fastFiles.slice(0, 2)
    bootstrapClassifications = await classifyDocuments(
      firstCandidates,
      supportedCountries,
      signal
    )
    let bootstrapIdentification = identificationFromClassifications(
      bootstrapClassifications,
      files,
      supportedCountries
    )
    if (bootstrapIdentification.country.status === "unconfirmed") {
      const attempted = new Set(firstCandidates.map((file) => file.name))
      const remainingFiles = files.filter((file) => !attempted.has(file.name))
      if (remainingFiles.length) {
        bootstrapClassifications.push(
          ...(await classifyDocuments(
            remainingFiles,
            supportedCountries,
            signal
          ))
        )
        bootstrapIdentification = identificationFromClassifications(
          bootstrapClassifications,
          files,
          supportedCountries
        )
      }
    }
  }
  const bootstrapIdentification = identificationFromClassifications(
    bootstrapClassifications,
    files,
    supportedCountries
  )
  const fastIdentification = localCountry
    ? ({
        country: {
          name: localCountry.country,
          status: "supported",
          basis: "consignee address",
          evidence: [
            {
              document: localCountry.fileName,
              page: localCountry.page,
              observedText: localCountry.observedText,
            },
          ],
          finalDestination: localCountry.country,
          dischargePort: "",
          transitCountries: [],
          explanation:
            "Matched the Bill of Lading consignee country locally against Certificate Settings.",
        },
        documents: [
          {
            fileName: localCountry.fileName,
            documentType: "Bill of Lading",
            status: "unconfirmed",
            evidence: [
              {
                document: localCountry.fileName,
                page: localCountry.page,
                observedText: localCountry.observedText,
              },
            ],
          },
        ],
      } satisfies Pick<Observations, "country" | "documents">)
    : {
        country: bootstrapIdentification.country,
        documents: bootstrapIdentification.documents,
      }
  const fastBills = fastIdentification.documents.filter(
    (document) =>
      document.documentType === "Bill of Lading" &&
      fastFiles.some((file) => file.name === document.fileName)
  )
  const fastCountryHasBillEvidence = fastIdentification.country.evidence.some(
    (evidence) => fastBills.some((bill) => bill.fileName === evidence.document)
  )
  if (!fastBills.length || !fastCountryHasBillEvidence) {
    fastIdentification.country = {
      ...fastIdentification.country,
      name: "",
      status: "unconfirmed",
      basis: "unconfirmed",
      evidence: [],
      finalDestination: "",
      explanation: "The Bill of Lading consignee country is not confirmed.",
    }
  }
  let certificateLayout = resolveLayout(
    layouts,
    fastIdentification.country.name
  )
  if (certificateLayout && fastIdentification.country.status === "supported")
    fastIdentification.country.name = certificateLayout.layout.country
  if (!certificateLayout && fastIdentification.country.status === "supported")
    fastIdentification.country.status = "unsupported"

  if (onProgress) {
    const provisionalObservations = {
      ...fastIdentification,
      shipments: [],
      groupingAmbiguous: true,
      fields: [],
      conditions: [],
      findings: [],
    } as KnowledgeReview["observations"]
    const provisionalState = certificateLayout
      ? knowledgeWithLayout({ generation: 0, pages: [] }, certificateLayout)
      : { generation: 0, pages: [] }
    const provisionalReview = evaluateReview(
      provisionalState,
      provisionalObservations,
      {},
      { id: randomUUID(), requestId, stage, date }
    )
    await onProgress({
      stage: "country",
      label: certificateLayout
        ? `${certificateLayout.layout.country} layout loaded from Certificate Settings`
        : "Bill of Lading destination needs review",
      review: {
        ...provisionalReview,
        ...(certificateLayout ? { certificateLayout } : {}),
      },
      fieldKeys: [],
    })
  }

  const classificationFailures = bootstrapClassifications.filter(
    (classification) => classification.error
  )
  if (
    bootstrapClassifications.length === files.length &&
    classificationFailures.length === files.length
  )
    throw new OkfError(
      "OpenAI could not read any uploaded document. Check the API configuration and retry.",
      502
    )
  const [originalState, originalOptions, correctionMemory] = await Promise.all([
    originalStatePromise,
    originalOptionsPromise,
    correctionMemoryPromise,
  ])
  const initialIdentification = localCountry
    ? {
        country: fastIdentification.country,
        shipments: [
          {
            id: "uploaded-certificate",
            documentNames: files.map((file) => file.name),
            evidence: fastIdentification.country.evidence,
          },
        ],
        groupingAmbiguous: false,
        documents: fastIdentification.documents,
      }
    : bootstrapIdentification
  const initialDocuments = new Map(
    initialIdentification.documents.map((document) => [
      document.fileName,
      document,
    ])
  )
  const identification = {
    ...initialIdentification,
    documents: files.map(
      (file) =>
        initialDocuments.get(file.name) ?? {
          fileName: file.name,
          documentType: "Unknown" as const,
          status: "unconfirmed" as const,
          evidence: [],
        }
    ),
  }
  // A New ECTN upload is the shipment boundary, so uploaded documents stay in
  // one group and never require a redundant confirmation step.
  certificateLayout = resolveLayout(layouts, identification.country.name)
  if (certificateLayout && identification.country.status === "supported")
    identification.country.name = certificateLayout.layout.country
  if (!certificateLayout && identification.country.status === "supported")
    identification.country.status = "unsupported"
  const state = certificateLayout
    ? knowledgeWithLayout(originalState, certificateLayout)
    : originalState
  const options =
    certificateLayout?.country_key === "madagascar"
      ? { ...originalOptions }
      : {}
  for (const field of certificateLayout?.layout.fields ?? []) {
    if (field.control === "select") options[field.id] = field.options
  }
  const observations = {
    ...identification,
    fields: [],
    conditions: [],
    findings: classificationFailures.map((classification) => ({
      ruleId: "classification-runtime",
      status: "unconfirmed" as const,
      evidence: [],
      explanation: `${classification.originalFilename} could not be classified: ${classification.error}`,
    })),
  } as KnowledgeReview["observations"]
  const documentAnalyses: DocumentAnalysis[] = []
  function evaluate(): KnowledgeReview {
    const review = evaluateReview(state, observations, options, {
      id: randomUUID(),
      requestId,
      stage,
      date,
    })
    return { ...review, ...(certificateLayout ? { certificateLayout } : {}) }
  }
  const countryPages = publishedPages(state).filter(
    (p) => p.country === identification.country.name
  )
  if (onProgress && fastIdentification.country.status === "unconfirmed") {
    await onProgress({
      stage: "country",
      label:
        identification.country.status === "supported"
          ? `${identification.country.name} certificate rules found`
          : "Destination needs review",
      review: evaluate(),
      fieldKeys: [],
    })
  }
  if (
    identification.country.status === "supported" &&
    certificateLayout &&
    ["final destination", "consignee address"].includes(
      identification.country.basis
    ) &&
    identification.country.finalDestination &&
    !identification.groupingAmbiguous &&
    identification.shipments.length === 1 &&
    countryPages.length
  ) {
    const rules = effectiveRules(
      countryPages,
      identification.country.name,
      stage,
      date
    )
    const mappings = countryPages.flatMap((page) => page.content.mappings)
    const learnedExtractions = new Map<
      string,
      Array<{
        id: string
        label: string
        document: string
        location: string
        requiredWhen: string
        instruction: string
        portalFieldIds: string[]
        ruleIds: string[]
      }>
    >()
    const learnedKeys = new Set<string>()
    for (const learning of correctionMemory) {
      if (
        !learning.verified ||
        learning.country !== identification.country.name
      )
        continue
      const mapping = mappings.find(
        (candidate) => candidate.systemFieldId === learning.target
      )
      const learnedDocumentType =
        learning.basis === "reasoned inference"
          ? countryPages
              .flatMap((page) => page.content.fields)
              .find((field) => mapping?.sourceFieldIds.includes(field.id))
              ?.document || learning.documentType
          : learning.documentType
      const key = correctionLearningKey(learning.country, learning)
      if (
        !mapping ||
        learnedKeys.has(key) ||
        !documentPriority.has(learnedDocumentType)
      )
        continue
      learnedKeys.add(key)
      const learnedId = `learned-${learnedDocumentType}-${learning.target}`
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .slice(0, 150)
      if (!mapping.fallbackSourceIds.includes(learnedId))
        mapping.fallbackSourceIds.push(learnedId)
      const fields = learnedExtractions.get(learnedDocumentType) ?? []
      fields.push({
        id: learnedId,
        label: learning.label,
        document: learnedDocumentType,
        location: "",
        requiredWhen: "",
        instruction: correctionLearningInstruction(learning),
        portalFieldIds: [learning.target],
        ruleIds: [],
      })
      learnedExtractions.set(learnedDocumentType, fields)
    }
    const localEvidencePages = new Map<
      string,
      Awaited<ReturnType<typeof localDocumentPages>>
    >()
    const mappedObservation = (systemFieldId: string) => {
      const mapping = mappings.find(
        (candidate) => candidate.systemFieldId === systemFieldId
      )
      if (!mapping) return undefined
      return observations.fields.find(
        (field) =>
          [...mapping.sourceFieldIds, ...mapping.fallbackSourceIds].includes(
            field.id
          ) &&
          field.status === "passed" &&
          field.value
      )
    }
    const localMatch = (documentType: string, pattern: RegExp) => {
      for (const document of identification.documents) {
        if (document.documentType !== documentType) continue
        for (const page of localEvidencePages.get(document.fileName) ?? []) {
          const match = pattern.exec(page.text)
          pattern.lastIndex = 0
          if (!match || match.index === undefined) continue
          const start = Math.max(0, match.index - 70)
          const end = Math.min(
            page.text.length,
            match.index + match[0].length + 70
          )
          return {
            match,
            evidence: {
              document: document.fileName,
              page: page.page,
              observedText: page.text.slice(start, end).trim(),
            },
          }
        }
      }
      return undefined
    }
    const setDerived = (
      systemFieldId: string,
      value: string,
      evidence: KnowledgeReview["observations"]["fields"][number]["evidence"],
      note: string
    ) => {
      if (!value || !evidence.length || mappedObservation(systemFieldId))
        return false
      const allowed = options[systemFieldId]
      if (allowed?.length && !allowed.includes(value)) return false
      const mapping = mappings.find(
        (candidate) => candidate.systemFieldId === systemFieldId
      )
      if (!mapping) return false
      const sourceIds = [
        ...mapping.sourceFieldIds,
        ...mapping.fallbackSourceIds,
      ]
      const id = sourceIds[0]
      if (!id) return false
      observations.fields = observations.fields.filter(
        (field) => !sourceIds.includes(field.id)
      )
      observations.fields.push({
        id,
        observedText: evidence.map((item) => item.observedText).join(" | "),
        value,
        status: "passed",
        evidence,
        note,
        row: null,
        rowLabel: "",
      })
      return true
    }
    const applyDeterministicDerivations = () => {
      const changed: string[] = []
      const record = (
        field: string,
        value: string,
        evidence: KnowledgeReview["observations"]["fields"][number]["evidence"],
        note: string
      ) => {
        if (setDerived(field, value, evidence, note)) changed.push(field)
      }

      const billContainer = localMatch(
        "Bill of Lading",
        /\b(?:[A-Z]{4}\s?\d{7}|\d+\s+containers?|containers?\s+(?:said|no\.?|number)|(?:20|40)\s*(?:'|FT|FEET)?\s*(?:DRY|DV|DC|GP|HC|HQ|RF|RH|REEF(?:ER)?|OT|FR|TK))\b/i
      )
      const billSea = localMatch(
        "Bill of Lading",
        /\b(?:ocean|sea|vessel|voyage|port of loading|port of discharge|bill of lading|waybill)\b/i
      )
      const size = localMatch(
        "Bill of Lading",
        /\b(20|40)\s*(?:'|FT|FEET|FOOT)?\s*(?:DRY|DV|DC|GP|HC|HQ|RF|RH|REEF(?:ER)?|OT|FR|TK)\b/i
      )
      const type = localMatch(
        "Bill of Lading",
        /\b(?:20|40)\s*(?:'|FT|FEET|FOOT)?\s*(DRY|DV|DC|GP|HC|HQ|RF|RH|REEF(?:ER)?|OT|FR|TK)\b/i
      )
      if (billSea)
        record(
          "shipmentMethod",
          "Sea",
          [billSea.evidence],
          "Derived deterministically from maritime Bill of Lading evidence."
        )
      if (billContainer || mappedObservation("containerNumber")) {
        const evidence = billContainer
          ? [billContainer.evidence]
          : mappedObservation("containerNumber")!.evidence
        record(
          "cargoType",
          "Full container load",
          evidence,
          "Derived deterministically because the Bill of Lading identifies containerized cargo."
        )
      }
      if (size) {
        record(
          "containerSize",
          size.match[1] === "20" ? "20 Feet" : "40 Feet",
          [size.evidence],
          "Normalized deterministically from the container size code on the Bill of Lading."
        )
      }
      if (type) {
        const code = type.match[1].toUpperCase()
        const normalizedType = /^(?:RF|RH|REEF)/.test(code)
          ? "Reefer"
          : code === "OT"
            ? "Open Top"
            : code === "FR"
              ? "FlatRack"
              : code === "TK"
                ? "Tank"
                : "Dry"
        record(
          "containerType",
          normalizedType,
          [type.evidence],
          "Normalized deterministically from the container type code on the Bill of Lading."
        )
      }

      let incoterm = mappedObservation("incoterm")
      const explicitIncoterm = localMatch(
        "Commercial Invoice",
        /\b(FOB|CFR|CIF)\b/i
      )
      const freightAmount = localMatch(
        "Commercial Invoice",
        /\bfreight\b[^\d$€£]{0,30}[$€£]?\s*\d/i
      )
      const insuranceAmount = localMatch(
        "Commercial Invoice",
        /\binsurance\b[^\d$€£]{0,30}[$€£]?\s*\d/i
      )
      const fobValue = mappedObservation("fobValue")
      if (!incoterm && explicitIncoterm) {
        record(
          "incoterm",
          explicitIncoterm.match[1].toUpperCase(),
          [explicitIncoterm.evidence],
          "Read deterministically from the Commercial Invoice."
        )
        incoterm = mappedObservation("incoterm")
      }
      if (!incoterm && fobValue) {
        const inferredIncoterm = insuranceAmount
          ? "CIF"
          : freightAmount
            ? "CFR"
            : "FOB"
        const componentEvidence = [
          ...fobValue.evidence,
          ...(freightAmount ? [freightAmount.evidence] : []),
          ...(insuranceAmount ? [insuranceAmount.evidence] : []),
        ]
        record(
          "incoterm",
          inferredIncoterm,
          componentEvidence,
          inferredIncoterm === "FOB"
            ? "Assumed FOB because the Commercial Invoice supplies a commercial goods value without a freight or insurance amount."
            : `Derived ${inferredIncoterm} from the Commercial Invoice's stated value components.`
        )
        incoterm = mappedObservation("incoterm")
      }
      if (incoterm && !mappedObservation("incotermPlace")) {
        const placeField = ["CFR", "CIF"].includes(incoterm.value)
          ? "unloadingCity"
          : incoterm.value === "FOB"
            ? "loadingCity"
            : ""
        const place = placeField ? mappedObservation(placeField) : undefined
        if (place)
          record(
            "incotermPlace",
            place.value,
            place.evidence,
            `${incoterm.value} Incoterm place derived from the corresponding ${placeField === "loadingCity" ? "loading" : "destination"} port.`
          )
      }
      return changed
    }
    const mappedSourceIds = new Set(
      mappings.flatMap((mapping) => [
        ...mapping.sourceFieldIds,
        ...mapping.fallbackSourceIds,
      ])
    )
    const layoutFieldOrder = new Map(
      layoutPlacements(certificateLayout.layout).map((placement, index) => [
        placement.fieldId,
        index,
      ])
    )
    const profiles: DocumentExtractionProfile[] = []
    const profileFields = new Map<string, DocumentExtractionProfile["fields"]>()
    const documentTypes = [
      "Bill of Lading",
      "Commercial Invoice",
      "Freight Invoice",
      "Packing List",
      "Export Declaration",
      "Customs Declaration",
      "DU (Documento Unico)",
      "Certificate of Origin",
    ].sort(
      (left, right) =>
        (documentPriority.get(left) ?? 99) - (documentPriority.get(right) ?? 99)
    )

    for (const documentType of documentTypes) {
      const documentPages = countryPages.filter(
        (page) =>
          page.template === "document" &&
          (page.title === documentType ||
            (["Export Declaration", "Customs Declaration"].includes(
              documentType
            ) &&
              page.title === "Export/Customs Declaration"))
      )
      const pageIds = new Set(documentPages.map((page) => page.id))
      const allPageRules = rules.filter(({ pageId }) => pageIds.has(pageId))
      const ruleFieldIds = new Set(
        allPageRules.flatMap(({ rule }) => rule.check.fieldIds)
      )
      const allExtraction = [
        ...new Map(
          [
            ...documentPages.flatMap((page) => page.content.fields),
            ...(learnedExtractions.get(documentType) ?? []),
          ]
            .filter(
              (field) =>
                mappedSourceIds.has(field.id) || ruleFieldIds.has(field.id)
            )
            .map((field) => [field.id, field])
        ).values(),
      ].sort((left, right) => {
        const rank = (fieldId: string) =>
          Math.min(
            ...mappings
              .filter((mapping) =>
                [
                  ...mapping.sourceFieldIds,
                  ...mapping.fallbackSourceIds,
                ].includes(fieldId)
              )
              .map(
                (mapping) =>
                  layoutFieldOrder.get(mapping.systemFieldId) ??
                  Number.MAX_SAFE_INTEGER
              ),
            Number.MAX_SAFE_INTEGER
          )
        return rank(left.id) - rank(right.id)
      })
      if (!allExtraction.length && !allPageRules.length) continue

      const documentFieldIds = new Set(allExtraction.map((field) => field.id))
      const orderedFieldKeys = mappings
        .filter((mapping) =>
          [...mapping.sourceFieldIds, ...mapping.fallbackSourceIds].some(
            (fieldId) => documentFieldIds.has(fieldId)
          )
        )
        .map((mapping) => mapping.systemFieldId)
        .sort(
          (left, right) =>
            (layoutFieldOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (layoutFieldOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
        )
      const configuredPriority = priorityPortalFields[documentType] ?? []
      const leadingLayoutFields = new Set(orderedFieldKeys.slice(0, 4))
      const priorityFieldKeys = orderedFieldKeys.filter(
        (fieldKey) =>
          leadingLayoutFields.has(fieldKey) ||
          configuredPriority.includes(fieldKey)
      )
      const prioritySourceIds = new Set(
        mappings
          .filter((mapping) =>
            priorityFieldKeys.includes(mapping.systemFieldId)
          )
          .flatMap((mapping) => [
            ...mapping.sourceFieldIds,
            ...mapping.fallbackSourceIds,
          ])
      )
      const priorityExtraction = allExtraction.filter((field) =>
        prioritySourceIds.has(field.id)
      )
      const remainingExtraction = allExtraction.filter(
        (field) => !prioritySourceIds.has(field.id)
      )
      const prioritizedExtraction = [
        ...priorityExtraction,
        ...remainingExtraction,
      ]
      const extractionFields = prioritizedExtraction.map((field) => {
        const mapping = mappings.find((candidate) =>
          [
            ...candidate.sourceFieldIds,
            ...candidate.fallbackSourceIds,
          ].includes(field.id)
        )
        const systemFieldId = mapping?.systemFieldId ?? ""
        const optionKey = systemFieldId.startsWith("invoiceItems.")
          ? `invoiceItem${systemFieldId.slice(13, 14).toUpperCase()}${systemFieldId.slice(14)}`
          : systemFieldId
        return {
          id: field.id,
          label: field.label,
          instruction: extractionInstruction(systemFieldId, field.instruction),
          repeated: Boolean(mapping?.repeated),
          critical: priorityFieldKeys.includes(systemFieldId),
          systemFieldId,
          options: options[optionKey] ?? [],
          corrections: correctionMemory
            .filter(
              (example) =>
                example.country === identification.country.name &&
                example.target === systemFieldId &&
                (!example.documentType || example.documentType === documentType)
            )
            .slice(0, 3)
            .map(({ before, after, reason }) => ({ before, after, reason })),
        }
      })
      if (extractionFields.length) {
        profiles.push({ documentType, fields: extractionFields })
        profileFields.set(documentType, extractionFields)
      }
    }

    const inspectedClassifications = new Map(
      bootstrapClassifications.map((classification) => [
        classification.originalFilename,
        classification,
      ])
    )
    const inspection = await inspectDocuments(
      files,
      profiles,
      supportedCountries,
      signal,
      (_file, partialField) => {
        const mapping = mappings.find((candidate) =>
          [
            ...candidate.sourceFieldIds,
            ...candidate.fallbackSourceIds,
          ].includes(partialField.id)
        )
        if (!mapping || mapping.repeated || !onProgress) return
        void onProgress({
          stage: "document",
          label: `Reading ${progressFieldLabels[mapping.systemFieldId] ?? mapping.systemFieldId}`,
          review: null,
          fieldKeys: [],
          partialFields: [
            { fieldKey: mapping.systemFieldId, value: partialField.value },
          ],
        })
      },
      async (file, result) => {
        inspectedClassifications.set(file.name, result.classification)
        documentAnalyses.push(result.analysis)
        const fields =
          profileFields.get(result.classification.documentType) ?? []
        const fieldIds = new Set(fields.map((field) => field.id))
        const nextFields = observationsFromDocumentAnalysis(
          result.analysis,
          fields
        )
        observations.fields = [
          ...observations.fields.filter(
            (field) =>
              !fieldIds.has(field.id) ||
              !field.evidence.some(
                (evidence) => evidence.document === file.name
              )
          ),
          ...nextFields,
        ]
        const document = {
          fileName: file.name,
          documentType: applicationDocumentType(
            result.classification.documentType
          ),
          status: result.classification.documentStatus,
          evidence: result.classification.classificationSource.page
            ? [
                {
                  document: file.name,
                  page: String(result.classification.classificationSource.page),
                  observedText:
                    result.classification.classificationSource.text ??
                    result.classification.documentType,
                },
              ]
            : [],
        }
        identification.documents = identification.documents.map((current) =>
          current.fileName === file.name ? document : current
        )
        if (onProgress) {
          const completedKeys = mappings.flatMap((mapping) =>
            nextFields.some(
              (field) =>
                field.status === "passed" &&
                [
                  ...mapping.sourceFieldIds,
                  ...mapping.fallbackSourceIds,
                ].includes(field.id)
            )
              ? [mapping.systemFieldId]
              : []
          )
          await onProgress({
            stage: "document",
            label: `${result.classification.documentType} read`,
            review: evaluate(),
            fieldKeys: [...new Set(completedKeys)],
          })
        }
      },
      new Map(
        bootstrapClassifications.map((classification) => [
          classification.originalFilename,
          classification,
        ])
      )
    )
    const successfullyInspectedFiles = new Set(
      inspection.documents.map(
        ({ classification }) => classification.originalFilename
      )
    )
    observations.findings = observations.findings.filter(
      (finding) =>
        finding.ruleId !== "classification-runtime" ||
        ![...successfullyInspectedFiles].some((fileName) =>
          finding.explanation.startsWith(`${fileName} `)
        )
    )
    const finalFailures = inspection.failures
    const classifications = [...inspectedClassifications.values()]
    if (!classifications.length)
      throw new OkfError(
        "OpenAI could not read any uploaded document. Check the API configuration and retry.",
        502
      )
    const detailedIdentification = identificationFromClassifications(
      classifications,
      files,
      supportedCountries
    )
    identification.country =
      fastIdentification.country.status !== "unconfirmed"
        ? fastIdentification.country
        : detailedIdentification.country
    identification.shipments = detailedIdentification.shipments
    identification.groupingAmbiguous = false
    const detailedDocuments = new Map(
      detailedIdentification.documents.map((document) => [
        document.fileName,
        document,
      ])
    )
    identification.documents = files.map(
      (file) =>
        detailedDocuments.get(file.name) ??
        identification.documents.find(
          (document) => document.fileName === file.name
        ) ?? {
          fileName: file.name,
          documentType: "Unknown" as const,
          status: "unreadable" as const,
          evidence: [],
        }
    )
    observations.country = identification.country
    observations.shipments = identification.shipments
    observations.groupingAmbiguous = identification.groupingAmbiguous
    observations.documents = identification.documents

    await Promise.all(
      identification.documents
        .filter((document) =>
          ["Bill of Lading", "Commercial Invoice"].includes(
            document.documentType
          )
        )
        .map(async (document) => {
          const file = files.find(
            (candidate) => candidate.name === document.fileName
          )
          if (file)
            localEvidencePages.set(file.name, await localDocumentPages(file))
        })
    )
    const derivedFieldKeys = applyDeterministicDerivations()
    if (onProgress && derivedFieldKeys.length)
      await onProgress({
        stage: "document",
        label: "Applying shipment rules",
        review: evaluate(),
        fieldKeys: derivedFieldKeys,
      })

    const reconciliationMappings = mappings.flatMap((mapping) =>
      [...mapping.sourceFieldIds, ...mapping.fallbackSourceIds].map(
        (sourceFieldId) => ({
          sourceFieldId,
          systemFieldId: mapping.systemFieldId,
          repeated: mapping.repeated,
        })
      )
    )
    const fieldsBySystemId = new Map<string, Set<string>>()
    for (const mapping of reconciliationMappings) {
      if (mapping.repeated) continue
      const filesWithValues = new Set(
        documentAnalyses.flatMap((analysis) =>
          analysis.fields.some(
            (field) =>
              field.id === mapping.sourceFieldId && field.value !== null
          )
            ? [analysis.originalFilename]
            : []
        )
      )
      const current = fieldsBySystemId.get(mapping.systemFieldId) ?? new Set()
      filesWithValues.forEach((filename) => current.add(filename))
      fieldsBySystemId.set(mapping.systemFieldId, current)
    }
    const needsReconciliation =
      documentAnalyses.some(
        (analysis) => analysis.possibleConflicts.length > 0
      ) ||
      [...fieldsBySystemId.values()].some((filenames) => filenames.size > 1)
    if (needsReconciliation) {
      try {
        const documentForSourceField = new Map(
          countryPages.flatMap((page) =>
            page.content.fields.map((field) => [field.id, page.title] as const)
          )
        )
        const reconciliation = await reconcileDocuments(
          documentAnalyses,
          mappings.flatMap((mapping) =>
            [...mapping.sourceFieldIds, ...mapping.fallbackSourceIds].map(
              (sourceFieldId) => ({
                sourceFieldId,
                systemFieldId: mapping.systemFieldId,
                authoritativeDocumentType:
                  documentForSourceField.get(sourceFieldId) ?? "Unknown",
                repeated: mapping.repeated,
              })
            )
          ),
          signal
        )
        for (const resolved of reconciliation.resolvedFields) {
          const mapping = mappings.find(
            (candidate) => candidate.systemFieldId === resolved.fieldId
          )
          if (!mapping || mapping.repeated) continue
          const sourceIds = [
            ...mapping.sourceFieldIds,
            ...mapping.fallbackSourceIds,
          ]
          const candidates = observations.fields.filter(
            (field) => sourceIds.includes(field.id) && field.row === null
          )
          if (!resolved.value) {
            if (resolved.conflicts.length > 1)
              observations.fields = observations.fields.map((field) =>
                candidates.includes(field)
                  ? {
                      ...field,
                      status: "conflicting",
                      note: resolved.explanation,
                    }
                  : field
              )
            continue
          }
          const selected = candidates.find(
            (field) =>
              field.value === resolved.value &&
              (!resolved.source ||
                field.evidence.some(
                  (evidence) => evidence.document === resolved.source?.filename
                ))
          )
          if (!selected) continue
          observations.fields = [
            ...observations.fields.filter(
              (field) => !sourceIds.includes(field.id) || field.row !== null
            ),
            {
              ...selected,
              status:
                resolved.confidence >=
                Number(process.env.OPENAI_DOCUMENT_CONFIDENCE_THRESHOLD ?? 0.72)
                  ? "passed"
                  : "unconfirmed",
              note: resolved.explanation,
            },
          ]
        }
        observations.findings.push(
          ...reconciliation.warnings.map((warning) => ({
            ruleId: "reconciliation-warning",
            status: "unconfirmed" as const,
            evidence: [],
            explanation: warning,
          }))
        )
      } catch (error) {
        if (signal?.aborted) throw error
        console.error("Document reconciliation failed", error)
        observations.findings.push({
          ruleId: "reconciliation-runtime",
          status: "unconfirmed",
          evidence: [],
          explanation:
            "Document extraction finished, but cross-document reconciliation could not complete.",
        })
      }
    }
    applyDeterministicDerivations()
    if (finalFailures.length) {
      for (const failure of finalFailures)
        console.error(
          `Document inspection failed: ${failure.filename}`,
          failure.error
        )
      const documents = finalFailures.map(({ filename }) => filename).join(", ")
      observations.findings.push({
        ruleId: "extraction-runtime",
        status: "unconfirmed",
        evidence: [],
        explanation: `Document extraction could not finish for: ${documents}.`,
      })
    }
  }
  const review = evaluate()
  const runtimeFailures = observations.findings.filter(
    (finding) =>
      finding.ruleId.endsWith("-runtime") ||
      finding.ruleId === "reconciliation-warning"
  )
  review.nextActions.push(
    ...runtimeFailures.map((failure) => failure.explanation)
  )
  const { error } = await session.client.from("okf_reviews").insert({
    id: review.id,
    request_id: requestId,
    actor: session.user.id,
    review,
  })
  databaseError(error)
  return review
}

export function reviewToAnalysis(review: KnowledgeReview): MadagascarAnalysis {
  const placedFields = new Set(
    review.certificateLayout
      ? layoutPlacements(review.certificateLayout.layout).map(
          (placement) => placement.fieldId
        )
      : []
  )
  const layoutFields =
    review.certificateLayout?.layout.fields
      .filter(
        (field) =>
          placedFields.has(field.id) &&
          !field.id.startsWith("invoiceItems.") &&
          field.id !== "invoiceValues"
      )
      .map((field) => ({ key: field.id, label: field.label })) ?? []
  const catalog = review.certificateLayout
    ? layoutFields
    : madagascarFieldCatalog
  const fields = catalog.map(({ key, label }) => {
    const f = review.mappedFields.find((f) => f.key === key)
    return {
      key,
      label,
      value: f?.status === "passed" ? f.value : "",
      status:
        f?.status === "passed"
          ? ("extracted" as const)
          : f?.status === "conflicting" || f?.status === "failed"
            ? ("conflict" as const)
            : ("missing" as const),
      source:
        f?.evidence
          .map((e) => `${e.document}, page ${e.page}: ${e.observedText}`)
          .join("; ") ?? "",
      note: f?.note ?? "No supported value from a published mapping.",
      observedText: f?.observedText ?? "",
    }
  })
  const rows = [
    ...new Set(
      review.mappedFields
        .filter((f) => f.key.startsWith("invoiceItems.") && f.row !== null)
        .map((f) => f.row!)
    ),
  ].sort((a, b) => a - b)
  const invoiceItems: MadagascarInvoiceItem[] = rows.map((row) => {
    const fs = review.mappedFields.filter(
      (f) => f.key.startsWith("invoiceItems.") && f.row === row
    )
    const value = (key: string) =>
      fs.find((f) => f.key === `invoiceItems.${key}`)?.value ?? ""
    return {
      description: value("description"),
      hsCode: value("hsCode"),
      brand: "",
      reference: "",
      originCountry: value("originCountry"),
      packageType: "",
      quantity: value("quantity"),
      unitOfMeasurement: value("unitOfMeasurement"),
      unitPrice: value("unitPrice"),
      totalPrice: "",
      currency: "",
      isSecondHand: value("isSecondHand"),
      source: fs
        .flatMap((f) => f.evidence.map((e) => `${e.document}, page ${e.page}`))
        .join("; "),
      issues: fs
        .filter((f) => f.status !== "passed")
        .map((f) => `${f.key}: ${f.status}. ${f.note}`),
      ...Object.fromEntries(
        fs
          .filter(
            (field) =>
              ![
                "issues",
                "source",
                "__proto__",
                "constructor",
                "prototype",
              ].includes(field.key.slice("invoiceItems.".length))
          )
          .map((field) => [
            field.key.slice("invoiceItems.".length),
            field.status === "passed" ? field.value : "",
          ])
      ),
    }
  })
  const issues = [
    ...review.nextActions,
    ...review.mappedFields
      .filter((f) => f.status !== "passed")
      .map((f) => `${f.key}: ${f.status}. ${f.note}`),
  ]
  const invoiceValues = review.mappedFields
    .filter((f) => f.key === "invoiceValues")
    .map((f) => ({
      label: f.rowLabel || "Invoice Value",
      value: f.value,
      status:
        f.status === "passed"
          ? ("extracted" as const)
          : f.status === "conflicting"
            ? ("conflict" as const)
            : ("missing" as const),
      source: f.evidence.map((e) => `${e.document}, page ${e.page}`).join("; "),
      note: f.note,
    }))
  return {
    consigneeCountry: review.observations.country.name,
    documents: review.observations.documents.map((d) => ({
      fileName: d.fileName,
      documentType: d.documentType,
      confidence: d.evidence.length ? "Evidence available" : "Unconfirmed",
      note: d.status,
    })),
    fields,
    invoiceItems,
    invoiceValues,
    issues,
    missingCorrectionsMessage: issues.join("\n\n"),
    okf: review,
  }
}
