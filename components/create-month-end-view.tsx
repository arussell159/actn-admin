"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PageFrame } from "@/components/page-frame"
import { NewMonthEndForm } from "@/components/new-month-end-form"
import { CreateMonthEndSkeleton } from "@/components/page-skeletons"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
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
    <PageFrame
      header={
        <SiteHeader
          title="New Month End"
          mobileLeadingContent={
            <SiteHeaderBackButton
              label="Back to month ends"
              href="/previous-month-ends"
            />
          }
        />
      }
    >
      <div className="grid gap-4 px-4 py-4 lg:px-6">
        {isLoading ? (
          <CreateMonthEndSkeleton />
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
    </PageFrame>
  )
}
