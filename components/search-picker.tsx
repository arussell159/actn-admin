"use client"

import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Choice = { id: string; label: string; indent?: number; pinned?: boolean }
type SearchPickerProps = {
  choices: Choice[]
  id?: string
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  listClassName?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  displayValue?: string
  footerAction?: {
    label: string
    icon?: React.ReactNode
    disabled?: boolean
    onSelect: () => void
  }
  autoOpenOnDesktop?: boolean
  focusSignal?: number
} & (
  | { multiple?: false; value: string; onValueChange: (value: string) => void }
  | {
      multiple: true
      value: string[]
      onValueChange: (value: string[]) => void
    }
)

export function SearchPicker(props: SearchPickerProps) {
  const {
    choices,
    id,
    label,
    placeholder,
    searchPlaceholder,
    emptyLabel,
    disabled,
    className,
    contentClassName,
    listClassName,
    variant = "outline",
    displayValue,
    footerAction,
    autoOpenOnDesktop,
    focusSignal,
  } = props
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const input = React.useRef<HTMLInputElement>(null)
  const selected = new Set(props.multiple ? props.value : [props.value])
  const labels = choices
    .filter((choice) => selected.has(choice.id))
    .map((choice) => choice.label)
  const filteredChoices = choices.filter(
    (choice) =>
      choice.pinned ||
      choice.label.toLowerCase().includes(query.trim().toLowerCase())
  )
  const focusSearchInput = React.useCallback(() => {
    window.requestAnimationFrame(() => input.current?.focus())
  }, [])
  React.useEffect(() => {
    if (
      (autoOpenOnDesktop || focusSignal) &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setQuery("")
      setOpen(true)
      focusSearchInput()
    }
  }, [autoOpenOnDesktop, focusSignal, focusSearchInput])
  function choose(id: string) {
    if (props.multiple)
      props.onValueChange(
        selected.has(id)
          ? props.value.filter((value) => value !== id)
          : [...props.value, id]
      )
    else {
      props.onValueChange(id)
      setOpen(false)
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          setQuery("")
          focusSearchInput()
        }
      }}
    >
      <PopoverTrigger
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return

          event.preventDefault()
          setQuery("")
          setOpen(true)
          focusSearchInput()
        }}
        render={
          <Button
            id={id}
            variant={variant}
            disabled={disabled}
            aria-label={label}
            className={cn("w-full justify-between", className)}
          />
        }
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {displayValue ??
            (labels.length
              ? labels[0] + (labels.length > 1 ? ` +${labels.length - 1}` : "")
              : placeholder)}
        </span>
        <ChevronsUpDownIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-80 max-w-[calc(100vw-2rem)] p-1", contentClassName)}
        initialFocus={input}
      >
        <Command shouldFilter={false} label={searchPlaceholder}>
          <CommandInput
            ref={input}
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className={listClassName}>
            {footerAction ? (
              !filteredChoices.length ? (
                <p role="status" className="py-6 text-center text-sm">
                  {emptyLabel}
                </p>
              ) : null
            ) : (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            )}
            {filteredChoices.map((choice) => (
              <CommandItem
                key={choice.id}
                value={`choice:${choice.id}`}
                data-checked={selected.has(choice.id)}
                onSelect={() => choose(choice.id)}
                style={
                  choice.indent
                    ? { paddingLeft: `${choice.indent * 1.25 + 0.5}rem` }
                    : undefined
                }
              >
                <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                {selected.has(choice.id) ? (
                  <span className="sr-only">selected</span>
                ) : null}
              </CommandItem>
            ))}
            {footerAction ? (
              <>
                <CommandSeparator alwaysRender />
                <CommandItem
                  value="footer-action"
                  disabled={footerAction.disabled}
                  onSelect={() => {
                    setOpen(false)
                    footerAction.onSelect()
                  }}
                >
                  {footerAction.icon}
                  {footerAction.label}
                </CommandItem>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
