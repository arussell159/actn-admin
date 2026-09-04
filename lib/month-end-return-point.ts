"use client"

import type { MonthEndRecord } from "@/lib/month-end-db"
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

export type MonthEndReturnPoint = {
  period: string
  countryId?: string
  activeSection?: string
  countrySearchQuery?: string
  countryTableFilter?: string
  scrollY: number
}

const monthEndReturnPointKey = "month-end:return-point"
const monthEndReturnIntentKey = "month-end:return-intent"
let monthEndReturnRecord: MonthEndRecord | undefined

export function saveMonthEndReturnRecord(record: MonthEndRecord) {
  monthEndReturnRecord = record
}

export function readMonthEndReturnRecord(period?: string) {
  return !period || monthEndReturnRecord?.period === period
    ? monthEndReturnRecord
    : undefined
}

export function saveMonthEndReturnPoint(returnPoint: MonthEndReturnPoint) {
  if (typeof window === "undefined") {
    return
  }

  writeBrowserStorage(
    "sessionStorage",
    monthEndReturnPointKey,
    JSON.stringify(returnPoint)
  )
}

export function readMonthEndReturnPoint(
  period?: string
): MonthEndReturnPoint | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    const rawValue = readBrowserStorage(
      "sessionStorage",
      monthEndReturnPointKey
    )
    const parsed: unknown = rawValue ? JSON.parse(rawValue) : undefined

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "period" in parsed &&
      "scrollY" in parsed &&
      typeof parsed.period === "string" &&
      typeof parsed.scrollY === "number" &&
      (!period || parsed.period === period)
    ) {
      return {
        period: parsed.period,
        countryId:
          "countryId" in parsed && typeof parsed.countryId === "string"
            ? parsed.countryId
            : undefined,
        activeSection:
          "activeSection" in parsed && typeof parsed.activeSection === "string"
            ? parsed.activeSection
            : undefined,
        countrySearchQuery:
          "countrySearchQuery" in parsed &&
          typeof parsed.countrySearchQuery === "string"
            ? parsed.countrySearchQuery
            : undefined,
        countryTableFilter:
          "countryTableFilter" in parsed &&
          typeof parsed.countryTableFilter === "string"
            ? parsed.countryTableFilter
            : undefined,
        scrollY: parsed.scrollY,
      }
    }
  } catch {
    removeBrowserStorage("sessionStorage", monthEndReturnPointKey)
  }

  return undefined
}

export function markMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return
  }

  writeBrowserStorage("sessionStorage", monthEndReturnIntentKey, period ?? "")
}

export function consumeMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return false
  }

  const intentPeriod = readBrowserStorage(
    "sessionStorage",
    monthEndReturnIntentKey
  )

  if (intentPeriod === null) {
    return false
  }

  removeBrowserStorage("sessionStorage", monthEndReturnIntentKey)

  return !intentPeriod || !period || intentPeriod === period
}

export function hasMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return false
  }

  const intentPeriod = readBrowserStorage(
    "sessionStorage",
    monthEndReturnIntentKey
  )

  return (
    intentPeriod !== null &&
    (!intentPeriod || !period || intentPeriod === period)
  )
}
