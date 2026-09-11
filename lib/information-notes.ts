import {
  reportDatabaseReadFailure,
  clearDatabaseReadFailure,
} from "@/lib/persistence"
import { readAllRows, deleteRowsById } from "@/lib/database-records"
import {
  readPendingDatabaseSave,
  saveDatabaseDraft,
  waitForDatabaseSave,
} from "@/lib/persistence"
import { createPublicClient } from "@/lib/public-client"
import {
  readBrowserStorage,
  readJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"
import { createInitialPages } from "@/lib/okf/seed"
import type { KnowledgePage } from "@/lib/okf/schema"
import type { VisibleCorrectionLearning } from "@/lib/okf/correction-learning"
import {
  correctionLearningFormat,
  correctionLearningKey,
} from "@/lib/okf/correction-learning"
import {
  canonicalDocumentTitle,
  requiredDocumentsForCountry,
} from "@/lib/okf/required-documents"

export type InformationNodeType = "folder" | "note"

export type InformationNode = {
  id: string
  parentId?: string
  type: InformationNodeType
  title: string
  content?: string
  pinned?: boolean
  createdAt: string
  updatedAt: string
}

export type TrashedInformationNode = InformationNode & {
  deletedAt: string
  originalParentId?: string
}

export type InformationNotesScope = "notebook" | "knowledge-base"

const scopeConfig = {
  notebook: {
    storageKey: "africa-ctn-information-notes",
    trashStorageKey: "africa-ctn-information-notes-trash",
    tableName: "information_notes",
    updatedEvent: "information-notes:updated",
  },
  "knowledge-base": {
    storageKey: "africa-ctn-knowledge-base-notes",
    trashStorageKey: "africa-ctn-knowledge-base-notes-trash",
    tableName: "knowledge_base_notes",
    updatedEvent: "knowledge-base-notes:updated",
  },
} as const

const knowledgeBaseExampleVersionKey = "africa-ctn-knowledge-base-layout-v10"

export const informationUpdatedEvent = "information-notes:updated"
export const knowledgeBaseUpdatedEvent = "knowledge-base-notes:updated"

type InformationNoteRow = {
  id: string
  parent_id: string | null
  type: InformationNodeType
  title: string
  content: string | null
  pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

export function createInformationId(title: string) {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "note"

  return `${base}-${Date.now().toString(36)}`
}

export function defaultInformationNotes(): InformationNode[] {
  const timestamp = now()

  return [
    {
      id: "company-information",
      type: "folder",
      title: "Company Information",
      pinned: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "general-notes",
      parentId: "company-information",
      type: "note",
      title: "General Notes",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { textAlign: null, level: 1 },
            content: [{ type: "text", text: "General Notes" }],
          },
          { type: "paragraph", attrs: { textAlign: null } },
        ],
      }),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function editorDocument(
  blocks: {
    heading?: string
    headingLevel?: 2 | 3
    text?: string
    bullets?: Array<string | { text: string; href: string }>
  }[]
) {
  return JSON.stringify({
    type: "doc",
    content: blocks.flatMap((block) => [
      ...(block.heading
        ? [
            {
              type: "heading",
              attrs: { textAlign: null, level: block.headingLevel ?? 2 },
              content: [{ type: "text", text: block.heading }],
            },
          ]
        : []),
      ...(block.text
        ? block.text.split("\n").map((text) => ({
            type: "paragraph",
            attrs: { textAlign: null },
            content: text ? [{ type: "text", text }] : undefined,
          }))
        : []),
      ...(block.bullets?.length
        ? [
            {
              type: "bulletList",
              content: block.bullets.map((bullet) => ({
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    attrs: { textAlign: null },
                    content: [
                      {
                        type: "text",
                        text:
                          typeof bullet === "string" ? bullet : bullet.text,
                        ...(typeof bullet === "string"
                          ? {}
                          : {
                              marks: [
                                {
                                  type: "link",
                                  attrs: {
                                    href: bullet.href,
                                    target: null,
                                    rel: "noopener noreferrer nofollow",
                                    class: null,
                                  },
                                },
                              ],
                            }),
                      },
                    ],
                  },
                ],
              })),
            },
          ]
        : []),
    ]),
  })
}

export function mergeRequiredDocumentNotes(
  nodes: InformationNode[],
  replaceExisting = false
) {
  const next = [...nodes]
  const timestamp = now()
  for (const country of next.filter(
    (node) =>
      node.type === "folder" &&
      !node.parentId &&
      node.title.toLocaleLowerCase() !== "shared"
  )) {
    const existingIndex = next.findIndex(
      (node) =>
        node.type === "note" &&
        node.parentId === country.id &&
        ["requirements", "required documents"].includes(
          node.title.toLocaleLowerCase()
        )
    )
    if (existingIndex >= 0 && !replaceExisting) continue
    const existing = existingIndex >= 0 ? next[existingIndex] : undefined
    const note: InformationNode = {
      id: existing?.id ?? `${country.id}-requirements`,
      parentId: country.id,
      type: "note",
      title: "Required Documents",
      content: editorDocument([
        { bullets: requiredDocumentsForCountry(country.title) },
      ]),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    if (existingIndex >= 0) next[existingIndex] = note
    else next.push(note)
  }
  return next
}

export function linkRequiredDocumentNotes(nodes: InformationNode[]) {
  return nodes.map((node) => {
    if (
      node.type !== "note" ||
      !["requirements", "required documents"].includes(
        node.title.toLocaleLowerCase()
      ) ||
      !node.parentId ||
      !node.content
    )
      return node
    const documentsFolder = nodes.find(
      (candidate) =>
        candidate.type === "folder" &&
        candidate.parentId === node.parentId &&
        candidate.title.toLocaleLowerCase() === "documents"
    )
    if (!documentsFolder)
      return node.title === "Required Documents"
        ? node
        : { ...node, title: "Required Documents" }
    const documentPages = new Map(
      nodes
        .filter(
          (candidate) =>
            candidate.type === "note" &&
            candidate.parentId === documentsFolder.id
        )
        .map((candidate) => [candidate.title.toLocaleLowerCase(), candidate])
    )
    try {
      const document = JSON.parse(node.content) as {
        content?: Array<{
          type?: string
          content?: Array<{
            content?: Array<{
              content?: Array<{
                type?: string
                text?: string
                marks?: unknown[]
              }>
            }>
          }>
        }>
      }
      for (const block of document.content ?? []) {
        if (block.type !== "bulletList") continue
        for (const item of block.content ?? []) {
          for (const paragraph of item.content ?? []) {
            for (const text of paragraph.content ?? []) {
              if (text.type !== "text" || !text.text) continue
              const target = documentPages.get(text.text.toLocaleLowerCase())
              if (!target) continue
              text.marks = [
                {
                  type: "link",
                  attrs: {
                    href: `/knowledge-base?node=${encodeURIComponent(target.id)}`,
                    target: null,
                    rel: "noopener noreferrer nofollow",
                    class: null,
                  },
                },
              ]
            }
          }
        }
      }
      return {
        ...node,
        title: "Required Documents",
        content: JSON.stringify(document),
      }
    } catch {
      return { ...node, title: "Required Documents" }
    }
  })
}

export function organizeDocumentKnowledgePages(nodes: InformationNode[]) {
  const next = [...nodes]
  const timestamp = now()
  for (const country of next.filter(
    (node) =>
      node.type === "folder" &&
      !node.parentId &&
      node.title.toLocaleLowerCase() !== "shared"
  )) {
    const misplacedPages = next.filter(
      (node) =>
        node.type === "note" &&
        node.parentId === country.id &&
        !!canonicalDocumentTitle(node.title)
    )
    if (!misplacedPages.length) continue
    let documents = next.find(
      (node) =>
        node.type === "folder" &&
        node.parentId === country.id &&
        node.title.toLocaleLowerCase() === "documents"
    )
    if (!documents) {
      documents = {
        id: `${country.id}-documents`,
        parentId: country.id,
        type: "folder",
        title: "Documents",
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      next.push(documents)
    }
    for (const page of misplacedPages) {
      const index = next.findIndex((node) => node.id === page.id)
      next[index] = {
        ...page,
        parentId: documents.id,
        title: canonicalDocumentTitle(page.title) ?? page.title,
        updatedAt: timestamp,
      }
    }
  }
  return next
}

function mergeKnownDocumentRequirementNotes(
  nodes: InformationNode[],
  replaceExisting = false
) {
  const next = [...nodes]
  const timestamp = now()
  const madagascar = next.find(
    (node) =>
      node.type === "folder" &&
      !node.parentId &&
      node.title.toLocaleLowerCase() === "madagascar"
  )
  if (!madagascar) return next

  let documents = next.find(
    (node) =>
      node.type === "folder" &&
      node.parentId === madagascar.id &&
      node.title.toLocaleLowerCase() === "documents"
  )
  if (!documents) {
    documents = {
      id: `${madagascar.id}-documents`,
      parentId: madagascar.id,
      type: "folder",
      title: "Documents",
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    next.push(documents)
  }

  const knownPages = [
    {
      slug: "bill-of-lading",
      title: "Bill of Lading",
      requirements: ["Must be the final, dated master Bill of Lading (MBL)."],
    },
    {
      slug: "commercial-invoice",
      title: "Commercial Invoice",
      requirements: ["The country of origin must be stated."],
    },
  ]
  for (const knownPage of knownPages) {
    const existingIndex = next.findIndex(
      (node) =>
        node.type === "note" &&
        node.parentId === documents.id &&
        node.title.toLocaleLowerCase() ===
          knownPage.title.toLocaleLowerCase()
    )
    if (existingIndex >= 0 && !replaceExisting) continue
    const existing = existingIndex >= 0 ? next[existingIndex] : undefined
    const note: InformationNode = {
      id: existing?.id ?? `${documents.id}-${knownPage.slug}`,
      parentId: documents.id,
      type: "note",
      title: knownPage.title,
      content: editorDocument([
        {
          heading: "Requirements",
          bullets: knownPage.requirements,
        },
      ]),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    if (existingIndex >= 0) next[existingIndex] = note
    else next.push(note)
  }
  return next
}

function removeSupersededDocumentUpdatePages(nodes: InformationNode[]) {
  return nodes.filter(
    (node) =>
      node.title.trim().toLocaleLowerCase() !==
      "require country of origin on madagascar commercial invoice"
  )
}

function countryExampleNodes(timestamp: string): InformationNode[] {
  const sharedFolderId = "knowledge-country-shared"
  const sharedNodes: InformationNode[] = [
    {
      id: sharedFolderId,
      type: "folder",
      title: "Shared",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: `${sharedFolderId}-upload-ai-instructions`,
      parentId: sharedFolderId,
      type: "note",
      title: "Document Upload & AI Instructions",
      content: editorDocument([
        {
          text: "These instructions define how uploaded shipment documents are reviewed and how extracted values become a certificate draft. Country-specific published knowledge overrides shared guidance when it explicitly differs.",
        },
        {
          heading: "Upload workflow",
          text: "Upload the shipment documents together as one certificate request. AI classifies the documents, separates shipments using explicit shipment references, and identifies the certificate country from the consignee name and address on the Bill of Lading. It must not substitute the notify party, a port, a transit country, or an address from another document.",
        },
        {
          heading: "Extraction instructions",
          text: "Read original PDFs with document-aware AI and retain the supporting filename, page and short evidence excerpt. Use the published country requirements, document instructions and Certificate Settings field mappings. Return a blank or unresolved value when the evidence is missing or ambiguous; never invent a value, source, date or certainty.",
        },
        {
          heading: "Normalization",
          text: "Normalize dates to YYYY-MM-DD. Return ISO currency codes instead of symbols. Preserve forward slashes in references and remove decorative labels or hyphens. Infer Incoterms, shipment method, cargo type, container details, loading country and measurements only when the relevant evidence and field instruction support the result.",
        },
        {
          heading: "Review",
          text: "Populate the certificate using the published layout, then let staff review extracted fields from top to bottom. Flag missing, conflicting or unsupported values for correction. Uploaded evidence and AI output do not publish or change country knowledge automatically.",
        },
      ]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
  const countries = [
    {
      id: "madagascar",
      name: "Madagascar",
      summary:
        "Working country knowledge for Madagascar certificates. AI keeps the requirements, procedure and source pages coordinated as new evidence is reviewed.",
      requirements:
        "Commercial Invoice\nPacking List\nBill of Lading\nFreight Invoice — supporting document when applicable\n\nThis is working guidance migrated from the current system. Confirm exceptions and effective dates against the linked source material.",
      procedure:
        "1. Upload the shipment documents.\n2. Review the extracted values from top to bottom.\n3. Resolve missing or incorrect values.\n4. Complete the certificate workflow using the current portal procedure.",
    },
    {
      id: "djibouti",
      name: "Djibouti",
      summary:
        "Working country knowledge for Djibouti certificates. This starter page is intentionally flexible and will become more specific as AI reviews approved sources.",
      requirements:
        "The detailed document requirements have not yet been verified in this knowledge base. Add a current procedure, notice, screenshot or source document through AI Update to build this page.",
      procedure:
        "The country-specific procedure is awaiting source review. AI should preserve uncertainty, identify contradictions and avoid turning assumptions into requirements.",
    },
    {
      id: "somalia",
      name: "Somalia",
      summary:
        "Working country knowledge for Somalia certificates. This starter page is intentionally flexible and will become more specific as AI reviews approved sources.",
      requirements:
        "The detailed document requirements have not yet been verified in this knowledge base. Add a current procedure, notice, screenshot or source document through AI Update to build this page.",
      procedure:
        "The country-specific procedure is awaiting source review. AI should preserve uncertainty, identify contradictions and avoid turning assumptions into requirements.",
    },
  ]

  return [
    ...sharedNodes,
    ...countries.flatMap((country) => {
      const folderId = `knowledge-country-${country.id}`
      return [
        {
          id: folderId,
          type: "folder" as const,
          title: country.name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: `${folderId}-overview`,
          parentId: folderId,
          type: "note" as const,
          title: "Overview",
          content: editorDocument([
            { text: country.summary },
            {
              heading: "Maintenance status",
              text: "AI maintained · Human reviewed before changes are applied",
            },
          ]),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: `${folderId}-requirements`,
          parentId: folderId,
          type: "note" as const,
          title: "Requirements",
          content: editorDocument([{ text: country.requirements }]),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: `${folderId}-procedure`,
          parentId: folderId,
          type: "note" as const,
          title: "Procedure",
          content: editorDocument([{ text: country.procedure }]),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: `${folderId}-sources`,
          parentId: folderId,
          type: "note" as const,
          title: "Sources",
          content: editorDocument([
            {
              text: "AI records the evidence used for operational claims here. Add source material through AI Update; do not treat this starter text as a source.",
            },
          ]),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ]
    }),
  ]
}

function mergeCountryExamples(nodes: InformationNode[]) {
  const examples = countryExampleNodes(now())
  const rootFolders = new Map(
    nodes
      .filter((node) => node.type === "folder" && !node.parentId)
      .map((node) => [node.title.toLocaleLowerCase(), node])
  )
  const next = [...nodes]

  for (const example of examples) {
    if (example.type === "folder") {
      if (!rootFolders.has(example.title.toLocaleLowerCase())) {
        next.push(example)
        rootFolders.set(example.title.toLocaleLowerCase(), example)
      }
      continue
    }

    const exampleParent = examples.find((node) => node.id === example.parentId)
    const actualParent = exampleParent
      ? rootFolders.get(exampleParent.title.toLocaleLowerCase())
      : undefined
    const exists = next.some(
      (node) =>
        node.type === "note" &&
        node.parentId === actualParent?.id &&
        node.title.toLocaleLowerCase() === example.title.toLocaleLowerCase()
    )
    if (!exists && actualParent) {
      next.push({ ...example, parentId: actualParent.id })
    }
  }

  return next
}

function simplifyKnowledgeBaseNotes(nodes: InformationNode[]) {
  const generatedRootIds = new Set([
    "knowledge-base-index",
    "knowledge-base-guide",
    "country-updates",
    "knowledge-country-shared-upload-ai-instructions",
  ])
  const generatedCountryPage =
    /^knowledge-country-[a-z0-9-]+-(?:overview|requirements|procedure|sources|ai-learning)$/
  const titles = new Map([
    ["knowledge-page-mg-overview", "Requirements"],
    ["knowledge-page-mg-process", "Procedure"],
    ["knowledge-page-standards", "Extraction Rules"],
    ["knowledge-page-shared-process", "Procedure"],
    ["knowledge-page-country-index", "Country Identification"],
  ])

  return nodes
    .filter(
      (node) =>
        !generatedRootIds.has(node.id) && !generatedCountryPage.test(node.id)
    )
    .map((node) => {
      const title = titles.get(node.id)
      let content = node.content
      if (content) {
        try {
          const document = JSON.parse(content) as {
            type?: string
            content?: Array<{
              type?: string
              content?: Array<{ text?: string; content?: unknown[] }>
            }>
          }
          if (document.type === "doc" && Array.isArray(document.content)) {
            const nodeText = (value: unknown): string => {
              if (!value || typeof value !== "object") return ""
              const item = value as { text?: unknown; content?: unknown[] }
              return [
                typeof item.text === "string" ? item.text : "",
                ...(item.content ?? []).map(nodeText),
              ].join("")
            }
            const filler = [
              /^this page (?:records|shows|is the map)/i,
              /^use this page as/i,
              /^the published requirements page remains/i,
              /^working country knowledge for/i,
              /^ai (?:keeps|maintains|records) /i,
              /^no verified .+ (?:added|learned|recorded) yet/i,
              /^start typing to add knowledge/i,
              /^shared document extraction conventions$/i,
            ]
            const seen = new Set<string>()
            document.content = document.content.filter((item) => {
              const text = nodeText(item).trim()
              if (
                ["heading", "paragraph"].includes(item.type ?? "") &&
                !text
              )
                return false
              if (filler.some((pattern) => pattern.test(text))) return false
              const key = `${item.type}:${text.toLocaleLowerCase()}`
              if (text && seen.has(key)) return false
              if (text) seen.add(key)
              return true
            })
            content = JSON.stringify(document)
          }
        } catch {}
      }
      return {
        ...node,
        ...(title ? { title } : {}),
        ...(content !== node.content ? { content } : {}),
      }
    })
}

export function mergeCorrectionLearningNotes(
  nodes: InformationNode[],
  learnings: VisibleCorrectionLearning[]
) {
  if (!learnings.length) return nodes
  const next = [...nodes]
  const byCountry = new Map<string, VisibleCorrectionLearning[]>()
  const uniqueLearnings = new Map<string, VisibleCorrectionLearning>()
  for (const learning of [...learnings].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )) {
    const key = correctionLearningKey(learning.country, learning)
    if (!uniqueLearnings.has(key)) uniqueLearnings.set(key, learning)
  }
  for (const learning of uniqueLearnings.values())
    byCountry.set(learning.country, [
      ...(byCountry.get(learning.country) ?? []),
      learning,
    ])
  for (const [country, countryLearnings] of byCountry) {
    const parent = next.find(
      (node) =>
        node.type === "folder" &&
        !node.parentId &&
        node.title.toLocaleLowerCase() === country.toLocaleLowerCase()
    )
    if (!parent) continue
    const id = `${parent.id}-ai-learning`
    const existingIndex = next.findIndex(
      (node) =>
        node.id === id ||
        (node.parentId === parent.id &&
          ["AI Learning", "Learned Rules", "Rules (Learned)"].includes(
            node.title
          ))
    )
    const timestamp = now()
    const note: InformationNode = {
      id: existingIndex >= 0 ? next[existingIndex].id : id,
      parentId: parent.id,
      type: "note",
      title: "Rules (Learned)",
      content: editorDocument([
        ...countryLearnings
          .sort((left, right) =>
            left.label.localeCompare(right.label, undefined, {
              sensitivity: "base",
            })
          )
          .flatMap((learning) => [
            {
              heading: learning.label,
              headingLevel: 3 as const,
            },
            {
              bullets: (() => {
                const formatted = correctionLearningFormat(learning)
                return [
                  `Field: ${formatted.field}`,
                  `Applies When: ${formatted.appliesWhen}`,
                  `Instruction: ${formatted.instruction}`,
                  `Source: ${formatted.source}`,
                  `Status: ${formatted.status}`,
                ]
              })(),
            },
          ]),
      ]),
      createdAt: existingIndex >= 0 ? next[existingIndex].createdAt : timestamp,
      updatedAt: timestamp,
    }
    if (existingIndex >= 0) next[existingIndex] = note
    else next.push(note)
  }
  return next
}

export function mergeLayoutCountryNotes(
  nodes: InformationNode[],
  countries: string[]
) {
  const next = [...nodes]
  for (const country of [...new Set(countries)].sort()) {
    const timestamp = now()
    let countryNode = next.find(
      (node) =>
        node.type === "folder" &&
        !node.parentId &&
        node.title.toLocaleLowerCase() === country.toLocaleLowerCase()
    )
    if (!countryNode) {
      const countryId = `knowledge-country-${country
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`
      countryNode = {
        id: countryId,
        type: "folder",
        title: country,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      next.push(countryNode)
    }
  }
  return next
}

function knowledgePageBlocks(page: KnowledgePage) {
  const blocks = page.content.sections
    .filter((section) => section.text.trim())
    .map((section) => ({
      heading: section.heading,
      text: section.text,
    }))

  if (page.content.rules.length) {
    blocks.push({
      heading: "Rules",
      text: page.content.rules
        .map((rule) =>
          [rule.instruction, rule.condition, rule.consequence]
            .filter(Boolean)
            .join(" — ")
        )
        .join("\n"),
    })
  }
  if (page.content.fields.length) {
    blocks.push({
      heading: "Fields to extract",
      text: page.content.fields
        .map((field) =>
          [field.label, field.instruction, field.location]
            .filter(Boolean)
            .join(" — ")
        )
        .join("\n"),
    })
  }
  if (page.content.mappings.length) {
    blocks.push({
      heading: "System field map",
      text: page.content.mappings
        .map((mapping) =>
          [mapping.systemFieldId, mapping.entryRule, mapping.ifMissing]
            .filter(Boolean)
            .join(" — ")
        )
        .join("\n"),
    })
  }
  if (page.content.sources.length) {
    blocks.push({
      heading: "Sources",
      text: page.content.sources
        .map((source) =>
          [source.title, source.url, source.note].filter(Boolean).join(" — ")
        )
        .join("\n"),
    })
  }

  if (page.content.aliases.length) {
    blocks.push({
      heading: "Aliases",
      text: page.content.aliases.join("\n"),
    })
  }

  return blocks
}

export function knowledgeBaseNotesFromPages(
  pages: KnowledgePage[] = createInitialPages()
): InformationNode[] {
  const timestamp = now()
  const countries = [...new Set(pages.map((page) => page.country))]
  const countryFolders = countries.map((country) => ({
    id: `knowledge-country-${country.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "folder" as const,
    title: country,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const countryFolderId = (country: string) =>
    countryFolders.find((folder) => folder.title === country)!.id
  const documentFolders = countries.flatMap((country) =>
    pages.some(
      (page) => page.country === country && page.template === "document"
    )
      ? [
          {
            id: `${countryFolderId(country)}-documents`,
            parentId: countryFolderId(country),
            type: "folder" as const,
            title: "Documents",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ]
      : []
  )
  const migratedPages: InformationNode[] = pages.flatMap((page) => {
    const blocks = knowledgePageBlocks(page)
    if (!blocks.length) return []
    return [{
      id: `knowledge-page-${page.id}`,
      parentId:
        page.template === "document"
          ? `${countryFolderId(page.country)}-documents`
          : countryFolderId(page.country),
      type: "note" as const,
      title:
        page.id === "mg-overview"
          ? "Requirements"
          : page.id === "mg-process"
            ? "Procedure"
            : page.id === "standards"
              ? "Extraction Rules"
              : page.id === "shared-process"
                ? "Procedure"
                : page.id === "country-index"
                  ? "Country Identification"
                  : page.title,
      content: editorDocument(blocks),
      createdAt: timestamp,
      updatedAt: timestamp,
    }]
  })

  return [...countryFolders, ...documentFolders, ...migratedPages]
}

export function defaultKnowledgeBaseNotes(): InformationNode[] {
  return knowledgeBaseNotesFromPages()
}

async function loadPublishedKnowledgeBaseNotes() {
  try {
    const response = await fetch("/api/okf", { cache: "no-store" })
    const result = (await response.json()) as {
      ok?: boolean
      state?: { pages?: unknown }
    }
    const pages = pageArray(result.state?.pages)

    return response.ok && result.ok && pages
      ? knowledgeBaseNotesFromPages(pages)
      : null
  } catch {
    return null
  }
}

async function loadDynamicOkfIndex() {
  try {
    const response = await fetch("/api/okf", { cache: "no-store" })
    const result = (await response.json()) as {
      ok?: boolean
      sourceLearnings?: VisibleCorrectionLearning[]
      layoutCountries?: string[]
    }
    return response.ok && result.ok
      ? {
          sourceLearnings: Array.isArray(result.sourceLearnings)
            ? result.sourceLearnings
            : [],
          layoutCountries: Array.isArray(result.layoutCountries)
            ? result.layoutCountries
            : [],
        }
      : { sourceLearnings: [], layoutCountries: [] }
  } catch {
    return { sourceLearnings: [], layoutCountries: [] }
  }
}

async function mergeDynamicOkfNotes(
  nodes: InformationNode[],
  dynamicIndex: Awaited<ReturnType<typeof loadDynamicOkfIndex>>
) {
  return mergeCorrectionLearningNotes(
    linkRequiredDocumentNotes(
      removeSupersededDocumentUpdatePages(
        mergeRequiredDocumentNotes(
          mergeKnownDocumentRequirementNotes(
            organizeDocumentKnowledgePages(
              mergeLayoutCountryNotes(nodes, dynamicIndex.layoutCountries)
            )
          )
        )
      )
    ),
    dynamicIndex.sourceLearnings
  )
}

export async function mergeLiveKnowledgeBaseNotes(nodes: InformationNode[]) {
  const visibleNotes = await mergeDynamicOkfNotes(
    nodes,
    await loadDynamicOkfIndex()
  )
  cacheInformationNotes(visibleNotes, "knowledge-base")
  return visibleNotes
}

function pageArray(value: unknown): KnowledgePage[] | null {
  if (!Array.isArray(value)) return null
  return value.every(
    (page) =>
      typeof page === "object" &&
      page !== null &&
      typeof (page as KnowledgePage).id === "string" &&
      typeof (page as KnowledgePage).title === "string" &&
      typeof (page as KnowledgePage).country === "string" &&
      typeof (page as KnowledgePage).content === "object"
  )
    ? (value as KnowledgePage[])
    : null
}

function isInformationNode(value: unknown): value is InformationNode {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const node = value as Partial<InformationNode>

  return (
    typeof node.id === "string" &&
    (node.type === "folder" || node.type === "note") &&
    typeof node.title === "string" &&
    typeof node.createdAt === "string" &&
    typeof node.updatedAt === "string" &&
    (node.parentId === undefined || typeof node.parentId === "string") &&
    (node.content === undefined || typeof node.content === "string")
  )
}

function isInformationNodeArray(value: unknown): value is InformationNode[] {
  return Array.isArray(value) && value.every(isInformationNode)
}

function isTrashedInformationNodeArray(
  value: unknown
): value is TrashedInformationNode[] {
  return (
    Array.isArray(value) &&
    value.every(
      (node) =>
        isInformationNode(node) &&
        "deletedAt" in node &&
        typeof node.deletedAt === "string"
    )
  )
}

export function loadInformationNotes(
  scope: InformationNotesScope = "notebook"
) {
  if (typeof window === "undefined") {
    return []
  }

  return readJsonBrowserStorage({
    kind: "localStorage",
    key: scopeConfig[scope].storageKey,
    fallback:
      scope === "knowledge-base"
        ? defaultKnowledgeBaseNotes()
        : defaultInformationNotes(),
    validate: isInformationNodeArray,
  })
}

type NoteDraft = { nodes: InformationNode[]; previous: InformationNode[] }
const confirmedNotes = new Map<InformationNotesScope, InformationNode[]>()
const notesSaveKey = (scope: InformationNotesScope) => "notes:" + scope

export function saveInformationNotes(
  nodes: InformationNode[],
  scope: InformationNotesScope = "notebook"
) {
  const previous =
    confirmedNotes.get(scope) ??
    readPendingDatabaseSave<NoteDraft>(notesSaveKey(scope))?.previous ??
    loadInformationNotes(scope)
  return saveDatabaseDraft(
    notesSaveKey(scope),
    scope === "notebook" ? "Notebook" : "Knowledge Base",
    { nodes, previous },
    async (draft) => {
      await saveDatabaseInformationNotes(
        draft.nodes,
        scope,
        confirmedNotes.get(scope) ?? draft.previous
      )
      confirmedNotes.set(scope, structuredClone(draft.nodes))
      cacheInformationNotes(draft.nodes, scope)
    }
  ).then(() => {
    if (
      typeof window !== "undefined" &&
      !readPendingDatabaseSave(notesSaveKey(scope))
    )
      window.dispatchEvent(new Event(scopeConfig[scope].updatedEvent))
  })
}

export function loadTrashedInformationNotes(
  scope: InformationNotesScope = "notebook"
) {
  if (typeof window === "undefined") {
    return []
  }

  return readJsonBrowserStorage({
    kind: "localStorage",
    key: scopeConfig[scope].trashStorageKey,
    fallback: [],
    validate: isTrashedInformationNodeArray,
  })
}

export function saveTrashedInformationNotes(
  nodes: TrashedInformationNode[],
  scope: InformationNotesScope = "notebook"
) {
  return saveDatabaseDraft(
    "notes-trash:" + scope,
    "Notebook trash",
    nodes,
    async (snapshot) => {
      const { error } = await createPublicClient()
        .from("app_settings")
        .upsert(
          {
            id: "notes-trash:" + scope,
            value: snapshot,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
      if (error) throw error
      writeBrowserStorage(
        "localStorage",
        scopeConfig[scope].trashStorageKey,
        JSON.stringify(snapshot)
      )
    }
  )
}

async function syncNotesTrash(scope: InformationNotesScope) {
  const key = "notes-trash:" + scope
  await waitForDatabaseSave(key).catch(() => {})
  const pending = readPendingDatabaseSave<TrashedInformationNode[]>(key)
  if (pending) await saveTrashedInformationNotes(pending, scope)
  await waitForDatabaseSave(key)
  const { data, error } = await createPublicClient()
    .from("app_settings")
    .select("value")
    .eq("id", key)
    .maybeSingle()
  if (error) throw error
  if (data && isTrashedInformationNodeArray(data.value)) {
    writeBrowserStorage(
      "localStorage",
      scopeConfig[scope].trashStorageKey,
      JSON.stringify(data.value)
    )
  } else {
    const legacyTrash = loadTrashedInformationNotes(scope)
    if (legacyTrash.length)
      await saveTrashedInformationNotes(legacyTrash, scope)
  }
}

async function getInformationNotesFromDatabase(
  scope: InformationNotesScope = "notebook"
) {
  await waitForDatabaseSave(notesSaveKey(scope)).catch(() => {})
  const pending = readPendingDatabaseSave<NoteDraft>(notesSaveKey(scope))
  if (pending) {
    try {
      await saveInformationNotes(pending.nodes, scope)
    } catch {
      return mergeLiveNotes(pending.nodes, scope)
    }
  }
  await waitForDatabaseSave(notesSaveKey(scope))
  await syncNotesTrash(scope)
  const supabase = createPublicClient()
  const rows = await readAllRows<InformationNoteRow>((from, to) =>
    supabase
      .from(scopeConfig[scope].tableName)
      .select("*")
      .order("sort_order")
      .order("id")
      .range(from, to)
  )
  let notes = rows.map(toInformationNode)
  confirmedNotes.set(scope, structuredClone(notes))
  if (!notes.length) {
    // Migrate existing local notes only into an uninitialized collection. An
    // intentionally emptied collection must stay empty on another device.
    const marker = await supabase
      .from("app_settings")
      .select("id")
      .eq("id", "notes-initialized:" + scope)
      .maybeSingle()
    if (marker.error) throw marker.error
    if (!marker.data) {
      const localNotes = loadInformationNotes(scope)
      notes =
        scope === "knowledge-base" &&
        !readBrowserStorage("localStorage", scopeConfig[scope].storageKey)
          ? ((await loadPublishedKnowledgeBaseNotes()) ?? localNotes)
          : localNotes
      await saveInformationNotes(notes, scope)
      // Re-read in case another device initialized the same collection.
      notes = (
        await readAllRows<InformationNoteRow>((from, to) =>
          supabase
            .from(scopeConfig[scope].tableName)
            .select("*")
            .order("sort_order")
            .order("id")
            .range(from, to)
        )
      ).map(toInformationNode)
      confirmedNotes.set(scope, structuredClone(notes))
    }
  }
  if (
    scope === "knowledge-base" &&
    readBrowserStorage("localStorage", knowledgeBaseExampleVersionKey) !== "10"
  ) {
    notes = linkRequiredDocumentNotes(
      removeSupersededDocumentUpdatePages(
        mergeRequiredDocumentNotes(
          mergeKnownDocumentRequirementNotes(
            organizeDocumentKnowledgePages(
              simplifyKnowledgeBaseNotes(mergeCountryExamples(notes))
            ),
            true
          ),
          true
        )
      )
    )
    await saveInformationNotes(notes, scope)
    writeBrowserStorage("localStorage", knowledgeBaseExampleVersionKey, "10")
  }
  const visibleNotes = await mergeLiveNotes(notes, scope)
  cacheInformationNotes(visibleNotes, scope)
  return visibleNotes
}

async function mergeLiveNotes(
  nodes: InformationNode[],
  scope: InformationNotesScope
) {
  return scope === "knowledge-base"
    ? mergeDynamicOkfNotes(nodes, await loadDynamicOkfIndex())
    : nodes
}

function cacheInformationNotes(
  nodes: InformationNode[],
  scope: InformationNotesScope
) {
  if (typeof window !== "undefined") {
    writeBrowserStorage(
      "localStorage",
      scopeConfig[scope].storageKey,
      JSON.stringify(nodes)
    )
  }
}

function toInformationNode(row: InformationNoteRow): InformationNode {
  return {
    id: row.id,
    parentId: row.parent_id ?? undefined,
    type: row.type,
    title: row.title,
    content: row.content ?? undefined,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toInformationRow(
  node: InformationNode,
  sortOrder: number
): InformationNoteRow {
  return {
    id: node.id,
    parent_id: node.parentId ?? null,
    type: node.type,
    title: node.title,
    content: node.content ?? null,
    pinned: node.pinned ?? false,
    sort_order: sortOrder,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  }
}

async function saveDatabaseInformationNotes(
  nodes: InformationNode[],
  scope: InformationNotesScope,
  previous: InformationNode[]
) {
  const supabase = createPublicClient()
  const table = scopeConfig[scope].tableName
  const previousRows = new Map(
    previous.map((node, index) => [node.id, toInformationRow(node, index)])
  )
  let rows = nodes
    .map(toInformationRow)
    .filter(
      (row) => JSON.stringify(row) !== JSON.stringify(previousRows.get(row.id))
    )
  const currentRows = await readAllRows<InformationNoteRow>((from, to) =>
    supabase.from(table).select("*").order("id").range(from, to)
  )
  const currentById = new Map(currentRows.map((row) => [row.id, row]))
  // A first-load migration may race another device initializing the notebook.
  // Preserve records already present instead of replacing them with seed text.
  if (!previous.length) rows = rows.filter((row) => !currentById.has(row.id))
  for (const row of rows) {
    const before = previousRows.get(row.id)
    const current = currentById.get(row.id)
    if (before && !current)
      throw new Error(
        "This note was deleted on another device. Reload before saving again."
      )
    if (
      before &&
      current &&
      Date.parse(current.updated_at) !== Date.parse(before.updated_at) &&
      Date.parse(current.updated_at) !== Date.parse(row.updated_at)
    )
      throw new Error(
        "This note changed on another device. Reload the notebook before saving again."
      )
  }
  const ids = new Set(nodes.map((node) => node.id))
  const removed = previous.filter((node) => !ids.has(node.id))
  const removedIds = new Set(removed.map((node) => node.id))
  for (const node of removed) {
    const current = currentById.get(node.id)
    if (
      current &&
      Date.parse(current.updated_at) !== Date.parse(node.updatedAt)
    )
      throw new Error(
        "A note you are deleting changed on another device. Reload before deleting it."
      )
  }
  if (
    currentRows.some(
      (row) =>
        row.parent_id &&
        removedIds.has(row.parent_id) &&
        !removedIds.has(row.id)
    )
  )
    throw new Error(
      "This folder has new content from another device. Reload before deleting it."
    )
  // Write changed notes only. Saving one browser's stale notebook must never
  // overwrite or delete unrelated notes created on another device.
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(index, index + 100), { onConflict: "id" })
    if (error) throw error
  }
  await deleteRowsById(
    removed.map((node) => node.id),
    (ids) => supabase.from(table).delete().in("id", ids)
  )
  const { error } = await supabase.from("app_settings").upsert(
    {
      id: "notes-initialized:" + scope,
      value: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )
  if (error) throw error
}

export function getPinnedInformationNodes(nodes: InformationNode[]) {
  return nodes
    .filter((node) => node.pinned)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getInformationNotes(
  scope: InformationNotesScope = "notebook"
) {
  try {
    const value = await getInformationNotesFromDatabase(scope)
    clearDatabaseReadFailure("notes:" + scope)
    return value
  } catch {
    reportDatabaseReadFailure("notes:" + scope, "Notebook")
    return loadInformationNotes(scope)
  }
}
