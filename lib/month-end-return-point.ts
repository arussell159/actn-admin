"use client"

export type MonthEndReturnPoint = {
  period: string
  countryId?: string
  activeSection?: string
  scrollY: number
}

const monthEndReturnPointKey = "month-end:return-point"
const monthEndReturnIntentKey = "month-end:return-intent"

export function saveMonthEndReturnPoint(returnPoint: MonthEndReturnPoint) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(
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
    const rawValue = window.sessionStorage.getItem(monthEndReturnPointKey)
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
        scrollY: parsed.scrollY,
      }
    }
  } catch {
    window.sessionStorage.removeItem(monthEndReturnPointKey)
  }

  return undefined
}

export function markMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(monthEndReturnIntentKey, period ?? "")
}

export function consumeMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return false
  }

  const intentPeriod = window.sessionStorage.getItem(monthEndReturnIntentKey)

  if (intentPeriod === null) {
    return false
  }

  window.sessionStorage.removeItem(monthEndReturnIntentKey)

  return !intentPeriod || !period || intentPeriod === period
}

export function hasMonthEndReturnIntent(period?: string) {
  if (typeof window === "undefined") {
    return false
  }

  const intentPeriod = window.sessionStorage.getItem(monthEndReturnIntentKey)

  return intentPeriod !== null && (!intentPeriod || !period || intentPeriod === period)
}
