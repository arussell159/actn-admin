"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function HeaderActionMenuTrigger({
  label,
  ...props
}: {
  label: string
} & Omit<React.ComponentProps<typeof Button>, "aria-label" | "children" | "size" | "variant">) {
  return (
    <Button
      {...props}
      variant="outline"
      size="icon"
      aria-label={label}
    >
      <MoreHorizontalIcon />
    </Button>
  )
}
