"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  BookOpenTextIcon,
  CalendarClockIcon,
  CalculatorIcon,
  GripIcon,
  HistoryIcon,
  MenuIcon,
  PlusIcon,
  Settings2Icon,
  UploadIcon,
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
import { Separator } from "@/components/ui/separator"
import {
  getMobileNavDockHrefs,
  saveMobileNavDockHrefs,
} from "@/lib/mobile-nav-settings"
import { cn } from "@/lib/utils"

const maxDockItems = 4

const allModuleItems = [
  {
    label: "Current Month",
    href: "/month-end",
    icon: CalendarClockIcon,
    match: ["/", "/month-end"],
  },
  {
    label: "Previous Months",
    href: "/previous-month-ends",
    icon: HistoryIcon,
    match: ["/previous-month-ends"],
  },
  {
    label: "Quote Tool",
    href: "/quote-tool",
    icon: CalculatorIcon,
    match: ["/quote-tool"],
  },
  {
    label: "Notebook",
    href: "/information",
    icon: BookOpenTextIcon,
    match: ["/information"],
  },
  {
    label: "Create Month End",
    href: "/month-end/new",
    icon: PlusIcon,
    match: ["/month-end/new"],
  },
  {
    label: "Pricing Upload",
    href: "/pricing-upload",
    icon: UploadIcon,
    match: ["/pricing-upload"],
  },
  {
    label: "Modules",
    href: "/template-builder",
    icon: Settings2Icon,
    match: ["/template-builder"],
  },
]

const defaultDockHrefs = [
  "/month-end",
  "/previous-month-ends",
  "/quote-tool",
  "/information",
]

type ModuleItem = (typeof allModuleItems)[number]

function isActivePath(pathname: string, matches: string[]) {
  return matches.some((match) =>
    match === "/" || match === "/month-end"
      ? pathname === match
      : pathname.startsWith(match)
  )
}

function SortableDockRow({
  item,
  onRemove,
}: {
  item: ModuleItem
  onRemove: (href: string) => void
}) {
  const Icon = item.icon
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl px-3 bg-background",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <button
        type="button"
        className="grid size-9 shrink-0 touch-none place-items-center rounded-full text-muted-foreground"
        aria-label={`Reorder ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon className="size-5" />
      </button>
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 font-medium">{item.label}</span>
      <button
        type="button"
        className="rounded-full px-3 py-1 text-sm font-medium text-primary"
        onClick={() => onRemove(item.href)}
      >
        More
      </button>
    </div>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const [isMoreOpen, setIsMoreOpen] = React.useState(false)
  const [dockHrefs, setDockHrefs] = React.useState(defaultDockHrefs)
  const [isCustomizing, setIsCustomizing] = React.useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const dockItems = dockHrefs
    .map((href) => allModuleItems.find((item) => item.href === href))
    .filter((item): item is (typeof allModuleItems)[number] => Boolean(item))
  const moreItems = allModuleItems.filter(
    (item) => !dockHrefs.includes(item.href)
  )
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href))
  const activeDockIndex = dockItems.findIndex((item) =>
    isActivePath(pathname, item.match)
  )
  const activeIndicatorIndex = activeDockIndex >= 0 ? activeDockIndex : 4

  React.useEffect(() => {
    let isMounted = true

    async function loadDockLayout() {
      const storedDockHrefs = await getMobileNavDockHrefs(
        allModuleItems.map((item) => item.href),
        maxDockItems
      )

      if (isMounted && storedDockHrefs?.length) {
        setDockHrefs(storedDockHrefs)
      }
    }

    loadDockLayout()

    return () => {
      isMounted = false
    }
  }, [])

  function handleMoreOpenChange(open: boolean) {
    setIsMoreOpen(open)

    if (open) {
      setIsCustomizing(false)
    }
  }

  function updateDock(nextDockHrefs: string[]) {
    const cleanDockHrefs = nextDockHrefs
      .filter((href) => allModuleItems.some((item) => item.href === href))
      .slice(0, maxDockItems)

    setDockHrefs(cleanDockHrefs)
    saveMobileNavDockHrefs(cleanDockHrefs)
  }

  function toggleDockItem(href: string) {
    if (dockHrefs.includes(href)) {
      updateDock(dockHrefs.filter((itemHref) => itemHref !== href))
      return
    }

    updateDock([...dockHrefs, href])
  }

  function handleDockDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = dockHrefs.indexOf(String(active.id))
    const newIndex = dockHrefs.indexOf(String(over.id))

    if (oldIndex >= 0 && newIndex >= 0) {
      updateDock(arrayMove(dockHrefs, oldIndex, newIndex))
    }
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-40 flex justify-center px-5 md:hidden"
      aria-label="Mobile app navigation"
    >
      <div className="pointer-events-auto relative w-full max-w-[26rem] overflow-hidden rounded-full border border-white/50 bg-background/65 px-4 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(15,23,42,0.05)] backdrop-blur-2xl supports-backdrop-filter:bg-background/50">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.04))]" />
        <span
          className="absolute top-1/2 z-0 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_18px_rgba(15,23,42,0.08)] transition-[left] duration-300 ease-out"
          style={{ left: `calc(${activeIndicatorIndex * 20 + 10}%)` }}
          aria-hidden="true"
        />
        <div className="relative z-10 grid grid-cols-5 items-center">
        {dockItems.map((item) => {
          const Icon = item.icon
          const isActive = isActivePath(pathname, item.match)

          return (
            <AppLink
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={cn(
                "mx-auto grid size-10 place-items-center rounded-full text-muted-foreground transition-colors active:text-foreground",
                isActive && "text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="sr-only">{item.label}</span>
            </AppLink>
          )
        })}

        <Sheet open={isMoreOpen} onOpenChange={handleMoreOpenChange}>
          <SheetTrigger
            className={cn(
              "mx-auto grid size-10 place-items-center rounded-full text-muted-foreground transition-colors active:text-foreground",
              isMoreActive && "text-foreground"
            )}
            aria-label="Open more navigation"
            title="More"
          >
            <MenuIcon className="size-5 shrink-0" />
            <span className="sr-only">More</span>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className={cn(
              "overflow-hidden px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]",
              isCustomizing
                ? "inset-0 h-svh max-h-none rounded-none"
                : "max-h-[82svh] rounded-t-2xl"
            )}
          >
            <SheetHeader className="grid grid-cols-[1fr_auto_1fr] items-center px-5 pt-5 pb-2">
              <SheetClose className="justify-self-start text-sm font-medium">
                Close
              </SheetClose>
              <SheetTitle className="text-center">
                {isCustomizing ? "Customize" : "More Modules"}
              </SheetTitle>
              <button
                type="button"
                className="justify-self-end text-sm font-medium text-primary disabled:text-muted-foreground"
                onClick={() => setIsCustomizing((current) => !current)}
              >
                {isCustomizing ? "Done" : "Customize"}
              </button>
            </SheetHeader>
            {isCustomizing ? (
              <div className="grid max-h-[calc(100svh-5rem)] gap-6 overflow-auto px-5 pt-4 pb-8">
                <section className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Dock</h2>
                    <span className="text-sm text-muted-foreground">
                      {dockHrefs.length}/{maxDockItems}
                    </span>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDockDragEnd}
                  >
                    <SortableContext
                      items={dockHrefs}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="overflow-hidden rounded-xl border bg-background">
                        {dockItems.map((item, index) => (
                          <React.Fragment key={item.href}>
                            {index > 0 ? <Separator /> : null}
                            <SortableDockRow
                              item={item}
                              onRemove={toggleDockItem}
                            />
                          </React.Fragment>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </section>

                <section className="grid gap-2">
                  <h2 className="font-semibold">More</h2>
                  <div className="overflow-hidden rounded-xl border bg-background">
                    {moreItems.map((item, index) => {
                  const Icon = item.icon
                      const canAddToDock = dockHrefs.length < maxDockItems

                  return (
                    <React.Fragment key={item.href}>
                      {index > 0 ? <Separator /> : null}
                      <div className="flex min-h-14 items-center gap-3 rounded-xl px-3">
                        <Icon className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 font-medium">
                          {item.label}
                        </span>
                        <button
                          type="button"
                              className="rounded-full px-3 py-1 text-sm font-medium text-primary disabled:text-muted-foreground"
                          disabled={!canAddToDock}
                          onClick={() => toggleDockItem(item.href)}
                        >
                              Dock
                        </button>
                      </div>
                    </React.Fragment>
                  )
                })}
                  </div>
                </section>
              </div>
            ) : (
              <div className="max-h-[62svh] overflow-auto px-3">
                {moreItems.map((item, index) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.href)

                  return (
                    <React.Fragment key={item.href}>
                      {index > 0 ? <Separator /> : null}
                      <SheetClose
                        render={<AppLink href={item.href} />}
                      >
                        <span
                          className={cn(
                            "flex min-h-14 items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-muted",
                            isActive && "bg-muted"
                          )}
                        >
                          <Icon className="size-5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 font-medium">
                            {item.label}
                          </span>
                        </span>
                      </SheetClose>
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </nav>
  )
}
