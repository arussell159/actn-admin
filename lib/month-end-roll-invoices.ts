const rollApprovalSuffix = "__approved_country_rolls"

export function rollApprovalKey(rowId: string) {
  return `${rowId}${rollApprovalSuffix}`
}

export function parseApprovedInternalIds(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  } catch {}

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function serializeApprovedInternalIds(internalIds: string[]) {
  return JSON.stringify(
    Array.from(new Set(internalIds.map((item) => item.trim()).filter(Boolean)))
  )
}

export function listApprovedInternalIds(checked: Record<string, unknown>) {
  return Array.from(
    new Set(
      Object.entries(checked)
        .filter(([key]) => key.endsWith(rollApprovalSuffix))
        .flatMap(([, value]) => parseApprovedInternalIds(value))
    )
  )
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function createRollInvoicesCsv(internalIds: string[]) {
  const rows = Array.from(
    new Set(internalIds.map((item) => item.trim()).filter(Boolean))
  )

  return ["Internal ID", ...rows.map(escapeCsvValue)].join("\r\n")
}
