"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  HomeIcon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  createInformationId,
  getInformationNotes,
  informationUpdatedEvent,
  saveInformationNotes,
  type InformationNode,
  type InformationNodeType,
} from "@/lib/information-notes"
import { cn } from "@/lib/utils"

const mobileRootNotesId = "__root_notes__"

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
  parentId?: string
) {
  const ids: string[] = []

  for (const node of childNodes(nodes, parentId)) {
    ids.push(node.id)

    if (node.type === "folder" && !collapsedFolderIds.has(node.id)) {
      ids.push(...visibleTreeNodeIds(nodes, collapsedFolderIds, node.id))
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
    return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  }
}

function MobileSearchBar() {
  return (
    <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 flex h-11 items-center gap-3 rounded-full bg-background/95 px-4 shadow-lg ring-1 ring-foreground/5 backdrop-blur md:hidden">
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-muted-foreground">Search</span>
    </div>
  )
}

function MobileFolderTitlePrompt({
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
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
          className="justify-self-start rounded-full bg-background shadow-sm"
          aria-label="Cancel folder"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
        <div className="text-sm font-semibold text-foreground">New Folder</div>
        <Button
          size="icon-sm"
          className="justify-self-end rounded-full bg-yellow-400 text-yellow-950 shadow-sm hover:bg-yellow-300 disabled:opacity-40"
          aria-label="Create folder"
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
  onCreate,
}: {
  nodes: InformationNode[]
  onOpenFolder: (nodeId: string) => void
  onOpenRootNotes: () => void
  onCreate: (type: InformationNodeType, parentId?: string) => void
}) {
  const rootItems = childNodes(nodes)
  const rootFolders = rootItems.filter((node) => node.type === "folder")
  const rootNotes = rootItems.filter((node) => node.type === "note")
  const totalNotes = nodes.filter((node) => node.type === "note").length

  return (
    <div className="relative min-h-full bg-muted/60 px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1rem)] md:hidden">
      <div className="mb-5 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-background shadow-sm"
          aria-label="Add folder"
          onClick={() => onCreate("folder")}
        >
          <FolderPlusIcon />
        </Button>
      </div>
      <h1 className="text-[30pt] font-bold leading-tight tracking-tight text-foreground md:text-3xl">
        Folders
      </h1>
      <div className="mt-5 overflow-hidden rounded-2xl bg-background">
        {rootFolders.map((folder, index) => {
          const count = childNodes(nodes, folder.id).length

          return (
            <button
              key={folder.id}
              type="button"
              className="relative flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
              onClick={() => onOpenFolder(folder.id)}
            >
              <FolderIcon className="size-5 shrink-0 text-yellow-500" />
              <span className="min-w-0 flex-1 font-medium">{folder.title}</span>
              <span className="text-muted-foreground">{count}</span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
              {index < rootFolders.length - 1 ? (
                <span className="absolute left-12 right-0 h-px translate-y-7 bg-border/60" />
              ) : null}
            </button>
          )
        })}
        {rootNotes.length ? (
          <button
            type="button"
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
            onClick={onOpenRootNotes}
          >
            <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 font-medium">Notes</span>
            <span className="text-muted-foreground">{rootNotes.length}</span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
          </button>
        ) : null}
      </div>
      <p className="mt-3 px-1 text-sm text-muted-foreground">
        {totalNotes} Notes
      </p>
      <MobileSearchBar />
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
              <DropdownMenuSubTrigger>
                <FolderIcon />
                {targetFolder.title}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52">
                {targetFolder.id !== movingFolder.parentId ? (
                  <DropdownMenuItem
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
  onBack,
  onOpenNote,
  onCreateNote,
  onCreateFolder,
  onDelete,
  onMove,
}: {
  folder?: InformationNode
  nodes: InformationNode[]
  notes: InformationNode[]
  onBack: () => void
  onOpenNote: (nodeId: string) => void
  onCreateNote: () => void
  onCreateFolder?: () => void
  onDelete: (nodeId: string) => void
  onMove: (nodeId: string, parentId?: string) => void
}) {
  const allFolders = nodes.filter((node) => node.type === "folder")
  const folderBlockedMoveIds = folder ? descendantsOf(nodes, folder.id) : new Set<string>()
  const childFolders = folder
    ? childNodes(nodes, folder.id).filter((node) => node.type === "folder")
    : []

  return (
    <div className="relative min-h-full bg-muted/60 px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1rem)] md:hidden">
      <div className="mb-5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-background shadow-sm"
          aria-label="Back to folders"
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full bg-background shadow-sm"
                aria-label="Folder actions"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onCreateNote}>
              <FilePlus2Icon />
              Add Note
            </DropdownMenuItem>
            {onCreateFolder ? (
              <DropdownMenuItem onClick={onCreateFolder}>
                <FolderPlusIcon />
                Add Folder
              </DropdownMenuItem>
            ) : null}
            {folder ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(folder.id)}
              >
                <Trash2Icon />
                Delete Folder
              </DropdownMenuItem>
            ) : null}
            {folder ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move Folder</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-52">
                  {folder.parentId ? (
                    <DropdownMenuItem onClick={() => onMove(folder.id)}>
                      Notebook
                    </DropdownMenuItem>
                  ) : null}
                  <MobileMoveFolderMenuItems
                    nodes={nodes}
                    movingFolder={folder}
                    blockedIds={folderBlockedMoveIds}
                    onMove={onMove}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h1 className="text-[30pt] font-bold leading-tight tracking-tight text-foreground md:text-3xl">
        {folder?.title ?? "Notes"}
      </h1>
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
                className="relative flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted"
                onClick={() => onOpenNote(childFolder.id)}
              >
                <FolderIcon className="size-5 shrink-0 text-yellow-500" />
                <span className="min-w-0 flex-1 font-medium">
                  {childFolder.title}
                </span>
                <span className="text-muted-foreground">{count}</span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                {index < childFolders.length - 1 ? (
                  <span className="absolute left-12 right-0 h-px translate-y-7 bg-border/60" />
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
            className="flex min-h-16 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-2xl bg-background px-5 py-3"
          >
            <button
              type="button"
              className="min-w-0 flex-1 overflow-hidden text-left transition-colors active:bg-muted"
              onClick={() => onOpenNote(note.id)}
            >
              <span className="block max-w-full truncate font-semibold">
                {note.title}
              </span>
              <span className="mt-1 block max-w-full truncate text-sm text-muted-foreground">
                {formatShortEditedDate(note.updatedAt)} {notePreview(note.content)}
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
                      .filter((targetFolder) => targetFolder.id !== note.parentId)
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
      <MobileSearchBar />
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

function MobileNoteHeader({
  onClose,
  onDelete,
}: {
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top,0px))] shrink-0 items-end justify-between bg-background px-4 pb-2 pt-[env(safe-area-inset-top,0px)] md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full bg-background shadow-sm"
        aria-label="Back to notes"
        onClick={onClose}
      >
        <ArrowLeftIcon />
      </Button>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full bg-background shadow-sm"
                aria-label="Note actions"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
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
  onToggleCollapse,
  editingNodeId,
  titleDraft,
  onTitleDraftChange,
  onCommitTitle,
  onCancelTitleEdit,
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
  onToggleCollapse: (nodeId: string) => void
  editingNodeId?: string
  titleDraft: string
  onTitleDraftChange: (value: string) => void
  onCommitTitle: (nodeId: string) => void
  onCancelTitleEdit: () => void
  focusableNodeIds?: string[]
  nodeRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  onFocusNode?: (nodeId: string) => void
  onOpenNoteForTyping?: () => void
  parentId?: string
  level?: number
}) {
  const children = childNodes(nodes, parentId)
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
    <div className="grid gap-2 lg:gap-1">
      {children.map((node) => {
        const Icon = node.type === "folder" ? FolderIcon : FileTextIcon
        const isFolder = node.type === "folder"
        const isCollapsed = collapsedFolderIds.has(node.id)

        return (
          <div key={node.id}>
            <div
              className={cn(
                "group flex min-h-12 items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)] focus-visible:bg-accent/70 lg:min-h-0 lg:gap-1 lg:rounded-xl lg:py-0 lg:pl-0 lg:pr-1 lg:hover:bg-muted/70",
                activeId === node.id &&
                  "bg-[color-mix(in_oklch,var(--muted),var(--foreground)_10%)] lg:bg-muted"
              )}
              style={{ marginLeft: `${level * 1.25}rem` }}
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 shrink-0 hover:bg-transparent lg:size-7"
                  aria-label={
                    isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`
                  }
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleCollapse(node.id)
                  }}
                  tabIndex={-1}
                >
                  {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </Button>
              ) : (
                <span className="size-9 shrink-0 lg:size-7" aria-hidden="true" />
              )}
              <Button
                variant="ghost"
                className="h-10 min-w-0 flex-1 justify-start px-2 text-[15px] hover:bg-transparent lg:h-8 lg:px-3 lg:text-sm"
                onClick={() => onSelect(node.id)}
                tabIndex={-1}
              >
                <Icon />
                {editingNodeId === node.id ? (
                  <Input
                    value={titleDraft}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onTitleDraftChange(event.target.value)}
                    onBlur={() => onCommitTitle(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onCommitTitle(node.id)
                      }

                      if (event.key === "Escape") {
                        onCancelTitleEdit()
                      }
                    }}
                    className="h-7 min-w-0 flex-1 px-2 text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="truncate">{node.title}</span>
                )}
              </Button>
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
                <DropdownMenuContent align="end" className="min-w-52 lg:min-w-44">
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
                onToggleCollapse={onToggleCollapse}
                editingNodeId={editingNodeId}
                titleDraft={titleDraft}
                onTitleDraftChange={onTitleDraftChange}
                onCommitTitle={onCommitTitle}
                onCancelTitleEdit={onCancelTitleEdit}
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

export function InformationView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nodes, setNodes] = React.useState<InformationNode[]>([])
  const [activeId, setActiveId] = React.useState<string | undefined>()
  const [contentDraft, setContentDraft] = React.useState("")
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState("")
  const [editingTreeNodeId, setEditingTreeNodeId] = React.useState<
    string | undefined
  >()
  const [treeTitleDraft, setTreeTitleDraft] = React.useState("")
  const [folderPromptParentId, setFolderPromptParentId] = React.useState<
    string | null
  >(null)
  const [folderPromptTitle, setFolderPromptTitle] = React.useState("")
  const [noteSearch, setNoteSearch] = React.useState("")
  const nodesRef = React.useRef<InformationNode[]>([])
  const desktopSearchInputRef = React.useRef<HTMLInputElement | null>(null)
  const desktopNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const mobileNoteSelectorRef = React.useRef<HTMLDetailsElement | null>(null)
  const hasInitializedCollapsedFolders = React.useRef(false)
  const [pendingDesktopNodeFocusId, setPendingDesktopNodeFocusId] =
    React.useState<string>()
  const [editorFocusSignal, setEditorFocusSignal] = React.useState(0)
  const [collapsedFolderIds, setCollapsedFolderIds] = React.useState(
    () => new Set<string>()
  )

  React.useEffect(() => {
    let isMounted = true

    async function loadNotes() {
      const loaded = await getInformationNotes()
      const requestedNode = searchParams.get("node") ?? undefined
      const requestedView = searchParams.get("view") ?? undefined
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
      const shouldShowMobileFolders =
        !requestedNode &&
        requestedView !== "notes" &&
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
      const initialNode = shouldShowMobileFolders
        ? undefined
        : requestedView === "notes"
          ? undefined
        : (requested ?? firstNote(loaded) ?? loaded[0])

      if (isMounted) {
        setNodes(nextNodes)
        if (!hasInitializedCollapsedFolders.current) {
          setCollapsedFolderIds(
            new Set(
              nextNodes
                .filter((node) => node.type === "folder")
                .map((node) => node.id)
            )
          )
          hasInitializedCollapsedFolders.current = true
        }
        setActiveId(requestedView === "notes" ? mobileRootNotesId : initialNode?.id)
        setContentDraft(initialNode?.content ?? "")
        setTitleDraft(requestedView === "notes" ? "Notes" : (initialNode?.title ?? ""))
        setEditingTitle(false)
      }
    }

    loadNotes()

    return () => {
      isMounted = false
    }
  }, [searchParams])

  React.useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const activeNode = nodes.find((node) => node.id === activeId)
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
    () => visibleTreeNodeIds(visibleNodes, collapsedFolderIds),
    [collapsedFolderIds, visibleNodes]
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

    const animationFrameId = window.requestAnimationFrame(() => {
      desktopSearchInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [searchParams])

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

  function emptyNoteContent() {
    return JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", attrs: { textAlign: null } }],
    })
  }

  function persist(nextNodes: InformationNode[]) {
    setNodes(nextNodes)
    saveInformationNotes(nextNodes)
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

  function selectNode(
    nodeId: string,
    mode: "push" | "replace" = "push"
  ) {
    if (!nodeId) {
      setActiveId(undefined)
      setContentDraft("")
      setTitleDraft("")
      setEditingTitle(false)
      mobileNoteSelectorRef.current?.removeAttribute("open")
      updateInformationRoute("/information", mode)
      window.dispatchEvent(new Event("information-notes:navigation"))
      return
    }

    const node = nodes.find((item) => item.id === nodeId)

    setActiveId(node?.id ?? nodeId)
    setContentDraft(node?.type === "note" ? (node.content ?? "") : "")
    setTitleDraft(node?.title ?? "")
    setEditingTitle(false)
    mobileNoteSelectorRef.current?.removeAttribute("open")
    updateInformationRoute(`/information?node=${encodeURIComponent(nodeId)}`, mode)
    window.dispatchEvent(new Event("information-notes:navigation"))
  }

  function selectRootNotes(mode: "push" | "replace" = "push") {
    setActiveId(mobileRootNotesId)
    setContentDraft("")
    setTitleDraft("Notes")
    setEditingTitle(false)
    mobileNoteSelectorRef.current?.removeAttribute("open")
    updateInformationRoute("/information?view=notes", mode)
    window.dispatchEvent(new Event("information-notes:navigation"))
  }

  function startCreate(
    type: InformationNodeType,
    parentId = "",
    titleOverride?: string
  ) {
    const title =
      titleOverride?.trim() ||
      (type === "folder" ? "Untitled Folder" : "Untitled Note")
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

    persist([...nodes, node])
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
    setActiveId(node.id)
    setContentDraft(node.content ?? "")
    setTitleDraft(node.title)
    setEditingTitle(false)
    setEditingTreeNodeId(node.id)
    setTreeTitleDraft(node.title)
    updateInformationRoute(`/information?node=${encodeURIComponent(node.id)}`)
    window.dispatchEvent(new Event("information-notes:navigation"))
  }

  function isMobileViewport() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    )
  }

  function requestCreateFolder(parentId = "") {
    if (!isMobileViewport()) {
      startCreate("folder", parentId)
      return
    }

    setFolderPromptParentId(parentId)
    setFolderPromptTitle("")
  }

  function confirmCreateFolder() {
    if (!folderPromptTitle.trim()) {
      return
    }

    startCreate("folder", folderPromptParentId ?? "", folderPromptTitle)
    setFolderPromptParentId(null)
    setFolderPromptTitle("")
  }

  function cancelCreateFolder() {
    setFolderPromptParentId(null)
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
      setTitleDraft(cleanTitle)
    }
  }

  function saveTitle() {
    if (!activeNode) {
      return
    }

    saveNodeTitle(activeNode.id, titleDraft)
    setEditingTitle(false)
  }

  function saveActiveNote() {
    if (!activeNode || activeNode.type !== "note") {
      return
    }

    const cleanTitle = titleDraft.trim() || activeNode.title
    const timestamp = new Date().toISOString()

    persist(
      nodes.map((node) =>
        node.id === activeNode.id
          ? {
              ...node,
              title: cleanTitle,
              content: contentDraft,
              updatedAt: timestamp,
            }
          : node
      )
    )
    setTitleDraft(cleanTitle)
    setEditingTitle(false)
  }

  function closeMobileNote() {
    if (activeNode?.parentId) {
      selectNode(activeNode.parentId, "replace")
      return
    }

    selectNode("", "replace")
  }

  function commitTreeTitle(nodeId: string) {
    saveNodeTitle(nodeId, treeTitleDraft)
    setEditingTreeNodeId(undefined)
    setTreeTitleDraft("")
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
    const deleteIds = descendantsOf(nodes, nodeId)
    const nextNodes = nodes.filter((node) => !deleteIds.has(node.id))
    const nextActive =
      activeId && deleteIds.has(activeId)
        ? (firstNote(nextNodes) ?? nextNodes[0])
        : activeNode

    persist(nextNodes)
    setActiveId(nextActive?.id)
    setContentDraft(nextActive?.content ?? "")
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
    if (!activeNode || activeNode.type !== "note") {
      return
    }

    if (contentDraft === (activeNode.content ?? "")) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const timestamp = new Date().toISOString()

      persist(
        nodes.map((node) =>
          node.id === activeNode.id
            ? { ...node, content: contentDraft, updatedAt: timestamp }
            : node
        )
      )
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [activeNode, contentDraft, nodes])

  React.useEffect(() => {
    async function refresh() {
      setNodes(await getInformationNotes())
    }

    window.addEventListener(informationUpdatedEvent, refresh)
    return () => window.removeEventListener(informationUpdatedEvent, refresh)
  }, [])

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
            ".simple-editor-mobile-toolbar",
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

  const noteHeaderTitle = activeNode ? (
    editingTitle ? (
      <Input
        value={titleDraft}
        onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            saveTitle()
          }

          if (event.key === "Escape") {
            setTitleDraft(activeNode.title)
            setEditingTitle(false)
          }
        }}
        className="h-8 max-w-[min(18rem,65vw)] px-2 text-center text-base font-semibold md:max-w-md md:text-left"
        autoFocus
      />
    ) : (
      <button
        type="button"
        className="min-w-0 max-w-[min(18rem,65vw)] truncate rounded-md px-1 text-center hover:bg-muted md:max-w-md md:text-left"
        onClick={() => {
          setTitleDraft(activeNode.title)
          setEditingTitle(true)
        }}
      >
        {activeNode.title}
      </button>
    )
  ) : (
    "Notebook"
  )
  const activeFolderNotes =
    activeNode?.type === "folder"
      ? childNodes(nodes, activeNode.id).filter((node) => node.type === "note")
      : childNodes(nodes).filter((node) => node.type === "note")

  return (
    <SidebarProvider
      className={cn(
        "min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] md:min-h-svh md:bg-sidebar",
        activeNode?.type === "note" ? "bg-background" : "bg-muted/60"
      )}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset
        className={cn(
          "min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] md:min-h-0 md:bg-background",
          activeNode?.type === "note" ? "bg-background" : "bg-muted/60"
        )}
      >
        <main
          className={cn(
            "flex min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] flex-1 flex-col md:min-h-[calc(100svh-1rem)] md:bg-background",
            activeNode?.type === "note" ? "bg-background" : "bg-muted/60"
          )}
        >
          <div className="hidden md:block">
            <SiteHeader title="Notebook" titleContent={noteHeaderTitle} />
          </div>
          {activeNode?.type === "note" ? (
            <MobileNoteHeader
              onClose={() => {
                saveActiveNote()
                closeMobileNote()
              }}
              onDelete={() => {
                if (activeNode) {
                  deleteNode(activeNode.id)
                }
              }}
            />
          ) : null}
          {folderPromptParentId !== null ? (
            <MobileFolderTitlePrompt
              value={folderPromptTitle}
              onChange={setFolderPromptTitle}
              onConfirm={confirmCreateFolder}
              onCancel={cancelCreateFolder}
            />
          ) : null}
          <div className="flex min-h-0 flex-1 px-0 py-0 sm:px-4 sm:py-4 lg:px-6">
            <Card className="min-h-0 flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 sm:rounded-lg sm:bg-card sm:shadow-sm sm:ring-1">
              <CardContent className="grid min-h-0 flex-1 gap-0 p-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
                <aside className="hidden border-b p-5 lg:block lg:border-r lg:border-b-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span aria-hidden="true" />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon-sm"
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
                  <div className="grid gap-4">
                    <Input
                      ref={desktopSearchInputRef}
                      value={noteSearch}
                      onChange={(event) => setNoteSearch(event.target.value)}
                      onKeyDown={handleDesktopSearchKeyDown}
                      placeholder="Search notebook"
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
                      onToggleCollapse={toggleFolderCollapse}
                      editingNodeId={editingTreeNodeId}
                      titleDraft={treeTitleDraft}
                      onTitleDraftChange={setTreeTitleDraft}
                      onCommitTitle={commitTreeTitle}
                      onCancelTitleEdit={cancelTreeTitleEdit}
                      focusableNodeIds={desktopVisibleTreeNodeIds}
                      nodeRefs={desktopNodeRefs}
                      onFocusNode={focusDesktopTreeNode}
                      onOpenNoteForTyping={focusDesktopEditor}
                    />
                  </div>
                </aside>

                <section className="flex min-h-0 min-w-0 flex-col p-0 sm:p-5">
                  <div className="hidden">
                    <div className="flex items-center gap-2">
                      <details
                        ref={mobileNoteSelectorRef}
                        className="group min-w-0 flex-1"
                      >
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border bg-background px-4 text-base font-medium marker:hidden">
                          <span className="min-w-0 truncate">
                            {activeNode?.title ?? "Notebook"}
                          </span>
                          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 max-h-[52svh] overflow-auto rounded-lg border bg-background p-4 shadow-md">
                          <Input
                            value={noteSearch}
                            onChange={(event) =>
                              setNoteSearch(event.target.value)
                            }
                            placeholder="Search notebook"
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
                            onToggleCollapse={toggleFolderCollapse}
                            editingNodeId={editingTreeNodeId}
                            titleDraft={treeTitleDraft}
                            onTitleDraftChange={setTreeTitleDraft}
                            onCommitTitle={commitTreeTitle}
                            onCancelTitleEdit={cancelTreeTitleEdit}
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
                          <DropdownMenuItem
                            onClick={() => startCreate("folder")}
                          >
                            <FolderPlusIcon />
                            Add Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {activeNode?.type === "note" ? (
                    <div className="min-h-0 flex-1 overflow-hidden bg-background sm:rounded-lg sm:border">
                      <div className="px-5 pt-4 md:hidden">
                        <Input
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onBlur={saveActiveNote}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveActiveNote()
                              event.currentTarget.blur()
                            }
                          }}
                          className="h-auto rounded-none border-0 bg-transparent px-0 py-1 !text-[24pt] font-bold leading-tight tracking-tight shadow-none focus-visible:ring-0 md:!text-3xl"
                          aria-label="Note title"
                        />
                      </div>
                      <SimpleEditor
                        key={activeNode.id}
                        focusSignal={editorFocusSignal}
                        value={contentDraft}
                        onChange={setContentDraft}
                      />
                    </div>
                  ) : activeNode?.type === "folder" ? (
                    <>
                      <MobileFolderNotesScreen
                        folder={activeNode}
                        nodes={nodes}
                        notes={activeFolderNotes}
                        onBack={() => selectNode("", "replace")}
                        onOpenNote={selectNode}
                        onCreateNote={() => startCreate("note", activeNode.id)}
                        onCreateFolder={() =>
                          requestCreateFolder(activeNode.id)
                        }
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
                        onBack={() => selectNode("", "replace")}
                        onOpenNote={selectNode}
                        onCreateNote={() => startCreate("note")}
                        onCreateFolder={() => requestCreateFolder()}
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
                        onCreate={(type, parentId) =>
                          type === "folder"
                            ? requestCreateFolder(parentId)
                            : startCreate(type, parentId)
                        }
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
                </section>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
