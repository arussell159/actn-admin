export function normalizeExchangeRateText(value: string) {
  return value.trim().replace(",", ".")
}

export function isExchangeRateDraft(value: string) {
  return /^\d*(?:[.,]\d{0,6})?$/.test(value)
}

export function parseExchangeRate(value: string) {
  const normalizedValue = normalizeExchangeRateText(value)

  if (!/^\d+(?:\.\d{1,6})?$/.test(normalizedValue)) {
    return undefined
  }

  const exchangeRate = Number(normalizedValue)

  return Number.isFinite(exchangeRate) && exchangeRate > 0
    ? exchangeRate
    : undefined
}

export function formatExchangeRate(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
    useGrouping: false,
  })
}
