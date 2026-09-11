"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function FileDropWorkspace({
  title,
  description,
  icon,
  actions,
  footer,
  onChooseFile,
  onFiles,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon: React.ReactNode
  actions: React.ReactNode
  footer?: React.ReactNode
  onChooseFile: () => void
  onFiles: (files: File[]) => void
  className?: string
}) {
  const [isDragging, setIsDragging] = React.useState(false)

  return (
    <section
      role="button"
      tabIndex={0}
      className={cn(
        "grid min-h-[22rem] cursor-pointer place-items-center rounded-xl border border-dashed bg-background p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[26rem]",
        isDragging ? "border-primary bg-muted/60" : "hover:bg-muted/40",
        className
      )}
      onClick={onChooseFile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onChooseFile()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        const files = Array.from(event.dataTransfer.files ?? [])

        if (files.length) {
          onFiles(files)
        }
      }}
    >
      <div className="grid max-w-xl gap-4">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
          {description ? (
            <div className="mt-2 text-sm text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
        {footer ? (
          <div className="text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </section>
  )
}
