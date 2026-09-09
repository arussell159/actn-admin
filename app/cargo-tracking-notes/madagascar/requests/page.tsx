import { redirect } from "next/navigation"

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>
}) {
  const { id } = (await searchParams) ?? {}
  const suffix = id ? `?id=${encodeURIComponent(id)}` : ""
  redirect(`/cargo-tracking-notes/requests${suffix}`)
}
