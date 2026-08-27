"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { MobilePullRefresh } from "@/components/mobile-pull-refresh"
import { useMobileScrollLock } from "@/hooks/use-mobile-scroll-lock"
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

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
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
}: {
  title?: string
  titleContent?: ReactNode
}) {
  useMobileScrollLock()
  const heading = titleContent ?? title

  return (
    <>
      <header className="sticky top-0 z-40 flex h-10 shrink-0 items-center gap-2 bg-transparent transition-[width,height] ease-linear md:relative md:z-auto md:h-(--header-height) md:border-b md:bg-background group-has-data-[collapsible=icon]/sidebar-wrapper:md:h-(--header-height)">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--background)_75%,transparent),color-mix(in_oklch,var(--background)_35%,transparent)_55%,transparent)] md:hidden"
          aria-hidden="true"
        />
        <div className="relative z-10 hidden w-full items-center gap-1 px-4 md:flex lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator
            orientation="vertical"
            className="mx-2 hidden h-4 data-vertical:self-auto md:block"
          />
          <h1 className="min-w-0 text-base font-medium">{heading}</h1>
        </div>
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
