"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { AppLink } from "@/components/app-link"

export function NavDocuments({
  items,
  title = "User Management",
}: {
  title?: string
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const pathname = usePathname()
  const [activeQuery, setActiveQuery] = React.useState("")
  const activeRoute = pathname === "/" ? "/month-end" : pathname

  React.useEffect(() => {
    function syncActiveQuery() {
      setActiveQuery(window.location.search.replace(/^\?/, ""))
    }

    syncActiveQuery()
    window.addEventListener("popstate", syncActiveQuery)
    window.addEventListener("information-notes:navigation", syncActiveQuery)

    return () => {
      window.removeEventListener("popstate", syncActiveQuery)
      window.removeEventListener(
        "information-notes:navigation",
        syncActiveQuery
      )
    }
  }, [pathname])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const [itemPath, itemQuery = ""] = item.url.split("?")
          const isCurrentMonthRoute =
            item.name === "Current Month" &&
            itemPath === "/month-end" &&
            (activeRoute === "/month-end" ||
              activeRoute.startsWith("/month-end/"))
          const isActive =
            item.url !== "#" &&
            (isCurrentMonthRoute ||
              (activeRoute === itemPath &&
                (itemQuery ? activeQuery === itemQuery : !activeQuery)))

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                isActive={isActive}
                render={<AppLink href={item.url} />}
              >
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
