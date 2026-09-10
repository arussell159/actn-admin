"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

type PageFrameProps = Omit<
  React.ComponentProps<typeof SidebarProvider>,
  "children"
> & {
  header: React.ReactNode
  children: React.ReactNode
  insetClassName?: string
  mainClassName?: string
  headerPlacement?: "main" | "inset"
}

// One sidebar/provider per page. Keep route state in the owning view, and allow
// document editors and the quote tool to retain their existing scroll containers.
export function PageFrame({
  header,
  children,
  insetClassName,
  mainClassName = "flex min-h-0 flex-1 flex-col bg-background",
  headerPlacement = "inset",
  style,
  ...providerProps
}: PageFrameProps) {
  return (
    <SidebarProvider
      {...providerProps}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
          ...style,
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className={insetClassName}>
        {headerPlacement === "inset" ? header : null}
        <div data-page-frame-content className={mainClassName}>
          {headerPlacement === "main" ? header : null}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
