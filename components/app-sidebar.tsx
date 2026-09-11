"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { AppLink } from "@/components/app-link"
import { AppLogo } from "@/components/app-logo"
import { openAppCommandMenuEvent } from "@/lib/app-command-menu"
import { NavUser } from "@/components/nav-user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  BookOpenTextIcon,
  CalculatorIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LibraryBigIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PinOffIcon,
  PlusIcon,
  ScanTextIcon,
  SearchIcon,
} from "lucide-react"
import {
  getPinnedInformationNodes,
  getInformationNotes,
  informationUpdatedEvent,
  saveInformationNotes,
} from "@/lib/information-notes"
import { bscCountryModules } from "@/lib/bsc-country-modules"
import { settingsPages } from "@/lib/app-routes"

const data = {
  user: {
    name: "Africa CTN",
    email: "monthend@africactn.com",
    avatar: "/avatars/shadcn.jpg",
  },
}
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [pinnedItems, setPinnedItems] = React.useState<
    { id: string; name: string; url: string; icon: React.ReactNode }[]
  >([])
  const [activeQuery, setActiveQuery] = React.useState("")
  const activeRoute = pathname === "/" ? "/dashboard" : pathname
  const monthEndItems = [
    {
      name: "New Month End",
      url: "/month-end/new",
      icon: <PlusIcon />,
    },
    {
      name: "Month End",
      url: "/month-end",
      icon: <HistoryIcon />,
    },
  ]

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

  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      return
    }

    async function syncPinnedItems() {
      const notes = await getInformationNotes()

      setPinnedItems(
        getPinnedInformationNodes(notes).map((node) => ({
          id: node.id,
          name: node.title,
          url: `/information?node=${encodeURIComponent(node.id)}`,
          icon: node.type === "folder" ? <FolderIcon /> : <FileTextIcon />,
        }))
      )
    }

    syncPinnedItems()
    window.addEventListener(informationUpdatedEvent, syncPinnedItems)

    return () =>
      window.removeEventListener(informationUpdatedEvent, syncPinnedItems)
  }, [])

  async function unpinItem(nodeId: string) {
    const notes = await getInformationNotes()

    void saveInformationNotes(
      notes.map((node) =>
        node.id === nodeId
          ? { ...node, pinned: false, updatedAt: new Date().toISOString() }
          : node
      )
    ).catch(() => {})
  }

  function isActiveUrl(url: string) {
    const [itemPath, itemQuery = ""] = url.split("?")

    return (
      url !== "#" &&
      activeRoute === itemPath &&
      (itemQuery ? activeQuery === itemQuery : !activeQuery)
    )
  }

  function isActiveMonthEndUrl(url: string, name: string) {
    const [itemPath, itemQuery = ""] = url.split("?")
    const isMonthEndRoute =
      name === "Month End" &&
      (activeRoute === "/month-end" ||
        activeRoute === "/previous-month-ends" ||
        activeRoute.startsWith("/previous-month-ends/"))

    return (
      url !== "#" &&
      (isMonthEndRoute ||
        (activeRoute === itemPath &&
          (itemQuery ? activeQuery === itemQuery : !activeQuery)))
    )
  }

  function openSearch() {
    window.dispatchEvent(new Event(openAppCommandMenuEvent))
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="data-[slot=sidebar-menu-button]:p-1.5!"
                render={<AppLink href="/month-end" />}
              >
                <AppLogo priority />
                <span className="text-base font-semibold">ACTN Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="size-8 shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActiveUrl("/dashboard")}
                render={<AppLink href="/dashboard" />}
              >
                <LayoutDashboardIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Accounting</SidebarGroupLabel>
          <SidebarMenu>
            {monthEndItems.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  isActive={isActiveMonthEndUrl(item.url, item.name)}
                  render={<AppLink href={item.url} />}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {bscCountryModules.map((module) => (
          <SidebarGroup key={module.id}>
            <SidebarGroupLabel>{module.label}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActiveUrl(`${module.basePath}/new`)}
                  render={<AppLink href={`${module.basePath}/new`} />}
                >
                  <ScanTextIcon />
                  <span>{module.newRequestLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActiveUrl(`${module.basePath}/requests`)}
                  render={<AppLink href={`${module.basePath}/requests`} />}
                >
                  <ListChecksIcon />
                  <span>{module.requestsLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupLabel>Utilities</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActiveUrl("/quote-tool")}
                render={<AppLink href="/quote-tool" />}
              >
                <CalculatorIcon />
                <span>Quote Tool</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActiveUrl("/information")}
                render={<AppLink href="/information" />}
              >
                <BookOpenTextIcon />
                <span>Notebook</span>
              </SidebarMenuButton>
              {pinnedItems.length ? (
                <SidebarMenuSub>
                  {pinnedItems.map((item) => (
                    <SidebarMenuSubItem
                      key={item.id}
                      className="group/menu-item"
                    >
                      <SidebarMenuSubButton
                        isActive={isActiveUrl(item.url)}
                        className="pr-8"
                        render={<AppLink href={item.url} />}
                      >
                        {item.icon}
                        <span>{item.name}</span>
                      </SidebarMenuSubButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              showOnHover
                              aria-label={`Actions for ${item.name}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-32">
                          <DropdownMenuItem onClick={() => unpinItem(item.id)}>
                            <PinOffIcon />
                            Unpin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              ) : null}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActiveUrl("/knowledge-base")}
                render={<AppLink href="/knowledge-base" />}
              >
                <LibraryBigIcon />
                <span>Knowledge Base</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsPages.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={activeRoute === item.href}
                  render={
                    <AppLink
                      href={item.href}
                      aria-current={
                        activeRoute === item.href ? "page" : undefined
                      }
                    />
                  }
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openSearch}>
              <SearchIcon />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
