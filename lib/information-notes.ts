import { createPublicClient } from "@/lib/public-client"
import {
  readBrowserStorage,
  readJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"
import { createInitialPages } from "@/lib/okf/seed"
import type { KnowledgePage } from "@/lib/okf/schema"

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

const knowledgeBaseExampleVersionKey = "africa-ctn-knowledge-base-examples-v2"

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

function editorDocument(blocks: { heading?: string; text?: string }[]) {
  return JSON.stringify({
    type: "doc",
    content: blocks.flatMap((block) => [
      ...(block.heading
        ? [
            {
              type: "heading",
              attrs: { textAlign: null, level: 2 },
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
    ]),
  })
}

function countryExampleNodes(timestamp: string): InformationNode[] {
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

  return countries.flatMap((country) => {
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
  })
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

function hasCountryExamples(nodes: InformationNode[]) {
  const countryFolders = new Set(
    nodes
      .filter((node) => node.type === "folder" && !node.parentId)
      .map((node) => node.title.toLocaleLowerCase())
  )
  return ["madagascar", "djibouti", "somalia"].every((country) =>
    countryFolders.has(country)
  )
}

function knowledgePageBlocks(page: KnowledgePage) {
  const blocks = page.content.sections
    .filter((section) => section.heading || section.text)
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

  return blocks.length
    ? blocks
    : [{ text: "Start typing to add knowledge to this page." }]
}

export function knowledgeBaseNotesFromPages(
  pages: KnowledgePage[] = createInitialPages()
): InformationNode[] {
  const timestamp = now()
  const guideId = "knowledge-base-guide"
  const indexId = "knowledge-base-index"
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
  const migratedPages: InformationNode[] = pages.map((page) => ({
    id: `knowledge-page-${page.id}`,
    parentId:
      page.template === "document"
        ? `${countryFolderId(page.country)}-documents`
        : countryFolderId(page.country),
    type: "note",
    title: page.title,
    content: editorDocument(knowledgePageBlocks(page)),
    createdAt: timestamp,
    updatedAt: timestamp,
  }))

  return mergeCountryExamples([
    {
      id: indexId,
      type: "note",
      title: "Index",
      pinned: true,
      content: editorDocument([
        {
          text: "Use this page as the map of the knowledge base. Link to important country, document, process, and comparison pages as the wiki grows.",
        },
        {
          heading: "Start here",
          text: "Create folders for broad areas and typed pages for knowledge. Keep each fact in the clearest existing page, then link related pages instead of copying the same fact into several places.",
        },
      ]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: guideId,
      type: "note",
      title: "Knowledge Base Guide",
      pinned: true,
      content: editorDocument([
        {
          text: "The knowledge base is a flexible, interlinked wiki. Pages are free-form and should stay useful to people first; structure is a convention, not a form that every page must satisfy.",
        },
        {
          heading: "Three layers",
          text: "Raw sources are immutable evidence. Wiki pages synthesize what those sources mean. This guide defines the conventions used to maintain the wiki.",
        },
        {
          heading: "Page conventions",
          text: "Use a clear title. State scope and conditions next to the claim they qualify. Link related pages. Cite the source or evidence for operational claims. Record contradictions instead of silently choosing one version. Avoid copying changing values into multiple pages.",
        },
        {
          heading: "Maintenance",
          text: "Update the Index when important pages are added. Keep a chronological Country Updates page for meaningful changes. Periodically check for stale claims, contradictions, missing links, duplicate guidance, and pages with no useful connections.",
        },
        {
          heading: "Operational OKF",
          text: "Certificate rules and field mappings may be compiled from this wiki when automation needs them. Those derived structures should not dictate how every knowledge page is written.",
        },
      ]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "country-updates",
      type: "note",
      title: "Country Updates",
      content: editorDocument([
        {
          text: "Keep an append-only timeline of meaningful country knowledge changes. Start entries with a date, action, and short title so the history stays easy to scan and search.",
        },
      ]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    ...countryFolders,
    ...documentFolders,
    ...migratedPages,
  ])
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

export function saveInformationNotes(
  nodes: InformationNode[],
  scope: InformationNotesScope = "notebook"
) {
  if (typeof window === "undefined") {
    return
  }

  writeBrowserStorage(
    "localStorage",
    scopeConfig[scope].storageKey,
    JSON.stringify(nodes)
  )
  saveDatabaseInformationNotes(nodes, scope).finally(() => {
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
  if (typeof window === "undefined") {
    return
  }

  writeBrowserStorage(
    "localStorage",
    scopeConfig[scope].trashStorageKey,
    JSON.stringify(nodes)
  )
}

export async function getInformationNotes(
  scope: InformationNotesScope = "notebook"
) {
  let localNotes = loadInformationNotes(scope)
  const needsExampleMigration =
    scope === "knowledge-base" &&
    readBrowserStorage("localStorage", knowledgeBaseExampleVersionKey) !== "2"

  if (needsExampleMigration) {
    localNotes = mergeCountryExamples(localNotes)
    cacheInformationNotes(localNotes, scope)
    writeBrowserStorage("localStorage", knowledgeBaseExampleVersionKey, "2")
  }

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(scopeConfig[scope].tableName)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return localNotes
    }

    let notes = (data ?? []).map((row) =>
      toInformationNode(row as InformationNoteRow)
    )

    if (!notes.length && localNotes.length) {
      const initialNotes =
        scope === "knowledge-base"
          ? ((await loadPublishedKnowledgeBaseNotes()) ?? localNotes)
          : localNotes
      saveDatabaseInformationNotes(initialNotes, scope)
      return initialNotes
    }

    if (
      scope === "knowledge-base" &&
      (needsExampleMigration ||
        (hasCountryExamples(localNotes) && !hasCountryExamples(notes)))
    ) {
      notes = mergeCountryExamples(notes)
      void saveDatabaseInformationNotes(notes, scope)
    }

    cacheInformationNotes(notes, scope)
    return notes
  } catch {
    return localNotes
  }
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
  scope: InformationNotesScope
) {
  try {
    const supabase = createPublicClient()
    const rows = nodes.map((node, index) => toInformationRow(node, index))

    if (rows.length) {
      await supabase
        .from(scopeConfig[scope].tableName)
        .upsert(rows, { onConflict: "id" })
    }

    const ids = new Set(nodes.map((node) => node.id))
    const { data } = await supabase
      .from(scopeConfig[scope].tableName)
      .select("id")
    const staleIds = (data ?? [])
      .map((row) => row.id as string)
      .filter((id) => !ids.has(id))

    if (staleIds.length) {
      await supabase
        .from(scopeConfig[scope].tableName)
        .delete()
        .in("id", staleIds)
    }
  } catch {}
}

export function getPinnedInformationNodes(nodes: InformationNode[]) {
  return nodes
    .filter((node) => node.pinned)
    .sort((a, b) => a.title.localeCompare(b.title))
}
