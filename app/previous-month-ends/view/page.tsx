import type { Metadata } from "next"

import { Suspense } from "react"

import { MonthEndPeriodView } from "@/components/month-end-period-view"
import {
  AppRouteSkeleton,
  MonthEndDashboardSkeleton,
} from "@/components/page-skeletons"
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

export default function Page() {
  return (
    <Suspense
      fallback={
        <AppRouteSkeleton>
          <MonthEndDashboardSkeleton />
        </AppRouteSkeleton>
      }
    >
      <MonthEndPeriodView />
    </Suspense>
  )
}
