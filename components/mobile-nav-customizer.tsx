"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripIcon, MinusIcon, PlusIcon, type LucideIcon } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type MobileNavCustomizerItem = {
  label: string
  href: string
  icon: LucideIcon
}

function SortableDockRow({
  item,
  onRemove,
}: {
  item: MobileNavCustomizerItem
  onRemove: (href: string) => void
}) {
  const Icon = item.icon
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl bg-background px-3",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <button
        type="button"
        className="grid size-9 shrink-0 touch-none place-items-center rounded-full text-muted-foreground"
        aria-label={`Reorder ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon className="size-5" />
      </button>
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 font-medium">{item.label}</span>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-primary"
        onClick={() => onRemove(item.href)}
        aria-label={`Move ${item.label} to More`}
      >
        <MinusIcon className="size-5" />
      </button>
    </div>
  )
}

export function MobileNavCustomizer({
  dockItems,
  moreItems,
  dockHrefs,
  maxDockItems,
  onDockHrefsChange,
}: {
  dockItems: MobileNavCustomizerItem[]
  moreItems: MobileNavCustomizerItem[]
  dockHrefs: string[]
  maxDockItems: number
  onDockHrefsChange: (hrefs: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function toggleDockItem(href: string) {
    onDockHrefsChange(
      dockHrefs.includes(href)
        ? dockHrefs.filter((itemHref) => itemHref !== href)
        : [...dockHrefs, href]
    )
  }

  function handleDockDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = dockHrefs.indexOf(String(active.id))
    const newIndex = dockHrefs.indexOf(String(over.id))

    if (oldIndex >= 0 && newIndex >= 0) {
      onDockHrefsChange(arrayMove(dockHrefs, oldIndex, newIndex))
    }
  }

  return (
    <div className="grid max-h-[calc(95svh-5rem)] gap-6 overflow-auto px-5 pt-4 pb-8">
      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dock</h2>
          <span className="text-sm text-muted-foreground">
            {dockHrefs.length}/{maxDockItems}
          </span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDockDragEnd}
        >
          <SortableContext
            items={dockHrefs}
            strategy={verticalListSortingStrategy}
          >
            <div className="overflow-hidden rounded-xl border bg-background">
              {dockItems.map((item, index) => (
                <React.Fragment key={item.href}>
                  {index > 0 ? <Separator /> : null}
                  <SortableDockRow item={item} onRemove={toggleDockItem} />
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">More</h2>
        <div className="overflow-hidden rounded-xl border bg-background">
          {moreItems.map((item, index) => {
            const Icon = item.icon
            const canAddToDock = dockHrefs.length < maxDockItems

            return (
              <React.Fragment key={item.href}>
                {index > 0 ? <Separator /> : null}
                <div className="flex min-h-14 items-center gap-3 rounded-xl px-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 font-medium">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-primary disabled:text-muted-foreground"
                    disabled={!canAddToDock}
                    onClick={() => toggleDockItem(item.href)}
                    aria-label={`Move ${item.label} to Dock`}
                  >
                    <PlusIcon className="size-5" />
                  </button>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </section>
    </div>
  )
}
