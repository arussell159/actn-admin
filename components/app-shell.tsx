"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeaderTargetContext } from "@/components/app-shell-context"
import { SiteHeaderContent } from "@/components/site-header"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { MobilePullRefresh } from "@/components/mobile-pull-refresh"
import { MobileAppGuard } from "@/components/mobile-app-guard"
import { RouteScrollReset } from "@/components/route-scroll-reset"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAppKeyboardViewport } from "@/hooks/use-app-keyboard-viewport"

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/information": "Notebook",
  "/month-end": "Month End",
  "/month-end/new": "Create Month End",
  "/month-end/country": "Country Records",
  "/previous-month-ends": "Previous Months",
  "/previous-month-ends/view": "Previous Month",
  "/pricing-upload": "Pricing Upload",
  "/quote-tool": "Quote Tool",
  "/template-builder": "Template Builder",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [headerTarget, setHeaderTarget] = React.useState<HTMLDivElement | null>(
    null
  )
  useAppKeyboardViewport()
  return (
    <AppHeaderTargetContext.Provider value={headerTarget}>
      <SidebarProvider
        className="app-shell"
        data-app-shell=""
        style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset className="app-inset">
          <header className="app-header" data-app-header="">
            <div className="app-header-slot" ref={setHeaderTarget} />
            <div className="app-header-fallback">
              <SiteHeaderContent
                title={routeTitles[pathname] ?? "ACTN Admin"}
              />
            </div>
          </header>
          <div className="app-scroll" data-app-scroll="" tabIndex={-1}>
            <div className="app-route" data-app-route="">
              {children}
            </div>
          </div>
        </SidebarInset>
        <MobileTabBar />
        <MobilePullRefresh />
        <MobileAppGuard />
        <React.Suspense fallback={null}>
          <RouteScrollReset />
        </React.Suspense>
      </SidebarProvider>
    </AppHeaderTargetContext.Provider>
  )
}
