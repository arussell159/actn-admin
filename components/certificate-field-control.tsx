"use client"

import * as React from "react"
import { CalendarIcon, ClipboardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Button as MovingBorderContainer } from "@/components/ui/moving-border"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxItem,
} from "@/components/ui/combobox"
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
    <MovingBorderContainer
      active
      as="div"
      borderRadius="0.5rem"
      duration={3800}
      containerClassName="h-auto w-full max-w-4xl"
      className="block h-auto border-transparent bg-background p-0"
    >
      <div
        className="min-h-9 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Analyzing…
      </div>
    </MovingBorderContainer>
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
  const [isDateOpen, setIsDateOpen] = React.useState(false)
  const [isChooserOpen, setIsChooserOpen] = React.useState(false)
  const [highlightedChooserIndex, setHighlightedChooserIndex] =
    React.useState(-1)
  const [calendarMonth, setCalendarMonth] = React.useState(
    () => parseDateValue(value) ?? new Date()
  )
  const [typedDay, setTypedDay] = React.useState("")
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
    "h-9 w-full min-w-0 flex-1 cursor-pointer justify-start gap-2 px-3 text-left text-[15px] font-medium data-[empty=true]:text-muted-foreground data-[size=default]:h-9",
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
      tabIndex={-1}
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
      tabIndex={-1}
      className="size-9 shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground"
      onClick={copyDraftValue}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  ) : null

  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <MovingBorderContainer
        active={isLoading}
        as="div"
        borderRadius="0.5rem"
        duration={3800}
        containerClassName={cn(
          "h-auto w-full",
          isLoading && "pointer-events-none"
        )}
        borderClassName="h-20 w-20 opacity-95"
        className="block h-auto border-transparent bg-background p-0"
        aria-busy={isLoading || undefined}
      >
        <div className="group relative w-full rounded-lg">
          {isDate ? (
            <div className="flex min-w-0 items-center gap-1">
              <Popover
                open={isDateOpen}
                onOpenChange={(open) => {
                  setIsDateOpen(open)
                  if (open) {
                    setCalendarMonth(
                      parseDateValue(draftValueRef.current) ?? new Date()
                    )
                    setTypedDay("")
                  }
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
                <PopoverContent
                  align="start"
                  className="w-auto p-0"
                  onKeyDownCapture={(event) => {
                    if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight"
                    ) {
                      event.preventDefault()
                      const direction = event.key === "ArrowLeft" ? -1 : 1
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + direction,
                            1
                          )
                      )
                      return
                    }

                    if (/^\d$/.test(event.key)) {
                      event.preventDefault()
                      setTypedDay((current) =>
                        current.length >= 2 ? event.key : current + event.key
                      )
                      return
                    }

                    if (event.key === "Backspace" && typedDay) {
                      event.preventDefault()
                      setTypedDay((current) => current.slice(0, -1))
                      return
                    }

                    if (event.key === "Enter" && typedDay) {
                      const day = Number(typedDay)
                      const daysInMonth = new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        0
                      ).getDate()

                      if (day >= 1 && day <= daysInMonth) {
                        event.preventDefault()
                        event.stopPropagation()
                        const nextValue = formatDateValue(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth(),
                            day
                          )
                        )
                        setDraftValue(nextValue)
                        draftValueRef.current = nextValue
                        commitValue(nextValue)
                        setIsDateOpen(false)
                      }
                    }
                  }}
                >
                  <Calendar
                    mode="single"
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selected={parseDateValue(draftValue)}
                    onSelect={(selectedDate) => {
                      const nextValue = formatDateValue(selectedDate)
                      setDraftValue(nextValue)
                      draftValueRef.current = nextValue
                      commitValue(nextValue)
                      setIsDateOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
              {externalCopyButton}
            </div>
          ) : isChooser ? (
            <div className="flex min-w-0 items-center gap-1">
              <Combobox
                items={chooserOptions}
                open={isChooserOpen}
                onOpenChange={(open) => {
                  setIsChooserOpen(open)
                  if (open) {
                    setHighlightedChooserIndex(
                      Math.max(0, chooserOptions.indexOf(draftValueRef.current))
                    )
                  }
                }}
                value={draftValue || null}
                onValueChange={(nextValue) => {
                  const selectedValue = nextValue ?? ""
                  setDraftValue(selectedValue)
                  draftValueRef.current = selectedValue
                  commitValue(selectedValue)
                  setIsChooserOpen(false)
                }}
              >
                <ComboboxTrigger
                  aria-label={label}
                  aria-disabled={isLoading || undefined}
                  tabIndex={isLoading ? -1 : undefined}
                  data-empty={!draftValue}
                  className={chooserFieldClassName}
                  onClick={copyOnCtrlClick}
                  onBlur={() => commitValue(draftValueRef.current)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault()
                      const direction = event.key === "ArrowDown" ? 1 : -1
                      setIsChooserOpen(true)
                      setHighlightedChooserIndex((current) => {
                        const selectedIndex = chooserOptions.indexOf(
                          draftValueRef.current
                        )
                        const startingIndex =
                          current >= 0
                            ? current
                            : selectedIndex >= 0
                              ? selectedIndex
                              : direction > 0
                                ? -1
                                : 0

                        return (
                          (startingIndex + direction + chooserOptions.length) %
                          chooserOptions.length
                        )
                      })
                      return
                    }

                    if (
                      event.key === "Enter" &&
                      isChooserOpen &&
                      highlightedChooserIndex >= 0
                    ) {
                      event.preventDefault()
                      event.stopPropagation()
                      const selectedValue =
                        chooserOptions[highlightedChooserIndex]
                      setDraftValue(selectedValue)
                      draftValueRef.current = selectedValue
                      commitValue(selectedValue)
                      setIsChooserOpen(false)
                      return
                    }

                    if (event.key === "Escape" && isChooserOpen) {
                      event.preventDefault()
                      setIsChooserOpen(false)
                    }
                  }}
                >
                  {draftValue || (isLoading ? "\u00a0" : "Choose Value")}
                </ComboboxTrigger>
                <ComboboxContent className="min-w-48">
                  {chooserOptions.map((option, optionIndex) => (
                    <ComboboxItem
                      key={option}
                      value={option}
                      index={optionIndex}
                      className={cn(
                        optionIndex === highlightedChooserIndex &&
                          "bg-accent text-accent-foreground"
                      )}
                    >
                      {option}
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </Combobox>
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
      </MovingBorderContainer>
    </div>
  )
}
