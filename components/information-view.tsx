"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDownAZIcon,
  ArrowDownZAIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  HomeIcon,
  ListCollapseIcon,
  ListSortAscendingIcon,
  MoreHorizontalIcon,
  PanelTopCloseIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import {
  NotebookLayout,
  NotebookActionTooltip,
  NotebookBreadcrumbs,
  NotebookTreeCaret,
  type NotebookBreadcrumbItem,
} from "@/components/notebook-layout"
import { KnowledgeBaseAiManager } from "@/components/knowledge-base-ai-manager"
import { NotebookSkeleton } from "@/components/page-skeletons"
import {
  SiteHeaderBackButton,
  siteHeaderGlassButtonClassName,
} from "@/components/site-header"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  createInformationId,
  getInformationNotes,
  mergeLiveKnowledgeBaseNotes,
  informationUpdatedEvent,
  knowledgeBaseUpdatedEvent,
  loadInformationNotes,
  loadTrashedInformationNotes,
  saveInformationNotes,
  saveTrashedInformationNotes,
  type InformationNode,
  type InformationNodeType,
  type InformationNotesScope,
  type TrashedInformationNode,
} from "@/lib/information-notes"
import { cn } from "@/lib/utils"
import {
  readBrowserStorage,
  readJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

const mobileRootNotesId = "__root_notes__"
const trashViewId = "__trash__"
const lastMobileNoteStorageKey = "actn-information-last-mobile-note-v1"
const lastMobileLocationStorageKey = "actn-information-last-mobile-location-v2"
const desktopNotebookStateStorageKey = "actn-information-desktop-state-v1"

type EditorSelection = {
  from: number
  to: number
}

type DesktopNotebookState = {
  activeId?: string
  collapsedFolderIds: string[]
  selectionByNoteId: Record<string, EditorSelection>
}

type MobileNotebookLocation =
  | { type: "node"; nodeId: string }
  | { type: "view"; view: "folders" | "notes" | "trash" }

type InformationSortOrder =
  | "name-asc"
  | "name-desc"
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"

const informationSortOptions: {
  value: InformationSortOrder
  label: string
}[] = [
  { value: "name-asc", label: "File name (A to Z)" },
  { value: "name-desc", label: "File name (Z to A)" },
  { value: "updated-desc", label: "Modified time (new to old)" },
  { value: "updated-asc", label: "Modified time (old to new)" },
  { value: "created-desc", label: "Created time (new to old)" },
  { value: "created-asc", label: "Created time (old to new)" },
]

function childNodes(nodes: InformationNode[], parentId?: string) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1
      }

      return a.title.localeCompare(b.title)
    })
}

function compareInformationNodes(
  sortOrder: InformationSortOrder,
  a: InformationNode,
  b: InformationNode
) {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1
  }

  if (sortOrder === "name-asc" || sortOrder === "name-desc") {
    const result = a.title.localeCompare(b.title)
    return sortOrder === "name-asc" ? result : -result
  }

  const field = sortOrder.startsWith("updated") ? "updatedAt" : "createdAt"
  const result = new Date(a[field]).getTime() - new Date(b[field]).getTime()

  return sortOrder.endsWith("asc") ? result : -result
}

function sortedChildNodes(
  nodes: InformationNode[],
  sortOrder: InformationSortOrder,
  parentId?: string
) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => compareInformationNodes(sortOrder, a, b))
}

function isDesktopViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches
  )
}

function isMobileViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
  )
}

function loadDesktopNotebookState(
  storageKey = desktopNotebookStateStorageKey
): DesktopNotebookState | null {
  return readJsonBrowserStorage({
    kind: "localStorage",
    key: storageKey,
    fallback: null,
    validate: (value): value is DesktopNotebookState =>
      Boolean(value) &&
      typeof value === "object" &&
      Array.isArray((value as DesktopNotebookState).collapsedFolderIds) &&
      typeof (value as DesktopNotebookState).selectionByNoteId === "object" &&
      (value as DesktopNotebookState).selectionByNoteId !== null,
  })
}

function saveDesktopNotebookState(
  state: DesktopNotebookState,
  storageKey = desktopNotebookStateStorageKey
) {
  if (typeof window === "undefined" || !isDesktopViewport()) {
    return
  }

  writeBrowserStorage("localStorage", storageKey, JSON.stringify(state))
}

function loadMobileNotebookLocation(
  storageKey = lastMobileLocationStorageKey
): MobileNotebookLocation | null {
  return readJsonBrowserStorage({
    kind: "localStorage",
    key: storageKey,
    fallback: null,
    validate: (value): value is MobileNotebookLocation => {
      if (!value || typeof value !== "object") {
        return false
      }

      const location = value as Partial<MobileNotebookLocation>

      return (
        (location.type === "node" && typeof location.nodeId === "string") ||
        (location.type === "view" &&
          (location.view === "folders" ||
            location.view === "notes" ||
            location.view === "trash"))
      )
    },
  })
}

function saveMobileNotebookLocation(
  location: MobileNotebookLocation,
  storageKey = lastMobileLocationStorageKey
) {
  if (typeof window === "undefined" || !isMobileViewport()) {
    return
  }

  writeBrowserStorage("localStorage", storageKey, JSON.stringify(location))
}

function descendantsOf(nodes: InformationNode[], nodeId: string) {
  const ids = new Set<string>([nodeId])
  let changed = true

  while (changed) {
    changed = false

    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id)
        changed = true
      }
    }
  }

  return ids
}

function ancestorFolderIds(nodes: InformationNode[], nodeId: string) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const ids: string[] = []
  let currentNode = nodeById.get(nodeId)

  while (currentNode?.parentId) {
    const parent = nodeById.get(currentNode.parentId)

    if (!parent) {
      break
    }

    if (parent.type === "folder") {
      ids.push(parent.id)
    }

    currentNode = parent
  }

  return ids
}

function folderIdsToRevealNode(nodes: InformationNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId)

  return [
    ...ancestorFolderIds(nodes, nodeId),
    ...(node?.type === "folder" ? [node.id] : []),
  ]
}

function firstNote(
  nodes: InformationNode[],
  parentId?: string
): InformationNode | undefined {
  const directNote = childNodes(nodes, parentId).find(
    (node) => node.type === "note"
  )

  if (directNote) {
    return directNote
  }

  for (const folder of childNodes(nodes, parentId).filter(
    (node) => node.type === "folder"
  )) {
    const note = firstNote(nodes, folder.id)

    if (note) {
      return note
    }
  }
}

function folderDescendants(nodes: InformationNode[], folderId: string) {
  const descendantIds = descendantsOf(nodes, folderId)
  descendantIds.delete(folderId)

  return nodes.filter((node) => descendantIds.has(node.id))
}

function visibleTreeNodeIds(
  nodes: InformationNode[],
  collapsedFolderIds: Set<string>,
  sortOrder: InformationSortOrder = "name-asc",
  parentId?: string
) {
  const ids: string[] = []

  for (const node of sortedChildNodes(nodes, sortOrder, parentId)) {
    ids.push(node.id)

    if (node.type === "folder" && !collapsedFolderIds.has(node.id)) {
      ids.push(
        ...visibleTreeNodeIds(nodes, collapsedFolderIds, sortOrder, node.id)
      )
    }
  }

  return ids
}

function formatEditedDate(value?: string) {
  if (!value) {
    return "No edits yet"
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return "No edits yet"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp)
}

function formatShortEditedDate(value?: string) {
  if (!value) {
    return ""
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return ""
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(timestamp)
}

function notePreview(content?: string) {
  if (!content) {
    return ""
  }

  try {
    const parsed = JSON.parse(content) as { content?: unknown[] }
    const text: string[] = []
    const collectText = (value: unknown) => {
      if (!value || typeof value !== "object") {
        return
      }

      if ("text" in value && typeof value.text === "string") {
        text.push(value.text)
      }

      if ("content" in value && Array.isArray(value.content)) {
        value.content.forEach(collectText)
      }
    }

    parsed.content?.forEach(collectText)
    return text.join(" ").trim()
  } catch {
    return content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }
}

type EditorJsonNode = {
  type?: string
  attrs?: Record<string, unknown>
  text?: string
  content?: EditorJsonNode[]
}

function editorNodeText(node?: EditorJsonNode) {
  if (!node) {
    return ""
  }

  const textParts: string[] = []

  function collectText(currentNode: EditorJsonNode) {
    if (currentNode.text) {
      textParts.push(currentNode.text)
    }

    currentNode.content?.forEach(collectText)
  }

  collectText(node)
  return textParts.join("").trim()
}

function parseEditorJson(value?: string): EditorJsonNode {
  if (!value) {
    return {
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: null } }],
    }
  }

  try {
    const parsed = JSON.parse(value) as EditorJsonNode

    if (parsed && parsed.type === "doc" && Array.isArray(parsed.content)) {
      return parsed
    }
  } catch {}

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text: value }],
      },
    ],
  }
}

type KnowledgePageDefiners = {
  country: string
  pageType: string
  status: string
}

function editorContentWithTitle(
  title: string,
  content?: string,
  definers?: KnowledgePageDefiners
) {
  const body = parseEditorJson(content)

  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { textAlign: null, level: 1 },
        content: title ? [{ type: "text", text: title }] : undefined,
      },
      ...(definers
        ? [
            {
              type: "knowledgeDefiners",
              attrs: definers,
            },
          ]
        : []),
      ...(body.content ?? []),
    ],
  })
}

function splitEditorTitleAndContent(value: string, fallbackTitle: string) {
  const document = parseEditorJson(value)
  const [titleNode, ...bodyContent] = document.content ?? []
  const title = editorNodeText(titleNode) || fallbackTitle || "Untitled Note"
  const cleanBodyContent = bodyContent.filter(
    (node) => node.type !== "knowledgeDefiners"
  )

  return {
    title,
    content: JSON.stringify({
      type: "doc",
      content: cleanBodyContent.length
        ? cleanBodyContent
        : [{ type: "paragraph", attrs: { textAlign: null } }],
    }),
  }
}

function knowledgePageType(title: string) {
  const value = title.trim().toLocaleLowerCase()
  if (["overview", "country index", "index"].includes(value)) return "Overview"
  if (["requirements", "required documents"].includes(value))
    return "Requirements"
  if (["procedure", "process", "shared process"].includes(value))
    return "Procedure"
  if (["sources", "references"].includes(value)) return "Sources"
  if (value.includes("field map")) return "Field mapping"
  if (value.includes("instruction") || value === "standards")
    return "Instructions"
  if (value.includes("update") || value.includes("log")) return "Change log"
  return "Knowledge"
}

function MobileFolderTitlePrompt({
  mode,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  mode: "create" | "rename"
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] md:hidden">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-10 justify-self-start rounded-full bg-background shadow-sm"
          aria-label={mode === "create" ? "Cancel folder" : "Cancel rename"}
          onClick={onCancel}
        >
          <XIcon />
        </Button>
        <div className="text-sm font-semibold text-foreground">
          {mode === "create" ? "New Folder" : "Rename Folder"}
        </div>
        <Button
          size="icon-sm"
          className="size-10 justify-self-end rounded-full bg-yellow-400 text-yellow-950 shadow-sm hover:bg-yellow-300 disabled:opacity-40"
          aria-label={mode === "create" ? "Create folder" : "Save folder name"}
          disabled={!value.trim()}
          onClick={onConfirm}
        >
          <CheckIcon />
        </Button>
      </header>
      <div className="grid gap-3 px-4 pt-3">
        <div className="relative">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onConfirm()
              }

              if (event.key === "Escape") {
                onCancel()
              }
            }}
            className="h-12 rounded-xl bg-background pr-10 pl-3 text-base shadow-sm"
            aria-label="Folder title"
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}

function MobileFoldersScreen({
  nodes,
  onOpenFolder,
  onOpenRootNotes,
}: {
  nodes: InformationNode[]
  onOpenFolder: (nodeId: string) => void
  onOpenRootNotes: () => void
}) {
  const rootItems = childNodes(nodes)
  const rootFolders = rootItems.filter((node) => node.type === "folder")
  const rootNotes = rootItems.filter((node) => node.type === "note")
  const totalNotes = nodes.filter((node) => node.type === "note").length

  return (
    <div className="relative min-h-full bg-muted/60 px-4 pt-4 pb-24 md:hidden">
      <h1 className="text-[30pt] leading-tight font-bold tracking-tight text-foreground md:text-3xl">
        Folders
      </h1>
      <div className="mt-5 overflow-hidden rounded-2xl bg-background">
        {rootFolders.map((folder, index) => {
          const count = childNodes(nodes, folder.id).length

          return (
            <button
              key={folder.id}
              type="button"
              className="relative flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
              onClick={() => onOpenFolder(folder.id)}
            >
              <FolderIcon className="size-6 shrink-0 text-yellow-500" />
              <span className="min-w-0 flex-1 text-lg font-medium">
                {folder.title}
              </span>
              <span className="text-lg text-muted-foreground">{count}</span>
              <ChevronRightIcon className="size-6 shrink-0 text-muted-foreground" />
              {index < rootFolders.length - 1 ? (
                <span className="absolute right-0 left-13 h-px translate-y-8 bg-border/60" />
              ) : null}
            </button>
          )
        })}
        {rootNotes.length ? (
          <button
            type="button"
            className="flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
            onClick={onOpenRootNotes}
          >
            <FileTextIcon className="size-6 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-lg font-medium">Notes</span>
            <span className="text-lg text-muted-foreground">
              {rootNotes.length}
            </span>
            <ChevronRightIcon className="size-6 shrink-0 text-muted-foreground" />
          </button>
        ) : null}
      </div>
      <p className="mt-3 px-1 text-sm text-muted-foreground">
        {totalNotes} Notes
      </p>
    </div>
  )
}

function MobileMoveFolderMenuItems({
  nodes,
  movingFolder,
  parentId,
  blockedIds,
  onMove,
}: {
  nodes: InformationNode[]
  movingFolder: InformationNode
  parentId?: string
  blockedIds: Set<string>
  onMove: (nodeId: string, parentId?: string) => void
}) {
  const folders = childNodes(nodes, parentId).filter(
    (node) =>
      node.type === "folder" &&
      node.id !== movingFolder.id &&
      !blockedIds.has(node.id)
  )

  return (
    <>
      {folders.map((targetFolder) => {
        const childFolders = childNodes(nodes, targetFolder.id).filter(
          (node) =>
            node.type === "folder" &&
            node.id !== movingFolder.id &&
            !blockedIds.has(node.id)
        )

        if (childFolders.length) {
          return (
            <DropdownMenuSub key={targetFolder.id}>
              <DropdownMenuSubTrigger className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!">
                <FolderIcon />
                {targetFolder.title}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52! p-1.5!">
                {targetFolder.id !== movingFolder.parentId ? (
                  <DropdownMenuItem
                    className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
                    onClick={() => onMove(movingFolder.id, targetFolder.id)}
                  >
                    Move Here
                  </DropdownMenuItem>
                ) : null}
                <MobileMoveFolderMenuItems
                  nodes={nodes}
                  movingFolder={movingFolder}
                  parentId={targetFolder.id}
                  blockedIds={blockedIds}
                  onMove={onMove}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }

        return targetFolder.id !== movingFolder.parentId ? (
          <DropdownMenuItem
            key={targetFolder.id}
            className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
            onClick={() => onMove(movingFolder.id, targetFolder.id)}
          >
            <FolderIcon />
            {targetFolder.title}
          </DropdownMenuItem>
        ) : null
      })}
    </>
  )
}

function MobileFolderNotesScreen({
  folder,
  nodes,
  notes,
  onOpenNote,
  onDelete,
  onMove,
}: {
  folder?: InformationNode
  nodes: InformationNode[]
  notes: InformationNode[]
  onOpenNote: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onMove: (nodeId: string, parentId?: string) => void
}) {
  const allFolders = nodes.filter((node) => node.type === "folder")
  const childFolders = folder
    ? childNodes(nodes, folder.id).filter((node) => node.type === "folder")
    : []

  return (
    <div className="relative min-h-full bg-muted/60 px-4 pt-4 pb-24 md:hidden">
      <p className="text-muted-foreground">
        {notes.length} Notes
        {childFolders.length ? `, ${childFolders.length} Folders` : ""}
      </p>
      {childFolders.length ? (
        <div className="mt-5 overflow-hidden rounded-2xl bg-background">
          {childFolders.map((childFolder, index) => {
            const count = childNodes(nodes, childFolder.id).length

            return (
              <button
                key={childFolder.id}
                type="button"
                className="relative flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
                onClick={() => onOpenNote(childFolder.id)}
              >
                <FolderIcon className="size-6 shrink-0 text-yellow-500" />
                <span className="min-w-0 flex-1 text-lg font-medium">
                  {childFolder.title}
                </span>
                <span className="text-lg text-muted-foreground">{count}</span>
                <ChevronRightIcon className="size-6 shrink-0 text-muted-foreground" />
                {index < childFolders.length - 1 ? (
                  <span className="absolute right-0 left-13 h-px translate-y-8 bg-border/60" />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex min-h-20 w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-2xl bg-background px-5 py-4"
          >
            <button
              type="button"
              className="min-w-0 flex-1 overflow-hidden text-left transition-colors active:bg-muted"
              onClick={() => onOpenNote(note.id)}
            >
              <span className="block max-w-full truncate text-lg font-semibold">
                {note.title}
              </span>
              <span className="mt-1 block max-w-full truncate text-[17px] leading-snug text-muted-foreground">
                {formatShortEditedDate(note.updatedAt)}{" "}
                {notePreview(note.content)}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Actions for ${note.title}`}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-52">
                    <DropdownMenuItem onClick={() => onMove(note.id)}>
                      Notebook
                    </DropdownMenuItem>
                    {allFolders
                      .filter(
                        (targetFolder) => targetFolder.id !== note.parentId
                      )
                      .map((targetFolder) => (
                        <DropdownMenuItem
                          key={targetFolder.id}
                          onClick={() => onMove(note.id, targetFolder.id)}
                        >
                          <FolderIcon />
                          {targetFolder.title}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(note.id)}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  )
}

function FolderDashboard({
  folder,
  nodes,
  onOpenNote,
}: {
  folder: InformationNode
  nodes: InformationNode[]
  onOpenNote: (nodeId: string) => void
}) {
  const descendants = folderDescendants(nodes, folder.id)
  const notes = descendants.filter((node) => node.type === "note")
  const folders = descendants.filter((node) => node.type === "folder")
  const recentNotes = [...notes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
    )
    .slice(0, 8)
  const mostRecentNote = recentNotes[0]

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {notes.length}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Folders</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {folders.length}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Most Recent Edit</p>
          {mostRecentNote ? (
            <button
              type="button"
              className="mt-2 block max-w-full text-left font-medium hover:underline"
              onClick={() => onOpenNote(mostRecentNote.id)}
            >
              <span className="block truncate">{mostRecentNote.title}</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {formatEditedDate(mostRecentNote.updatedAt)}
              </span>
            </button>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <p className="font-medium">Recent Notes</p>
        </div>
        {recentNotes.length ? (
          <div className="divide-y">
            {recentNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                onClick={() => onOpenNote(note.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {note.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatEditedDate(note.updatedAt)}
                  </span>
                </span>
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            This folder does not have any notes yet.
          </div>
        )}
      </div>
    </div>
  )
}

function TrashDashboard({
  trashedNodes,
  onRestore,
}: {
  trashedNodes: TrashedInformationNode[]
  onRestore: (nodeId: string) => void
}) {
  const topLevelTrashedNodes = trashedNodes
    .filter(
      (node) =>
        !node.parentId ||
        !trashedNodes.some((trashedNode) => trashedNode.id === node.parentId)
    )
    .sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
    )

  return (
    <div className="grid gap-4 px-3 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0">
      <div className="hidden items-center justify-between gap-3 md:flex">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Trash</h2>
          <p className="text-sm text-muted-foreground">
            Restore deleted notes and folders.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        {topLevelTrashedNodes.length ? (
          <div className="divide-y">
            {topLevelTrashedNodes.map((node) => {
              const deletedChildCount = trashedNodes.filter(
                (trashedNode) => trashedNode.parentId === node.id
              ).length

              return (
                <div
                  key={node.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{node.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {node.type === "folder"
                        ? `${deletedChildCount} item${
                            deletedChildCount === 1 ? "" : "s"
                          } inside`
                        : "Note"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(node.id)}
                  >
                    <RotateCcwIcon />
                    Restore
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Trash is empty.
          </div>
        )}
      </div>
    </div>
  )
}

function MobileNotebookActions({
  activeNode,
  nodes,
  onCreateNote,
  onCreateFolder,
  onOpenTrash,
  trashCount,
  onRename,
  onDelete,
  onMove,
}: {
  activeNode?: InformationNode
  nodes: InformationNode[]
  onCreateNote: () => void
  onCreateFolder: () => void
  onOpenTrash: () => void
  trashCount: number
  onRename: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onMove: (nodeId: string, parentId?: string) => void
}) {
  const isNote = activeNode?.type === "note"
  const isFolder = activeNode?.type === "folder"
  const blockedMoveIds = isFolder
    ? descendantsOf(nodes, activeNode.id)
    : new Set<string>()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={siteHeaderGlassButtonClassName}
            aria-label="Notebook actions"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52! p-1.5!">
        {!isNote ? (
          <>
            <DropdownMenuItem
              className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
              onClick={onCreateNote}
            >
              <FilePlus2Icon />
              Add Note
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
              onClick={onCreateFolder}
            >
              <FolderPlusIcon />
              Add Folder
            </DropdownMenuItem>
          </>
        ) : null}
        {!isNote ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
              onClick={onOpenTrash}
            >
              <Trash2Icon />
              Trash{trashCount ? ` (${trashCount})` : ""}
            </DropdownMenuItem>
          </>
        ) : null}
        {isFolder ? (
          <>
            <DropdownMenuItem
              className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
              onClick={() => onRename(activeNode.id)}
            >
              <PencilIcon />
              Rename Folder
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!">
                Move Folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52! p-1.5!">
                {activeNode.parentId ? (
                  <DropdownMenuItem
                    className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
                    onClick={() => onMove(activeNode.id)}
                  >
                    Notebook
                  </DropdownMenuItem>
                ) : null}
                <MobileMoveFolderMenuItems
                  nodes={nodes}
                  movingFolder={activeNode}
                  blockedIds={blockedMoveIds}
                  onMove={onMove}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
        {activeNode ? (
          <DropdownMenuItem
            className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
            variant="destructive"
            onClick={() => onDelete(activeNode.id)}
          >
            <Trash2Icon />
            Delete {isFolder ? "Folder" : "Note"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NoteTree({
  nodes,
  allNodes,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onTogglePin,
  onMove,
  collapsedFolderIds,
  sortOrder,
  onToggleCollapse,
  editingNodeId,
  titleDraft,
  onTitleDraftChange,
  onCommitTitle,
  onCancelTitleEdit,
  onStartTitleEdit,
  focusableNodeIds = [],
  nodeRefs,
  onFocusNode = () => undefined,
  onOpenNoteForTyping = () => undefined,
  parentId,
  level = 0,
}: {
  nodes: InformationNode[]
  allNodes: InformationNode[]
  activeId?: string
  onSelect: (nodeId: string) => void
  onCreate: (type: InformationNodeType, parentId?: string) => void
  onDelete: (nodeId: string) => void
  onTogglePin: (nodeId: string) => void
  onMove: (nodeId: string, parentId?: string) => void
  collapsedFolderIds: Set<string>
  sortOrder: InformationSortOrder
  onToggleCollapse: (nodeId: string) => void
  editingNodeId?: string
  titleDraft: string
  onTitleDraftChange: (value: string) => void
  onCommitTitle: (nodeId: string) => void
  onCancelTitleEdit: () => void
  onStartTitleEdit: (nodeId: string) => void
  focusableNodeIds?: string[]
  nodeRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  onFocusNode?: (nodeId: string) => void
  onOpenNoteForTyping?: () => void
  parentId?: string
  level?: number
}) {
  const children = sortedChildNodes(nodes, sortOrder, parentId)
  const allFolders = allNodes.filter((node) => node.type === "folder")
  const fallbackNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>(
    {}
  )
  const treeNodeRefs = nodeRefs ?? fallbackNodeRefs

  if (!children.length && level === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No notes yet.
      </div>
    )
  }

  return (
    <div className="notebook-tree grid gap-2 lg:gap-1">
      {children.map((node) => {
        const isFolder = node.type === "folder"
        const isCollapsed = collapsedFolderIds.has(node.id)

        return (
          <div key={node.id}>
            <div
              className={cn(
                "group flex min-h-12 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)] focus-visible:ring-2 focus-visible:ring-ring/40 lg:min-h-0 lg:gap-0 lg:rounded-md lg:px-1 lg:py-0 lg:hover:bg-muted/70",
                activeId === node.id &&
                  "bg-[color-mix(in_oklch,var(--muted),var(--foreground)_10%)] lg:bg-muted"
              )}
              style={{ marginLeft: `${level * 0.95}rem` }}
              draggable
              tabIndex={0}
              ref={(element) => {
                treeNodeRefs.current[node.id] = element
              }}
              onKeyDown={(event) => {
                if (editingNodeId === node.id) {
                  return
                }

                if (event.target !== event.currentTarget) {
                  return
                }

                if (event.key === "Tab") {
                  const currentIndex = focusableNodeIds.indexOf(node.id)
                  const nextId =
                    focusableNodeIds[currentIndex + (event.shiftKey ? -1 : 1)]

                  if (!nextId) {
                    return
                  }

                  event.preventDefault()
                  onFocusNode(nextId)
                  return
                }

                if (event.key !== "Enter") {
                  return
                }

                event.preventDefault()
                onSelect(node.id)

                if (node.type === "folder") {
                  if (isCollapsed) {
                    onToggleCollapse(node.id)
                  }

                  const firstChild = childNodes(nodes, node.id)[0]

                  if (firstChild) {
                    onFocusNode(firstChild.id)
                  }
                  return
                }

                onOpenNoteForTyping()
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", node.id)
              }}
              onDragOver={(event) => {
                if (node.type === "folder") {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                const movedNodeId = event.dataTransfer.getData("text/plain")

                if (movedNodeId && node.type === "folder") {
                  onMove(movedNodeId, node.id)
                }
              }}
            >
              {isFolder ? (
                <NotebookTreeCaret
                  collapsed={isCollapsed}
                  label={node.title}
                  onToggle={() => onToggleCollapse(node.id)}
                />
              ) : (
                <span
                  className="size-9 shrink-0 lg:size-5"
                  aria-hidden="true"
                />
              )}
              {editingNodeId === node.id ? (
                <Input
                  aria-label="Folder title"
                  placeholder="Folder name"
                  value={titleDraft}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => onTitleDraftChange(event.target.value)}
                  onBlur={() => onCommitTitle(node.id)}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === "Enter") onCommitTitle(node.id)
                    if (event.key === "Escape") onCancelTitleEdit()
                  }}
                  className="h-7 min-w-0 flex-1 px-2 text-sm"
                  autoFocus
                />
              ) : (
                <Button
                  variant="ghost"
                  className="h-10 min-w-0 flex-1 justify-start px-2 text-[15px] hover:bg-transparent lg:h-7 lg:rounded-sm lg:px-1.5 lg:text-sm lg:font-normal"
                  onClick={() => {
                    onSelect(node.id)
                  }}
                  tabIndex={-1}
                >
                  <span className="truncate">{node.title}</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-9 opacity-100 transition-opacity lg:size-7 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                      aria-label={`Actions for ${node.title}`}
                      tabIndex={-1}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-52 lg:min-w-44"
                >
                  {node.type === "folder" ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => onCreate("note", node.id)}
                      >
                        <FilePlus2Icon />
                        Add Note
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onCreate("folder", node.id)}
                      >
                        <FolderPlusIcon />
                        Add Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStartTitleEdit(node.id)}
                      >
                        <PencilIcon />
                        Rename Folder
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => onTogglePin(node.id)}>
                    {node.pinned ? <PinOffIcon /> : <PinIcon />}
                    {node.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-52 lg:min-w-44">
                      <DropdownMenuItem onClick={() => onMove(node.id)}>
                        Notebook
                      </DropdownMenuItem>
                      {allFolders
                        .filter((folder) => {
                          const blockedIds = descendantsOf(allNodes, node.id)
                          return (
                            folder.id !== node.id && !blockedIds.has(folder.id)
                          )
                        })
                        .map((folder) => (
                          <DropdownMenuItem
                            key={folder.id}
                            onClick={() => onMove(node.id, folder.id)}
                          >
                            <FolderIcon />
                            {folder.title}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(node.id)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isFolder && !isCollapsed ? (
              <NoteTree
                nodes={nodes}
                allNodes={allNodes}
                activeId={activeId}
                onSelect={onSelect}
                onCreate={onCreate}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
                onMove={onMove}
                collapsedFolderIds={collapsedFolderIds}
                sortOrder={sortOrder}
                onToggleCollapse={onToggleCollapse}
                editingNodeId={editingNodeId}
                titleDraft={titleDraft}
                onTitleDraftChange={onTitleDraftChange}
                onCommitTitle={onCommitTitle}
                onCancelTitleEdit={onCancelTitleEdit}
                onStartTitleEdit={onStartTitleEdit}
                focusableNodeIds={focusableNodeIds}
                nodeRefs={treeNodeRefs}
                onFocusNode={onFocusNode}
                onOpenNoteForTyping={onOpenNoteForTyping}
                parentId={node.id}
                level={level + 1}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function InformationView({
  scope = "notebook",
}: {
  scope?: InformationNotesScope
}) {
  const isKnowledgeBase = scope === "knowledge-base"
  const basePath = isKnowledgeBase ? "/knowledge-base" : "/information"
  const rootLabel = isKnowledgeBase ? "Knowledge Base" : "Notebook"
  const itemLabel = isKnowledgeBase ? "page" : "note"
  const updatedEvent = isKnowledgeBase
    ? knowledgeBaseUpdatedEvent
    : informationUpdatedEvent
  const desktopStateKey = isKnowledgeBase
    ? "actn-knowledge-base-desktop-state-v1"
    : desktopNotebookStateStorageKey
  const mobileLocationKey = isKnowledgeBase
    ? "actn-knowledge-base-mobile-location-v1"
    : lastMobileLocationStorageKey
  const lastMobileItemKey = isKnowledgeBase
    ? "actn-knowledge-base-last-mobile-page-v1"
    : lastMobileNoteStorageKey
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nodes, setNodes] = React.useState<InformationNode[]>([])
  const [trashedNodes, setTrashedNodes] = React.useState<
    TrashedInformationNode[]
  >([])
  const [activeId, setActiveId] = React.useState<string | undefined>()
  const [contentDraft, setContentDraft] = React.useState("")
  const [titleDraft, setTitleDraft] = React.useState("")
  const [editingTreeNodeId, setEditingTreeNodeId] = React.useState<
    string | undefined
  >()
  const [treeTitleDraft, setTreeTitleDraft] = React.useState("")
  const [folderPromptParentId, setFolderPromptParentId] = React.useState<
    string | null
  >(null)
  const [folderPromptMode, setFolderPromptMode] = React.useState<
    "create" | "rename"
  >("create")
  const [folderPromptNodeId, setFolderPromptNodeId] = React.useState<
    string | null
  >(null)
  const [folderPromptTitle, setFolderPromptTitle] = React.useState("")
  const [noteSearch, setNoteSearch] = React.useState("")
  const [isNotebookLoading, setIsNotebookLoading] = React.useState(true)
  const nodesRef = React.useRef<InformationNode[]>([])
  const titleDraftRef = React.useRef("")
  const contentDraftRef = React.useRef("")
  const activeIdRef = React.useRef<string | undefined>(undefined)
  const activeNoteSaveTimeoutRef = React.useRef<number | undefined>(undefined)
  const saveActiveNoteRef = React.useRef<() => void>(() => undefined)
  const desktopSearchInputRef = React.useRef<HTMLInputElement | null>(null)
  const desktopNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>(
    {}
  )
  const mobileNoteSelectorRef = React.useRef<HTMLDetailsElement | null>(null)
  const notebookShellRef = React.useRef<HTMLDivElement | null>(null)
  const hasInitializedCollapsedFolders = React.useRef(false)
  const hasLoadedNotes = React.useRef(false)
  const [pendingDesktopNodeFocusId, setPendingDesktopNodeFocusId] =
    React.useState<string>()
  const [editorFocusSignal, setEditorFocusSignal] = React.useState(0)
  const [editorRestoreSelectionSignal, setEditorRestoreSelectionSignal] =
    React.useState(0)
  const [selectionByNoteId, setSelectionByNoteId] = React.useState<
    Record<string, EditorSelection>
  >({})
  const selectionByNoteIdRef = React.useRef<Record<string, EditorSelection>>({})
  const [informationSortOrder, setInformationSortOrder] =
    React.useState<InformationSortOrder>("name-asc")
  const [collapsedFolderIds, setCollapsedFolderIds] = React.useState(
    () => new Set<string>()
  )

  React.useEffect(() => {
    if (hasLoadedNotes.current) {
      return
    }

    let isMounted = true

    async function loadNotes() {
      setIsNotebookLoading(true)
      const cachedTrash = loadTrashedInformationNotes(scope)
      const cachedTrashIds = new Set(cachedTrash.map((node) => node.id))
      const cachedNodes = loadInformationNotes(scope).filter(
        (node) => !cachedTrashIds.has(node.id)
      )

      if (cachedNodes.length && isMounted) {
        nodesRef.current = cachedNodes
        setNodes(cachedNodes)
        setTrashedNodes(cachedTrash)
        setIsNotebookLoading(false)
      }

      // Layout countries and correction learning are lightweight and should not
      // wait for the database-backed notebook query before appearing in the tree.
      if (isKnowledgeBase) {
        const liveNodes = await mergeLiveKnowledgeBaseNotes(cachedNodes)
        if (isMounted) {
          nodesRef.current = liveNodes
          setNodes(liveNodes)
          const requestedLiveNodeId = searchParams.get("node") ?? undefined
          const requestedLiveNode = requestedLiveNodeId
            ? liveNodes.find((node) => node.id === requestedLiveNodeId)
            : undefined
          if (requestedLiveNode) {
            setActiveNodeId(requestedLiveNode.id)
            setActiveDrafts(
              requestedLiveNode.title,
              requestedLiveNode.content ?? ""
            )
          }
        }
      }

      const loadedNodes = await getInformationNotes(scope)
      const loadedTrash = loadTrashedInformationNotes(scope)
      const trashedIds = new Set(loadedTrash.map((node) => node.id))
      const loaded = loadedNodes.filter((node) => !trashedIds.has(node.id))
      const requestedNode = searchParams.get("node") ?? undefined
      const requestedView = searchParams.get("view") ?? undefined
      const requestedMobileView =
        requestedView === "folders" ||
        requestedView === "notes" ||
        requestedView === "trash"
          ? requestedView
          : undefined
      const desktopState =
        !requestedNode && !requestedView && isDesktopViewport()
          ? loadDesktopNotebookState(desktopStateKey)
          : null
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
      const rememberedLocation =
        !requestedNode && !requestedView && isMobile
          ? loadMobileNotebookLocation(mobileLocationKey)
          : null
      const rememberedNodeId =
        rememberedLocation?.type === "node"
          ? rememberedLocation.nodeId
          : !rememberedLocation && !requestedNode && !requestedView && isMobile
            ? readBrowserStorage("localStorage", lastMobileItemKey)
            : undefined
      const rememberedNode = rememberedNodeId
        ? loaded.find((node) => node.id === rememberedNodeId)
        : undefined
      const initialView =
        requestedMobileView ??
        (!requestedNode && isMobile
          ? rememberedLocation?.type === "view"
            ? rememberedLocation.view
            : rememberedNode
              ? undefined
              : "folders"
          : undefined)
      const localRequested = requestedNode
        ? nodesRef.current.find((node) => node.id === requestedNode)
        : undefined
      const requested = requestedNode
        ? (loaded.find((node) => node.id === requestedNode) ?? localRequested)
        : undefined
      const nextNodes = localRequested
        ? [
            ...loaded.filter((node) => node.id !== localRequested.id),
            localRequested,
          ]
        : loaded
      const desktopRestoredNode = desktopState?.activeId
        ? loaded.find((node) => node.id === desktopState.activeId)
        : undefined
      const initialNode = initialView
        ? undefined
        : (requested ??
          rememberedNode ??
          desktopRestoredNode ??
          firstNote(loaded) ??
          loaded[0])
      const requestedRevealFolderIds =
        requestedNode && initialNode && isDesktopViewport()
          ? folderIdsToRevealNode(nextNodes, initialNode.id)
          : []

      if (isMounted) {
        setNodes(nextNodes)
        setTrashedNodes(loadedTrash)
        if (!hasInitializedCollapsedFolders.current) {
          const nextCollapsedFolderIds = desktopState
            ? new Set(desktopState.collapsedFolderIds)
            : new Set(
                nextNodes
                  .filter((node) => node.type === "folder")
                  .map((node) => node.id)
              )

          for (const folderId of requestedRevealFolderIds) {
            nextCollapsedFolderIds.delete(folderId)
          }

          setCollapsedFolderIds(nextCollapsedFolderIds)
          hasInitializedCollapsedFolders.current = true
        } else if (requestedRevealFolderIds.length) {
          setCollapsedFolderIds((current) => {
            const next = new Set(current)

            for (const folderId of requestedRevealFolderIds) {
              next.delete(folderId)
            }

            return next
          })
        }
        if (desktopState) {
          selectionByNoteIdRef.current = desktopState.selectionByNoteId
          setSelectionByNoteId(desktopState.selectionByNoteId)
        }
        setActiveNodeId(
          initialView === "trash"
            ? trashViewId
            : initialView === "notes"
              ? mobileRootNotesId
              : initialView === "folders"
                ? undefined
                : initialNode?.id
        )
        setActiveDrafts(
          initialView === "trash"
            ? "Trash"
            : initialView === "notes"
              ? "Notes"
              : initialView === "folders"
                ? ""
                : (initialNode?.title ?? ""),
          initialView ? "" : (initialNode?.content ?? "")
        )
        if (initialNode?.type === "note" && isDesktopViewport()) {
          setEditorRestoreSelectionSignal((signal) => signal + 1)
        }
        if (requestedNode && initialNode && isDesktopViewport()) {
          setPendingDesktopNodeFocusId(initialNode.id)
        }
        hasLoadedNotes.current = true
        setIsNotebookLoading(false)
      }
    }

    loadNotes()

    return () => {
      isMounted = false
    }
  }, [
    desktopStateKey,
    isKnowledgeBase,
    lastMobileItemKey,
    mobileLocationKey,
    scope,
    searchParams,
  ])

  React.useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  React.useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  React.useEffect(() => {
    return () => {
      if (activeNoteSaveTimeoutRef.current) {
        window.clearTimeout(activeNoteSaveTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!isKnowledgeBase) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      const current = nodesRef.current.find(
        (node) => node.id === activeIdRef.current && node.type === "note"
      )
      if (
        !current ||
        (titleDraftRef.current.trim() === current.title &&
          contentDraftRef.current === (current.content ?? ""))
      )
        return
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [isKnowledgeBase])

  const activeNode = nodes.find((node) => node.id === activeId)

  React.useEffect(() => {
    if (!hasLoadedNotes.current || isNotebookLoading) {
      return
    }

    const requestedNodeId = searchParams.get("node")
    const requestedView = searchParams.get("view")
    const requestedNode = requestedNodeId
      ? nodesRef.current.find((node) => node.id === requestedNodeId)
      : undefined
    const requestedActiveId = requestedNode
      ? requestedNode.id
      : requestedView === "notes"
        ? mobileRootNotesId
        : requestedView === "trash"
          ? trashViewId
          : requestedView === "folders"
            ? undefined
            : activeIdRef.current

    if (requestedActiveId === activeIdRef.current) {
      return
    }

    saveActiveNoteRef.current()
    setActiveNodeId(requestedActiveId)
    setActiveDrafts(
      requestedNode?.title ??
        (requestedActiveId === mobileRootNotesId
          ? "Notes"
          : requestedActiveId === trashViewId
            ? "Trash"
            : ""),
      requestedNode?.type === "note" ? (requestedNode.content ?? "") : ""
    )
  }, [isNotebookLoading, searchParams])

  React.useEffect(() => {
    const shell = notebookShellRef.current

    if (!shell || activeNode?.type !== "note") {
      return
    }

    const activeShell = shell
    const mobileQuery = window.matchMedia("(max-width: 767px)")
    const visualViewport = window.visualViewport

    function syncMobileEditorViewport() {
      if (!mobileQuery.matches) {
        activeShell.style.removeProperty("--mobile-note-viewport-height")
        activeShell.style.removeProperty("--mobile-note-viewport-top")
        return
      }

      activeShell.style.setProperty(
        "--mobile-note-viewport-height",
        `${visualViewport?.height ?? window.innerHeight}px`
      )
      activeShell.style.setProperty(
        "--mobile-note-viewport-top",
        `${visualViewport?.offsetTop ?? 0}px`
      )

      activeShell
        .querySelector<HTMLElement>('[data-slot="sidebar-inset"]')
        ?.scrollTo({ top: 0, left: 0 })
    }

    syncMobileEditorViewport()
    window.addEventListener("resize", syncMobileEditorViewport)
    visualViewport?.addEventListener("resize", syncMobileEditorViewport)
    visualViewport?.addEventListener("scroll", syncMobileEditorViewport)
    mobileQuery.addEventListener("change", syncMobileEditorViewport)

    return () => {
      window.removeEventListener("resize", syncMobileEditorViewport)
      visualViewport?.removeEventListener("resize", syncMobileEditorViewport)
      visualViewport?.removeEventListener("scroll", syncMobileEditorViewport)
      mobileQuery.removeEventListener("change", syncMobileEditorViewport)
      activeShell.style.removeProperty("--mobile-note-viewport-height")
      activeShell.style.removeProperty("--mobile-note-viewport-top")
    }
  }, [activeNode?.type])

  React.useEffect(() => {
    if (!hasLoadedNotes.current) {
      return
    }

    saveDesktopNotebookState(
      {
        activeId,
        collapsedFolderIds: [...collapsedFolderIds],
        selectionByNoteId: selectionByNoteIdRef.current,
      },
      desktopStateKey
    )
  }, [activeId, collapsedFolderIds, desktopStateKey])

  React.useEffect(() => {
    if (!hasLoadedNotes.current || !isMobileViewport()) {
      return
    }

    if (activeId === undefined) {
      saveMobileNotebookLocation(
        { type: "view", view: "folders" },
        mobileLocationKey
      )
    } else if (activeId === mobileRootNotesId) {
      saveMobileNotebookLocation(
        { type: "view", view: "notes" },
        mobileLocationKey
      )
    } else if (activeId === trashViewId) {
      saveMobileNotebookLocation(
        { type: "view", view: "trash" },
        mobileLocationKey
      )
    } else if (activeNode) {
      saveMobileNotebookLocation(
        { type: "node", nodeId: activeNode.id },
        mobileLocationKey
      )
    }
  }, [activeId, activeNode, mobileLocationKey])
  const visibleNodes = React.useMemo(() => {
    const query = noteSearch.trim().toLowerCase()

    if (!query) {
      return nodes
    }

    const visibleIds = new Set<string>()
    const nodeById = new Map(nodes.map((node) => [node.id, node]))

    for (const node of nodes) {
      const searchable = `${node.title} ${node.content ?? ""}`.toLowerCase()

      if (!searchable.includes(query)) {
        continue
      }

      let currentNode: InformationNode | undefined = node

      while (currentNode) {
        visibleIds.add(currentNode.id)
        currentNode = currentNode.parentId
          ? nodeById.get(currentNode.parentId)
          : undefined
      }
    }

    return nodes.filter((node) => visibleIds.has(node.id))
  }, [nodes, noteSearch])
  const desktopVisibleTreeNodeIds = React.useMemo(
    () =>
      visibleTreeNodeIds(
        visibleNodes,
        collapsedFolderIds,
        informationSortOrder
      ),
    [collapsedFolderIds, informationSortOrder, visibleNodes]
  )

  React.useEffect(() => {
    const requestedNode = searchParams.get("node")
    const requestedView = searchParams.get("view")

    if (requestedNode || requestedView) {
      return
    }

    if (!window.matchMedia("(min-width: 1024px)").matches) {
      return
    }

    if (activeNode?.type === "note") {
      setEditorRestoreSelectionSignal((signal) => signal + 1)
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      desktopSearchInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [activeNode?.type, searchParams])

  React.useEffect(() => {
    if (!pendingDesktopNodeFocusId) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      desktopNodeRefs.current[pendingDesktopNodeFocusId]?.focus()
      setPendingDesktopNodeFocusId(undefined)
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [desktopVisibleTreeNodeIds, pendingDesktopNodeFocusId])

  React.useEffect(() => {
    function restoreEditorFocusFromCommandMenu() {
      if (activeNode?.type !== "note" || !isDesktopViewport()) {
        return
      }

      window.setTimeout(() => {
        setEditorRestoreSelectionSignal((signal) => signal + 1)
      }, 0)
    }

    window.addEventListener(
      "information-notes:restore-editor-focus",
      restoreEditorFocusFromCommandMenu
    )

    return () =>
      window.removeEventListener(
        "information-notes:restore-editor-focus",
        restoreEditorFocusFromCommandMenu
      )
  }, [activeNode?.type])

  function revealActiveNote() {
    if (!activeNode) {
      return
    }

    setCollapsedFolderIds((current) => {
      const next = new Set(current)

      for (const folderId of ancestorFolderIds(nodes, activeNode.id)) {
        next.delete(folderId)
      }

      return next
    })

    window.setTimeout(() => {
      desktopNodeRefs.current[activeNode.id]?.scrollIntoView({
        block: "nearest",
      })
    }, 0)
  }

  function emptyNoteContent() {
    return JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: null } }],
    })
  }

  function persist(nextNodes: InformationNode[]) {
    nodesRef.current = nextNodes
    setNodes(nextNodes)
    saveInformationNotes(nextNodes, scope)
  }

  function applyKnowledgeBaseUpdates(
    nextNodes: InformationNode[],
    firstUpdatedId?: string
  ) {
    persist(nextNodes)
    if (!firstUpdatedId) return
    const updated = nextNodes.find((node) => node.id === firstUpdatedId)
    if (!updated) return
    setActiveNodeId(updated.id)
    setActiveDrafts(updated.title, updated.content ?? "")
    updateInformationRoute(
      `${basePath}?node=${encodeURIComponent(updated.id)}`,
      "replace"
    )
  }

  function persistTrash(nextTrashedNodes: TrashedInformationNode[]) {
    setTrashedNodes(nextTrashedNodes)
    saveTrashedInformationNotes(nextTrashedNodes, scope)
  }

  function updateInformationRoute(
    href: string,
    mode: "push" | "replace" = "push"
  ) {
    if (mode === "replace") {
      router.replace(href)
      return
    }

    router.push(href)
  }

  function setActiveDrafts(title: string, content: string) {
    titleDraftRef.current = title
    contentDraftRef.current = content
    setTitleDraft(title)
    setContentDraft(content)
  }

  function setActiveNodeId(nodeId: string | undefined) {
    activeIdRef.current = nodeId
    setActiveId(nodeId)
  }

  function selectNode(nodeId: string, mode: "push" | "replace" = "push") {
    if (
      isKnowledgeBase &&
      nodeId !== activeIdRef.current &&
      hasUnreviewedKnowledgeEdit() &&
      !window.confirm("Discard this unreviewed knowledge draft?")
    ) {
      return
    }
    saveActiveNote()

    if (!nodeId) {
      saveMobileNotebookLocation(
        { type: "view", view: "folders" },
        mobileLocationKey
      )
      setActiveNodeId(undefined)
      setActiveDrafts("", "")
      mobileNoteSelectorRef.current?.removeAttribute("open")
      updateInformationRoute(
        isMobileViewport() ? `${basePath}?view=folders` : basePath,
        mode
      )
      window.dispatchEvent(new Event(`${scope}:navigation`))
      return
    }

    const node = nodes.find((item) => item.id === nodeId)

    if (node) {
      saveMobileNotebookLocation(
        { type: "node", nodeId: node.id },
        mobileLocationKey
      )
    }
    setActiveNodeId(node?.id ?? nodeId)
    setActiveDrafts(
      node?.title ?? "",
      node?.type === "note" ? (node.content ?? "") : ""
    )
    mobileNoteSelectorRef.current?.removeAttribute("open")
    updateInformationRoute(
      `${basePath}?node=${encodeURIComponent(nodeId)}`,
      mode
    )
    window.dispatchEvent(new Event(`${scope}:navigation`))
    if (node?.type === "note" && !isMobileViewport()) {
      setEditorFocusSignal((signal) => signal + 1)
    }
  }

  function selectRootNotes(mode: "push" | "replace" = "push") {
    if (
      isKnowledgeBase &&
      hasUnreviewedKnowledgeEdit() &&
      !window.confirm("Discard this unreviewed knowledge draft?")
    )
      return
    saveActiveNote()
    saveMobileNotebookLocation(
      { type: "view", view: "notes" },
      mobileLocationKey
    )
    setActiveNodeId(mobileRootNotesId)
    setActiveDrafts("Notes", "")
    mobileNoteSelectorRef.current?.removeAttribute("open")
    updateInformationRoute(`${basePath}?view=notes`, mode)
    window.dispatchEvent(new Event(`${scope}:navigation`))
  }

  function selectTrash(mode: "push" | "replace" = "push") {
    if (
      isKnowledgeBase &&
      hasUnreviewedKnowledgeEdit() &&
      !window.confirm("Discard this unreviewed knowledge draft?")
    )
      return
    saveActiveNote()
    saveMobileNotebookLocation(
      { type: "view", view: "trash" },
      mobileLocationKey
    )
    setActiveNodeId(trashViewId)
    setActiveDrafts("Trash", "")
    mobileNoteSelectorRef.current?.removeAttribute("open")
    updateInformationRoute(`${basePath}?view=trash`, mode)
    window.dispatchEvent(new Event(`${scope}:navigation`))
  }

  function startCreate(
    type: InformationNodeType,
    parentId = "",
    titleOverride?: string
  ) {
    if (activeNoteSaveTimeoutRef.current) {
      window.clearTimeout(activeNoteSaveTimeoutRef.current)
      activeNoteSaveTimeoutRef.current = undefined
    }

    const title =
      titleOverride?.trim() ||
      (type === "folder"
        ? "Untitled Folder"
        : isKnowledgeBase
          ? "Untitled Page"
          : "Untitled Note")
    const timestamp = new Date().toISOString()
    const node: InformationNode = {
      id: createInformationId(title),
      parentId: parentId || undefined,
      type,
      title,
      content: type === "note" ? emptyNoteContent() : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const nextNodes =
      activeNode?.type === "note"
        ? nodes.map((item) =>
            item.id === activeNode.id
              ? {
                  ...item,
                  title: titleDraftRef.current.trim() || activeNode.title,
                  content: contentDraftRef.current,
                  updatedAt: timestamp,
                }
              : item
          )
        : nodes

    persist([...nextNodes, node])
    if (type === "folder") {
      setCollapsedFolderIds((current) => {
        const next = new Set(current)
        next.add(node.id)
        return next
      })
    }
    if (parentId) {
      setCollapsedFolderIds((current) => {
        const next = new Set(current)
        next.delete(parentId)
        return next
      })
    }
    setNoteSearch("")
    saveMobileNotebookLocation(
      { type: "node", nodeId: node.id },
      mobileLocationKey
    )
    setActiveNodeId(node.id)
    setActiveDrafts(node.title, node.content ?? "")
    setEditingTreeNodeId(type === "folder" ? node.id : undefined)
    setTreeTitleDraft(node.title)
    if (type === "note" && !isMobileViewport()) {
      setEditorFocusSignal((signal) => signal + 1)
    }
    updateInformationRoute(`${basePath}?node=${encodeURIComponent(node.id)}`)
    window.dispatchEvent(new Event(`${scope}:navigation`))
  }

  function activeCreateParentId() {
    if (activeNode?.type === "folder") {
      return activeNode.id
    }

    if (activeNode?.type === "note") {
      return activeNode.parentId ?? ""
    }

    return ""
  }

  function startCreateAtActiveFocus(type: InformationNodeType) {
    startCreate(type, activeCreateParentId())
  }

  function requestCreateFolder(parentId = "") {
    if (!isMobileViewport()) {
      startCreate("folder", parentId)
      return
    }

    setFolderPromptMode("create")
    setFolderPromptNodeId(null)
    setFolderPromptParentId(parentId)
    setFolderPromptTitle("")
  }

  function requestRenameFolder(nodeId: string) {
    const node = nodesRef.current.find(
      (item) => item.id === nodeId && item.type === "folder"
    )

    if (!node) {
      return
    }

    if (!isMobileViewport()) {
      startTreeTitleEdit(nodeId)
      return
    }

    setFolderPromptMode("rename")
    setFolderPromptNodeId(nodeId)
    setFolderPromptParentId(node.parentId ?? "")
    setFolderPromptTitle(node.title)
  }

  function confirmCreateFolder() {
    if (!folderPromptTitle.trim()) {
      return
    }

    if (folderPromptMode === "rename" && folderPromptNodeId) {
      saveNodeTitle(folderPromptNodeId, folderPromptTitle)
    } else {
      startCreate("folder", folderPromptParentId ?? "", folderPromptTitle)
    }

    cancelCreateFolder()
  }

  function cancelCreateFolder() {
    setFolderPromptParentId(null)
    setFolderPromptNodeId(null)
    setFolderPromptMode("create")
    setFolderPromptTitle("")
  }

  function saveNodeTitle(nodeId: string, value: string) {
    const node = nodes.find((item) => item.id === nodeId)

    if (!node) {
      return
    }

    const cleanTitle = value.trim() || node.title
    const timestamp = new Date().toISOString()

    const nextNodes = nodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            title: cleanTitle,
            updatedAt: timestamp,
          }
        : item
    )

    persist(nextNodes)

    if (activeId === nodeId) {
      titleDraftRef.current = cleanTitle
      setTitleDraft(cleanTitle)
    }
  }

  function saveActiveNote() {
    const currentActiveId = activeIdRef.current
    const currentActiveNode = nodesRef.current.find(
      (node) => node.id === currentActiveId
    )

    if (!currentActiveNode || currentActiveNode.type !== "note") {
      return
    }

    if (activeNoteSaveTimeoutRef.current) {
      window.clearTimeout(activeNoteSaveTimeoutRef.current)
      activeNoteSaveTimeoutRef.current = undefined
    }

    if (isKnowledgeBase) return

    const cleanTitle = titleDraftRef.current.trim() || currentActiveNode.title
    const timestamp = new Date().toISOString()
    const nextNodes = nodesRef.current.map((node) =>
      node.id === currentActiveNode.id
        ? {
            ...node,
            title: cleanTitle,
            content: contentDraftRef.current,
            updatedAt: timestamp,
          }
        : node
    )

    persist(nextNodes)
    titleDraftRef.current = cleanTitle
    setTitleDraft(cleanTitle)
  }

  saveActiveNoteRef.current = saveActiveNote

  function scheduleActiveNoteSave() {
    if (isKnowledgeBase) return
    if (activeNoteSaveTimeoutRef.current) {
      window.clearTimeout(activeNoteSaveTimeoutRef.current)
    }

    activeNoteSaveTimeoutRef.current = window.setTimeout(() => {
      activeNoteSaveTimeoutRef.current = undefined
      saveActiveNote()
    }, 700)
  }

  function updateActiveNoteContent(value: string) {
    const nextNote = splitEditorTitleAndContent(value, titleDraftRef.current)

    titleDraftRef.current = nextNote.title
    contentDraftRef.current = nextNote.content
    setContentDraft(nextNote.content)

    if (nextNote.title !== titleDraft) {
      setTitleDraft(nextNote.title)
    }

    scheduleActiveNoteSave()
  }

  function hasUnreviewedKnowledgeEdit() {
    if (!isKnowledgeBase) return false
    const current = nodesRef.current.find(
      (node) => node.id === activeIdRef.current && node.type === "note"
    )
    return Boolean(
      current &&
      (titleDraftRef.current.trim() !== current.title ||
        contentDraftRef.current !== (current.content ?? ""))
    )
  }

  function closeMobileNote() {
    if (activeNode?.parentId) {
      selectNode(activeNode.parentId, "replace")
      return
    }

    selectNode("", "replace")
  }

  function closeMobileFolder(folder?: InformationNode) {
    if (folder?.parentId) {
      selectNode(folder.parentId, "replace")
      return
    }

    selectNode("", "replace")
  }

  function commitTreeTitle(nodeId: string) {
    saveNodeTitle(nodeId, treeTitleDraft)
    setEditingTreeNodeId(undefined)
    setTreeTitleDraft("")
  }

  function startTreeTitleEdit(nodeId: string) {
    const node = nodesRef.current.find(
      (item) => item.id === nodeId && item.type === "folder"
    )

    if (!node) {
      return
    }

    setEditingTreeNodeId(nodeId)
    setTreeTitleDraft(node.title)
  }

  function cancelTreeTitleEdit() {
    setEditingTreeNodeId(undefined)
    setTreeTitleDraft("")
  }

  function togglePin(nodeId: string) {
    persist(
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              pinned: !node.pinned,
              updatedAt: new Date().toISOString(),
            }
          : node
      )
    )
  }

  function toggleFolderCollapse(nodeId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current)

      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }

      return next
    })
  }

  function focusDesktopTreeNode(nodeId: string) {
    setPendingDesktopNodeFocusId(nodeId)
  }

  function focusDesktopEditor() {
    setEditorFocusSignal((signal) => signal + 1)
  }

  function collapseAllFolders() {
    setCollapsedFolderIds(
      new Set(
        nodes.filter((node) => node.type === "folder").map((node) => node.id)
      )
    )
  }

  function handleDesktopSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Tab" || event.shiftKey) {
      return
    }

    const firstNodeId = desktopVisibleTreeNodeIds[0]

    if (!firstNodeId) {
      return
    }

    event.preventDefault()
    focusDesktopTreeNode(firstNodeId)
  }

  function deleteNode(nodeId: string) {
    saveActiveNote()

    const deleteIds = descendantsOf(nodes, nodeId)
    const timestamp = new Date().toISOString()
    const nextTrashedNodes = [
      ...nodes
        .filter((node) => deleteIds.has(node.id))
        .map((node) => ({
          ...node,
          originalParentId: node.parentId,
          deletedAt: timestamp,
        })),
      ...trashedNodes.filter((node) => !deleteIds.has(node.id)),
    ]
    const nextNodes = nodes.filter((node) => !deleteIds.has(node.id))
    const nextActive =
      activeId && deleteIds.has(activeId)
        ? (firstNote(nextNodes) ?? nextNodes[0])
        : activeNode

    persistTrash(nextTrashedNodes)
    persist(nextNodes)
    if (nextActive) {
      saveMobileNotebookLocation(
        { type: "node", nodeId: nextActive.id },
        mobileLocationKey
      )
    } else {
      saveMobileNotebookLocation(
        { type: "view", view: "notes" },
        mobileLocationKey
      )
    }
    setActiveNodeId(nextActive?.id)
    setActiveDrafts(nextActive?.title ?? "", nextActive?.content ?? "")
    updateInformationRoute(
      nextActive
        ? `${basePath}?node=${encodeURIComponent(nextActive.id)}`
        : `${basePath}?view=notes`,
      "replace"
    )
  }

  function restoreNode(nodeId: string) {
    const restoreIds = descendantsOf(trashedNodes, nodeId)
    const restoredNodes = trashedNodes.filter((node) => restoreIds.has(node.id))
    const remainingTrash = trashedNodes.filter(
      (node) => !restoreIds.has(node.id)
    )
    const activeNodeIds = new Set(nodes.map((node) => node.id))
    const restoredNodeIds = new Set(restoredNodes.map((node) => node.id))
    const nextRestoredNodes = restoredNodes
      .filter((node) => !activeNodeIds.has(node.id))
      .map(({ deletedAt, originalParentId, ...node }) => ({
        ...node,
        parentId:
          originalParentId &&
          (activeNodeIds.has(originalParentId) ||
            restoredNodeIds.has(originalParentId))
            ? originalParentId
            : undefined,
      }))

    if (!nextRestoredNodes.length) {
      persistTrash(remainingTrash)
      return
    }

    const restoredRoot =
      nextRestoredNodes.find((node) => node.id === nodeId) ??
      nextRestoredNodes[0]

    persist([...nodes, ...nextRestoredNodes])
    persistTrash(remainingTrash)
    setCollapsedFolderIds((current) => {
      const next = new Set(current)

      for (const folderId of ancestorFolderIds(
        [...nodes, ...nextRestoredNodes],
        restoredRoot.id
      )) {
        next.delete(folderId)
      }

      return next
    })
    setActiveNodeId(restoredRoot.id)
    setActiveDrafts(restoredRoot.title, restoredRoot.content ?? "")
    updateInformationRoute(
      `${basePath}?node=${encodeURIComponent(restoredRoot.id)}`
    )
  }

  function moveNode(nodeId: string, parentId?: string) {
    if (nodeId === parentId) {
      return
    }

    const blockedIds = descendantsOf(nodes, nodeId)

    if (parentId && blockedIds.has(parentId)) {
      return
    }

    const timestamp = new Date().toISOString()

    persist(
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              parentId,
              updatedAt: timestamp,
            }
          : node
      )
    )
  }

  React.useEffect(() => {
    async function refresh() {
      const activeElement = document.activeElement as HTMLElement | null

      if (
        activeElement?.closest(".simple-editor-content .ProseMirror") ||
        activeElement?.matches('[aria-label="Folder title"]') ||
        activeNoteSaveTimeoutRef.current
      ) {
        return
      }

      const loaded = await getInformationNotes(scope)
      // A stale response must not put locally deleted folders back in the tree.
      const trashedIds = new Set(
        loadTrashedInformationNotes(scope).map((node) => node.id)
      )
      setNodes(loaded.filter((node) => !trashedIds.has(node.id)))
    }

    window.addEventListener(updatedEvent, refresh)
    return () => window.removeEventListener(updatedEvent, refresh)
  }, [scope, updatedEvent])

  React.useEffect(() => {
    if (activeNode?.type !== "note") {
      return
    }

    function dismissKeyboardOnOutsideTap(event: PointerEvent) {
      if (!window.matchMedia("(max-width: 767px)").matches) {
        return
      }

      const activeElement = document.activeElement as HTMLElement | null

      if (
        !activeElement ||
        (!activeElement.isContentEditable &&
          activeElement.tagName !== "INPUT" &&
          activeElement.tagName !== "TEXTAREA")
      ) {
        return
      }

      const target = event.target as HTMLElement | null

      if (
        target?.closest(
          [
            ".simple-editor-content .ProseMirror",
            ".simple-editor-search-and-replace",
            "[data-radix-popper-content-wrapper]",
            "[role='menu']",
            "input",
            "textarea",
          ].join(",")
        )
      ) {
        return
      }

      activeElement.blur()
    }

    document.addEventListener("pointerdown", dismissKeyboardOnOutsideTap, true)

    return () => {
      document.removeEventListener(
        "pointerdown",
        dismissKeyboardOnOutsideTap,
        true
      )
    }
  }, [activeNode?.type])

  const activeFolderNotes =
    activeNode?.type === "folder"
      ? childNodes(nodes, activeNode.id).filter((node) => node.type === "note")
      : childNodes(nodes).filter((node) => node.type === "note")
  const currentSortOption =
    informationSortOptions.find(
      (option) => option.value === informationSortOrder
    ) ?? informationSortOptions[0]
  const activeNodePath: InformationNode[] = []

  if (activeNode) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    let pathNode: InformationNode | undefined = activeNode

    while (pathNode) {
      activeNodePath.unshift(pathNode)
      pathNode = pathNode.parentId ? nodeById.get(pathNode.parentId) : undefined
    }
  }

  const isKnowledgeDraftDirty = Boolean(
    isKnowledgeBase &&
    activeNode?.type === "note" &&
    (titleDraft.trim() !== activeNode.title ||
      contentDraft !== (activeNode.content ?? ""))
  )
  const knowledgeDefiners: KnowledgePageDefiners | undefined =
    isKnowledgeBase && activeNode?.type === "note"
      ? {
          country:
            activeNodePath.find((node) => node.type === "folder")?.title ??
            "Shared",
          pageType: knowledgePageType(titleDraft || activeNode.title),
          status: "AI managed",
        }
      : undefined
  const knowledgeDraftPage =
    isKnowledgeDraftDirty && knowledgeDefiners
      ? {
          path: `${knowledgeDefiners.country} / ${titleDraft}`,
          title: titleDraft,
          body: notePreview(contentDraft),
        }
      : undefined

  const notebookBreadcrumbItems: NotebookBreadcrumbItem[] = [
    {
      id: scope,
      label: rootLabel,
      onSelect:
        activeNode || activeId ? () => selectNode("", "replace") : undefined,
    },
    ...(activeNode
      ? activeNodePath.map((node, index) => ({
          id: node.id,
          label:
            node.id === activeNode.id && node.type === "note"
              ? titleDraft || node.title
              : node.title,
          onSelect:
            index < activeNodePath.length - 1
              ? () => selectNode(node.id, "replace")
              : undefined,
        }))
      : activeId === mobileRootNotesId
        ? [{ id: mobileRootNotesId, label: "Notes" }]
        : activeId === trashViewId
          ? [{ id: trashViewId, label: "Trash" }]
          : []),
  ]
  const mobileHeaderBackAction = activeNode
    ? () => {
        if (activeNode.type === "note") {
          saveActiveNote()
          closeMobileNote()
          return
        }

        closeMobileFolder(activeNode)
      }
    : activeId === mobileRootNotesId || activeId === trashViewId
      ? () => selectNode("", "replace")
      : undefined

  return (
    <NotebookLayout
      ref={notebookShellRef}
      activeDocument={activeNode?.type === "note"}
      header={{
        titleContent: <NotebookBreadcrumbs items={notebookBreadcrumbItems} />,
        actions: isKnowledgeBase ? (
          <KnowledgeBaseAiManager
            nodes={nodes}
            draftPage={knowledgeDraftPage}
            onApply={applyKnowledgeBaseUpdates}
          />
        ) : undefined,
        mobileLeadingContent: mobileHeaderBackAction ? (
          <SiteHeaderBackButton
            label="Back to notes"
            onClick={mobileHeaderBackAction}
          />
        ) : undefined,
        mobileTrailingContent: (
          <MobileNotebookActions
            activeNode={activeNode}
            nodes={nodes}
            onCreateNote={() =>
              startCreate(
                "note",
                activeNode?.type === "folder" ? activeNode.id : ""
              )
            }
            onCreateFolder={() =>
              requestCreateFolder(
                activeNode?.type === "folder" ? activeNode.id : ""
              )
            }
            onOpenTrash={() => selectTrash()}
            trashCount={trashedNodes.length}
            onRename={requestRenameFolder}
            onDelete={deleteNode}
            onMove={moveNode}
          />
        ),
      }}
      headerOverlay={
        folderPromptParentId !== null ? (
          <MobileFolderTitlePrompt
            mode={folderPromptMode}
            value={folderPromptTitle}
            onChange={setFolderPromptTitle}
            onConfirm={confirmCreateFolder}
            onCancel={cancelCreateFolder}
          />
        ) : null
      }
      loading={isNotebookLoading ? <NotebookSkeleton /> : undefined}
      navigation={
        <>
          <div className="mb-3 flex items-center justify-center gap-1 text-muted-foreground">
            <NotebookActionTooltip label={`Create new ${itemLabel}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                aria-label={`Create new ${itemLabel}`}
                onClick={() => startCreateAtActiveFocus("note")}
              >
                <FilePlus2Icon />
              </Button>
            </NotebookActionTooltip>
            <NotebookActionTooltip label="Create new folder">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                aria-label="Create new folder"
                onClick={() => startCreateAtActiveFocus("folder")}
              >
                <FolderPlusIcon />
              </Button>
            </NotebookActionTooltip>
            <DropdownMenu>
              <NotebookActionTooltip label={`Sort: ${currentSortOption.label}`}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                      aria-label={`Sort: ${currentSortOption.label}`}
                    />
                  }
                >
                  <ListSortAscendingIcon />
                </DropdownMenuTrigger>
              </NotebookActionTooltip>
              <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuRadioGroup
                  value={informationSortOrder}
                  onValueChange={(value) =>
                    setInformationSortOrder(value as InformationSortOrder)
                  }
                >
                  {informationSortOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.value === "name-asc" ? (
                        <ArrowDownAZIcon />
                      ) : option.value === "name-desc" ? (
                        <ArrowDownZAIcon />
                      ) : (
                        <ClockIcon />
                      )}
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotebookActionTooltip label={`Reveal active ${itemLabel}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                aria-label={`Reveal active ${itemLabel}`}
                onClick={revealActiveNote}
              >
                <PanelTopCloseIcon />
              </Button>
            </NotebookActionTooltip>
            <NotebookActionTooltip label="Collapse all">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                aria-label="Collapse all"
                onClick={collapseAllFolders}
              >
                <ListCollapseIcon />
              </Button>
            </NotebookActionTooltip>
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-auto pb-4">
            <Input
              ref={desktopSearchInputRef}
              value={noteSearch}
              onChange={(event) => setNoteSearch(event.target.value)}
              onKeyDown={handleDesktopSearchKeyDown}
              placeholder={
                isKnowledgeBase ? "Search knowledge base" : "Search notebook"
              }
              className="focus-visible:ring-inset"
            />

            <NoteTree
              nodes={visibleNodes}
              allNodes={nodes}
              activeId={activeId}
              onSelect={selectNode}
              onCreate={startCreate}
              onDelete={deleteNode}
              onTogglePin={togglePin}
              onMove={moveNode}
              collapsedFolderIds={collapsedFolderIds}
              sortOrder={informationSortOrder}
              onToggleCollapse={toggleFolderCollapse}
              editingNodeId={editingTreeNodeId}
              titleDraft={treeTitleDraft}
              onTitleDraftChange={setTreeTitleDraft}
              onCommitTitle={commitTreeTitle}
              onCancelTitleEdit={cancelTreeTitleEdit}
              onStartTitleEdit={startTreeTitleEdit}
              focusableNodeIds={desktopVisibleTreeNodeIds}
              nodeRefs={desktopNodeRefs}
              onFocusNode={focusDesktopTreeNode}
              onOpenNoteForTyping={focusDesktopEditor}
            />
          </div>
          <Button
            variant={activeId === trashViewId ? "secondary" : "ghost"}
            className="mt-4 h-9 justify-start gap-2 rounded-md px-2 text-sm font-normal"
            onClick={() => selectTrash()}
          >
            <Trash2Icon className="size-4" />
            <span className="min-w-0 flex-1 text-left">Trash</span>
            {trashedNodes.length ? (
              <span className="text-xs text-muted-foreground">
                {trashedNodes.length}
              </span>
            ) : null}
          </Button>
        </>
      }
    >
      {isKnowledgeBase ? (
        <div className="fixed right-4 bottom-20 z-40 md:hidden">
          <KnowledgeBaseAiManager
            nodes={nodes}
            draftPage={knowledgeDraftPage}
            onApply={applyKnowledgeBaseUpdates}
          />
        </div>
      ) : null}
      <div className="hidden">
        <div className="flex items-center gap-2">
          <details ref={mobileNoteSelectorRef} className="group min-w-0 flex-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border bg-background px-4 text-base font-medium marker:hidden">
              <span className="min-w-0 truncate">
                {activeNode?.title ?? rootLabel}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 max-h-[52svh] overflow-auto rounded-lg border bg-background p-4 shadow-md">
              <Input
                value={noteSearch}
                onChange={(event) => setNoteSearch(event.target.value)}
                placeholder={
                  isKnowledgeBase ? "Search knowledge base" : "Search notebook"
                }
                className="mb-3"
              />
              <NoteTree
                nodes={visibleNodes}
                allNodes={nodes}
                activeId={activeId}
                onSelect={selectNode}
                onCreate={startCreate}
                onDelete={deleteNode}
                onTogglePin={togglePin}
                onMove={moveNode}
                collapsedFolderIds={collapsedFolderIds}
                sortOrder={informationSortOrder}
                onToggleCollapse={toggleFolderCollapse}
                editingNodeId={editingTreeNodeId}
                titleDraft={treeTitleDraft}
                onTitleDraftChange={setTreeTitleDraft}
                onCommitTitle={commitTreeTitle}
                onCancelTitleEdit={cancelTreeTitleEdit}
                onStartTitleEdit={startTreeTitleEdit}
              />
            </div>
          </details>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  className="size-10"
                  aria-label="Create note or folder"
                />
              }
            >
              <PlusIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={() => startCreate("note")}>
                <FilePlus2Icon />
                Add Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startCreate("folder")}>
                <FolderPlusIcon />
                Add Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeId === trashViewId ? (
        <TrashDashboard trashedNodes={trashedNodes} onRestore={restoreNode} />
      ) : activeNode?.type === "note" ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-background pt-2 sm:-m-5 sm:pt-0">
          <SimpleEditor
            key={
              isKnowledgeBase
                ? `${activeNode.id}-${activeNode.updatedAt}`
                : activeNode.id
            }
            focusSignal={editorFocusSignal}
            restoreSelectionSignal={editorRestoreSelectionSignal}
            restoredSelection={
              selectionByNoteIdRef.current[activeNode.id] ??
              selectionByNoteId[activeNode.id]
            }
            value={editorContentWithTitle(
              titleDraft,
              contentDraft,
              knowledgeDefiners
            )}
            onChange={updateActiveNoteContent}
            onSelectionChange={(selection) => {
              if (!isDesktopViewport()) {
                return
              }

              selectionByNoteIdRef.current = {
                ...selectionByNoteIdRef.current,
                [activeNode.id]: selection,
              }
            }}
          />
        </div>
      ) : activeNode?.type === "folder" ? (
        <>
          <MobileFolderNotesScreen
            folder={activeNode}
            nodes={nodes}
            notes={activeFolderNotes}
            onOpenNote={selectNode}
            onDelete={deleteNode}
            onMove={moveNode}
          />
          <div className="hidden px-3 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 md:block">
            <FolderDashboard
              folder={activeNode}
              nodes={nodes}
              onOpenNote={selectNode}
            />
          </div>
        </>
      ) : activeId === mobileRootNotesId ? (
        <>
          <MobileFolderNotesScreen
            nodes={nodes}
            notes={activeFolderNotes}
            onOpenNote={selectNode}
            onDelete={deleteNode}
            onMove={moveNode}
          />
          <div className="hidden px-3 pb-3 sm:px-0 sm:pb-0 md:block">
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
              <HomeIcon className="size-8" />
              <p>Select a note from the tree or create a new one.</p>
            </div>
          </div>
        </>
      ) : nodes.length ? (
        <>
          <MobileFoldersScreen
            nodes={nodes}
            onOpenFolder={selectNode}
            onOpenRootNotes={selectRootNotes}
          />
          <div className="hidden px-3 pb-3 sm:px-0 sm:pb-0 md:block">
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
              <HomeIcon className="size-8" />
              <p>Select a note from the tree or create a new one.</p>
            </div>
          </div>
        </>
      ) : (
        <div className="px-3 pb-3 sm:px-0 sm:pb-0">
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
            <HomeIcon className="size-8" />
            <p>Select a note from the tree or create a new one.</p>
          </div>
        </div>
      )}
    </NotebookLayout>
  )
}
