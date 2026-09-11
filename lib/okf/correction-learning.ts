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
  basis?:
    | "document evidence"
    | "staff explanation"
    | "observed correction"
    | "reasoned inference"
  explanation?: string
  /** Why this result was chosen, including any relationship or calculation. */
  reasoning?: string
  /** A reusable instruction for reaching the result on a future shipment. */
  reproduction?: string
  /** True when the rule is a disclosed operational assumption, not a quoted fact. */
  assumption?: boolean
  /** Another certificate field whose current value matched this correction. */
  relatedTarget?: string
  relatedLabel?: string
  /** Number of independent requests supporting a promoted relationship. */
  occurrences?: number
  /** Short, evidence-backed explanation of what made the value easy to miss. */
  missedReason?: string
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
  const normalized = normalizeCorrectionLearning(learning)
  const summary = normalized.verified
    ? `Staff corrected ${normalized.label} for ${country}. The value was verified in ${normalized.documentType}, ${normalized.filename}${normalized.page ? `, page ${normalized.page}` : ""}.`
    : normalized.basis === "observed correction"
      ? `Staff corrected ${normalized.label} for ${country}. The change was recorded as an observation for comparison with future corrections.`
      : `Staff corrected ${normalized.label} for ${country}. The corrected value was not verified in the retained source documents.`
  return `${summary}\n${correctionLearningMarker}${JSON.stringify(normalized)}`
}

export function normalizeCorrectionLearning(
  learning: CorrectionSourceLearning
): CorrectionSourceLearning {
  const reason =
    learning.reasoning ||
    learning.explanation ||
    learning.supportingText ||
    (learning.verified
      ? `Staff verified ${learning.label} in ${learning.documentType}.`
      : "The source or decision rule has not been confirmed.")
  const reproduction =
    learning.reproduction ||
    (learning.basis === "reasoned inference"
      ? `${reason} Apply this only when the same relationship is present in the current shipment; otherwise ask for confirmation.`
      : learning.verified
        ? `Read ${learning.label} from ${learning.documentType}. Require matching evidence from the current shipment${learning.page ? "; the prior example was on page " + learning.page : ""}.`
        : learning.basis === "observed correction"
          ? "Retain this as one observation. Promote it only after the same field relationship is independently observed again."
          : "Retain this correction as an observation until its source or a repeated relationship can be established.")
  return {
    ...learning,
    reasoning: reason,
    reproduction,
    assumption: learning.assumption ?? false,
  }
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
    return normalizeCorrectionLearning(value as CorrectionSourceLearning)
  } catch {
    return null
  }
}

export function correctionLearningSummary(learning: CorrectionSourceLearning) {
  if (!learning.verified)
    return learning.basis === "observed correction"
      ? `Observed staff correction${learning.relatedLabel ? ` matching ${learning.relatedLabel}` : ""}; awaiting an independent repeat.`
      : "Corrected by staff; source not verified."
  if (learning.basis === "reasoned inference")
    return `Confirmed operational inference: ${learning.reasoning || learning.explanation || learning.supportingText}`
  if (learning.basis === "staff explanation")
    return `Staff confirmed ${learning.documentType} as the source: ${learning.explanation || learning.supportingText}`
  return `Verified in ${learning.documentType}${learning.page ? `, page ${learning.page}` : ""}: ${learning.supportingText || learning.matchedValue}`
}

export function correctionLearningFormat(learning: CorrectionSourceLearning) {
  const cleanSentence = (value: string) => {
    const text = value
      .trim()
      .replace(/^its\s+on\s+the\s+/i, "Check the ")
      .replace(/\s+Apply this only when.*$/i, "")
      .replace(/\s+/g, " ")
    if (!text) return ""
    const sentence = text[0].toLocaleUpperCase() + text.slice(1)
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
  }
  const appliesWhen = learning.relatedLabel
    ? `${learning.relatedLabel} is present and the same relationship applies.`
    : learning.basis === "document evidence" && learning.documentType
      ? `Reviewing ${learning.documentType} for this field.`
      : learning.basis === "staff explanation"
        ? `Applying the confirmed instruction for ${learning.label}.`
        : "A correction is made to this field."
  const instruction = learning.occurrences && learning.occurrences >= 2
    ? cleanSentence(learning.reproduction || learning.reasoning || "")
    : learning.verified
      ? learning.basis === "staff explanation"
        ? cleanSentence(
            learning.explanation || learning.reasoning || learning.supportingText
          )
        : cleanSentence(
            learning.reproduction ||
              learning.missedReason ||
              `Check ${learning.label} using the cited source.`
          )
    : "Review the uploaded documents again. Do not infer a rule until the reason is verified and repeated."
  const source = learning.filename
    ? `${learning.documentType}, ${learning.filename}${learning.page ? `, page ${learning.page}` : ""}`
    : learning.relatedLabel
      ? `Repeated staff corrections matching ${learning.relatedLabel}`
      : learning.basis === "staff explanation"
        ? "Staff-confirmed instruction"
      : "Correction audit; reason unverified"
  const status = learning.occurrences && learning.occurrences >= 2
    ? "Learned rule"
    : learning.basis === "staff explanation" && learning.verified
      ? "Verified note"
      : learning.verified
        ? "Evidence found"
      : "Unresolved"
  return {
    field: learning.label,
    appliesWhen,
    instruction,
    source,
    status,
  }
}

/** One current learning per country and destination field. Newer confirmations replace
 * the presentation of older ones; the correction audit remains append-only. */
export function correctionLearningKey(
  country: string,
  learning: Pick<CorrectionSourceLearning, "target">
) {
  return `${country.trim().toLocaleLowerCase()}:${normalizedCorrectionTarget(learning.target).toLocaleLowerCase()}`
}

export function correctionLearningInstruction(
  learning: Pick<
    CorrectionSourceLearning,
    | "label"
    | "documentType"
    | "basis"
    | "reasoning"
    | "explanation"
    | "reproduction"
  >
) {
  if (learning.basis === "reasoned inference")
    return (
      learning.reproduction ||
      `Apply this confirmed reasoning: ${learning.reasoning || learning.explanation}. Use only current-shipment values and ask when the relationship cannot be established with certainty.`
    )
  return `Look for an explicitly stated ${learning.label} in ${learning.documentType}. Staff previously verified this field in that document type. Return it only with current-document page evidence; never copy a prior value.`
}
