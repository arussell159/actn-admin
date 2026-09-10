"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type CountryTableFilterOption = {
  id: string
  label: string
  mobileLabel?: string
  count?: number
}

export function CountryTableFilters({
  searchQuery,
  searchPlaceholder,
  searchAriaLabel,
  selectedFilter,
  filterOptions,
  action,
  mobileFiltersFullWidth = false,
  hideActionOnMobile = false,
  onSearchQueryChange,
  onSelectedFilterChange,
}: {
  searchQuery: string
  searchPlaceholder: string
  searchAriaLabel: string
  selectedFilter: string
  filterOptions: CountryTableFilterOption[]
  action?: React.ReactNode
  mobileFiltersFullWidth?: boolean
  hideActionOnMobile?: boolean
  onSearchQueryChange: (value: string) => void
  onSelectedFilterChange: (value: string) => void
}) {
  return (
    <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div
        className={cn(
          "flex flex-col gap-2 md:flex-row md:items-center",
          mobileFiltersFullWidth && "w-full md:w-auto"
        )}
      >
        <div className="relative w-full md:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 bg-background pr-9 pl-9"
            aria-label={searchAriaLabel}
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label={`Clear ${searchAriaLabel.toLowerCase()}`}
              onClick={() => onSearchQueryChange("")}
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
        </div>
        <div
          className={cn(
            "inline-flex h-9 items-center rounded-lg bg-muted p-1",
            mobileFiltersFullWidth
              ? "w-full justify-center md:w-fit md:justify-start"
              : "w-fit"
          )}
          aria-label="Country table filters"
        >
          {filterOptions.map((option) => {
            const isSelected = selectedFilter === option.id

            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 rounded-md text-sm text-muted-foreground",
                  mobileFiltersFullWidth
                    ? "flex-1 px-4 text-center md:flex-none md:px-3"
                    : "px-3",
                  isSelected &&
                    "bg-background text-foreground shadow-xs hover:bg-background"
                )}
                aria-pressed={isSelected}
                onClick={() => onSelectedFilterChange(option.id)}
              >
                {option.mobileLabel ? (
                  <>
                    <span className="md:hidden">{option.mobileLabel}</span>
                    <span className="hidden md:inline">{option.label}</span>
                  </>
                ) : (
                  option.label
                )}
                {option.count === undefined ? null : (
                  <span className="hidden text-xs tabular-nums md:inline">
                    {option.count}
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      </div>
      {action ? (
        <div className={cn("w-fit", hideActionOnMobile && "hidden md:block")}>
          {action}
        </div>
      ) : null}
    </section>
  )
}

export function CountryTableActionButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className="w-fit" {...props}>
      {children}
    </Button>
  )
}
