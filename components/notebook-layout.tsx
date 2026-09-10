"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { PageFrame } from "@/components/page-frame"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import "@/components/notebook-layout.css"

export type NotebookBreadcrumbItem = {
  id: string
  label: string
  onSelect?: () => void
}

export function NotebookTreeCaret({
  collapsed,
  label,
  onToggle,
}: {
  collapsed: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-9 shrink-0 rounded-sm hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-inherit dark:aria-expanded:bg-transparent lg:size-5"
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
      aria-expanded={!collapsed}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      tabIndex={-1}
    >
      {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
    </Button>
  )
}

export function NotebookActionTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function NotebookBreadcrumbs({
  items,
}: {
  items: NotebookBreadcrumbItem[]
}) {
  const containerRef = React.useRef<HTMLSpanElement>(null)
  const itemsRef = React.useRef(items)
  const itemSignature = items
    .map((item) => `${item.id}:${item.label}`)
    .join("|")
  const [layout, setLayout] = React.useState({
    startIndex: Math.max(0, items.length - 2),
    truncatedIndex: -1,
    truncatedWidth: 0,
  })

  itemsRef.current = items

  React.useLayoutEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const updateLayout = () => {
      const currentItems = itemsRef.current

      if (currentItems.length < 2) {
        return
      }

      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      const computedStyle = window.getComputedStyle(container)

      if (context) {
        context.font = computedStyle.font
      }

      const measureLabel = (label: string) =>
        Math.ceil(context?.measureText(label).width ?? label.length * 5.5) + 2
      const availableWidth = Math.max(0, container.clientWidth - 16)
      const separatorWidth = 10
      const currentIndex = currentItems.length - 1
      let usedWidth = measureLabel(currentItems[currentIndex].label)
      let startIndex = currentIndex
      let truncatedIndex = -1
      let truncatedWidth = 0

      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        const remainingWidth = availableWidth - usedWidth - separatorWidth

        if (remainingWidth <= 0) {
          break
        }

        const labelWidth = measureLabel(currentItems[index].label)

        if (labelWidth <= remainingWidth) {
          startIndex = index
          usedWidth += separatorWidth + labelWidth
          continue
        }

        if (index === currentIndex - 1 && remainingWidth >= 24) {
          startIndex = index
          truncatedIndex = index
          truncatedWidth = remainingWidth
        }

        break
      }

      setLayout((current) =>
        current.startIndex === startIndex &&
        current.truncatedIndex === truncatedIndex &&
        current.truncatedWidth === truncatedWidth
          ? current
          : { startIndex, truncatedIndex, truncatedWidth }
      )
    }

    updateLayout()
    const observer = new ResizeObserver(updateLayout)
    observer.observe(container)

    return () => observer.disconnect()
  }, [itemSignature])

  if (items.length === 1) {
    return <span>{items[0].label}</span>
  }

  const visibleItems = items.slice(layout.startIndex)

  return (
    <span
      ref={containerRef}
      className="mx-auto flex w-full max-w-60 min-w-0 items-center justify-center gap-1 overflow-hidden px-2 text-[10px] leading-5 font-normal text-muted-foreground/70 md:mx-0 md:max-w-none md:justify-start md:px-0 md:text-xs"
      aria-label="Notebook breadcrumb"
    >
      {visibleItems.map((item, visibleIndex) => {
        const index = layout.startIndex + visibleIndex
        const isCurrent = index === items.length - 1
        const content = item.onSelect ? (
          <button
            type="button"
            className="block max-w-full truncate rounded-sm pb-0.5 text-[10px] leading-5 font-normal text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 md:text-xs"
            onClick={item.onSelect}
          >
            {item.label}
          </button>
        ) : (
          <span className="block max-w-full truncate pb-0.5 text-[10px] leading-5 font-normal text-muted-foreground/70 md:text-xs">
            {item.label}
          </span>
        )

        return (
          <React.Fragment key={item.id}>
            {visibleIndex ? (
              <span className="shrink-0 text-muted-foreground/50">/</span>
            ) : null}
            <span
              className={cn(
                "min-w-0 overflow-hidden",
                isCurrent ? "shrink-0 whitespace-nowrap" : "shrink-0 truncate"
              )}
              style={
                index === layout.truncatedIndex
                  ? { width: layout.truncatedWidth }
                  : undefined
              }
              title={item.label}
            >
              {content}
            </span>
          </React.Fragment>
        )
      })}
    </span>
  )
}

// Notebook and certificate knowledge share the same shell and pane geometry.
export function NotebookLayout({
  ref,
  activeDocument,
  header,
  headerOverlay,
  navigation,
  loading,
  children,
}: {
  ref?: React.Ref<HTMLDivElement>
  activeDocument: boolean
  header: React.ComponentProps<typeof SiteHeader>
  headerOverlay?: React.ReactNode
  navigation: React.ReactNode
  loading?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <PageFrame
      ref={ref}
      data-mobile-note-editor={activeDocument ? "true" : undefined}
      className={cn(
        "min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] md:min-h-svh md:bg-sidebar",
        activeDocument ? "bg-background" : "bg-muted/60"
      )}
      insetClassName={cn(
        "min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] md:min-h-0 md:bg-background",
        activeDocument
          ? "bg-background lg:h-[calc(100svh-1rem)] lg:overflow-hidden"
          : "bg-muted/60"
      )}
      mainClassName={cn(
        "flex min-h-[calc(100dvh+env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px))] flex-1 flex-col md:min-h-[calc(100svh-1rem)] md:bg-background",
        activeDocument
          ? "bg-background lg:h-full lg:min-h-0 lg:overflow-hidden"
          : "bg-muted/60"
      )}
      headerPlacement="main"
      header={<SiteHeader {...header} />}
    >
      {headerOverlay}
      <div className="flex h-[calc(100svh-7rem)] min-h-[36rem] flex-1 px-0 py-0 sm:px-4 sm:py-4 lg:px-6">
        <Card
          className={cn(
            "flex min-h-0 flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 sm:rounded-lg sm:bg-card sm:shadow-sm sm:ring-1 md:overflow-hidden",
            activeDocument && "lg:overflow-hidden"
          )}
        >
          {loading ?? (
            <CardContent className="grid min-h-0 flex-1 gap-0 p-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside className="notebook-tree hidden min-h-0 flex-col border-b p-5 lg:flex lg:border-r lg:border-b-0 lg:text-sm">
                {navigation}
              </aside>
              <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden p-0 sm:p-5">
                {children}
              </section>
            </CardContent>
          )}
        </Card>
      </div>
    </PageFrame>
  )
}
