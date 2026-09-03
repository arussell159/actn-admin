"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
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
import { CircleUserRoundIcon, LogOutIcon } from "lucide-react"

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

export function SiteHeader({
  title = "Documents",
  titleContent,
  leadingContent,
  actions,
  bottomContent,
}: {
  title?: string
  titleContent?: ReactNode
  leadingContent?: ReactNode
  actions?: ReactNode
  bottomContent?: ReactNode
}) {
  useMobileScrollLock()
  const heading = titleContent ?? title

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 flex h-[calc(2.5rem+env(safe-area-inset-top,0px))] shrink-0 items-center gap-2 bg-transparent pt-[env(safe-area-inset-top,0px)] transition-[width,height] ease-linear md:relative md:z-auto md:h-auto md:min-h-(--header-height) md:flex-col md:items-stretch md:bg-background md:pt-0 group-has-data-[collapsible=icon]/sidebar-wrapper:md:min-h-(--header-height)",
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
              <Separator
                orientation="vertical"
                className="mx-1 h-4 data-vertical:self-auto"
              />
            </div>
          ) : null}
          <h1 className="min-w-0 truncate text-base font-medium">{heading}</h1>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {bottomContent ? (
          <div className="relative z-10 hidden h-9 border-b px-4 md:block lg:px-6">
            {bottomContent}
          </div>
        ) : null}
        <div className="relative z-10 grid w-full grid-cols-[2.25rem_1fr_2.25rem] items-center px-4 md:hidden">
          <span aria-hidden="true" />
          <h1 className="truncate text-center text-base font-semibold">
            {heading}
          </h1>
          <MobileProfileMenu />
        </div>
      </header>
      <MobilePullRefresh />
      <MobileTabBar />
    </>
  )
}
