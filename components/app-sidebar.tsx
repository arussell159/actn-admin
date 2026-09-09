"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"

import { AppLink } from "@/components/app-link"
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
  CalendarClockIcon,
  CalculatorIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PinOffIcon,
  PlusIcon,
  ScanTextIcon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
} from "lucide-react"
import {
  getPinnedInformationNodes,
  getInformationNotes,
  informationUpdatedEvent,
  saveInformationNotes,
} from "@/lib/information-notes"
import { listMonthEndRecords } from "@/lib/month-end-db"
import { bscCountryModules } from "@/lib/bsc-country-modules"

const data = {
  user: {
    name: "Africa CTN",
    email: "monthend@africactn.com",
    avatar: "/avatars/shadcn.jpg",
  },
  dashboard: [
    {
      name: "Previous Months",
      url: "/previous-month-ends",
      icon: <HistoryIcon />,
    },
  ],
}
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [pinnedItems, setPinnedItems] = React.useState<
    { id: string; name: string; url: string; icon: React.ReactNode }[]
  >([])
  const [hasOpenMonthEnd, setHasOpenMonthEnd] = React.useState(true)
  const [activeQuery, setActiveQuery] = React.useState("")
  const activeRoute = pathname === "/" ? "/dashboard" : pathname
  const monthEndItems = [
    hasOpenMonthEnd
      ? {
          name: "Current Month",
          url: "/month-end",
          icon: <CalendarClockIcon />,
        }
      : {
          name: "Create Month End",
          url: "/month-end/new",
          icon: <PlusIcon />,
        },
    ...data.dashboard,
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

  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      return
    }

    async function syncMonthEndItems() {
      try {
        const records = await listMonthEndRecords()
        setHasOpenMonthEnd(records.some((record) => record.status === "Open"))
      } catch {}
    }

    syncMonthEndItems()
    window.addEventListener("month-end:records-updated", syncMonthEndItems)

    return () =>
      window.removeEventListener("month-end:records-updated", syncMonthEndItems)
  }, [])

  async function unpinItem(nodeId: string) {
    const notes = await getInformationNotes()

    saveInformationNotes(
      notes.map((node) =>
        node.id === nodeId
          ? { ...node, pinned: false, updatedAt: new Date().toISOString() }
          : node
      )
    )
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
    const isCurrentMonthRoute =
      name === "Current Month" &&
      itemPath === "/month-end" &&
      (activeRoute === "/month-end" || activeRoute.startsWith("/month-end/"))

    return (
      url !== "#" &&
      (isCurrentMonthRoute ||
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
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background">
                  <Image
                    src="/actn-admin-icon.png"
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 object-contain"
                    priority
                  />
                </span>
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
          <SidebarGroupLabel>Month End</SidebarGroupLabel>
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActiveUrl("/knowledge-base")}
                  render={<AppLink href="/knowledge-base" />}
                >
                  <SparklesIcon />
                  <span>{module.rulesLabel}</span>
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
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActiveUrl("/template-builder")}
                render={<AppLink href="/template-builder" />}
              >
                <Settings2Icon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
