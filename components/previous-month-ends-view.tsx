"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { PageFrame } from "@/components/page-frame"
import { AppLink } from "@/components/app-link"
import { PreviousMonthEndsSkeleton } from "@/components/page-skeletons"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  loadMonthEndRecords,
  listMonthEndRecords,
  type MonthEndRecord,
} from "@/lib/month-end-db"

function MonthEndActions({
  monthEnd,
  confirmDeletePeriod,
  setConfirmDeletePeriod,
  onView,
  onDelete,
}: {
  monthEnd: MonthEndRecord
  confirmDeletePeriod: string
  setConfirmDeletePeriod: React.Dispatch<React.SetStateAction<string>>
  onView: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setConfirmDeletePeriod("")
      }}
    >
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
        <DropdownMenuItem onClick={onView}>
          <FileTextIcon />
          View
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {confirmDeletePeriod === monthEnd.period ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            Confirm Delete
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            onClick={() => setConfirmDeletePeriod(monthEnd.period)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PreviousMonthEndsView() {
  const router = useRouter()
  const [records, setRecords] = React.useState<MonthEndRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [deleteError, setDeleteError] = React.useState("")
  const [confirmDeletePeriod, setConfirmDeletePeriod] = React.useState("")

  React.useEffect(() => {
    let isMounted = true

    async function loadRecords() {
      setIsLoading(true)

      const cachedRecords = loadMonthEndRecords()
      if (cachedRecords.length && isMounted) {
        setRecords(cachedRecords)
        setIsLoading(false)
      }

      try {
        const monthEndRecords = await listMonthEndRecords()

        if (isMounted) {
          setRecords(monthEndRecords)
        }
      } catch {
        if (isMounted) {
          setDeleteError(
            "Could not load month ends. Check your connection and try again."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadRecords()
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
      setConfirmDeletePeriod("")
      window.dispatchEvent(new Event("month-end:records-updated"))
    } catch {
      setRecords(previousRecords)
      setDeleteError("Could not delete that month-end record.")
    }
  }

  return (
    <PageFrame header={<SiteHeader title="Month End" />}>
      <div className="grid gap-4 px-4 pt-4 pb-24 md:pb-4 lg:px-6">
        <section className="flex justify-end">
          <Button
            className="w-fit"
            size="lg"
            render={<AppLink href="/month-end/new" />}
            nativeButton={false}
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
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {records.map((monthEnd) => {
                const href = monthEndRecordHref(monthEnd)
                return (
                  <Card
                    key={monthEnd.period}
                    className="gap-0 py-0 shadow-none"
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
                      <AppLink href={href} className="min-w-0 font-semibold">
                        {getMonthEndTitle(monthEnd)}
                      </AppLink>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge
                          variant={
                            monthEnd.status === "Open" ? "default" : "secondary"
                          }
                        >
                          {monthEnd.status}
                        </Badge>
                        <MonthEndActions
                          monthEnd={monthEnd}
                          confirmDeletePeriod={confirmDeletePeriod}
                          setConfirmDeletePeriod={setConfirmDeletePeriod}
                          onView={() => router.push(href)}
                          onDelete={() => void deleteRecord(monthEnd.period)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 border-t px-4 py-3 text-sm">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
                        <div className="text-muted-foreground">Completed</div>
                        <div className="text-right break-words">
                          {formatDateTime(monthEnd.completedAt)}
                        </div>
                      </div>
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
                        <div className="text-muted-foreground">Updated</div>
                        <div className="text-right break-words">
                          {formatDateTime(monthEnd.updatedAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {!records.length ? (
                <Card className="py-10 text-center text-muted-foreground shadow-none">
                  No month ends yet.
                </Card>
              ) : null}
            </div>
            <Table containerClassName="hidden rounded-lg border bg-background md:block">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion Date</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((monthEnd) => {
                  const href = monthEndRecordHref(monthEnd)
                  return (
                    <TableRow key={monthEnd.period}>
                      <TableCell className="font-medium">
                        <AppLink href={href} className="block">
                          {getMonthEndTitle(monthEnd)}
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <AppLink href={href} className="block">
                          <Badge
                            variant={
                              monthEnd.status === "Open"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {monthEnd.status}
                          </Badge>
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <AppLink href={href} className="block">
                          {formatDateTime(monthEnd.completedAt)}
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <AppLink href={href} className="block">
                          {formatDateTime(monthEnd.updatedAt)}
                        </AppLink>
                      </TableCell>
                      <TableCell className="text-right">
                        <MonthEndActions
                          monthEnd={monthEnd}
                          confirmDeletePeriod={confirmDeletePeriod}
                          setConfirmDeletePeriod={setConfirmDeletePeriod}
                          onView={() => router.push(href)}
                          onDelete={() => void deleteRecord(monthEnd.period)}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!records.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No month ends yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </PageFrame>
  )
}

function monthEndRecordHref(record: MonthEndRecord) {
  const period = encodeURIComponent(record.period)
  return record.status === "Open"
    ? `/month-end?period=${period}`
    : `/previous-month-ends/view?period=${period}`
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
