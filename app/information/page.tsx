import { Suspense } from "react"

import { InformationView } from "@/components/information-view"
import { AppRouteSkeleton, NotebookSkeleton } from "@/components/page-skeletons"

export default function Page() {
  return (
    <Suspense
      fallback={
        <AppRouteSkeleton>
          <NotebookSkeleton />
        </AppRouteSkeleton>
      }
    >
      <InformationView />
    </Suspense>
  )
}
