"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { SiteHeaderIconButton } from "@/components/site-header"
import { Button } from "@/components/ui/button"

export function HeaderActionMenuTrigger({
  label,
  headerStyle = false,
  disabled,
  ...props
}: {
  label: string
  headerStyle?: boolean
} & Omit<React.ComponentProps<typeof Button>, "aria-label" | "children" | "size" | "variant">) {
  const headerButtonProps = props as unknown as Omit<
    React.ComponentProps<typeof SiteHeaderIconButton>,
    "label" | "children"
  >

  return headerStyle ? (
    <SiteHeaderIconButton
      {...headerButtonProps}
      label={label}
      isDisabled={disabled}
    >
      <MoreHorizontalIcon />
    </SiteHeaderIconButton>
  ) : (
    <Button
      {...props}
      disabled={disabled}
      variant="outline"
      size="icon"
      aria-label={label}
    >
      <MoreHorizontalIcon />
    </Button>
  )
}
