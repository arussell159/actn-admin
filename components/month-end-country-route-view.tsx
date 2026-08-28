"use client"

import { useSearchParams } from "next/navigation"

import { MonthEndCountryReconciliationView } from "@/components/month-end-country-reconciliation-view"

export function MonthEndCountryRouteView() {
  const searchParams = useSearchParams()
  const period = searchParams.get("period") ?? undefined
  const countryId = searchParams.get("country") ?? undefined
  const requestedView = searchParams.get("view")
  const view =
    requestedView === "dashboard" ||
    requestedView === "reconciliation" ||
    requestedView === "journal"
      ? requestedView
      : "auto"

  return (
    <MonthEndCountryReconciliationView
      period={period}
      countryId={countryId}
      view={view}
    />
  )
}
