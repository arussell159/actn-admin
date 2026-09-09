import { Suspense } from "react"

import { MadagascarBscView } from "@/components/madagascar-bsc-view"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MadagascarBscView section="requests" />
    </Suspense>
  )
}
