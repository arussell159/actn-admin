export const correctionLearningMarker = "[OKF_SOURCE_V1]"

export type CorrectionSourceLearning = {
  version: 1
  target: string
  label: string
  verified: boolean
  documentType: string
  filename: string
  page: number | null
  supportingText: string
  matchedValue: string
  confidence: number
  basis?: "document evidence" | "staff explanation"
  explanation?: string
}

export type VisibleCorrectionLearning = CorrectionSourceLearning & {
  country: string
  createdAt: string
}

export function normalizedCorrectionTarget(target: string) {
  if (target.startsWith("invoiceValue:")) return "invoiceValues"
  if (target.startsWith("invoiceItem:")) {
    const key = target.split(":")[2]
    return key ? `invoiceItems.${key}` : target
  }
  return target
}

export function correctionLearningReason(
  country: string,
  learning: CorrectionSourceLearning
) {
  const summary = learning.verified
    ? `Staff corrected ${learning.label} for ${country}. The value was verified in ${learning.documentType}, ${learning.filename}${learning.page ? `, page ${learning.page}` : ""}.`
    : `Staff corrected ${learning.label} for ${country}. The corrected value was not verified in the retained source documents.`
  return `${summary}\n${correctionLearningMarker}${JSON.stringify(learning)}`
}

export function parseCorrectionLearning(
  reason: unknown
): CorrectionSourceLearning | null {
  if (typeof reason !== "string") return null
  const markerIndex = reason.lastIndexOf(correctionLearningMarker)
  if (markerIndex < 0) return null
  try {
    const value = JSON.parse(
      reason.slice(markerIndex + correctionLearningMarker.length)
    ) as Partial<CorrectionSourceLearning>
    if (
      value.version !== 1 ||
      typeof value.target !== "string" ||
      typeof value.label !== "string" ||
      typeof value.verified !== "boolean" ||
      typeof value.documentType !== "string" ||
      typeof value.filename !== "string" ||
      !(value.page === null || typeof value.page === "number") ||
      typeof value.supportingText !== "string" ||
      typeof value.matchedValue !== "string" ||
      typeof value.confidence !== "number"
    )
      return null
    return value as CorrectionSourceLearning
  } catch {
    return null
  }
}

export function correctionLearningSummary(learning: CorrectionSourceLearning) {
  if (!learning.verified) return "Corrected by staff; source not verified."
  if (learning.basis === "staff explanation")
    return `Staff confirmed ${learning.documentType} as the source: ${learning.explanation || learning.supportingText}`
  return `Verified in ${learning.documentType}${learning.page ? `, page ${learning.page}` : ""}: ${learning.supportingText || learning.matchedValue}`
}
