"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { CloseButton } from "@heroui/react"
import {
  BookOpenTextIcon,
  CalculatorIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  LibraryBigIcon,
  ListChecksIcon,
  HistoryIcon,
  MenuIcon,
  PlusIcon,
  ScanTextIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  getMobileNavDockHrefs,
  saveMobileNavDockHrefs,
} from "@/lib/mobile-nav-settings"
import {
  mobileNavActiveIndicatorPendingStorageKey,
  mobileNavActiveIndicatorStorageKey,
} from "@/lib/mobile-nav-active-state"
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"
import { cn } from "@/lib/utils"
import { bscCountryModules } from "@/lib/bsc-country-modules"
import { settingsPages } from "@/lib/app-routes"

const maxDockItems = 4

const allModuleItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    match: ["/", "/dashboard"],
    section: "Main",
  },
  {
    label: "Month End",
    href: "/month-end",
    icon: HistoryIcon,
    match: ["/previous-month-ends", "/month-end", "/month-end/country"],
    section: "Accounting",
  },
  {
    label: "Quote Tool",
    href: "/quote-tool",
    icon: CalculatorIcon,
    match: ["/quote-tool"],
    section: "Utilities",
  },
  {
    label: "Notebook",
    href: "/information",
    icon: BookOpenTextIcon,
    match: ["/information"],
    section: "Utilities",
  },
  {
    label: "New Month End",
    href: "/month-end/new",
    icon: PlusIcon,
    match: ["/month-end/new"],
    section: "Accounting",
  },
  {
    label: "Knowledge Base",
    href: "/knowledge-base",
    icon: LibraryBigIcon,
    match: ["/knowledge-base"],
    section: "Utilities",
  },
  ...bscCountryModules.flatMap((module) => [
    {
      label: module.newRequestLabel,
      href: `${module.basePath}/new`,
      icon: ScanTextIcon,
      match: [`${module.basePath}/new`],
      section: module.label,
    },
    {
      label: module.requestsLabel,
      href: `${module.basePath}/requests`,
      icon: ListChecksIcon,
      match: [`${module.basePath}/requests`],
      section: module.label,
    },
  ]),
  ...settingsPages.map((item) => ({
    label: item.title,
    href: item.href,
    icon: item.icon,
    match: [item.href],
    section: item.section,
  })),
]

const defaultDockHrefs = [
  "/dashboard",
  "/month-end",
  "/quote-tool",
  "/information",
]

function subscribeToClientMount() {
  return () => {}
}

function isActivePath(pathname: string, matches: string[]) {
  return matches.some((match) =>
    match === "/" || match === "/dashboard" || match === "/month-end"
      ? pathname === match
      : pathname.startsWith(match)
  )
}

function normalizeDefaultDockHrefs(hrefs: string[]) {
  const remainingHrefs = hrefs.filter(
    (href) =>
      href !== "/dashboard" &&
      href !== "/month-end" &&
      href !== "/previous-month-ends"
  )

  return ["/dashboard", "/month-end", ...new Set(remainingHrefs)].slice(
    0,
    maxDockItems
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false)
  const viewportBaselineHeightRef = React.useRef(0)
  const [isMoreOpen, setIsMoreOpen] = React.useState(false)
  const [dockHrefs, setDockHrefs] = React.useState(defaultDockHrefs)
  const [isActiveIndicatorPressed, setIsActiveIndicatorPressed] =
    React.useState(false)
  const dockItems = dockHrefs
    .map((href) => allModuleItems.find((item) => item.href === href))
    .filter((item): item is (typeof allModuleItems)[number] => Boolean(item))
  const moreItems = allModuleItems.filter(
    (item) => !dockHrefs.includes(item.href)
  )
  const moreItemGroups = Array.from(
    moreItems.reduce((groups, item) => {
      const sectionItems = groups.get(item.section) ?? []
      sectionItems.push(item)
      groups.set(item.section, sectionItems)
      return groups
    }, new Map<string, typeof moreItems>())
  ).map(([label, items]) => ({ label, items }))
  const isMoreActive = moreItems.some((item) =>
    isActivePath(pathname, item.match)
  )
  const activeDockIndex = dockItems.findIndex((item) =>
    isActivePath(pathname, item.match)
  )
  const activeIndicatorIndex = activeDockIndex >= 0 ? activeDockIndex : 4
  const [displayedActiveIndicatorIndex, setDisplayedActiveIndicatorIndex] =
    React.useState(() => {
      if (typeof window === "undefined") {
        return activeIndicatorIndex
      }

      const shouldAnimateFromStoredIndex =
        readBrowserStorage(
          "sessionStorage",
          mobileNavActiveIndicatorPendingStorageKey
        ) === "true"
      const storedIndex = Number(
        readBrowserStorage("sessionStorage", mobileNavActiveIndicatorStorageKey)
      )

      return shouldAnimateFromStoredIndex &&
        Number.isInteger(storedIndex) &&
        storedIndex >= 0 &&
        storedIndex <= 4
        ? storedIndex
        : activeIndicatorIndex
    })
  const isMounted = React.useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false
  )
  const portalTarget = isMounted ? document.body : null

  React.useEffect(() => {
    const visualViewport = window.visualViewport

    function isEditableElement(element: Element | null) {
      return Boolean(
        element?.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]'
        )
      )
    }

    function syncKeyboardVisibility() {
      const viewportHeight = visualViewport?.height ?? window.innerHeight
      const hasEditableFocus = isEditableElement(document.activeElement)

      if (!hasEditableFocus) {
        viewportBaselineHeightRef.current = Math.max(
          viewportBaselineHeightRef.current,
          viewportHeight,
          window.innerHeight
        )
      } else if (!viewportBaselineHeightRef.current) {
        viewportBaselineHeightRef.current = Math.max(
          viewportHeight,
          window.innerHeight
        )
      }

      setIsKeyboardOpen(
        hasEditableFocus &&
          viewportBaselineHeightRef.current - viewportHeight > 120
      )
    }

    function syncAfterFocusChange() {
      window.setTimeout(syncKeyboardVisibility, 0)
    }

    syncKeyboardVisibility()
    window.addEventListener("resize", syncKeyboardVisibility)
    visualViewport?.addEventListener("resize", syncKeyboardVisibility)
    visualViewport?.addEventListener("scroll", syncKeyboardVisibility)
    document.addEventListener("focusin", syncAfterFocusChange)
    document.addEventListener("focusout", syncAfterFocusChange)

    return () => {
      window.removeEventListener("resize", syncKeyboardVisibility)
      visualViewport?.removeEventListener("resize", syncKeyboardVisibility)
      visualViewport?.removeEventListener("scroll", syncKeyboardVisibility)
      document.removeEventListener("focusin", syncAfterFocusChange)
      document.removeEventListener("focusout", syncAfterFocusChange)
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    async function loadDockLayout() {
      const storedDockHrefs = await getMobileNavDockHrefs(
        allModuleItems.map((item) => item.href),
        maxDockItems
      )

      if (isMounted && storedDockHrefs?.length) {
        const normalizedDockHrefs = normalizeDefaultDockHrefs(storedDockHrefs)

        setDockHrefs(normalizedDockHrefs)

        if (normalizedDockHrefs.join("|") !== storedDockHrefs.join("|")) {
          void saveMobileNavDockHrefs(normalizedDockHrefs).catch(() => {})
        }
      }
    }

    loadDockLayout()

    return () => {
      isMounted = false
    }
  }, [])

  React.useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setDisplayedActiveIndicatorIndex(activeIndicatorIndex)
      writeBrowserStorage(
        "sessionStorage",
        mobileNavActiveIndicatorStorageKey,
        String(activeIndicatorIndex)
      )
      removeBrowserStorage(
        "sessionStorage",
        mobileNavActiveIndicatorPendingStorageKey
      )
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [activeIndicatorIndex])

  function handleMoreOpenChange(open: boolean) {
    setIsMoreOpen(open)
  }

  function prepareActiveIndicatorTransition() {
    writeBrowserStorage(
      "sessionStorage",
      mobileNavActiveIndicatorStorageKey,
      String(displayedActiveIndicatorIndex)
    )
    writeBrowserStorage(
      "sessionStorage",
      mobileNavActiveIndicatorPendingStorageKey,
      "true"
    )
  }

  if (!portalTarget || isKeyboardOpen) {
    return null
  }

  return createPortal(
    <nav
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-5 pb-0 md:hidden"
      style={{ bottom: "1rem" }}
      aria-label="Mobile app navigation"
    >
      <div className="pointer-events-auto relative w-full max-w-[28rem] overflow-hidden rounded-full border border-white/50 bg-background/65 px-1.5 py-2 shadow-[0_14px_40px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(15,23,42,0.05)] backdrop-blur-2xl supports-backdrop-filter:bg-background/50">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.04))]" />
        <div className="relative z-10 grid grid-cols-5 items-center">
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 z-0 h-12 w-[calc(20%-0.25rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklch,var(--muted),var(--foreground)_12%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_18px_rgba(15,23,42,0.08)] transition-[left,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[left]",
              isActiveIndicatorPressed &&
                "bg-[color-mix(in_oklch,var(--muted),var(--foreground)_18%)]"
            )}
            style={{
              left: `calc(${displayedActiveIndicatorIndex * 20 + 10}%)`,
            }}
            aria-hidden="true"
          />
          {dockItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(pathname, item.match)

            return (
              <AppLink
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                onClick={prepareActiveIndicatorTransition}
                onPointerEnter={() => {
                  if (isActive) {
                    setIsActiveIndicatorPressed(true)
                  }
                }}
                onPointerLeave={() => setIsActiveIndicatorPressed(false)}
                onPointerDown={() => {
                  if (isActive) {
                    setIsActiveIndicatorPressed(true)
                  }
                }}
                onPointerUp={() => setIsActiveIndicatorPressed(false)}
                className={cn(
                  "relative z-10 mx-auto grid h-12 w-[calc(100%-0.25rem)] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_8%)] active:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_14%)] active:text-muted-foreground",
                  isActive &&
                    "bg-transparent text-foreground hover:bg-transparent active:bg-transparent active:text-foreground"
                )}
              >
                <Icon className="size-6 shrink-0" />
                <span className="sr-only">{item.label}</span>
              </AppLink>
            )
          })}

          <Sheet open={isMoreOpen} onOpenChange={handleMoreOpenChange}>
            <SheetTrigger
              className={cn(
                "relative z-10 mx-auto grid h-12 w-[calc(100%-0.25rem)] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_8%)] active:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_14%)] active:text-muted-foreground",
                isMoreActive &&
                  "bg-transparent text-foreground hover:bg-transparent active:bg-transparent active:text-foreground"
              )}
              onPointerEnter={() => {
                if (isMoreActive) {
                  setIsActiveIndicatorPressed(true)
                }
              }}
              onPointerLeave={() => setIsActiveIndicatorPressed(false)}
              onPointerDown={() => {
                if (isMoreActive) {
                  setIsActiveIndicatorPressed(true)
                }
              }}
              onPointerUp={() => setIsActiveIndicatorPressed(false)}
              aria-label="Open more navigation"
              title="More"
            >
              <MenuIcon className="size-6 shrink-0" />
              <span className="sr-only">More</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="h-[calc(100svh-0.75rem)] max-h-[calc(100svh-0.75rem)] overflow-hidden rounded-t-2xl px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <SheetHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                <SheetTitle>Menu</SheetTitle>
                <CloseButton
                  aria-label="Close menu"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-muted p-0 leading-none text-foreground hover:bg-muted/80 [&_[data-slot=close-button-icon]]:size-4"
                  onPress={() => setIsMoreOpen(false)}
                />
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
                <div className="grid gap-5">
                  {moreItemGroups.map((group) => (
                    <section key={group.label} className="grid gap-2">
                      <p className="px-1 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="overflow-hidden rounded-2xl border bg-card">
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const isActive = isActivePath(pathname, item.match)

                          return (
                            <SheetClose
                              key={item.href}
                              className="block w-full border-b last:border-b-0"
                              render={
                                <AppLink
                                  href={item.href}
                                  aria-current={isActive ? "page" : undefined}
                                  onClick={prepareActiveIndicatorTransition}
                                />
                              }
                            >
                              <span
                                className={cn(
                                  "flex min-h-14 items-center gap-3 px-4 text-left transition-colors active:bg-muted",
                                  isActive && "bg-muted"
                                )}
                              >
                                <Icon className="size-5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {item.label}
                                </span>
                                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                              </span>
                            </SheetClose>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>,
    portalTarget
  )
}
