"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  EditIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { AppLink } from "@/components/app-link"
import { PreviousMonthEndsSkeleton } from "@/components/page-skeletons"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deleteMonthEndRecord,
  getMonthEndTitle,
  listMonthEndRecords,
  type MonthEndRecord,
} from "@/lib/month-end-db"

export function PreviousMonthEndsView() {
  const router = useRouter()
  const [records, setRecords] = React.useState<MonthEndRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [deleteError, setDeleteError] = React.useState("")

  React.useEffect(() => {
    let isMounted = true

    async function loadRecords() {
      setIsLoading(true)

      try {
        const monthEndRecords = await listMonthEndRecords()

        if (isMounted) {
          setRecords(
            monthEndRecords.filter((record) => record.status === "Closed")
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRecords()
    window.addEventListener("month-end:records-updated", loadRecords)

    return () => {
      isMounted = false
      window.removeEventListener("month-end:records-updated", loadRecords)
    }
  }, [])

  async function deleteRecord(period: string) {
    const previousRecords = records

    setRecords((current) =>
      current.filter((record) => record.period !== period)
    )
    setDeleteError("")

    try {
      await deleteMonthEndRecord(period)
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch {
      setRecords(previousRecords)
      setDeleteError("Could not delete that month-end record.")
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title="Previous Months" />
          <div className="grid gap-4 px-4 py-4 lg:px-6">
            <section className="flex justify-end">
              <Button
                className="w-fit"
                render={<AppLink href="/month-end/new" />}
              >
                <PlusIcon />
                New Month End
              </Button>
            </section>
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : null}
            {isLoading ? (
              <PreviousMonthEndsSkeleton />
            ) : records.length ? (
              <Table containerClassName="rounded-lg border bg-background">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((monthEnd) => (
                    <TableRow key={monthEnd.period}>
                      <TableCell className="font-medium">
                        <AppLink
                          href={`/previous-month-ends/view?period=${monthEnd.period}`}
                          className="block"
                        >
                          {getMonthEndTitle(monthEnd)}
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <AppLink
                          href={`/previous-month-ends/view?period=${monthEnd.period}`}
                          className="block"
                        >
                          {formatDateTime(monthEnd.completedAt)}
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <AppLink
                          href={`/previous-month-ends/view?period=${monthEnd.period}`}
                          className="block"
                        >
                          {formatDateTime(monthEnd.updatedAt)}
                        </AppLink>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${getMonthEndTitle(monthEnd)}`}
                              />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/previous-month-ends/view?period=${encodeURIComponent(monthEnd.period)}`
                                )
                              }
                            >
                              <EditIcon />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => deleteRecord(monthEnd.period)}
                            >
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle>No previous month ends yet</CardTitle>
                  <CardDescription>
                    Closed month-end records will appear here after you save
                    them.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Not completed"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not completed"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}
