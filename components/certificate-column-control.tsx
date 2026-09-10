"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"

export function CertificateColumnControl({
  label,
  value,
  max = 4,
  compact = false,
  onChange,
}: {
  label: string
  value: number
  max?: number
  compact?: boolean
  onChange: (value: number) => void
}) {
  const control = (
    <div
      className={cn(
        "flex w-fit items-center rounded-lg border bg-background",
        compact ? "gap-1 p-0.5" : "gap-2 p-1"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={value <= 1}
        aria-label={`Remove ${label.toLowerCase().replace(/s$/, "")}`}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <MinusIcon />
      </Button>
      <div
        className="flex min-w-14 items-center justify-center gap-1"
        role="img"
        aria-label={`${value} ${value === 1 ? "column" : "columns"}`}
      >
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-4 w-2.5 rounded-[2px] border transition-colors",
              index < value
                ? "border-primary/60 bg-primary/70"
                : "border-border bg-muted/40"
            )}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={value >= max}
        aria-label={`Add ${label.toLowerCase().replace(/s$/, "")}`}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <PlusIcon />
      </Button>
    </div>
  )

  if (compact) return control

  return (
    <Field className="gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {control}
    </Field>
  )
}
