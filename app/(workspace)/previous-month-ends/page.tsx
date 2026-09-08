import { Suspense } from "react"

import {
  AppRouteSkeleton,
  PreviousMonthEndsSkeleton,
} from "@/components/page-skeletons"
import { PreviousMonthEndsView } from "@/components/previous-month-ends-view"

export default function Page() {
  return (
    <Suspense
      fallback={
        <AppRouteSkeleton title="Previous Months">
          <PreviousMonthEndsSkeleton includeAction />
        </AppRouteSkeleton>
      }
    >
      <PreviousMonthEndsView />
    </Suspense>
  )
}
