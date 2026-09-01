import { createPublicClient } from "@/lib/public-client"

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

const storageKey = "africa-ctn-information-notes"
const trashStorageKey = "africa-ctn-information-notes-trash"
const tableName = "information_notes"
export const informationUpdatedEvent = "information-notes:updated"

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

export function loadInformationNotes() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? (JSON.parse(stored) as InformationNode[]) : null

    return Array.isArray(parsed) ? parsed : defaultInformationNotes()
  } catch {
    return defaultInformationNotes()
  }
}

export function saveInformationNotes(nodes: InformationNode[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nodes))
  saveDatabaseInformationNotes(nodes).finally(() => {
    window.dispatchEvent(new Event(informationUpdatedEvent))
  })
}

export function loadTrashedInformationNotes() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const stored = window.localStorage.getItem(trashStorageKey)
    const parsed = stored
      ? (JSON.parse(stored) as TrashedInformationNode[])
      : null

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTrashedInformationNotes(nodes: TrashedInformationNode[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(trashStorageKey, JSON.stringify(nodes))
}

export async function getInformationNotes() {
  const localNotes = loadInformationNotes()

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return localNotes
    }

    const notes = (data ?? []).map((row) =>
      toInformationNode(row as InformationNoteRow)
    )

    if (!notes.length && localNotes.length) {
      saveDatabaseInformationNotes(localNotes)
      return localNotes
    }

    cacheInformationNotes(notes)
    return notes
  } catch {
    return localNotes
  }
}

function cacheInformationNotes(nodes: InformationNode[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(nodes))
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

async function saveDatabaseInformationNotes(nodes: InformationNode[]) {
  try {
    const supabase = createPublicClient()
    const rows = nodes.map((node, index) => toInformationRow(node, index))

    if (rows.length) {
      await supabase.from(tableName).upsert(rows, { onConflict: "id" })
    }

    const ids = new Set(nodes.map((node) => node.id))
    const { data } = await supabase.from(tableName).select("id")
    const staleIds = (data ?? [])
      .map((row) => row.id as string)
      .filter((id) => !ids.has(id))

    if (staleIds.length) {
      await supabase.from(tableName).delete().in("id", staleIds)
    }
  } catch {}
}

export function getPinnedInformationNodes(nodes: InformationNode[]) {
  return nodes
    .filter((node) => node.pinned)
    .sort((a, b) => a.title.localeCompare(b.title))
}
