import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginPage } from "@/components/login-page"
import { appTitle } from "@/lib/page-title"

export const metadata: Metadata = {
  title: appTitle,
}

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
