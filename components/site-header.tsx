"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { useMobileScrollLock } from "@/hooks/use-mobile-scroll-lock"

export function SiteHeader({ title = "Documents" }: { title?: string }) {
  useMobileScrollLock()

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator
            orientation="vertical"
            className="mx-2 hidden h-4 data-vertical:self-auto md:block"
          />
          <h1 className="text-base font-medium">{title}</h1>
        </div>
      </header>
      <MobileTabBar />
    </>
  )
}
