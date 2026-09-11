"use client"

import { useDraggable, useDroppable } from "@dnd-kit/core"
import { GripVerticalIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  CertificateField,
  CertificateGroup,
} from "@/lib/certificate-layout/schema"

export function LayoutDragField({
  field,
  groupId,
  library = false,
  onClick,
}: {
  field: CertificateField
  groupId?: string
  library?: boolean
  onClick: () => void
}) {
  const id = (library ? "library:" : "field:") + field.id
  const drag = useDraggable({ id, data: { fieldId: field.id, groupId } })
  const drop = useDroppable({
    id,
    disabled: library,
    data: { fieldId: field.id, groupId },
  })
  const rightDrop = useDroppable({
    id: id + ":right",
    disabled: library,
    data: { fieldId: field.id, groupId, placement: "right" },
  })
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node)
        drop.setNodeRef(node)
      }}
      data-drag-field={field.id}
      className={cn(
        "group relative flex min-w-0 items-center gap-1 rounded-md border bg-background transition-colors",
        library
          ? "border-transparent hover:border-border"
          : "hover:border-primary/50",
        drag.isDragging && "opacity-30",
        drop.isOver && "border-primary ring-2 ring-primary/20"
      )}
    >
      {!library ? (
        <div
          ref={rightDrop.setNodeRef}
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-20 flex w-1/2 items-center justify-end border-r-4 border-transparent transition-colors",
            rightDrop.isOver && "border-primary"
          )}
          aria-hidden="true"
        >
          {rightDrop.isOver ? (
            <span className="absolute top-1/2 left-full ml-2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold whitespace-nowrap text-primary-foreground shadow-lg">
              <PlusIcon className="size-3" />
              Add Column
            </span>
          ) : null}
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        aria-label={`Drag ${field.label}`}
        className={cn(
          "shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing",
          library && "justify-start"
        )}
      >
        <GripVerticalIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        onClick={onClick}
        aria-label={`${library ? "Add" : "Edit"} field ${field.label}`}
        className="h-auto min-w-0 flex-1 justify-start rounded-none px-1 py-2 text-left whitespace-normal"
      >
        <span className="text-[13px] font-medium">{field.label}</span>
      </Button>
    </div>
  )
}

export function LayoutDropSlot({ group }: { group: CertificateGroup }) {
  const drop = useDroppable({
    id: "group:" + group.id,
    data: { groupId: group.id },
  })
  return (
    <div
      ref={drop.setNodeRef}
      data-drop-group={group.id}
      role="status"
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors",
        drop.isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-primary/30 bg-primary/[0.03]"
      )}
    >
      {drop.isOver ? "Release to place" : "Drop field here"}
    </div>
  )
}
