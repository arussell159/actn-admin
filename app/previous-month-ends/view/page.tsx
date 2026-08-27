import { Suspense } from "react"

import { MonthEndPeriodView } from "@/components/month-end-period-view"

export default function Page() {
  return (
    <Suspense>
      <MonthEndPeriodView />
    </Suspense>
  )
}
