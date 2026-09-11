"use client"

import { ChevronRightIcon, FileTextIcon, FolderIcon } from "lucide-react"
import { NotebookTreeCaret } from "@/components/notebook-layout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KnowledgePage } from "@/lib/okf/schema"

export type KnowledgeNode = {
  id: string
  title: string
  parent?: string
  folder?: boolean
}
export const knowledgeRoot = "knowledge"

export function knowledgeNodes(
  pages: KnowledgePage[],
  certificateCountries: string[] = []
): KnowledgeNode[] {
  return [
    ...[
      ...new Set(
        [
          ...pages.filter((p) => p.country !== "Shared").map((p) => p.country),
          ...certificateCountries,
        ].filter(Boolean)
      ),
    ]
      .sort((a, b) => a.localeCompare(b))
      .flatMap((country) => {
        const id = "country-" + country.toLowerCase()
        const countryPages = pages.filter((p) => p.country === country)
        return [
          { id, title: country, folder: true },
          ...countryPages
            .filter((p) => ["overview", "process"].includes(p.template))
            .map((p) => ({
              id: p.id,
              title: p.template === "overview" ? "Required Documents" : p.title,
              parent: id,
            })),
          ...(countryPages.some((p) => p.template === "document")
            ? [
                {
                  id: id + "-documents",
                  title: "Documents",
                  parent: id,
                  folder: true,
                },
              ]
            : []),
          ...countryPages
            .filter((p) => p.template === "document")
            .map((p) => ({
              id: p.id,
              title: p.title,
              parent: id + "-documents",
            })),
        ]
      }),
    { id: "updates", title: "Country Updates" },
  ]
}

export function knowledgePath(nodes: KnowledgeNode[], id: string) {
  const path: KnowledgeNode[] = []
  let node = nodes.find((n) => n.id === id)
  while (node) {
    path.unshift(node)
    node = nodes.find((n) => n.id === node?.parent)
  }
  return path
}

export function KnowledgeTree({
  nodes,
  activeId,
  onSelect,
  collapsed,
  onToggle,
  parent,
  level = 0,
}: {
  nodes: KnowledgeNode[]
  activeId: string
  onSelect: (id: string) => void
  collapsed: Set<string>
  onToggle: (id: string) => void
  parent?: string
  level?: number
}) {
  return (
    <div className="notebook-tree grid gap-2 lg:gap-1">
      {nodes
        .filter((n) => n.parent === parent)
        .map((node) => (
          <div key={node.id}>
            <div
              className={cn(
                "group flex min-h-12 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)] lg:min-h-0 lg:gap-0 lg:rounded-md lg:px-1 lg:py-0 lg:hover:bg-muted/70",
                activeId === node.id &&
                  "bg-[color-mix(in_oklch,var(--muted),var(--foreground)_10%)] lg:bg-muted"
              )}
              style={{ marginLeft: `${level * 0.95}rem` }}
            >
              {node.folder ? (
                <NotebookTreeCaret
                  collapsed={collapsed.has(node.id)}
                  label={node.title}
                  onToggle={() => onToggle(node.id)}
                />
              ) : (
                <span
                  className="size-9 shrink-0 lg:size-5"
                  aria-hidden="true"
                />
              )}
              <Button
                variant="ghost"
                className="h-10 min-w-0 flex-1 justify-start px-2 text-[15px] hover:bg-transparent lg:h-7 lg:rounded-sm lg:px-1.5 lg:text-sm lg:font-normal"
                aria-current={activeId === node.id ? "page" : undefined}
                title={node.title}
                onClick={() => onSelect(node.id)}
              >
                <span className="truncate">{node.title}</span>
              </Button>
            </div>
            {node.folder && !collapsed.has(node.id) ? (
              <KnowledgeTree
                nodes={nodes}
                activeId={activeId}
                onSelect={onSelect}
                collapsed={collapsed}
                onToggle={onToggle}
                parent={node.id}
                level={level + 1}
              />
            ) : null}
          </div>
        ))}
    </div>
  )
}

export function KnowledgeFolder({
  nodes,
  id,
  onSelect,
}: {
  nodes: KnowledgeNode[]
  id: string
  onSelect: (id: string) => void
}) {
  const children = nodes.filter(
    (n) => n.parent === (id === knowledgeRoot ? undefined : id)
  )
  return (
    <div className="notebook-tree relative min-h-full overflow-auto bg-muted/60 px-4 pt-4 pb-24 md:bg-background md:px-0 md:pt-0">
      <h1 className="text-[30pt] leading-tight font-bold tracking-tight text-foreground md:text-3xl">
        {nodes.find((n) => n.id === id)?.title ?? "Knowledge Base"}
      </h1>
      <div className="mt-5 overflow-hidden rounded-2xl bg-background md:border">
        {children.map((node, index) => (
          <button
            key={node.id}
            type="button"
            className="relative flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted/50 active:bg-muted"
            onClick={() => onSelect(node.id)}
          >
            {node.folder ? (
              <FolderIcon className="size-6 shrink-0 text-yellow-500" />
            ) : (
              <FileTextIcon className="size-6 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 text-lg font-medium">
              {node.title}
            </span>
            {node.folder ? (
              <span className="text-lg text-muted-foreground">
                {nodes.filter((n) => n.parent === node.id).length}
              </span>
            ) : null}
            <ChevronRightIcon className="size-6 shrink-0 text-muted-foreground" />
            {index < children.length - 1 ? (
              <span className="absolute right-0 bottom-0 left-13 h-px bg-border/60" />
            ) : null}
          </button>
        ))}
      </div>
      <p className="mt-3 px-1 text-sm text-muted-foreground">
        {children.length} entries
      </p>
    </div>
  )
}
