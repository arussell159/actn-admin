import type { Metadata } from "next"

import { Suspense } from "react"

import { MonthEndPeriodView } from "@/components/month-end-period-view"
import {
  AppRouteSkeleton,
  MonthEndDashboardSkeleton,
  SkeletonActionButton,
} from "@/components/page-skeletons"
import { formatPeriod } from "@/lib/month-end-db"
import { formatMonthEndPageTitle } from "@/lib/page-title"

type Props = {
  searchParams: Promise<{ period?: string | string[] }>
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { period } = await searchParams
  const cleanPeriod = Array.isArray(period) ? period[0] : period

  return {
    title: formatMonthEndPageTitle(cleanPeriod),
  }
}

export default async function Page({ searchParams }: Props) {
  const { period } = await searchParams
  const cleanPeriod = Array.isArray(period) ? period[0] : period
  const title = cleanPeriod ? formatPeriod(cleanPeriod) : "Dashboard"

  return (
    <Suspense
      fallback={
        <AppRouteSkeleton
          title={title}
          actions={<SkeletonActionButton label="Closed" />}
          tabs={["Dashboard", "Countries", "Tasks"]}
          activeTab="Dashboard"
        >
          <MonthEndDashboardSkeleton />
        </AppRouteSkeleton>
      }
    >
      <MonthEndPeriodView />
    </Suspense>
  )
}
