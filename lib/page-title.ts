export const appTitle = "ACTN Admin"

export function formatMonthEndPageTitle(period?: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return appTitle
  }

  const [year, month] = period.split("-").map(Number)
  const date = new Date(year, month - 1, 1)

  if (Number.isNaN(date.getTime())) {
    return appTitle
  }

  const periodTitle = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date)

  return `${periodTitle} - ${appTitle}`
}
