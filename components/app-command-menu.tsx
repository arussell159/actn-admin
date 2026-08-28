"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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

export const openAppCommandMenuEvent = "app-command-menu:open"

export function AppCommandMenu() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "p" || (!event.ctrlKey && !event.metaKey)) {
        return
      }

      const mql = window.matchMedia("(min-width: 768px)")

      if (!mql.matches) {
        return
      }

      event.preventDefault()
      setOpen((currentOpen) => !currentOpen)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  React.useEffect(() => {
    function handleOpenCommandMenu() {
      setOpen(true)
    }

    window.addEventListener(openAppCommandMenuEvent, handleOpenCommandMenu)

    return () =>
      window.removeEventListener(openAppCommandMenuEvent, handleOpenCommandMenu)
  }, [])

  function goToPage(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Command menu">
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {appCommandPages.map((page) => {
            const Icon = page.icon

            return (
              <CommandItem
                key={page.href}
                value={`${page.title} ${page.section}`}
                keywords={page.keywords}
                onSelect={() => goToPage(page.href)}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{page.title}</span>
                <CommandShortcut>{page.section}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
