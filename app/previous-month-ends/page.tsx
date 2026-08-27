import { Suspense } from "react"

import { PreviousMonthEndsView } from "@/components/previous-month-ends-view"

export default function Page() {
  return (
    <Suspense>
      <PreviousMonthEndsView />
    </Suspense>
  )
}
