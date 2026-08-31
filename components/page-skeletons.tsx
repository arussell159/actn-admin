import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

export function AppRouteSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-background md:p-2">
      <aside className="hidden w-72 shrink-0 rounded-xl bg-sidebar p-3 md:block">
        <Skeleton className="h-10 rounded-lg" />
        <div className="mt-5 grid gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-8 rounded-md"
              style={{ width: `${92 - (index % 3) * 14}%` }}
            />
          ))}
        </div>
      </aside>
      <main className="flex min-h-svh flex-1 flex-col md:min-h-[calc(100svh-1rem)]">
        <header className="flex h-12 shrink-0 items-center border-b px-4 lg:px-6">
          <Skeleton className="h-5 w-48 rounded-md" />
        </header>
        <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
          {children}
        </div>
      </main>
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

export function PreviousMonthEndsSkeleton() {
  return <SkeletonTable rows={7} columns={4} />
}

export function MonthEndDashboardSkeleton() {
  return (
    <>
      <section className="rounded-lg border bg-background p-3 md:hidden">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="h-3 w-14 rounded-md" />
              <Skeleton className="mt-2 h-6 w-12 rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-4 w-full rounded-md" />
      </section>
      <SkeletonStatGrid />
      <div className="flex items-center gap-3">
        <div className="-mx-4 min-w-0 flex-1 overflow-x-hidden px-4 md:mx-0 md:px-0">
          <div className="flex h-11 w-full max-w-md items-center gap-1 rounded-[1.375rem] bg-muted p-1">
            <Skeleton className="h-9 w-28 rounded-[1.05rem] bg-background" />
            <Skeleton className="h-9 w-24 rounded-[1.05rem]" />
            <Skeleton className="h-9 w-24 rounded-[1.05rem]" />
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>
      <SkeletonTable rows={10} columns={5} />
    </>
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
