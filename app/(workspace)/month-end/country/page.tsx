import type { Metadata } from "next"

import { Suspense } from "react"

import { MonthEndCountryRouteView } from "@/components/month-end-country-route-view"
import { CountryDashboardRouteSkeleton } from "@/components/page-skeletons"
import { formatPeriod } from "@/lib/month-end-db"
import { appTitle } from "@/lib/page-title"

export const metadata: Metadata = {
  title: appTitle,
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const query = await searchParams
  const countryId =
    typeof query.country === "string" ? query.country : undefined
  const period = typeof query.period === "string" ? query.period : undefined
  const requestedView = typeof query.view === "string" ? query.view : undefined
  const fallbackView =
    requestedView === "reconciliation"
      ? "reconciliation"
      : requestedView === "journal" || requestedView === "invoice"
        ? "journal"
        : requestedView === "dashboard"
          ? "dashboard"
          : undefined

  return (
    <Suspense
      fallback={
        countryId ? (
          <CountryDashboardRouteSkeleton
            countryId={countryId}
            periodTitle={period ? formatPeriod(period) : undefined}
            activeView={fallbackView}
          />
        ) : (
          <CountryDashboardRouteSkeleton activeView={fallbackView} />
        )
      }
    >
      <MonthEndCountryRouteView />
    </Suspense>
  )
}
