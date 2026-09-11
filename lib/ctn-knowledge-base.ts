"use client"

import { knowledgeAnchor, knowledgeVersion } from "./ctn-knowledge-review"

import { madagascarOfficialRuleDefinitions } from "@/lib/madagascar-bsc"
import {
  readJsonBrowserStorage,
  readBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"
import { createPublicClient } from "@/lib/public-client"

export type CtnKnowledgeSectionKind = string

export type CtnKnowledgeSection = {
  id: string
  title: string
  kind: CtnKnowledgeSectionKind
  summary: string
  body: string[]
  updatedAt: string
}

export type CtnKnowledgeChange = {
  id: string
  createdAt: string
  source: "seed" | "chat"
  instruction: string
  summary: string
}

export type CtnKnowledgeCountryRecord = {
  id: string
  country: string
  format: "okf.ctn.country.v1"
  version: string | number
  updatedAt: string
  sections: CtnKnowledgeSection[]
  changeLog: CtnKnowledgeChange[]
}

const STORAGE_KEY = "africa-ctn-knowledge-base-v1"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function groupMadagascarDocumentRules() {
  const groups = new Map<string, string[]>()

  for (const rule of madagascarOfficialRuleDefinitions) {
    const group = groups.get(rule.documentType) ?? []
    group.push(`${rule.title}: ${rule.instruction}`)
    groups.set(rule.documentType, group)
  }

  return Array.from(groups.entries()).flatMap(([documentType, rules]) => [
    `${documentType}`,
    ...rules.map((rule) => `- ${rule}`),
  ])
}

function createPlaceholderCountryRecord({
  id,
  country,
  createdAt,
}: {
  id: string
  country: string
  createdAt: string
}): CtnKnowledgeCountryRecord {
  return {
    id,
    country,
    format: "okf.ctn.country.v1",
    version: 1,
    updatedAt: createdAt,
    sections: [
      {
        id: `${id}-required-documents`,
        title: "Required Documents",
        kind: "required-documents",
        summary:
          "Placeholder document requirements for future country-specific ECTN procedures.",
        body: [
          "Commercial Invoice",
          "- Placeholder: Capture required invoice data points once country instructions are finalized.",
          "Packing List",
          "- Placeholder: Capture packing and container requirements once country instructions are finalized.",
          "Transport Document",
          "- Placeholder: Capture bill of lading or transport document requirements once country instructions are finalized.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-system`,
        title: "System",
        kind: "system",
        summary:
          "Placeholder system context for country-specific certificate processing.",
        body: [
          "Processing Platform",
          "- Placeholder: Add portal, account, and submission behavior when confirmed.",
          "Record Identity",
          "- Placeholder: Track certificate records by bill of lading number wherever possible.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-procedures`,
        title: "Procedures",
        kind: "procedures",
        summary:
          "Placeholder operational procedures for future country-specific processing.",
        body: [
          "Review Flow",
          "- Placeholder: Add intake, validation, submission, and follow-up steps when ready.",
          "Exceptions",
          "- Placeholder: Add country-specific exception handling and escalation notes later.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-ai-intake`,
        title: "AI Intake Notes",
        kind: "ai-intake",
        summary:
          "Placeholder area for AI-managed notes before they are promoted into structured procedures.",
        body: [],
        updatedAt: createdAt,
      },
    ],
    changeLog: [
      {
        id: `${id}-seed`,
        createdAt,
        source: "seed",
        instruction: `Seed placeholder OKF country record for ${country}.`,
        summary: `Created placeholder OKF navigation record for ${country}.`,
      },
    ],
  }
}

function createGeneralProcessingRecord(
  createdAt: string
): CtnKnowledgeCountryRecord {
  const id = "general-processing"

  return {
    id,
    country: "General Processing Instructions",
    format: "okf.ctn.country.v1",
    version: 1,
    updatedAt: createdAt,
    sections: [
      {
        id: `${id}-required-documents`,
        title: "Required Documents",
        kind: "required-documents",
        summary:
          "Placeholder global document standards shared across ECTN certificate workflows.",
        body: [
          "Document Completeness",
          "- Placeholder: Define how the system should identify missing or incomplete supporting documents.",
          "Naming And Storage",
          "- Placeholder: Define naming, attachment, and retention conventions for uploaded documents.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-system`,
        title: "System",
        kind: "system",
        summary:
          "Placeholder global system behavior for all countries in the Cargo Tracking Notes workflow.",
        body: [
          "Modular Country Records",
          "- Placeholder: Store country-specific rules separately from shared processing behavior.",
          "AI Knowledge Updates",
          "- Placeholder: Let AI draft structured OKF updates from chat and require approval before saving.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-procedures`,
        title: "Procedures",
        kind: "procedures",
        summary:
          "Placeholder shared operating procedures for certificate intake, review, and correction.",
        body: [
          "Intake",
          "- Placeholder: Add shared intake steps for new certificate requests.",
          "Review",
          "- Placeholder: Add shared field review and correction steps.",
          "Submission",
          "- Placeholder: Add shared submission and post-submission tracking steps.",
        ],
        updatedAt: createdAt,
      },
      {
        id: `${id}-ai-intake`,
        title: "AI Intake Notes",
        kind: "ai-intake",
        summary:
          "Placeholder area for shared AI-managed knowledge updates before they become standard procedure.",
        body: [],
        updatedAt: createdAt,
      },
    ],
    changeLog: [
      {
        id: `${id}-seed`,
        createdAt,
        source: "seed",
        instruction: "Seed placeholder shared processing OKF record.",
        summary:
          "Created placeholder OKF navigation record for shared processing.",
      },
    ],
  }
}

function isCtnKnowledgeCountryRecordArray(
  value: unknown
): value is CtnKnowledgeCountryRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (record) =>
        record &&
        typeof record === "object" &&
        "id" in record &&
        typeof record.id === "string" &&
        "country" in record &&
        typeof record.country === "string" &&
        "format" in record &&
        record.format === "okf.ctn.country.v1" &&
        "sections" in record &&
        Array.isArray(record.sections) &&
        "changeLog" in record &&
        Array.isArray(record.changeLog)
    )
  )
}

export function createSeedCtnKnowledgeRecords(): CtnKnowledgeCountryRecord[] {
  const createdAt = "2026-09-09T00:00:00.000Z"

  return [
    {
      id: "madagascar",
      country: "Madagascar",
      format: "okf.ctn.country.v1",
      version: 1,
      updatedAt: createdAt,
      sections: [
        {
          id: "madagascar-required-documents",
          title: "Required Documents",
          kind: "required-documents",
          summary:
            "Document requirements currently used to review new ECTN certificates for Madagascar.",
          body: groupMadagascarDocumentRules(),
          updatedAt: createdAt,
        },
        {
          id: "madagascar-system",
          title: "System",
          kind: "system",
          summary:
            "Country-level operating context for Madagascar certificate processing.",
          body: [
            "Requests are treated generically as certificates so the same workflow can support additional countries.",
            "Knowledge is stored as a country record and can be used by AI extraction, validation, and review flows later.",
            "The bill of lading number is the preferred operational identifier for certificate records.",
          ],
          updatedAt: createdAt,
        },
        {
          id: "madagascar-procedures",
          title: "Procedures",
          kind: "procedures",
          summary:
            "Working procedures that guide how Madagascar certificate records should be handled.",
          body: [
            "Create a certificate from uploaded trade documents, extract fields top to bottom, and review missing values before submission.",
            "Use allowed option lists for incoterms, shipment method, cargo type, container type, and container size.",
            "When a new instruction comes from chat, update the knowledge record instead of manually editing scattered rule text.",
          ],
          updatedAt: createdAt,
        },
        {
          id: "madagascar-ai-intake",
          title: "AI Intake Notes",
          kind: "ai-intake",
          summary:
            "Chat-sourced operational updates waiting to be promoted into stricter country procedures or document requirements.",
          body: [],
          updatedAt: createdAt,
        },
      ],
      changeLog: [
        {
          id: "madagascar-seed",
          createdAt,
          source: "seed",
          instruction: "Seed Madagascar country knowledge from current rules.",
          summary: "Created the first OKF country record for Madagascar.",
        },
      ],
    },
    createPlaceholderCountryRecord({
      id: "ivory-coast",
      country: "Ivory Coast",
      createdAt,
    }),
    createPlaceholderCountryRecord({
      id: "angola",
      country: "Angola",
      createdAt,
    }),
    createGeneralProcessingRecord(createdAt),
  ]
}

export function loadCtnKnowledgeRecords() {
  const seedRecords = createSeedCtnKnowledgeRecords()
  const records = readJsonBrowserStorage<CtnKnowledgeCountryRecord[]>({
    kind: "localStorage",
    key: STORAGE_KEY,
    fallback: seedRecords,
    validate: isCtnKnowledgeCountryRecordArray,
  })

  const recordsById = new Map(records.map((record) => [record.id, record]))
  for (const seedRecord of seedRecords) {
    if (!recordsById.has(seedRecord.id)) {
      recordsById.set(seedRecord.id, seedRecord)
    }
  }

  return Array.from(recordsById.values())
}

const databaseSettingId = "ctn-knowledge-records"
let databaseRevision: string | null | undefined

export async function getCtnKnowledgeRecords(): Promise<
  CtnKnowledgeCountryRecord[]
> {
  const { data, error } = await createPublicClient()
    .from("app_settings")
    .select("value,updated_at")
    .eq("id", databaseSettingId)
    .maybeSingle()
  if (error) throw error
  databaseRevision = data?.updated_at ?? null
  if (!data) {
    const legacy = loadCtnKnowledgeRecords()
    if (readBrowserStorage("localStorage", STORAGE_KEY))
      await saveCtnKnowledgeRecords(legacy)
    return legacy
  }
  if (!isCtnKnowledgeCountryRecordArray(data.value))
    throw new Error(
      "The saved country knowledge is invalid. Please restore a valid revision."
    )
  const old = readBrowserStorage("localStorage", STORAGE_KEY)
  if (
    old &&
    !readBrowserStorage("localStorage", STORAGE_KEY + ":before-database-sync")
  )
    writeBrowserStorage(
      "localStorage",
      STORAGE_KEY + ":before-database-sync",
      old
    )
  writeBrowserStorage("localStorage", STORAGE_KEY, JSON.stringify(data.value))
  return data.value
}

// The whole approved document, version and history commit together. Competing
// browsers must reload a changed revision before approving another proposal.
export async function saveCtnKnowledgeRecords(
  records: CtnKnowledgeCountryRecord[]
) {
  if (databaseRevision === undefined)
    throw new Error("Load shared knowledge before saving.")
  const client = createPublicClient()
  const row = {
    id: databaseSettingId,
    value: records,
    updated_at: new Date().toISOString(),
  }
  const query =
    databaseRevision === null
      ? client.from("app_settings").insert(row)
      : client
          .from("app_settings")
          .update(row)
          .eq("id", databaseSettingId)
          .eq("updated_at", databaseRevision)
  const { data, error } = await query.select("updated_at").maybeSingle()
  if (error) throw error
  if (!data)
    throw new Error(
      "The knowledge changed on another device. Reload and review it again."
    )
  databaseRevision = data.updated_at
  writeBrowserStorage("localStorage", STORAGE_KEY, JSON.stringify(records))
}

export function ctnKnowledgeRecordToHtml(record: CtnKnowledgeCountryRecord) {
  const sections = record.sections
    .map((section) => {
      const bodyItems = section.body.length
        ? section.body
            .map((item, index) => {
              const trimmed = item.trim()
              const anchor = escapeHtml(knowledgeAnchor(section.id, index))
              const inline = (text: string) =>
                escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>")
              if (/^[-*] /.test(trimmed))
                return `<ul><li data-okf-anchor="${anchor}">${inline(trimmed.slice(2))}</li></ul>`
              const numbered = /^(\d+)\.\s+(.*)$/.exec(trimmed)
              if (numbered)
                return `<ol start="${numbered[1]}"><li data-okf-anchor="${anchor}">${inline(numbered[2])}</li></ol>`
              const isHeading =
                /^#{1,6} /.test(trimmed) ||
                (trimmed.length < 70 &&
                  !/[.!?]$/.test(trimmed) &&
                  !trimmed.includes("`"))
              const tag = isHeading ? "h3" : "p"
              return `<${tag} data-okf-anchor="${anchor}">${inline(trimmed.replace(/^#{1,6}\s+/, ""))}</${tag}>`
            })
            .join("")
        : "<p>No entries yet.</p>"

      return `
        <h2 data-okf-anchor="${escapeHtml(knowledgeAnchor(section.id))}">${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.summary)}</p>
        ${bodyItems}
      `
    })
    .join("")

  const changes = record.changeLog
    .slice(0, 5)
    .map(
      (change) =>
        `<li>${escapeHtml(new Date(change.createdAt).toLocaleDateString())}: ${escapeHtml(change.summary)}</li>`
    )
    .join("")

  return `
    <h1>${escapeHtml(record.country)}</h1>
    <p><code>okf://ctn/countries/${escapeHtml(record.id)}</code></p>
    <p><strong>Format:</strong> ${record.format} <strong>Version:</strong> ${knowledgeVersion(record.version)}</p>
    ${sections}
    <h2>Change Log</h2>
    <ul>${changes}</ul>
  `
}
