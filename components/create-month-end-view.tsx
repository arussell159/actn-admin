"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { NewMonthEndForm } from "@/components/new-month-end-form"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listMonthEndRecords, type MonthEndRecord } from "@/lib/month-end-db"

export function CreateMonthEndView() {
  const router = useRouter()
  const [records, setRecords] = React.useState<MonthEndRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    async function loadRecords() {
      try {
        const monthEndRecords = await listMonthEndRecords()

        if (isMounted) {
          setRecords(monthEndRecords)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRecords()

    return () => {
      isMounted = false
    }
  }, [])

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
          <SiteHeader title="Create Month End" />
          <div className="grid gap-4 px-4 py-4 lg:px-6">
            <section>
              <h1 className="text-2xl font-semibold">Create Month End</h1>
            </section>
            {isLoading ? (
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle>Loading month ends</CardTitle>
                  <CardDescription>Checking existing records.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <NewMonthEndForm
                existingRecords={records}
                onCancel={() => router.push("/previous-month-ends")}
                onCreated={(record) =>
                  router.push(
                    `/month-end?period=${encodeURIComponent(record.period)}`
                  )
                }
              />
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
