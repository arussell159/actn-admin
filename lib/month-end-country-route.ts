import {
  getCanonicalCountryId,
  getLinkedCountryIds,
} from "@/lib/month-end-master-records"
import type { TemplateCountryRow } from "@/lib/month-end-template"

export type MonthEndCountryView = "reconciliation" | "journal" | "dashboard"

const frabemarCountryId = "frabemar"
const frabemarChildCountryIds = [
  "frabemar-gabon",
  "frabemar-dr-congo",
  "frabemar-mali",
  "frabemar-republic-of-guinea",
]

function taskIsComplete(
  checked: Record<string, unknown> | undefined,
  countryId: string,
  taskId: string
) {
  return checked?.[`${countryId}__${taskId}`] === true
}

export function resolveMonthEndCountryView({
  countryId,
  row,
  checked,
  countries,
}: {
  countryId: string
  row?: TemplateCountryRow
  checked?: Record<string, unknown>
  countries?: TemplateCountryRow[]
}): MonthEndCountryView {
  const canonicalCountryId = getCanonicalCountryId(countryId, countries)
  const isFrabemarPackage = countryId === frabemarCountryId
  const isFrabemarChild = frabemarChildCountryIds.includes(countryId)
  const isJournalComplete =
    taskIsComplete(checked, countryId, "journal") ||
    taskIsComplete(checked, canonicalCountryId, "journal") ||
    ((isFrabemarPackage || isFrabemarChild) &&
      taskIsComplete(checked, frabemarCountryId, "journal"))
  const reconciliationCountryIds = isFrabemarPackage
    ? frabemarChildCountryIds
    : getLinkedCountryIds(canonicalCountryId, countries)
  const isReconciliationComplete =
    reconciliationCountryIds.length > 0 &&
    reconciliationCountryIds.every((linkedCountryId) =>
      taskIsComplete(checked, linkedCountryId, "reconcile")
    )

  if (isJournalComplete) {
    return "dashboard"
  }

  if (isFrabemarPackage || (row?.invoiceRequired && isReconciliationComplete)) {
    return "journal"
  }

  return isReconciliationComplete ? "dashboard" : "reconciliation"
}

export function monthEndCountryHref({
  period,
  countryId,
  row,
  checked,
  countries,
}: {
  period: string
  countryId: string
  row?: TemplateCountryRow
  checked?: Record<string, unknown>
  countries?: TemplateCountryRow[]
}) {
  const routedCountryId =
    countryId === frabemarCountryId
      ? countryId
      : getCanonicalCountryId(countryId, countries)
  const query = new URLSearchParams({
    period,
    country: routedCountryId,
    view: resolveMonthEndCountryView({
      countryId,
      row,
      checked,
      countries,
    }),
  })

  return `/month-end/country?${query.toString()}`
}
