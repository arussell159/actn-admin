"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  HistoryIcon,
  ListCollapseIcon,
  MoreHorizontalIcon,
  PanelTopCloseIcon,
  PencilIcon,
  SparklesIcon,
} from "lucide-react"
import {
  NotebookLayout,
  NotebookActionTooltip,
  NotebookBreadcrumbs,
} from "@/components/notebook-layout"
import { NotebookSkeleton } from "@/components/page-skeletons"
import {
  SiteHeaderBackButton,
  siteHeaderGlassButtonClassName,
} from "@/components/site-header"
import {
  KnowledgeTree,
  KnowledgeFolder,
  knowledgeNodes,
  knowledgePath,
  knowledgeRoot,
} from "@/components/okf-navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import { Toolbar, ToolbarGroup } from "@/components/tiptap-ui-primitive/toolbar"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Choice, OkfContent, TextEdit, okfHref } from "@/components/okf-content"
import {
  createCountryDefinitionPages,
  createInitialPages,
} from "@/lib/okf/seed"
import type {
  KnowledgeChange,
  KnowledgeContent,
  KnowledgeDraft,
  KnowledgeState,
  Publication,
} from "@/lib/okf/schema"
import { nextVersion, includePublicationDependencies } from "@/lib/okf/engine"

type Intake = {
  id: string
  page_id: string
  note: string
  created_at: string
  result: {
    classification: string
    message: string
    question: string
    draftId: string | null
  }
}
type Data = {
  state: KnowledgeState
  drafts: KnowledgeDraft[]
  history: Publication[]
  intake: Intake[]
  options: Record<string, string[]>
  layoutCountries: string[]
  layoutDefinitions: {
    country: string
    fields: {
      id: string
      label: string
      sourceDocument: string
      instruction: string
    }[]
  }[]
  userId: string
  canEdit: boolean
  canPublish: boolean
  development?: boolean
}
type Preview = {
  draft: KnowledgeDraft
  state: KnowledgeState
  token: string
  stale: boolean
  comparisons: {
    pageId: string
    title: string
    before: KnowledgeContent
    after: KnowledgeContent
    currentVersion: string | null
    proposedVersion: string
    mappingChanged: boolean
  }[]
}
import { okfApi, stableSignature } from "@/lib/okf/client"

function differenceRows(before: KnowledgeContent, after: KnowledgeContent) {
  const rows: { key: string; before: string; after: string }[] = []
  for (const key of [
    "sections",
    "rules",
    "fields",
    "mappings",
    "sources",
  ] as const) {
    const identity = (v: object) =>
      "id" in v ? String(v.id) : "heading" in v ? String(v.heading) : ""
    const a = new Map(before[key].map((v) => [identity(v), v]))
    const b = new Map(after[key].map((v) => [identity(v), v]))
    for (const id of new Set([...a.keys(), ...b.keys()]))
      if (stableSignature(a.get(id)) !== stableSignature(b.get(id)))
        rows.push({
          key: `${key}: ${id}`,
          before: a.has(id) ? JSON.stringify(a.get(id), null, 2) : "New entry",
          after: b.has(id) ? JSON.stringify(b.get(id), null, 2) : "Removed",
        })
  }
  if (JSON.stringify(before.aliases) !== JSON.stringify(after.aliases))
    rows.push({
      key: "Country aliases",
      before: before.aliases.join(", "),
      after: after.aliases.join(", "),
    })
  return rows
}

export function OkfView() {
  const params = useSearchParams()

  const pageId = params.get("page") || "mg-overview"
  const [data, setData] = React.useState<Data>({
    state: { generation: 0, pages: createInitialPages() },
    drafts: [],
    history: [],
    intake: [],
    options: {},
    layoutCountries: [],
    layoutDefinitions: [],
    userId: "",
    canEdit: false,
    canPublish: false,
  })
  const [loaded, setLoaded] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const shellRef = React.useRef<HTMLDivElement>(null)
  const [assistantOpen, setAssistantOpen] = React.useState(
    !!params.get("correction")
  )
  const [collapsed, setCollapsed] = React.useState(new Set<string>())
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState("All countries")
  const [structuralChange, setStructuralChange] = React.useState("")
  const [consumerMigration, setConsumerMigration] = React.useState("")
  const [draft, setDraft] = React.useState<KnowledgeDraft | null>(null)
  const [savedSignature, setSavedSignature] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [assistantMode, setAssistantMode] = React.useState<
    "question" | "update"
  >("update")
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<
    KnowledgeContent["sources"]
  >([])
  const [answer, setAnswer] = React.useState<{
    message: string
    question: string
    pageIds: string[]
  } | null>(null)
  const [reviewing, setReviewing] = React.useState(false)
  const [correctionId, setCorrectionId] = React.useState<string | undefined>(
    params.get("correction") ?? undefined
  )
  const draftRef = React.useRef(draft)
  draftRef.current = draft
  const flight = React.useRef<Promise<KnowledgeDraft | null> | null>(null)
  const signature = (d: KnowledgeDraft | null) =>
    d ? stableSignature([d.id, d.changes, d.reason, d.source]) : ""
  const dirty = !!draft && signature(draft) !== savedSignature
  const displayPages = React.useMemo(() => {
    const known = new Set(data.state.pages.map((page) => page.country))
    const countries = [
      ...(data.layoutDefinitions ?? []).map(({ country }) => country),
      ...(data.layoutCountries ?? []),
    ]
    const definitions = new Map(
      (data.layoutDefinitions ?? []).map((definition) => [
        definition.country,
        definition.fields,
      ])
    )
    return [
      ...data.state.pages,
      ...[...new Set(countries)]
        .filter((country) => !known.has(country))
        .flatMap((country) =>
          createCountryDefinitionPages(country, definitions.get(country))
        ),
    ]
  }, [data.layoutCountries, data.layoutDefinitions, data.state.pages])
  const page = displayPages.find((p) => p.id === pageId) ?? displayPages[0]
  const definitionOnly = !data.state.pages.some((item) => item.id === page.id)
  const currentChange = draft?.changes.find((c) => c.pageId === page.id)
  const editingPage = currentChange
    ? { ...page, content: currentChange.content }
    : page
  const updates = pageId === "updates"
  const nodes = knowledgeNodes(displayPages, data.layoutCountries ?? [])
  const folder =
    pageId === knowledgeRoot || !!nodes.find((n) => n.id === pageId)?.folder
  const path = knowledgePath(nodes, pageId)
  React.useEffect(() => {
    const updateViewport = () => {
      const viewport = window.visualViewport
      if (!shellRef.current || !viewport || window.innerWidth >= 768) return
      shellRef.current.style.setProperty(
        "--mobile-note-viewport-height",
        viewport.height + "px"
      )
      shellRef.current.style.setProperty(
        "--mobile-note-viewport-top",
        viewport.offsetTop + "px"
      )
    }
    updateViewport()
    window.visualViewport?.addEventListener("resize", updateViewport)
    window.visualViewport?.addEventListener("scroll", updateViewport)
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport)
      window.visualViewport?.removeEventListener("scroll", updateViewport)
    }
  }, [])

  const reload = React.useCallback(async () => {
    const result = await okfApi<Data>("/api/okf")
    setData(result)
    setLoaded(true)
    return result
  }, [setData, setLoaded])
  React.useEffect(() => {
    void reload().catch((e) => setError(e.message))
  }, [reload])
  React.useEffect(() => {
    setCorrectionId(params.get("correction") ?? undefined)
  }, [params])

  const save = React.useCallback(async (): Promise<KnowledgeDraft | null> => {
    while (flight.current) await flight.current
    const current = draftRef.current
    if (!current) return null
    setSaving(true)
    const pending = okfApi<{ draft?: KnowledgeDraft; duplicate?: boolean }>(
      "/api/okf",
      {
        action: "save",
        draft: {
          id: current.id,
          expectedEdit: current.edit_version,
          baseGeneration: current.base_generation,
          changes: current.changes,
          reason: current.reason || "Direct staff edit",
          source: current.source,
        },
      }
    )
      .then((result) => {
        if (result.duplicate) {
          setNotice("Already covered")
          const freshId = crypto.randomUUID()
          const next = {
            ...(draftRef.current ?? current),
            id: freshId,
            edit_version: 0,
          }
          draftRef.current = next
          setDraft(next)
          setSavedSignature(
            signature({ ...current, id: freshId, edit_version: 0 })
          )
          setData((d) => ({
            ...d,
            drafts: d.drafts.filter((d) => d.id !== current.id),
          }))
          return null
        }
        const next = result.draft!
        const merged =
          draftRef.current?.id === next.id
            ? {
                ...draftRef.current,
                edit_version: next.edit_version,
                updated_at: next.updated_at,
              }
            : next
        draftRef.current = merged
        setDraft(merged)
        setSavedSignature(signature(next))
        setError("")
        setData((d) => ({
          ...d,
          drafts: [next, ...d.drafts.filter((v) => v.id !== next.id)],
        }))
        return next
      })
      .finally(() => {
        flight.current = null
        setSaving(false)
      })
    flight.current = pending
    return pending
  }, [])
  React.useEffect(() => {
    if (!draft || !dirty || !draft.reason.trim()) return
    const timer = window.setTimeout(() => {
      void save().catch((e) => setError(e.message))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, save])
  React.useEffect(() => {
    if (
      !draft ||
      dirty ||
      draft.edit_version < 1 ||
      draft.review_edit === draft.edit_version
    )
      return
    let active = true
    const timer = window.setTimeout(() => {
      setReviewing(true)
      void okfApi<{ review: string; edit: number }>("/api/okf/assistant", {
        mode: "review",
        draftId: draft.id,
        pageId,
        text: "",
      })
        .then((result) => {
          if (active)
            setDraft((current) =>
              current?.id === draft.id && current.edit_version === result.edit
                ? {
                    ...current,
                    review: result.review,
                    review_edit: result.edit,
                  }
                : current
            )
        })
        .catch((e) => {
          if (active)
            setNotice(
              `Draft saved. Advisory AI review unavailable: ${e.message}`
            )
        })
        .finally(() => {
          if (active) setReviewing(false)
        })
    }, 1800)
    return () => {
      active = false
      setReviewing(false)
      window.clearTimeout(timer)
    }
  }, [draft, dirty, pageId])
  function newDraft(changes: KnowledgeChange[], reason: string) {
    const next: KnowledgeDraft = {
      id: crypto.randomUUID(),
      edit_version: 0,
      base_generation: data.state.generation,
      changes,
      reason,
      source: "Direct staff edit",
      proposer: data.userId,
      updated_at: new Date().toISOString(),
      status: "pending",
      review: "",
      review_edit: null,
    }
    draftRef.current = next
    setDraft(next)
    setSavedSignature("")
    setPreview(null)
    setError("")
  }
  function editPage() {
    const existing = data.drafts.find(
      (d) =>
        d.proposer === data.userId &&
        d.changes.some((c) => c.pageId === page.id)
    )
    if (existing) {
      setDraft(existing)
      setSavedSignature(signature(existing))
      return
    }
    if (draft) {
      setDraft({
        ...draft,
        changes: [
          ...draft.changes,
          { pageId: page.id, content: page.content, level: "patch" },
        ],
      })
      return
    }
    newDraft(
      [{ pageId: page.id, content: page.content, level: "patch" }],
      `Direct edit: ${page.title}`
    )
  }
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed")
    } finally {
      setBusy(false)
    }
  }
  async function showPreview(id?: string) {
    await run(async () => {
      let saved = id ? data.drafts.find((d) => d.id === id) : draft
      if (!id && dirty) {
        try {
          saved = await save()
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !/changed|stale|refresh/i.test(error.message)
          )
            throw error
          const latest = await reload()
          const local = draftRef.current
          if (!local) return
          setPreview({
            draft: local,
            state: latest.state,
            token: "",
            stale: true,
            comparisons: local.changes.map((c) => {
              const p = latest.state.pages.find((p) => p.id === c.pageId)!
              return {
                pageId: p.id,
                title: p.title,
                before: p.content,
                after: c.content,
                currentVersion: p.version,
                proposedVersion: nextVersion(p.version, c.level),
                mappingChanged:
                  stableSignature(p.content.mappings) !==
                  stableSignature(c.content.mappings),
              }
            }),
          })
          return
        }
      }
      if (!saved) return
      const result = await okfApi<Preview>("/api/okf", {
        action: "preview",
        id: saved.id,
      })
      setPreview(result)
    })
  }
  async function assistant() {
    if (!input.trim() && !attachments.length && !correctionId) return
    await run(async () => {
      const result = await okfApi<{
        result: { message: string; question: string; pageIds: string[] }
        draft: KnowledgeDraft | null
      }>("/api/okf/assistant", {
        mode: assistantMode,
        text: input,
        pageId,
        attachments,
        correctionId,
        draftId: draft?.id,
      })
      setAnswer(result.result)
      if (result.draft) {
        setAssistantOpen(false)
        setDraft(result.draft)
        draftRef.current = result.draft
        setSavedSignature(signature(result.draft))
        setNotice(
          "Proposal saved. Review the exact changes before publication."
        )
      }
      await reload()
    })
  }
  async function attach(files: FileList | null) {
    if (!files?.length) return
    await run(async () => {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set("file", file)
        const response = await fetch("/api/okf/evidence", {
          method: "POST",
          body: form,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        setAttachments((a) => [...a, result.source])
        if (draftRef.current?.changes.some((c) => c.pageId === page.id))
          setDraft((d) =>
            d
              ? {
                  ...d,
                  changes: d.changes.map((c) =>
                    c.pageId === page.id
                      ? {
                          ...c,
                          content: {
                            ...c.content,
                            sources: [...c.content.sources, result.source],
                          },
                        }
                      : c
                  ),
                }
              : d
          )
      }
    })
  }
  function navigate(id: string) {
    window.history.replaceState(null, "", okfHref(id))
    setAnswer(null)
    setCollapsed(
      (current) =>
        new Set(
          [...current].filter(
            (key) => !knowledgePath(nodes, id).some((n) => n.id === key)
          )
        )
    )
  }
  const visible = displayPages.filter(
    (p) =>
      !search ||
      `${p.title} ${p.country} ${JSON.stringify(p.content)}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  const visibleNodeIds = new Set(
    visible.flatMap((p) => knowledgePath(nodes, p.id).map((n) => n.id))
  )
  for (const node of nodes.filter(
    (node) =>
      node.id.startsWith("layout-") &&
      `${node.title} ${node.parent ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )) {
    knowledgePath(nodes, node.id).forEach((item) => visibleNodeIds.add(item.id))
  }
  const treeNodes = search
    ? nodes.filter((n) => visibleNodeIds.has(n.id))
    : nodes
  return (
    <>
      <NotebookLayout
        ref={shellRef}
        activeDocument={!folder}
        header={{
          headingAs: "div",
          titleContent: (
            <NotebookBreadcrumbs
              items={[
                {
                  id: knowledgeRoot,
                  label: "Knowledge Base",
                  onSelect: () => navigate(knowledgeRoot),
                },
                ...path.map((node, index) => ({
                  id: node.id,
                  label: node.title,
                  onSelect:
                    index < path.length - 1
                      ? () => navigate(node.id)
                      : undefined,
                })),
              ]}
            />
          ),
          mobileLeadingContent:
            pageId !== knowledgeRoot ? (
              <SiteHeaderBackButton
                label="Back to knowledge folder"
                onClick={() =>
                  navigate(
                    nodes.find((n) => n.id === pageId)?.parent ?? knowledgeRoot
                  )
                }
              />
            ) : undefined,
          mobileTrailingContent: (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className={siteHeaderGlassButtonClassName}
                    aria-label="Knowledge Base actions"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52! p-1.5!">
                {!folder && !updates ? (
                  <DropdownMenuItem
                    className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
                    disabled={
                      definitionOnly ||
                      !data.canEdit ||
                      busy ||
                      saving ||
                      !!currentChange
                    }
                    onClick={editPage}
                  >
                    <PencilIcon />
                    Edit Page
                  </DropdownMenuItem>
                ) : null}
                {!folder ? (
                  <DropdownMenuItem
                    className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
                    onClick={() => setAssistantOpen(true)}
                  >
                    <SparklesIcon />
                    Update with AI
                  </DropdownMenuItem>
                ) : null}
                {!folder ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  className="min-h-11! gap-2.5! px-3! py-2! text-base! [&_svg:not([class*='size-'])]:size-5!"
                  onClick={() => navigate("updates")}
                >
                  <HistoryIcon />
                  Country Updates
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
        navigation={
          <nav
            aria-label="OKF navigation"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="mb-3 flex items-center justify-center gap-1 text-muted-foreground">
              <NotebookActionTooltip label="Edit page">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                  aria-label="Edit page"
                  disabled={
                    !!folder ||
                    updates ||
                    definitionOnly ||
                    !data.canEdit ||
                    busy ||
                    saving ||
                    !!currentChange
                  }
                  onClick={editPage}
                >
                  <PencilIcon />
                </Button>
              </NotebookActionTooltip>
              <NotebookActionTooltip label="Update with AI">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                  aria-label="Update with AI"
                  disabled={!!folder}
                  onClick={() => setAssistantOpen(true)}
                >
                  <SparklesIcon />
                </Button>
              </NotebookActionTooltip>
              <NotebookActionTooltip label="Country updates">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                  aria-label="Country updates"
                  onClick={() => navigate("updates")}
                >
                  <HistoryIcon />
                </Button>
              </NotebookActionTooltip>
              <NotebookActionTooltip label="Reveal active page">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-md hover:bg-muted hover:text-foreground"
                  aria-label="Reveal active page"
                  onClick={() => {
                    setSearch("")
                    setCollapsed(
                      (current) =>
                        new Set(
                          [...current].filter(
                            (key) => !path.some((n) => n.id === key)
                          )
                        )
                    )
                  }}
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
                  onClick={() =>
                    setCollapsed(
                      new Set(nodes.filter((n) => n.folder).map((n) => n.id))
                    )
                  }
                >
                  <ListCollapseIcon />
                </Button>
              </NotebookActionTooltip>
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-4 overflow-auto">
              <Input
                aria-label="Search OKF"
                placeholder="Search knowledge base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="focus-visible:ring-inset"
              />
              <KnowledgeTree
                nodes={treeNodes.filter((n) => n.id !== "updates")}
                activeId={pageId}
                onSelect={navigate}
                collapsed={search ? new Set() : collapsed}
                onToggle={(id) =>
                  setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
              {!treeNodes.length ? (
                <p className="text-sm text-muted-foreground">
                  No matching pages.
                </p>
              ) : null}
            </div>
            <Button
              variant={updates ? "secondary" : "ghost"}
              className="mt-4 h-9 justify-start gap-2 rounded-md px-2 text-sm font-normal"
              onClick={() => navigate("updates")}
            >
              <HistoryIcon className="size-4" />
              <span className="min-w-0 flex-1 text-left">Country Updates</span>
              {data.drafts.length ? (
                <span className="text-xs text-muted-foreground">
                  {data.drafts.length}
                </span>
              ) : null}
            </Button>
            {data.development ? (
              <p className="mt-2 px-2 text-xs text-muted-foreground">
                Local development · saved on this machine
              </p>
            ) : null}
          </nav>
        }
        loading={!loaded && !error ? <NotebookSkeleton /> : undefined}
      >
        {folder ? (
          <KnowledgeFolder nodes={nodes} id={pageId} onSelect={navigate} />
        ) : (
          <div className="okf-notebook pt-2 sm:-m-5 sm:pt-0">
            <Toolbar
              className="simple-editor-mobile-toolbar"
              aria-label="Knowledge page actions"
            >
              <Spacer />
              <ToolbarGroup>
                {!updates ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      definitionOnly ||
                      !data.canEdit ||
                      busy ||
                      saving ||
                      !!currentChange
                    }
                    onClick={editPage}
                  >
                    <PencilIcon className="size-4" />
                    Edit page
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAssistantOpen(true)}
                >
                  <SparklesIcon className="size-4" />
                  Update with AI
                </Button>
              </ToolbarGroup>
              <Spacer />
            </Toolbar>
            <div className="okf-notebook-scroll" key={pageId}>
              <div className="okf-notebook-document space-y-5">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
                  >
                    {error}
                    {!loaded ? (
                      <div className="mt-2 flex gap-3">
                        <a href="/login" className="underline">
                          Staff sign in
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void run(async () => {
                              await reload()
                            })
                          }
                        >
                          Retry connection
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {notice ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {notice}
                  </p>
                ) : null}
                {draft ? (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        Draft · {draft.changes.length} page
                        {draft.changes.length === 1 ? "" : "s"} ·{" "}
                        {saving
                          ? "Saving…"
                          : dirty
                            ? "Unsaved changes"
                            : "Saved"}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy || saving}
                          onClick={() => void showPreview()}
                        >
                          Preview changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || saving}
                          onClick={() =>
                            void run(async () => {
                              if (draft.edit_version)
                                await okfApi("/api/okf", {
                                  action: "discard",
                                  id: draft.id,
                                  edit: draft.edit_version,
                                })
                              setDraft(null)
                              draftRef.current = null
                              await reload()
                            })
                          }
                        >
                          Discard draft
                        </Button>
                      </div>
                    </div>
                    {draft.source !== "Direct staff edit" ? (
                      <>
                        <TextEdit
                          label="Reason for the change set"
                          value={draft.reason}
                          onChange={(v) => setDraft({ ...draft, reason: v })}
                        />
                        <TextEdit
                          label="Source or evidence summary"
                          value={draft.source}
                          onChange={(v) => setDraft({ ...draft, source: v })}
                        />
                      </>
                    ) : null}
                    {draft.source !== "Direct staff edit" ? (
                      <details>
                        <summary className="cursor-pointer text-sm">
                          Included pages and version impact
                        </summary>
                        <div className="mt-3 grid gap-3">
                          {draft.changes.map((c) => (
                            <Choice
                              key={c.pageId}
                              label={
                                data.state.pages.find((p) => p.id === c.pageId)
                                  ?.title ?? c.pageId
                              }
                              value={c.level}
                              values={["minor", "patch"]}
                              onChange={(v) =>
                                setDraft({
                                  ...draft,
                                  changes: draft.changes.map((x) =>
                                    x.pageId === c.pageId
                                      ? { ...x, level: v as "minor" | "patch" }
                                      : x
                                  ),
                                })
                              }
                            />
                          ))}
                          <p className="text-xs text-muted-foreground">
                            Choosing patch confirms that operational meaning is
                            unchanged. Rules, extraction and mapping changes
                            require minor.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                changes: includePublicationDependencies(
                                  data.state,
                                  draft.changes
                                ),
                              })
                            }
                          >
                            Include linked fields and sources
                          </Button>
                        </div>
                      </details>
                    ) : null}
                    {reviewing ? (
                      <p className="text-xs text-muted-foreground">
                        AI is reviewing the affected content and dependencies…
                      </p>
                    ) : draft.review ? (
                      <details>
                        <summary className="cursor-pointer text-sm">
                          Advisory AI review
                        </summary>
                        <p className="mt-2 text-sm whitespace-pre-wrap">
                          {draft.review}
                        </p>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                {!updates ? (
                  <article>
                    <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                          {page.title}
                        </h1>
                        <div className="mt-2 flex gap-2">
                          <span className="text-xs text-muted-foreground">
                            {definitionOnly
                              ? "Certificate definition"
                              : page.version
                                ? `Published ${page.version}`
                                : "Draft"}
                          </span>
                          {currentChange ? (
                            <span className="text-xs text-muted-foreground">
                              Editing draft
                            </span>
                          ) : null}
                        </div>
                        {page.publishedAt ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Approved{" "}
                            {new Date(page.publishedAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <OkfContent
                      page={editingPage}
                      pages={displayPages.map((p) => ({
                        ...p,
                        content:
                          draft?.changes.find((c) => c.pageId === p.id)
                            ?.content ?? p.content,
                      }))}
                      options={data.options}
                      onChange={
                        currentChange && !definitionOnly
                          ? (content) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      changes: d.changes.map((c) =>
                                        c.pageId === page.id
                                          ? { ...c, content }
                                          : c
                                      ),
                                    }
                                  : d
                              )
                          : undefined
                      }
                    />
                  </article>
                ) : (
                  <section className="grid gap-5">
                    <h1 className="text-2xl font-semibold">Country Updates</h1>
                    <p className="text-sm text-muted-foreground">
                      Update intake, pending proposals and publication history.
                      Requirements remain on their authoritative pages.
                    </p>
                    <Choice
                      label="Country filter"
                      value={filter}
                      values={["All countries", "Madagascar", "Shared"]}
                      onChange={setFilter}
                    />
                    <h2 className="text-lg font-semibold">Pending proposals</h2>
                    {data.drafts
                      .filter(
                        (d) =>
                          filter === "All countries" ||
                          d.changes.some(
                            (c) =>
                              data.state.pages.find((p) => p.id === c.pageId)
                                ?.country === filter
                          )
                      )
                      .map((d) => (
                        <div
                          key={d.id}
                          className="grid gap-2 rounded-lg border p-4"
                        >
                          <p className="font-medium">{d.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            Proposed {new Date(d.updated_at).toLocaleString()} ·{" "}
                            {d.proposer}
                          </p>
                          <div>
                            {d.changes.map((c) => (
                              <a
                                className="mr-3 text-sm underline"
                                key={c.pageId}
                                href={okfHref(c.pageId)}
                              >
                                {
                                  data.state.pages.find(
                                    (p) => p.id === c.pageId
                                  )?.title
                                }
                              </a>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || dirty}
                              onClick={() => void showPreview(d.id)}
                            >
                              Preview
                            </Button>
                            {d.proposer === data.userId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={dirty || saving}
                                onClick={() => {
                                  setDraft(d)
                                  setSavedSignature(signature(d))
                                  navigate(d.changes[0].pageId)
                                }}
                              >
                                Continue editing
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    {!data.drafts.length ? (
                      <p className="text-sm text-muted-foreground">
                        No pending proposals.
                      </p>
                    ) : null}
                    <h2 className="text-lg font-semibold">
                      Publication history
                    </h2>
                    {data.history
                      .filter(
                        (h) =>
                          filter === "All countries" ||
                          h.after_pages.some((p) => p.country === filter)
                      )
                      .map((h) => (
                        <details key={h.id} className="rounded-lg border p-4">
                          <summary className="cursor-pointer text-sm">
                            {new Date(h.created_at).toLocaleString()} ·{" "}
                            {h.reason}
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <p className="text-xs text-muted-foreground">
                              Proposer: {h.proposer} · Approver: {h.approver}
                            </p>
                            <p className="text-sm">
                              Source: {h.source || "Unconfirmed"}
                            </p>
                            {h.after_pages.map((p) => (
                              <a
                                key={p.id}
                                className="text-sm underline"
                                href={okfHref(p.id)}
                              >
                                {p.title} · {p.version}
                              </a>
                            ))}
                            <details>
                              <summary className="cursor-pointer text-sm">
                                Before and after content
                              </summary>
                              {h.after_pages.map((after) => (
                                <div key={after.id} className="mt-3 grid gap-2">
                                  <p className="font-medium">{after.title}</p>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                      <p className="text-xs">Before</p>
                                      <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                                        {JSON.stringify(
                                          h.before_pages.find(
                                            (p) => p.id === after.id
                                          )?.content ?? "No prior content",
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                    <div>
                                      <p className="text-xs">After</p>
                                      <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                                        {JSON.stringify(after.content, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </details>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!data.canEdit || dirty || saving}
                              onClick={() =>
                                newDraft(
                                  h.before_pages.map((p) => ({
                                    pageId: p.id,
                                    content: p.content,
                                    level: "minor",
                                  })),
                                  `Restore content before publication ${h.id}`
                                )
                              }
                            >
                              Propose undo
                            </Button>
                          </div>
                        </details>
                      ))}
                    {!data.history.length ? (
                      <p className="text-sm text-muted-foreground">
                        No approved publications yet.
                      </p>
                    ) : null}
                    <h2 className="text-lg font-semibold">Update intake</h2>
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm">
                        Propose a structural change
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <p className="text-sm text-muted-foreground">
                          Changes to templates or the form structure need a
                          separate release and consumer migration.
                        </p>
                        <label className="grid gap-1 text-sm">
                          Proposed structure
                          <Textarea
                            value={structuralChange}
                            onChange={(e) =>
                              setStructuralChange(e.target.value)
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          Consumer migration
                          <Textarea
                            value={consumerMigration}
                            onChange={(e) =>
                              setConsumerMigration(e.target.value)
                            }
                          />
                        </label>
                        <Button
                          variant="outline"
                          disabled={
                            !data.canEdit ||
                            busy ||
                            !structuralChange.trim() ||
                            !consumerMigration.trim()
                          }
                          onClick={() =>
                            void run(async () => {
                              await okfApi("/api/okf", {
                                action: "propose-structure",
                                change: structuralChange,
                                migration: consumerMigration,
                              })
                              setStructuralChange("")
                              setConsumerMigration("")
                              setNotice(
                                "Structural proposal recorded for a separate release."
                              )
                              await reload()
                            })
                          }
                        >
                          Record structural proposal
                        </Button>
                      </div>
                    </details>
                    {data.intake
                      .filter(
                        (i) =>
                          filter === "All countries" ||
                          data.state.pages.find((p) => p.id === i.page_id)
                            ?.country === filter ||
                          i.page_id === "updates"
                      )
                      .map((i) => (
                        <details key={i.id} className="rounded-lg border p-3">
                          <summary className="cursor-pointer text-sm">
                            {i.result.classification} ·{" "}
                            {new Date(i.created_at).toLocaleString()}
                          </summary>
                          <p className="mt-2 text-sm whitespace-pre-wrap">
                            {i.note}
                          </p>
                          <p className="mt-2 text-sm">{i.result.message}</p>
                          <p className="mt-2 text-sm">{i.result.question}</p>
                          <a
                            href={okfHref(i.page_id)}
                            className="text-sm underline"
                          >
                            Context page
                          </a>
                        </details>
                      ))}
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </NotebookLayout>
      <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
        <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-2xl">
          <DialogTitle>Knowledge assistant</DialogTitle>
          <DialogDescription>
            {updates ? "Country Updates" : page.title}
          </DialogDescription>
          <section className="grid gap-3" aria-label="Knowledge assistant">
            <div className="flex flex-wrap items-center gap-3">
              <SparklesIcon className="size-4" />
              <Button
                size="sm"
                variant={assistantMode === "update" ? "secondary" : "ghost"}
                onClick={() => {
                  setAssistantMode("update")
                  setAnswer(null)
                }}
              >
                Propose a change
              </Button>
              <Button
                size="sm"
                variant={assistantMode === "question" ? "secondary" : "ghost"}
                onClick={() => {
                  setAssistantMode("question")
                  setAnswer(null)
                }}
              >
                Ask published OKF
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {assistantMode === "question"
                ? "Answers use published knowledge. Questions do not change it."
                : `Propose a change for ${updates ? "the certificate knowledge base" : `${page.country} / ${page.title}`}. Notices and rejections need explicit scope.`}
            </p>
            {correctionId ? (
              <p className="text-xs text-muted-foreground">
                Request correction attached: {correctionId}
              </p>
            ) : null}
            <Textarea
              aria-label={
                assistantMode === "question" ? "Question" : "Update notes"
              }
              placeholder={
                assistantMode === "question"
                  ? "Ask a question about published requirements…"
                  : "Type an update, paste a rejection message, or explain new evidence…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {assistantMode === "update" ? (
                <label className="text-xs">
                  Attach evidence
                  <Input
                    aria-label="Attach evidence"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.xlsx"
                    disabled={!data.canEdit || busy}
                    onChange={(e) => void attach(e.target.files)}
                    className="mt-1 max-w-64"
                  />
                </label>
              ) : (
                <span />
              )}
              <Button
                disabled={
                  !loaded ||
                  busy ||
                  dirty ||
                  (assistantMode === "update" && !data.canEdit)
                }
                onClick={() => void assistant()}
              >
                {busy
                  ? "Working…"
                  : assistantMode === "question"
                    ? "Ask question"
                    : "Propose update"}
              </Button>
            </div>
            {attachments.length ? (
              <p className="text-xs text-muted-foreground">
                Evidence: {attachments.map((a) => a.title).join(", ")}
              </p>
            ) : null}
            {answer ? (
              <div className="grid gap-3 border-t pt-4 text-sm">
                <p className="whitespace-pre-wrap">{answer.message}</p>
                {answer.question ? (
                  <p className="font-medium">{answer.question}</p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {answer.pageIds.map((id) => (
                    <a key={id} href={okfHref(id)} className="underline">
                      {data.state.pages.find((p) => p.id === id)?.title ?? id}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
          <DialogTitle>Review proposed publication</DialogTitle>
          <DialogDescription>
            Approve only the changes shown below. Published pages update
            together.
          </DialogDescription>
          {preview ? (
            <>
              <p className="text-sm">Reason: {preview.draft.reason}</p>
              <p className="text-sm">
                Source: {preview.draft.source || "Unconfirmed"}
              </p>
              {preview.stale ? (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500 p-3 text-sm"
                >
                  Published content changed after this draft was created.
                  Compare the current content below, then create a refreshed
                  draft before approving.
                </div>
              ) : null}
              {preview.comparisons.map((c) => (
                <div
                  key={c.pageId}
                  className="grid gap-3 rounded-lg border p-4"
                >
                  <p className="font-semibold">
                    {c.title} · {c.currentVersion || "First publication"} →{" "}
                    {c.proposedVersion}
                  </p>
                  {c.mappingChanged ? (
                    <span className="text-xs text-muted-foreground">
                      Field mapping changes included
                    </span>
                  ) : null}
                  {(differenceRows(c.before, c.after).length
                    ? differenceRows(c.before, c.after)
                    : [
                        {
                          key: "First publication of setup content",
                          before: "No published content",
                          after: JSON.stringify(c.after, null, 2),
                        },
                      ]
                  ).map((row) => (
                    <div key={row.key} className="grid gap-2">
                      <p className="text-xs font-medium">{row.key}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">
                            Current wording
                          </p>
                          <pre className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-xs break-words whitespace-pre-wrap">
                            {row.before}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">
                            Proposed wording
                          </p>
                          <pre className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-xs break-words whitespace-pre-wrap">
                            {row.after}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                {preview.stale ? (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setData((d) => ({ ...d, state: preview.state }))
                      const old = preview.draft
                      setPreview(null)
                      const next = {
                        ...old,
                        id: crypto.randomUUID(),
                        base_generation: preview.state.generation,
                        edit_version: 0,
                        proposer: data.userId,
                      }
                      setDraft(next)
                      draftRef.current = next
                      setSavedSignature("")
                    }}
                  >
                    Create refreshed draft from this comparison
                  </Button>
                ) : (
                  <Button
                    disabled={!data.canPublish || busy || dirty}
                    onClick={() =>
                      void run(async () => {
                        await okfApi("/api/okf", {
                          action: "publish",
                          id: preview.draft.id,
                          token: preview.token,
                        })
                        setPreview(null)
                        setDraft(null)
                        draftRef.current = null
                        setNotice(
                          "Approved changes published. Previous reviews remain unchanged; affected requests can be rechecked."
                        )
                        await reload()
                      })
                    }
                  >
                    Approve and publish
                  </Button>
                )}
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Continue editing
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
