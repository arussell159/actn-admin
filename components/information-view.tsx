"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
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
  Trash2Icon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
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
  parentId?: string
  level?: number
}) {
  const children = childNodes(nodes, parentId)
  const allFolders = allNodes.filter((node) => node.type === "folder")

  if (!children.length && level === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No notes yet.
      </div>
    )
  }

  return (
    <div className={level === 0 ? "grid gap-1" : "grid gap-1"}>
      {children.map((node) => {
        const Icon = node.type === "folder" ? FolderIcon : FileTextIcon
        const isFolder = node.type === "folder"
        const isCollapsed = collapsedFolderIds.has(node.id)

        return (
          <div key={node.id}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-muted/70",
                activeId === node.id && "bg-muted"
              )}
              style={{ marginLeft: `${level * 1.25}rem` }}
              draggable
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
                  className="shrink-0 hover:bg-transparent"
                  aria-label={
                    isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`
                  }
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleCollapse(node.id)
                  }}
                >
                  {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </Button>
              ) : (
                <span className="size-7 shrink-0" aria-hidden="true" />
              )}
              <Button
                variant="ghost"
                className="min-w-0 flex-1 justify-start hover:bg-transparent"
                onClick={() => onSelect(node.id)}
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
                      className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                      aria-label={`Actions for ${node.title}`}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
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
                    <DropdownMenuSubContent className="min-w-44">
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
  const [noteSearch, setNoteSearch] = React.useState("")
  const [collapsedFolderIds, setCollapsedFolderIds] = React.useState(
    () => new Set<string>()
  )

  React.useEffect(() => {
    let isMounted = true

    async function loadNotes() {
      const loaded = await getInformationNotes()
      const requestedNode = searchParams.get("node") ?? undefined
      const requested = requestedNode
        ? loaded.find((node) => node.id === requestedNode)
        : undefined
      const initialNode = requested ?? firstNote(loaded) ?? loaded[0]

      if (isMounted) {
        setNodes(loaded)
        setActiveId(initialNode?.id)
        setContentDraft(initialNode?.content ?? "")
        setTitleDraft(initialNode?.title ?? "")
        setEditingTitle(false)
      }
    }

    loadNotes()

    return () => {
      isMounted = false
    }
  }, [searchParams])

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

  function selectNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId)

    setActiveId(node?.id ?? nodeId)
    setContentDraft(node?.type === "note" ? (node.content ?? "") : "")
    setTitleDraft(node?.title ?? "")
    setEditingTitle(false)
    router.replace(`/information?node=${encodeURIComponent(nodeId)}`)
    window.dispatchEvent(new Event("information-notes:navigation"))
  }

  function startCreate(type: InformationNodeType, parentId = "") {
    const title = type === "folder" ? "Untitled Folder" : "Untitled Note"
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
    router.replace(`/information?node=${encodeURIComponent(node.id)}`)
    window.dispatchEvent(new Event("information-notes:navigation"))
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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title="Notebook" />
          <div className="flex flex-1 px-0 py-0 sm:px-4 sm:py-4 lg:px-6">
            <Card className="min-h-0 flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 sm:rounded-lg sm:bg-card sm:shadow-sm sm:ring-1">
              <CardContent className="grid min-h-[calc(100svh-8rem)] gap-0 p-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
                <aside className="hidden border-b p-5 lg:block lg:border-r lg:border-b-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Notebook</CardTitle>
                      <CardDescription>
                        Folders and notes for misc information.
                      </CardDescription>
                    </div>
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
                      value={noteSearch}
                      onChange={(event) => setNoteSearch(event.target.value)}
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
                    />
                  </div>
                </aside>

                <section className="min-w-0 p-0 sm:p-5">
                  <div className="sticky top-0 z-10 border-b bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:hidden">
                    <div className="flex items-center gap-2">
                      <details className="group min-w-0 flex-1">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border bg-background px-3 text-sm font-medium marker:hidden">
                          <span className="min-w-0 truncate">
                            {activeNode?.title ?? "Notebook"}
                          </span>
                          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-2 max-h-[45svh] overflow-auto rounded-lg border bg-background p-3 shadow-sm">
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

                  <div className="flex flex-col gap-2 px-3 py-3 sm:mb-4 sm:px-0 sm:py-0 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2">
                      {activeNode?.type === "folder" ? (
                        <FolderIcon className="size-5 shrink-0" />
                      ) : (
                        <FileTextIcon className="size-5 shrink-0" />
                      )}
                      {activeNode ? (
                        editingTitle ? (
                          <Input
                            value={titleDraft}
                            onChange={(event) =>
                              setTitleDraft(event.target.value)
                            }
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
                            className="h-9 max-w-md text-base font-semibold"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 rounded-md px-1 text-left hover:bg-muted"
                            onClick={() => {
                              setTitleDraft(activeNode.title)
                              setEditingTitle(true)
                            }}
                          >
                            <span className="block truncate">
                              {activeNode.title}
                            </span>
                          </button>
                        )
                      ) : (
                        "Notebook"
                      )}
                    </CardTitle>
                    {activeNode?.type === "note" ? (
                      <span className="text-sm text-muted-foreground">
                        Autosaved
                      </span>
                    ) : null}
                  </div>
                  {activeNode?.type === "note" ? (
                    <div className="overflow-hidden bg-background sm:rounded-lg sm:border">
                      <SimpleEditor
                        key={activeNode.id}
                        value={contentDraft}
                        onChange={setContentDraft}
                      />
                    </div>
                  ) : activeNode?.type === "folder" ? (
                    <FolderDashboard
                      folder={activeNode}
                      nodes={nodes}
                      onOpenNote={selectNode}
                    />
                  ) : (
                    <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
                      <HomeIcon className="size-8" />
                      <p>Select a note from the tree or create a new one.</p>
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
