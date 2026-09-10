import { z } from "zod"
import type { CertificateLayoutRecord } from "@/lib/certificate-layout/schema"

export const stages = [
  "intake",
  "drafting",
  "submission",
  "validation",
  "release",
] as const
export const outcomes = [
  "passed",
  "failed",
  "missing",
  "unreadable",
  "conflicting",
  "not applicable",
  "unconfirmed",
] as const
export const documentNames = [
  "Bill of Lading",
  "Commercial Invoice",
  "Freight Invoice",
  "Packing List",
  "Export/Customs Declaration",
  "Export Declaration",
  "Customs Declaration",
  "Certificate of Origin",
] as const
const id = z.string().min(1).max(160)
const text = z.string().max(12000)
export const evidenceSchema = z.object({
  document: text,
  page: text,
  observedText: text,
})
export const sourceSchema = z.object({
  id,
  title: text,
  url: text,
  attachmentPath: text,
  note: text,
})
export const ruleSchema = z.object({
  id,
  country: z.string(),
  document: z.string(),
  instruction: text,
  requirement: z.enum([
    "always required",
    "conditionally required",
    "not required",
    "unconfirmed",
  ]),
  condition: text,
  stage: z.enum(stages),
  consequence: text,
  sourceIds: z.array(id),
  effectiveFrom: z.string(),
  effectiveTo: z.string(),
  kind: z.enum(["document", "acceptance", "comparison", "format"]),
  check: z.object({
    operator: z.enum([
      "interpret",
      "present",
      "equal",
      "number",
      "date",
      "option",
    ]),
    fieldIds: z.array(id),
    expected: text,
  }),
})
export const extractionSchema = z.object({
  id,
  label: text,
  document: text,
  location: text,
  requiredWhen: text,
  instruction: text,
  portalFieldIds: z.array(id),
  ruleIds: z.array(id),
})
export const mappingSchema = z.object({
  id,
  systemFieldId: id,
  sourceFieldIds: z.array(id),
  entryRule: text,
  ifMissing: text,
  fallbackSourceIds: z.array(id),
  transform: z.enum(["none", "trim", "uppercase", "decimal", "date-iso"]),
  unit: text,
  repeated: z.boolean(),
  ruleIds: z.array(id),
})
export const contentSchema = z.object({
  sections: z
    .array(z.object({ heading: text, text, references: z.array(id) }))
    .max(30),
  rules: z.array(ruleSchema).max(300),
  fields: z.array(extractionSchema).max(300),
  mappings: z.array(mappingSchema).max(300),
  sources: z.array(sourceSchema).max(100),
  aliases: z.array(z.string()).max(100),
})
export const pageSchema = z.object({
  id,
  title: text,
  country: z.string(),
  template: z.string(),
  content: contentSchema,
  revision: z.number().int().nonnegative(),
  version: z.string().nullable(),
  publishedAt: z.string().nullable(),
})
export const changeSchema = z.object({
  pageId: id,
  content: contentSchema,
  level: z.enum(["patch", "minor"]),
})
export const draftInputSchema = z.object({
  id: z.string().uuid(),
  expectedEdit: z.number().int().nonnegative(),
  baseGeneration: z.number().int().nonnegative(),
  changes: z.array(changeSchema).min(1).max(30),
  reason: z.string().min(1).max(12000),
  source: text,
})
export type KnowledgeContent = z.infer<typeof contentSchema>
export type KnowledgePage = z.infer<typeof pageSchema>
export type KnowledgeRule = z.infer<typeof ruleSchema>
export type KnowledgeChange = z.infer<typeof changeSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type Outcome = (typeof outcomes)[number]
export type Stage = (typeof stages)[number]
export type KnowledgeState = { generation: number; pages: KnowledgePage[] }
export type KnowledgeDraft = {
  id: string
  edit_version: number
  base_generation: number
  changes: KnowledgeChange[]
  reason: string
  source: string
  proposer: string
  updated_at: string
  status: string
  review: string
  review_edit: number | null
  preview_token?: string
}
export type Publication = {
  id: string
  draft_id: string
  before_pages: KnowledgePage[]
  after_pages: KnowledgePage[]
  proposer: string
  approver: string
  reason: string
  source: string
  created_at: string
}
export const observationSchema = z.object({
  country: z.object({
    name: text,
    status: z.enum(["supported", "unsupported", "ambiguous", "unconfirmed"]),
    basis: z.enum([
      "final destination",
      "discharge port",
      "consignee address",
      "transit",
      "unconfirmed",
    ]),
    evidence: z.array(evidenceSchema),
    finalDestination: text,
    dischargePort: text,
    transitCountries: z.array(text),
    explanation: text,
  }),
  shipments: z.array(
    z.object({
      id,
      documentNames: z.array(text),
      evidence: z.array(evidenceSchema),
    })
  ),
  groupingAmbiguous: z.boolean(),
  documents: z.array(
    z.object({
      fileName: text,
      documentType: z.enum([...documentNames, "Unknown"]),
      status: z.enum(["draft", "final", "unconfirmed", "unreadable"]),
      evidence: z.array(evidenceSchema),
    })
  ),
  fields: z.array(
    z.object({
      id,
      observedText: text,
      value: text,
      status: z.enum(outcomes),
      evidence: z.array(evidenceSchema),
      note: text,
      row: z.number().int().nonnegative().nullable(),
      rowLabel: text,
    })
  ),
  conditions: z.array(
    z.object({
      ruleId: id,
      applies: z.enum(["yes", "no", "unconfirmed"]),
      evidence: z.array(evidenceSchema),
    })
  ),
  findings: z.array(
    z.object({
      ruleId: id,
      status: z.enum(outcomes),
      evidence: z.array(evidenceSchema),
      explanation: text,
    })
  ),
})
export type Observations = z.infer<typeof observationSchema>
export type ReviewFinding = {
  id: string
  ruleId: string
  pageId: string
  stage: Stage
  status: Outcome
  explanation: string
  evidence: Evidence[]
  consequence: string
}
export type KnowledgeReview = {
  certificateLayout?: CertificateLayoutRecord
  id: string
  requestId: string
  createdAt: string
  stage: Stage
  date: string
  generation: number
  revisions: { pageId: string; revision: number; version: string | null }[]
  observations: Observations
  findings: ReviewFinding[]
  missingDocuments: string[]
  nextActions: string[]
  mappedFields: {
    key: string
    value: string
    observedText: string
    status: Outcome
    evidence: Evidence[]
    note: string
    row: number | null
    rowLabel: string
  }[]
}
export type Correction = {
  id: string
  request_id: string
  review_id: string | null
  target: string
  before_value: unknown
  after_value: unknown
  reason: string
  actor: string
  created_at: string
}
