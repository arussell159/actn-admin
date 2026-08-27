"use client"

import { useSearchParams } from "next/navigation"

import MonthEndView from "@/components/month-end-view"

export function MonthEndPeriodView() {
  const searchParams = useSearchParams()
  const period = searchParams.get("period") ?? undefined

  return <MonthEndView period={period} />
}
