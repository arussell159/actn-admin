import { Suspense } from "react"
import { CertificateLayoutSettings } from "@/components/certificate-layout-settings"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CertificateLayoutSettings />
    </Suspense>
  )
}
