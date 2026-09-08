import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SiteHeader } from "@/components/site-header"

export function AppRouteSkeleton({
  children,
  title,
  actions,
  tabs,
  activeTab,
}: {
  children: ReactNode
  title?: ReactNode
  actions?: ReactNode
  tabs?: string[]
  activeTab?: string
}) {
  return (
    <main className="app-page bg-background" aria-busy="true">
      {title || actions || tabs?.length ? (
        <SiteHeader
          titleContent={title}
          actions={actions}
          bottomContent={
            tabs?.length ? (
              <div className="flex gap-6">
                {tabs.map((tab) => (
                  <span
                    key={tab}
                    className={
                      tab === activeTab
                        ? "font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {tab}
                  </span>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
        {children}
      </div>
    </main>
  )
}

export function SkeletonActionButton({ label }: { label: string }) {
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
      <Skeleton className="size-4 rounded-sm bg-primary-foreground/30" />
      <span>{label}</span>
    </div>
  )
}

export function CountryDashboardRouteSkeleton({
  countryId,
  periodTitle,
  activeView,
}: {
  countryId?: string
  periodTitle?: string
  activeView?: "reconciliation" | "journal" | "dashboard"
}) {
  const countryName = countryId
    ?.split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
  const title =
    countryName && periodTitle
      ? countryName + " - " + periodTitle
      : countryName || "Country Records"
  return (
    <AppRouteSkeleton
      title={title}
      tabs={["Reconciliation", "Journal Entry", "Dashboard"]}
    >
      {activeView === "dashboard" ? (
        <CountryDashboardBodySkeleton />
      ) : activeView === "journal" ? (
        <CountryJournalBodySkeleton />
      ) : (
        <CountryReconciliationBodySkeleton />
      )}
    </AppRouteSkeleton>
  )
}

function CountryDashboardBodySkeleton() {
  return (
    <div className="grid min-h-0 gap-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full rounded-lg md:w-64" />
          <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-1">
            <Skeleton className="h-7 w-24 rounded-md bg-background" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </section>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        <MatchedDashboardTableSkeleton />
      </div>
    </div>
  )
}

function MatchedDashboardTableSkeleton() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="grid min-w-[48rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem] border-b px-2 text-xs font-medium md:min-w-0">
        <div className="h-10 py-3">Country</div>
        <div className="h-10 py-3">NetSuite</div>
        <div className="h-10 py-3">Matched By</div>
        <div className="h-10 py-3 text-right">Amounts</div>
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[48rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem] border-b px-2 py-2 text-xs md:min-w-0"
        >
          <div className="grid min-h-10 content-start gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <div className="grid min-h-10 content-start gap-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <div className="grid min-h-10 content-start gap-2">
            <Skeleton className="h-4 w-8 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
          <div className="grid min-h-10 justify-items-end gap-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CountryReconciliationBodySkeleton() {
  return (
    <div className="grid min-h-0 items-stretch gap-4 lg:grid-cols-2">
      {["Country Records", "NetSuite Records"].map((title) => (
        <section
          key={title}
          className="grid min-h-[28rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <Skeleton className="h-6 w-36 rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
          <div className="-mx-3 overflow-hidden border-y">
            <SkeletonTable rows={6} columns={5} />
          </div>
          <div className="-mx-3 -mb-3 flex h-12 items-center justify-between border-t bg-muted/50 px-4 text-xs font-medium">
            <span>{title}</span>
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </section>
      ))}
    </div>
  )
}

export function CountryJournalBodySkeleton() {
  return (
    <div className="grid flex-1 place-items-start md:place-items-center">
      <section className="w-full max-w-3xl overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div>
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="mt-2 h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid gap-3 rounded-lg border bg-background px-4 py-3">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <SkeletonTable rows={7} columns={4} />
        </div>
      </section>
    </div>
  )
}

function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <section className="hidden gap-4 md:grid md:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-background p-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="mt-4 h-8 w-16 rounded-md" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
        </div>
      ))}
    </section>
  )
}

function SkeletonTable({
  rows = 8,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid gap-3 border-b p-4 md:grid-cols-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 rounded-md" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid items-center gap-3 p-4 md:grid-cols-4"
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className="h-4 rounded-md"
                style={{
                  width:
                    columnIndex === columns - 1
                      ? "55%"
                      : columnIndex === 0
                        ? "80%"
                        : "70%",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CreateMonthEndSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background">
        <div className="border-b p-6">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-md" />
        </div>
        <div className="grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-12 rounded-md" />
              <Skeleton className="h-9 rounded-md" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-10 rounded-md" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          </div>
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed bg-background p-6">
            <div className="grid justify-items-center gap-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-72 max-w-full rounded-md" />
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function PreviousMonthEndsSkeleton({
  includeAction = false,
}: {
  includeAction?: boolean
} = {}) {
  return (
    <>
      {includeAction ? (
        <section className="flex justify-end">
          <SkeletonActionButton label="New Month End" />
        </section>
      ) : null}
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-[minmax(0,1fr)_12rem_12rem_3rem] border-b px-2 text-sm font-medium">
          <div className="h-10 py-3">Name</div>
          <div className="h-10 py-3">Completion Date</div>
          <div className="h-10 py-3">Last Updated</div>
          <div className="h-10 py-3" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 7 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[minmax(0,1fr)_12rem_12rem_3rem] items-center gap-3 px-2 py-3"
            >
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="ml-auto size-7 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function CompactCreateMonthEndSkeleton() {
  return (
    <div className="grid max-w-3xl gap-4">
      <div className="rounded-lg border bg-background p-5">
        <Skeleton className="h-5 w-44 rounded-md" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full rounded-md" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
        <Skeleton className="mt-4 h-10 w-36 rounded-md" />
      </div>
    </div>
  )
}

export function MonthEndDashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <Skeleton className="mt-4 h-7 w-20 rounded-md" />
            {index === 0 ? (
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-background p-5">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="mt-6 h-[280px] w-full rounded-md" />
          </div>
        ))}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b p-5">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-md" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 p-4 sm:px-5"
              >
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-10 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-background p-5">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="mt-5 h-28 w-full rounded-md" />
          <div className="mt-3 flex justify-between gap-3">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <div className="mt-5 border-t pt-4">
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
      </section>
    </div>
  )
}

export function CountryReconciliationSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="grid min-h-9 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
      <SkeletonStatGrid count={3} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonTable rows={8} columns={5} />
        <SkeletonTable rows={8} columns={5} />
      </div>
    </div>
  )
}

export function NotebookSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 gap-0 p-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r p-5 lg:flex">
        <div className="mb-3 flex justify-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="size-8 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-md" />
        <div className="mt-5 grid gap-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-7 rounded-md"
              style={{
                width: `${88 - (index % 3) * 12}%`,
                marginLeft: index % 4 === 0 ? "0" : "1rem",
              }}
            />
          ))}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col p-4 sm:p-5">
        <Skeleton className="h-9 w-2/3 rounded-md" />
        <div className="mt-8 grid gap-3">
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-11/12 rounded-md" />
          <Skeleton className="h-5 w-4/5 rounded-md" />
          <Skeleton className="mt-4 h-5 w-10/12 rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>
      </section>
    </div>
  )
}

export function LoginSkeleton() {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex flex-1 items-start justify-center pt-[16svh] sm:items-center sm:pt-0">
          <div className="w-full max-w-xs">
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="mt-3 h-4 w-56 rounded-md" />
            <div className="mt-6 grid gap-3">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
            </div>
          </div>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-muted lg:block">
        <Skeleton className="h-full min-h-dvh rounded-none" />
      </section>
    </main>
  )
}
