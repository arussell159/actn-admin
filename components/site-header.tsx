"use client"

import type { ComponentProps, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CloseButton } from "@heroui/react"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { MobilePullRefresh } from "@/components/mobile-pull-refresh"
import { useMobileScrollLock } from "@/hooks/use-mobile-scroll-lock"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/client"
import { ArrowLeftIcon, CircleUserRoundIcon, LogOutIcon } from "lucide-react"

export const siteHeaderGlassButtonClassName =
  "grid size-10 shrink-0 place-items-center rounded-full border border-white bg-white text-slate-950 shadow-sm transition-colors hover:bg-white/90 pressed:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5"

export function SiteHeaderIconButton({
  label,
  children,
  className,
  ...props
}: {
  label: string
  children: ReactNode
} & Omit<ComponentProps<typeof CloseButton>, "aria-label" | "children">) {
  return (
    <CloseButton
      {...props}
      aria-label={label}
      className={cn(siteHeaderGlassButtonClassName, className)}
    >
      {children}
    </CloseButton>
  )
}

export function SiteHeaderBackButton({
  label = "Back",
  href,
  onClick,
}: {
  label?: string
  href?: string
  onClick?: () => void
}) {
  const router = useRouter()

  return (
    <SiteHeaderIconButton
      label={label}
      data-site-header-back=""
      onPress={href ? () => router.push(href) : onClick}
    >
      <ArrowLeftIcon className="size-4.5" />
    </SiteHeaderIconButton>
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
        render={
          <SiteHeaderIconButton label="Open profile menu">
            <CircleUserRoundIcon />
          </SiteHeaderIconButton>
        }
      >
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

export function SiteHeader({
  title = "Documents",
  titleContent,
  leadingContent,
  mobileLeadingContent,
  mobileTrailingContent,
  actions,
  bottomContent,
  headingAs = "h1",
}: {
  title?: string
  titleContent?: ReactNode
  leadingContent?: ReactNode
  mobileLeadingContent?: ReactNode
  mobileTrailingContent?: ReactNode
  actions?: ReactNode
  bottomContent?: ReactNode
  headingAs?: "h1" | "div"
}) {
  useMobileScrollLock()
  const heading = titleContent ?? title
  const Heading = headingAs

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 flex h-[calc(2.5rem+env(safe-area-inset-top,0px))] shrink-0 items-center gap-2 bg-transparent pt-[env(safe-area-inset-top,0px)] md:relative md:z-auto md:h-auto md:min-h-(--header-height) md:flex-col md:items-stretch md:bg-background md:pt-0 group-has-data-[collapsible=icon]/sidebar-wrapper:md:min-h-(--header-height)",
          bottomContent ? "md:border-b-0" : "md:border-b"
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[calc(4rem+env(safe-area-inset-top,0px))] bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--background)_75%,transparent),color-mix(in_oklch,var(--background)_35%,transparent)_55%,transparent)] md:hidden"
          aria-hidden="true"
        />
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
          <Heading className="min-w-0 truncate text-base font-medium">
            {heading}
          </Heading>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {bottomContent ? (
          <div className="relative z-10 hidden min-h-9 border-b px-4 md:block lg:px-6">
            {bottomContent}
          </div>
        ) : null}
        <div className="relative z-10 grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center px-4 md:hidden">
          {mobileLeadingContent ? (
            <div className="grid size-10 place-items-center">
              {mobileLeadingContent}
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
          <Heading className="truncate text-center text-base font-semibold">
            {heading}
          </Heading>
          {mobileTrailingContent ? (
            <div className="grid size-10 place-items-center">
              {mobileTrailingContent}
            </div>
          ) : (
            <MobileProfileMenu />
          )}
        </div>
      </header>
      <MobilePullRefresh />
      <MobileTabBar />
    </>
  )
}
