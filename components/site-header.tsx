"use client"

import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AppHeaderTargetContext } from "@/components/app-shell-context"
import { useRouter } from "next/navigation"
import { AppLink } from "@/components/app-link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/client"
import { ArrowLeftIcon, CircleUserRoundIcon, LogOutIcon } from "lucide-react"

export const siteHeaderGlassButtonClassName =
  "relative isolate size-10 overflow-hidden rounded-full border-white/50 bg-background/65 shadow-[0_8px_24px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(15,23,42,0.05)] backdrop-blur-2xl before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.04))] hover:bg-background/75 supports-backdrop-filter:bg-background/50 dark:border-white/15 dark:bg-background/40 dark:shadow-[0_8px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:bg-background/55"

export function SiteHeaderBackButton({
  label = "Back",
  href,
  onClick,
}: {
  label?: string
  href?: string
  onClick?: () => void
}) {
  return (
    <Button
      type={href ? undefined : "button"}
      variant="outline"
      size="icon-lg"
      className={siteHeaderGlassButtonClassName}
      data-site-header-back=""
      aria-label={label}
      render={href ? <AppLink href={href} /> : undefined}
      onClick={onClick}
    >
      <ArrowLeftIcon className="size-4.5" />
    </Button>
  )
}

function MobileProfileMenu() {
  const router = useRouter()

  function signOut() {
    const supabase = createClient()
    router.replace("/login")
    void supabase.auth.signOut().finally(() => {
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-10 place-items-center rounded-full text-foreground transition-colors active:bg-muted"
        aria-label="Open profile menu"
        title="Profile"
      >
        <CircleUserRoundIcon className="size-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-40">
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeaderContent({
  title = "Documents",
  titleContent,
  leadingContent,
  mobileLeadingContent,
  mobileTrailingContent,
  actions,
}: {
  title?: string
  titleContent?: ReactNode
  leadingContent?: ReactNode
  mobileLeadingContent?: ReactNode
  mobileTrailingContent?: ReactNode
  actions?: ReactNode
  bottomContent?: ReactNode
}) {
  const heading = titleContent ?? title

  return (
    <div
      className={cn(
        "app-header-content flex shrink-0 items-center gap-2 md:flex-col md:items-stretch md:bg-background",
        "md:border-b"
      )}
    >
      <div
        className={cn(
          "relative z-10 hidden h-(--header-height) w-full items-center gap-3 px-4 md:grid lg:px-6",
          leadingContent
            ? "grid-cols-[auto_minmax(0,1fr)_auto]"
            : actions
              ? "grid-cols-[minmax(0,1fr)_auto]"
              : "grid-cols-1"
        )}
      >
        {leadingContent ? (
          <div className="flex min-w-8 items-center gap-2">
            {leadingContent}
            <span
              aria-hidden="true"
              className="mx-1 h-4 w-px shrink-0 self-center bg-border"
            />
          </div>
        ) : null}
        <h1 className="min-w-0 truncate text-base font-medium">{heading}</h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="relative z-10 grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center px-4 md:hidden">
        {mobileLeadingContent ? (
          <div className="grid size-10 place-items-center">
            {mobileLeadingContent}
          </div>
        ) : (
          <span aria-hidden="true" />
        )}
        <h1 className="truncate text-center text-base font-semibold">
          {heading}
        </h1>
        {mobileTrailingContent ? (
          <div className="grid size-10 place-items-center">
            {mobileTrailingContent}
          </div>
        ) : (
          <MobileProfileMenu />
        )}
      </div>
    </div>
  )
}

export function SiteHeader(props: Parameters<typeof SiteHeaderContent>[0]) {
  const target = useContext(AppHeaderTargetContext)
  const { bottomContent, ...headerProps } = props
  return (
    <>
      {target
        ? createPortal(<SiteHeaderContent {...headerProps} />, target)
        : null}
      {bottomContent ? (
        <div className="hidden h-9 shrink-0 border-b px-4 md:block lg:px-6">
          {bottomContent}
        </div>
      ) : null}
    </>
  )
}
