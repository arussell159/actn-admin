type ReconciliationAnalysis = {
  originalFilename: string
  uncertainFields: string[]
  missingFields: string[]
  possibleConflicts: Array<{ fieldId: string }>
  fields: Array<{
    id: string
    value: string | null
    confidence: number
    sourcePage: number | null
    supportingText: string | null
  }>
}

type ReconciliationMapping = {
  sourceFieldId: string
  systemFieldId: string
  repeated: boolean
}

export function selectReconciliationCandidate<
  T extends {
    value: string
    status: string
    evidence: Array<{ document: string }>
  },
>(
  candidates: T[],
  resolved: { value: string | null; source: { filename: string } | null }
): T | undefined {
  // JSON arbitration can select between independently confirmed sources, but
  // cannot turn an uncertain or conflicting source into confirmed evidence.
  return candidates.find(
    (field) =>
      field.status === "passed" &&
      field.value === resolved.value &&
      (!resolved.source ||
        field.evidence.some(
          (evidence) => evidence.document === resolved.source?.filename
        ))
  )
}

// Agreement needs no model arbitration. Compare the same trimmed values used
// by form mapping; preserve interior whitespace, formatting, units and dates.
export function documentReconciliationRequired(
  analyses: ReconciliationAnalysis[],
  mappings: ReconciliationMapping[],
  confidenceThreshold: number
) {
  if (analyses.some((analysis) => analysis.possibleConflicts.length))
    return true
  const candidates = new Map<
    string,
    Array<{ filename: string; value: string; reliable: boolean }>
  >()
  for (const mapping of mappings) {
    if (mapping.repeated) continue
    for (const analysis of analyses) {
      for (const field of analysis.fields) {
        if (field.id !== mapping.sourceFieldId || !field.value?.trim()) continue
        const values = candidates.get(mapping.systemFieldId) ?? []
        values.push({
          filename: analysis.originalFilename,
          value: field.value.trim(),
          reliable: Boolean(
            field.confidence >= confidenceThreshold &&
            field.sourcePage &&
            field.supportingText?.trim() &&
            !analysis.uncertainFields.includes(field.id) &&
            !analysis.missingFields.includes(field.id)
          ),
        })
        candidates.set(mapping.systemFieldId, values)
      }
    }
  }
  return [...candidates.values()].some(
    (values) =>
      new Set(values.map((candidate) => candidate.filename)).size > 1 &&
      (new Set(values.map((candidate) => candidate.value)).size > 1 ||
        values.some((candidate) => !candidate.reliable))
  )
}
