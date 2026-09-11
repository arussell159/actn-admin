"use client"

import * as React from "react"
import { CalendarIcon, ClipboardIcon } from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CertificateField } from "@/lib/certificate-layout/schema"

function formatDateValue(date?: Date) {
  if (!date) {
    return ""
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateValue(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const date = new Date(`${value.trim()}T00:00:00`)

  return Number.isNaN(date.getTime()) ? undefined : date
}

function displayDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  return match ? `${match[2]}-${match[3]}-${match[1]}` : value
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value)
}

export function AiTextShimmer() {
  return (
    <BorderBeam
      active={false}
      size="md"
      colorVariant="colorful"
      theme="light"
      duration={3.8}
      strength={0.95}
      brightness={1.55}
      saturation={1.5}
      staticColors
      className="max-w-4xl rounded-lg"
    >
      <div
        className="min-h-9 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Analyzing…
      </div>
    </BorderBeam>
  )
}

export function CertificateFieldControl({
  field,
  value,
  isLoading = false,
  streamingValue,
  onValueChange,
}: {
  field: CertificateField
  value: string
  isLoading?: boolean
  streamingValue?: string
  onValueChange?: (value: string) => void
}) {
  const label = field.label
  const [draftValue, setDraftValue] = React.useState(value)
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false)
  const draftValueRef = React.useRef(value)
  const isDate = field.control === "date"
  const chooserOptions = field.options
  const isChooser = field.control === "select"

  React.useEffect(() => {
    setDraftValue(value)
    draftValueRef.current = value
  }, [value])

  React.useEffect(() => {
    function syncCtrlState(event: KeyboardEvent) {
      setIsCtrlPressed(event.ctrlKey)
    }
    function clearCtrlState() {
      setIsCtrlPressed(false)
    }

    window.addEventListener("keydown", syncCtrlState)
    window.addEventListener("keyup", syncCtrlState)
    window.addEventListener("blur", clearCtrlState)

    return () => {
      window.removeEventListener("keydown", syncCtrlState)
      window.removeEventListener("keyup", syncCtrlState)
      window.removeEventListener("blur", clearCtrlState)
    }
  }, [])

  function commitValue(nextValue = draftValue) {
    if (nextValue === value) return
    setDraftValue(value)
    draftValueRef.current = value
    if (onValueChange) {
      onValueChange(nextValue)
      return
    }
  }
  function copyDraftValue() {
    if (draftValueRef.current.trim()) {
      void copyText(draftValueRef.current)
    }
  }
  function copyOnCtrlClick(event: React.MouseEvent<HTMLElement>) {
    if (!event.ctrlKey || !draftValueRef.current.trim()) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    copyDraftValue()
  }

  const isMissing = !draftValue.trim()
  const isCopyCursor = isCtrlPressed && !isMissing
  const editableFieldClassName = cn(
    "h-9 pr-9 text-[15px] font-medium",
    isCopyCursor && "cursor-pointer",
    isMissing &&
      !isLoading &&
      "border-destructive/35 shadow-[0_0_0_1px_hsl(var(--destructive)/0.08),0_0_10px_hsl(var(--destructive)/0.10)] placeholder:text-destructive/60 focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
  )
  const chooserFieldClassName = cn(
    "h-9 w-full min-w-0 flex-1 cursor-pointer justify-start gap-2 px-3 text-left text-[15px] font-medium data-[size=default]:h-9",
    isMissing && !isLoading
      ? "border-destructive/35 shadow-[0_0_0_1px_hsl(var(--destructive)/0.08),0_0_10px_hsl(var(--destructive)/0.10)] hover:bg-background focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
      : "data-[empty=true]:text-muted-foreground"
  )
  const inlineCopyButton = draftValue.trim() ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label}`}
      className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground"
      onClick={copyDraftValue}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  ) : null
  const externalCopyButton = draftValue.trim() ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label}`}
      className="size-9 shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground"
      onClick={copyDraftValue}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  ) : null

  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <BorderBeam
        active={false}
        size="md"
        colorVariant="colorful"
        theme="light"
        duration={3.8}
        strength={0.95}
        brightness={1.55}
        saturation={1.5}
        staticColors
        className={cn(
          "w-full rounded-lg",
          isLoading && "pointer-events-none"
        )}
        aria-busy={isLoading || undefined}
      >
        <div className="group relative w-full rounded-lg">
          {isDate ? (
            <div className="flex min-w-0 items-center gap-1">
              <Popover
                onOpenChange={(open) => {
                  if (!open) commitValue(draftValueRef.current)
                }}
              >
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      aria-label={label}
                      aria-disabled={isLoading || undefined}
                      tabIndex={isLoading ? -1 : undefined}
                      data-empty={!draftValue}
                      className={chooserFieldClassName}
                      onClick={copyOnCtrlClick}
                    />
                  }
                >
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {displayDateValue(draftValue) ||
                    (isLoading ? "\u00a0" : "mm-dd-yyyy")}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseDateValue(draftValue)}
                    onSelect={(selectedDate) => {
                      const nextValue = formatDateValue(selectedDate)
                      setDraftValue(nextValue)
                      draftValueRef.current = nextValue
                    }}
                  />
                </PopoverContent>
              </Popover>
              {externalCopyButton}
            </div>
          ) : isChooser ? (
            <div className="flex min-w-0 items-center gap-1">
              <Select
                value={draftValue || undefined}
                onValueChange={(nextValue) => {
                  const selectedValue = nextValue ?? ""
                  setDraftValue(selectedValue)
                  draftValueRef.current = selectedValue
                  commitValue(selectedValue)
                }}
              >
                <SelectTrigger
                  aria-label={label}
                  aria-disabled={isLoading || undefined}
                  tabIndex={isLoading ? -1 : undefined}
                  className={chooserFieldClassName}
                  onClick={copyOnCtrlClick}
                  onBlur={() => commitValue(draftValueRef.current)}
                >
                  <SelectValue
                    placeholder={isLoading ? "\u00a0" : "Choose value"}
                  />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-48">
                  <SelectGroup>
                    {chooserOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {externalCopyButton}
            </div>
          ) : field.control === "textarea" ? (
            <>
              <Textarea
                value={draftValue}
                aria-label={label}
                aria-busy={isLoading || undefined}
                readOnly={isLoading}
                tabIndex={isLoading ? -1 : undefined}
                placeholder={isLoading ? "" : "Missing"}
                className={cn(editableFieldClassName, "h-auto min-h-24")}
                onClick={copyOnCtrlClick}
                onChange={(event) => {
                  setDraftValue(event.target.value)
                  draftValueRef.current = event.target.value
                }}
                onBlur={() => commitValue(draftValueRef.current)}
              />
              {inlineCopyButton}
            </>
          ) : (
            <>
              <Input
                type={field.control === "number" ? "number" : "text"}
                value={draftValue}
                placeholder={isLoading ? "" : "Missing"}
                aria-label={label}
                aria-busy={isLoading || undefined}
                readOnly={isLoading}
                tabIndex={isLoading ? -1 : undefined}
                className={editableFieldClassName}
                onClick={copyOnCtrlClick}
                onChange={(event) => {
                  setDraftValue(event.target.value)
                  draftValueRef.current = event.target.value
                }}
                onBlur={() => commitValue(draftValueRef.current)}
              />
              {inlineCopyButton}
            </>
          )}
          {isLoading && streamingValue ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-10 flex min-w-0 items-center overflow-hidden rounded-lg px-3 text-[15px] font-medium text-foreground",
                isDate && "pl-9",
                field.control === "textarea" && "items-start py-2"
              )}
              aria-live="polite"
            >
              <span className="truncate">{streamingValue}</span>
              <span className="ml-0.5 inline-block h-4 w-px shrink-0 animate-pulse bg-indigo-500/80" />
            </div>
          ) : null}
        </div>
      </BorderBeam>
    </div>
  )
}
