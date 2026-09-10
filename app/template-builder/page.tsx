import { TemplateEditorView } from "@/components/template-editor-view"
import { certificateLayoutsHref } from "@/lib/certificate-layout/routes"
import { redirect } from "next/navigation"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; country?: string }>
}) {
  const { tab, country } = await searchParams
  if (tab === "certificate-layouts") redirect(certificateLayoutsHref(country))
  return <TemplateEditorView />
}
