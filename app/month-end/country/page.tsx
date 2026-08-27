import type { Metadata } from "next"

import { Suspense } from "react"

import { MonthEndCountryRouteView } from "@/components/month-end-country-route-view"
import { appTitle } from "@/lib/page-title"

export const metadata: Metadata = {
  title: appTitle,
}

export default function Page() {
  return (
    <Suspense>
      <MonthEndCountryRouteView />
    </Suspense>
  )
}
