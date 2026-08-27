import { Suspense } from "react"

import { InformationView } from "@/components/information-view"

export default function Page() {
  return (
    <Suspense>
      <InformationView />
    </Suspense>
  )
}
