"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  CheckIcon,
  FileUpIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createInformationId,
  type InformationNode,
} from "@/lib/information-notes"

type KnowledgeUpdate = {
  country: string
  title: string
  body: string
  reason: string
}

type KnowledgeProposal = {
  summary: string
  warnings: string[]
  updates: KnowledgeUpdate[]
}

function nodeText(content?: string) {
  if (!content) return ""
  try {
    const document = JSON.parse(content) as unknown
    const text: string[] = []
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return
      const value = node as { text?: string; content?: unknown[] }
      if (value.text) text.push(value.text)
      value.content?.forEach(visit)
    }
    visit(document)
    return text.join(" ").replace(/\s+/g, " ").trim()
  } catch {
    return content
  }
}

function markdownDocument(markdown: string) {
  const content = markdown.split(/\r?\n/).map((line) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (heading) {
      return {
        type: "heading",
        attrs: { textAlign: null, level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      }
    }
    const text = line.trim().replace(/^[-*]\s+/, "• ")
    return {
      type: "paragraph",
      attrs: { textAlign: null },
      content: text ? [{ type: "text", text }] : undefined,
    }
  })

  return JSON.stringify({
    type: "doc",
    content: content.length
      ? content
      : [{ type: "paragraph", attrs: { textAlign: null } }],
  })
}

function wikiSnapshot(nodes: InformationNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes
    .filter((node) => node.type === "note")
    .map((node) => {
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      return `PAGE: ${parent?.title ? `${parent.title} / ` : ""}${node.title}\n${nodeText(node.content)}`
    })
    .join("\n\n---\n\n")
}

export function KnowledgeBaseAiManager({
  nodes,
  onApply,
  draftPage,
}: {
  nodes: InformationNode[]
  onApply: (nodes: InformationNode[], firstUpdatedId?: string) => void
  draftPage?: { path: string; title: string; body: string }
}) {
  const [open, setOpen] = React.useState(false)
  const [instruction, setInstruction] = React.useState("")
  const [sourceLabel, setSourceLabel] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [proposal, setProposal] = React.useState<KnowledgeProposal>()
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  function openManager() {
    setError("")
    setProposal(undefined)
    setInstruction("")
    setOpen(true)
  }

  async function review() {
    setLoading(true)
    setError("")
    setProposal(undefined)
    try {
      const form = new FormData()
      form.set("instruction", instruction)
      form.set("sourceLabel", sourceLabel)
      form.set("wiki", wikiSnapshot(nodes))
      if (draftPage) form.set("draftPage", JSON.stringify(draftPage))
      files.forEach((file) => form.append("files", file))
      const response = await fetch("/api/knowledge-base/chat", {
        method: "POST",
        body: form,
      })
      const result = (await response.json()) as {
        ok?: boolean
        message?: string
        proposal?: KnowledgeProposal
      }
      if (!response.ok || !result.ok || !result.proposal) {
        throw new Error(
          result.message || "The AI review could not be completed."
        )
      }
      setProposal(result.proposal)
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "The AI review could not be completed."
      )
    } finally {
      setLoading(false)
    }
  }

  function applyProposal() {
    if (!proposal) return
    const timestamp = new Date().toISOString()
    const next = [...nodes]
    let firstUpdatedId: string | undefined
    let editedPageId: string | undefined

    for (const update of proposal.updates) {
      const globalPage = [
        "index",
        "country updates",
        "knowledge base guide",
      ].includes(update.title.trim().toLocaleLowerCase())
      if (globalPage) {
        const existingIndex = next.findIndex(
          (node) =>
            node.type === "note" &&
            !node.parentId &&
            node.title.toLocaleLowerCase() ===
              update.title.trim().toLocaleLowerCase()
        )
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            content: markdownDocument(update.body),
            updatedAt: timestamp,
          }
          firstUpdatedId ??= next[existingIndex].id
        } else {
          const page: InformationNode = {
            id: createInformationId(update.title),
            type: "note",
            title: update.title.trim(),
            content: markdownDocument(update.body),
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          next.push(page)
          firstUpdatedId ??= page.id
        }
        continue
      }

      const country = update.country.trim() || "Shared"
      let folder = next.find(
        (node) =>
          node.type === "folder" &&
          !node.parentId &&
          node.title.toLocaleLowerCase() === country.toLocaleLowerCase()
      )
      if (!folder) {
        folder = {
          id: createInformationId(country),
          type: "folder",
          title: country,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        next.push(folder)
      }

      const existingIndex = next.findIndex(
        (node) =>
          node.type === "note" &&
          node.parentId === folder?.id &&
          node.title.toLocaleLowerCase() ===
            update.title.trim().toLocaleLowerCase()
      )
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          content: markdownDocument(update.body),
          updatedAt: timestamp,
        }
        firstUpdatedId ??= next[existingIndex].id
        if (
          draftPage &&
          update.title.trim().toLocaleLowerCase() ===
            draftPage.title.trim().toLocaleLowerCase()
        )
          editedPageId = next[existingIndex].id
      } else {
        const page: InformationNode = {
          id: createInformationId(update.title),
          parentId: folder.id,
          type: "note",
          title: update.title.trim(),
          content: markdownDocument(update.body),
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        next.push(page)
        firstUpdatedId ??= page.id
        if (
          draftPage &&
          update.title.trim().toLocaleLowerCase() ===
            draftPage.title.trim().toLocaleLowerCase()
        )
          editedPageId = page.id
      }
    }

    onApply(next, editedPageId ?? firstUpdatedId)
    setOpen(false)
    setProposal(undefined)
    setInstruction("")
    setSourceLabel("")
    setFiles([])
  }

  return (
    <>
      <Button size="sm" className="gap-2" onClick={openManager}>
        {draftPage ? <CheckIcon /> : <SparklesIcon />}
        <span>{draftPage ? "Finish editing" : "AI Update"}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draftPage
                ? "Review page edits with AI"
                : "Update knowledge with AI"}
            </DialogTitle>
            <DialogDescription>
              {draftPage
                ? "Your typing is an unreviewed draft. AI reconciles it with the structured OKF and proposes every affected page; nothing changes until you approve it."
                : "Add a source, correction or procedure change. AI checks the whole wiki and proposes every affected page; nothing changes until you approve it."}
            </DialogDescription>
          </DialogHeader>

          {!proposal ? (
            <div className="grid gap-4">
              <Input
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                placeholder="Source title or URL (optional)"
              />
              <Textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={
                  draftPage
                    ? "Optional: explain what you intended to change…"
                    : "Paste new requirements, explain a correction, or tell AI what changed…"
                }
                className="min-h-36 resize-y"
              />
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors hover:bg-muted/50">
                <FileUpIcon className="size-5 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {files.length
                    ? `${files.length} source file${files.length === 1 ? "" : "s"} selected`
                    : "Attach PDFs, screenshots, text or spreadsheets"}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.xlsx"
                  className="sr-only"
                  onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []))
                  }
                />
              </label>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-medium">{proposal.summary}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {proposal.updates.length} page
                  {proposal.updates.length === 1 ? "" : "s"} will be updated.
                </p>
              </div>
              {proposal.warnings.length ? (
                <div className="grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  {proposal.warnings.map((warning) => (
                    <p key={warning} className="flex gap-2 text-sm">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="divide-y rounded-lg border">
                {proposal.updates.map((update, index) => (
                  <div
                    key={`${update.country}-${update.title}-${index}`}
                    className="p-3"
                  >
                    <div className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {update.country} / {update.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {update.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {proposal ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setProposal(undefined)}
                >
                  Back
                </Button>
                {proposal.updates.length ? (
                  <Button onClick={applyProposal}>
                    Apply {proposal.updates.length} updates
                  </Button>
                ) : (
                  <Button onClick={() => setOpen(false)}>
                    Return to draft
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={review}
                disabled={
                  loading ||
                  (!draftPage && !instruction.trim() && !files.length)
                }
              >
                {loading ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <SparklesIcon />
                )}
                {loading
                  ? "Reviewing entire knowledge base…"
                  : "Review proposed updates"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
