"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FileTextIcon,
  FolderIcon,
  type LucideIcon,
  MapPinnedIcon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { appCommandPages } from "@/lib/app-routes"
import {
  getInformationNotes,
  informationUpdatedEvent,
} from "@/lib/information-notes"
import { getMonthEndTitle, listMonthEndRecords } from "@/lib/month-end-db"
import { getMonthEndTemplate } from "@/lib/month-end-template"

export const openAppCommandMenuEvent = "app-command-menu:open"

type AppCommandItem = {
  id: string
  title: string
  href: string
  section: string
  keywords: string[]
  icon: LucideIcon
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function commandItemScore(item: AppCommandItem, query: string) {
  if (!query) {
    return 1
  }

  const title = item.title.toLowerCase()
  const section = item.section.toLowerCase()
  const keywords = item.keywords.map((keyword) => keyword.toLowerCase())

  if (title === query) {
    return 100
  }

  if (title.startsWith(query)) {
    return 90
  }

  if (title.includes(query)) {
    return 80
  }

  if (keywords.some((keyword) => keyword === query)) {
    return 70
  }

  if (keywords.some((keyword) => keyword.startsWith(query))) {
    return 60
  }

  if (keywords.some((keyword) => keyword.includes(query))) {
    return 50
  }

  if (section.includes(query)) {
    return 40
  }

  return 0
}

function filterCommandItems(items: AppCommandItem[], query: string) {
  if (!query) {
    return items
  }

  return items
    .map((item) => ({ item, score: commandItemScore(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score
      }

      return first.item.title.localeCompare(second.item.title)
    })
    .map(({ item }) => item)
}

export function AppCommandMenu() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [commandSearch, setCommandSearch] = React.useState("")
  const [notebookItems, setNotebookItems] = React.useState<AppCommandItem[]>([])
  const [monthEndCountryItems, setMonthEndCountryItems] = React.useState<
    AppCommandItem[]
  >([])
  const pageItems = React.useMemo(
    () =>
      appCommandPages.map((page) => ({
        id: `page-${page.href}`,
        ...page,
      })),
    []
  )
  const normalizedCommandSearch = normalizeSearch(commandSearch)
  const visibleNotebookItems = filterCommandItems(
    notebookItems,
    normalizedCommandSearch
  )
  const visibleMonthEndCountryItems = filterCommandItems(
    monthEndCountryItems,
    normalizedCommandSearch
  )
  const visiblePageItems = filterCommandItems(
    pageItems,
    normalizedCommandSearch
  )
  const hasVisibleResults =
    visibleNotebookItems.length > 0 ||
    visibleMonthEndCountryItems.length > 0 ||
    visiblePageItems.length > 0

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }

      const key = event.key.toLowerCase()
      const mql = window.matchMedia("(min-width: 768px)")

      if (!mql.matches) {
        return
      }

      if (key === "p") {
        event.preventDefault()
        setOpen((currentOpen) => !currentOpen)
        return
      }

      if (key === "q") {
        event.preventDefault()
        setOpen(false)
        router.push("/quote-tool")
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  React.useEffect(() => {
    function handleOpenCommandMenu() {
      setOpen(true)
    }

    window.addEventListener(openAppCommandMenuEvent, handleOpenCommandMenu)

    return () =>
      window.removeEventListener(openAppCommandMenuEvent, handleOpenCommandMenu)
  }, [])

  React.useEffect(() => {
    let isMounted = true

    async function syncNotebookItems() {
      const notes = await getInformationNotes()

      if (!isMounted) {
        return
      }

      setNotebookItems(
        notes
          .slice()
          .sort((first, second) => first.title.localeCompare(second.title))
          .map((node) => ({
            id: `notebook-${node.id}`,
            title: node.title,
            href: `/information?node=${encodeURIComponent(node.id)}`,
            section: node.type === "folder" ? "Folder" : "Note",
            keywords: [node.type, "notebook", "information", "notes"],
            icon: node.type === "folder" ? FolderIcon : FileTextIcon,
          }))
      )
    }

    syncNotebookItems()
    window.addEventListener(informationUpdatedEvent, syncNotebookItems)
    window.addEventListener("information-notes:navigation", syncNotebookItems)

    return () => {
      isMounted = false
      window.removeEventListener(informationUpdatedEvent, syncNotebookItems)
      window.removeEventListener(
        "information-notes:navigation",
        syncNotebookItems
      )
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    async function syncMonthEndCountryItems() {
      try {
        const [records, template] = await Promise.all([
          listMonthEndRecords(),
          getMonthEndTemplate(),
        ])
        const openRecord = records.find((record) => record.status === "Open")

        if (!isMounted) {
          return
        }

        if (!openRecord) {
          setMonthEndCountryItems([])
          return
        }

        setMonthEndCountryItems(
          template.countries
            .filter((country) => country.checkable !== false)
            .map((country) => ({
              id: `month-end-country-${country.id}`,
              title: country.name,
              href: `/month-end/country?period=${encodeURIComponent(
                openRecord.period
              )}&country=${encodeURIComponent(country.id)}`,
              section: getMonthEndTitle(openRecord),
              keywords: [
                "month end",
                "current month",
                "country",
                openRecord.period,
                country.name,
              ],
              icon: MapPinnedIcon,
            }))
        )
      } catch {
        if (isMounted) {
          setMonthEndCountryItems([])
        }
      }
    }

    syncMonthEndCountryItems()
    window.addEventListener("month-end:records-updated", syncMonthEndCountryItems)
    window.addEventListener(
      "month-end:template-updated",
      syncMonthEndCountryItems
    )

    return () => {
      isMounted = false
      window.removeEventListener(
        "month-end:records-updated",
        syncMonthEndCountryItems
      )
      window.removeEventListener(
        "month-end:template-updated",
        syncMonthEndCountryItems
      )
    }
  }, [])

  function goToPage(href: string) {
    setOpen(false)
    setCommandSearch("")
    router.push(href)
  }

  function renderCommandItem(item: AppCommandItem) {
    const Icon = item.icon

    return (
      <CommandItem
        key={item.id}
        value={item.title}
        keywords={item.keywords}
        onSelect={() => goToPage(item.href)}
      >
        <Icon className="size-4 text-muted-foreground" />
        <span>{item.title}</span>
        <CommandShortcut>{item.section}</CommandShortcut>
      </CommandItem>
    )
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      shouldFilter={false}
    >
      <CommandInput
        value={commandSearch}
        onValueChange={setCommandSearch}
        placeholder="Search pages, notes, folders, countries..."
      />
      <CommandList>
        {!hasVisibleResults ? <CommandEmpty>No results found.</CommandEmpty> : null}
        {visibleNotebookItems.length ? (
          <CommandGroup heading="Notebook">
            {visibleNotebookItems.map(renderCommandItem)}
          </CommandGroup>
        ) : null}
        {visibleMonthEndCountryItems.length ? (
          <CommandGroup heading="Current Month End">
            {visibleMonthEndCountryItems.map(renderCommandItem)}
          </CommandGroup>
        ) : null}
        {visiblePageItems.length ? (
          <CommandGroup heading="Pages">
            {visiblePageItems.map(renderCommandItem)}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
