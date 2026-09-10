import { Suspense } from "react"
import { InformationView } from "@/components/information-view"
import { redirect } from "next/navigation"
import { certificateLayoutsHref } from "@/lib/certificate-layout/routes"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  if (page?.startsWith("layout-"))
    redirect(certificateLayoutsHref(page.slice("layout-".length)))
  return (
    <Suspense fallback={null}>
      <InformationView scope="knowledge-base" />
    </Suspense>
  )
}
